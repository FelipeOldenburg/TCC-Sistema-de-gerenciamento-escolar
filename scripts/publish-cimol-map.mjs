import "dotenv/config";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { createDbPool } from "../server/db.js";

const prefix = "CIMOL · ";
const categories = new Set(["AMBIENTE", "CIRCULACAO", "ESCADA", "ACESSO", "PATIO"]);
const obsoleteFloorNames = [
  "Bloco C · Ala principal · 2º pavimento",
  "Bloco D · 2º pavimento",
  "Acessos de C2 e D2",
].map((name) => `${prefix}${name}`);
const normalized = (value) => String(value).normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase().replace(/\s+/g, " ");
const uniqueMatch = (rows, name) => {
  const matches = rows.filter((row) => normalized(row.nome) === normalized(name));
  return matches.length === 1 ? matches[0] : null;
};

export const publicationOptions = (args) => {
  const { values } = parseArgs({ args, options: {
    slug: { type: "string", default: "cimol" },
    apply: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
  } });
  if (values.slug !== "cimol") throw new Error("Este mapa só pode ser publicado no slug exato cimol.");
  if (values.apply && values["dry-run"]) throw new Error("Use --apply ou --dry-run, nunca ambos.");
  return { slug: values.slug, apply: values.apply };
};

export const validateMapViews = (views) => {
  if (!Array.isArray(views) || !views.length) throw new Error("O mapa precisa de vistas.");
  const keys = new Set(views.map((view) => view.key));
  const names = new Set(views.map((view) => view.nome));
  if (keys.size !== views.length || names.size !== views.length) throw new Error("Vistas com chaves ou nomes repetidos.");
  for (const view of views) {
    if (!view.key || !view.nome?.trim() || `${prefix}${view.nome}`.length > 120 ||
        !Number.isInteger(view.largura) || view.largura <= 0 || !Number.isInteger(view.altura) || view.altura <= 0 ||
        (view.piso?.length || 0) > 80 || (view.descricao?.length || 0) > 2000 || !Array.isArray(view.areas)) {
      throw new Error(`Vista inválida: ${view.key}.`);
    }
    const areaKeys = new Set();
    const areaNames = new Set();
    for (const area of view.areas) {
      if (!area.key || areaKeys.has(area.key) || !area.nome?.trim() || area.nome.length > 120 || areaNames.has(area.nome)) {
        throw new Error(`Áreas precisam de chaves e nomes únicos: ${view.key}.`);
      }
      areaKeys.add(area.key);
      areaNames.add(area.nome);
      if (!area.caminho_svg || area.caminho_svg.length > 8000 ||
          !/^[MmLlHhVvCcSsQqTtAaZz0-9.,+\-\seE]+$/.test(area.caminho_svg) ||
          !categories.has(area.categoria || "AMBIENTE") || (area.descricao?.length || 0) > 2000 ||
          (area.destino_key && !keys.has(area.destino_key))) {
        throw new Error(`Geometria ou destino inválido: ${view.key}/${area.key}.`);
      }
      const x = area.rotulo_x ?? null;
      const y = area.rotulo_y ?? null;
      if ((x === null) !== (y === null) || (x !== null &&
          (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > view.largura || y < 0 || y > view.altura))) {
        throw new Error(`Rótulo fora da vista: ${view.key}/${area.key}.`);
      }
    }
  }
};

export const publishCimolMap = async (db, { views, slug = "cimol", apply = false }) => {
  if (slug !== "cimol") throw new Error("Este mapa só pode ser publicado no slug exato cimol.");
  validateMapViews(views);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    if (!apply) await conn.query("SET TRANSACTION READ ONLY");
    const [institutions] = await conn.query(
      `SELECT id FROM instituicoes WHERE slug = ? AND ativo = TRUE${apply ? " FOR UPDATE" : ""}`, [slug]
    );
    if (institutions.length !== 1) throw new Error("Instituição CIMOL ativa não encontrada.");
    const institutionId = institutions[0].id;
    const [blocks] = await conn.query("SELECT id, nome FROM blocos WHERE instituicao_id = ?", [institutionId]);
    const [rooms] = await conn.query(
      "SELECT id, nome, bloco_id FROM salas WHERE instituicao_id = ? AND status = 'ATIVA'", [institutionId]
    );
    const [sectors] = await conn.query("SELECT id, nome FROM setores WHERE instituicao_id = ? AND ativo = TRUE", [institutionId]);
    const mapNames = views.map((view) => `${prefix}${view.nome}`);
    const placeholders = mapNames.map(() => "?").join(", ");
    const [existingMaps] = await conn.query(
      `SELECT id, nome FROM mapas WHERE instituicao_id = ? AND nome IN (${placeholders})`, [institutionId, ...mapNames]
    );
    const [existingAreas] = await conn.query(
      `SELECT a.id, a.mapa_id, a.nome, a.editado_cpd, a.excluido_cpd FROM mapa_areas a
       JOIN mapas m ON m.id = a.mapa_id AND m.instituicao_id = a.instituicao_id
       WHERE a.instituicao_id = ? AND m.nome IN (${placeholders})`, [institutionId, ...mapNames]
    );
    const report = { slug, mode: apply ? "apply" : "dry-run", maps: views.length, areas: 0,
      createdMaps: 0, updatedMaps: 0, createdAreas: 0, updatedAreas: 0, preservedAreas: 0, removedAreas: 0,
      unmatched: { blocos: [], salas: [], setores: [] } };
    const missing = (kind, view, area, name) => report.unmatched[kind].push({ vista: view.key, area: area?.key || null, nome: name });
    const plans = views.map((view) => {
      const block = view.bloco_nome ? uniqueMatch(blocks, view.bloco_nome) : null;
      if (view.bloco_nome && !block) missing("blocos", view, null, view.bloco_nome);
      const existingMap = existingMaps.find((map) => map.nome === `${prefix}${view.nome}`);
      report[existingMap ? "updatedMaps" : "createdMaps"]++;
      const priorAreas = existingAreas.filter((area) => area.mapa_id === existingMap?.id);
      if (new Set(priorAreas.map((area) => area.nome)).size !== priorAreas.length) {
        throw new Error(`O mapa reservado tem áreas com nomes repetidos: ${view.key}.`);
      }
      report.preservedAreas += priorAreas.filter((area) => area.editado_cpd || area.excluido_cpd).length;
      const areas = view.areas.map((area) => {
        const areaBlock = area.bloco_nome ? uniqueMatch(blocks, area.bloco_nome) : block;
        if (area.bloco_nome && !areaBlock) missing("blocos", view, area, area.bloco_nome);
        const room = area.sala_nome && areaBlock ? uniqueMatch(
          rooms.filter((candidate) => candidate.bloco_id === areaBlock.id).map((candidate) =>
            ({ ...candidate, nome: candidate.nome.replace(/\s+/g, "") })), area.sala_nome.replace(/\s+/g, "")
        ) : null;
        const sector = area.setor_nome ? uniqueMatch(sectors, area.setor_nome) : null;
        if (area.sala_nome && !room) missing("salas", view, area, area.sala_nome);
        if (area.setor_nome && !sector) missing("setores", view, area, area.setor_nome);
        const tipo = area.sala_nome ? (room ? "SALA" : "OUTRO")
          : area.setor_nome ? (sector ? "SETOR" : "OUTRO") : area.bloco_nome && areaBlock ? "BLOCO" : "OUTRO";
        const prior = priorAreas.find((candidate) => candidate.nome === area.nome);
        if (!prior) report.createdAreas++;
        else if (!prior.editado_cpd && !prior.excluido_cpd) report.updatedAreas++;
        report.areas++;
        return { ...area, id: prior?.id, protectedByCpd: prior?.editado_cpd || prior?.excluido_cpd, tipo, bloco_id: tipo === "BLOCO" ? areaBlock.id : null,
          sala_id: tipo === "SALA" ? room.id : null, setor_id: tipo === "SALA" || tipo === "SETOR" ? sector?.id || null : null };
      });
      const removed = priorAreas.filter((prior) => !prior.editado_cpd && !prior.excluido_cpd &&
        !areas.some((area) => area.nome === prior.nome));
      report.removedAreas += removed.length;
      return { ...view, id: existingMap?.id, bloco_id: block?.id || null, areas, removed };
    });
    if (apply) {
      const mapIds = new Map();
      for (const view of plans) {
        const [result] = await conn.query(
          `INSERT INTO mapas (instituicao_id, nome, piso, largura, altura, ativo, bloco_id, visao_geral, descricao)
           VALUES (?, ?, ?, ?, ?, TRUE, ?, ?, ?)
           ON CONFLICT (instituicao_id, nome) DO UPDATE SET piso = EXCLUDED.piso, largura = EXCLUDED.largura,
             altura = EXCLUDED.altura, ativo = TRUE, bloco_id = EXCLUDED.bloco_id,
             visao_geral = EXCLUDED.visao_geral, descricao = EXCLUDED.descricao, updated_at = CURRENT_TIMESTAMP
           RETURNING id`,
          [institutionId, `${prefix}${view.nome}`, view.piso || null, view.largura, view.altura,
            view.bloco_id, Boolean(view.visao_geral), view.descricao || null]
        );
        view.id = result.insertId;
        mapIds.set(view.key, view.id);
      }
      for (const view of plans) {
        for (const area of view.areas) {
          const values = [area.tipo, area.nome, area.caminho_svg, area.bloco_id, area.sala_id, area.setor_id,
            area.rotulo_x ?? null, area.rotulo_y ?? null, area.categoria || "AMBIENTE", area.descricao || null,
            area.destino_key ? mapIds.get(area.destino_key) : null];
          if (area.protectedByCpd) continue;
          if (area.id) {
            await conn.query(
              `UPDATE mapa_areas SET tipo = ?, nome = ?, caminho_svg = ?, bloco_id = ?, sala_id = ?, setor_id = ?,
                 rotulo_x = ?, rotulo_y = ?, categoria = ?, descricao = ?, destino_mapa_id = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ? AND mapa_id = ? AND instituicao_id = ?`, [...values, area.id, view.id, institutionId]
            );
          } else {
            await conn.query(
              `INSERT INTO mapa_areas (tipo, nome, caminho_svg, bloco_id, sala_id, setor_id,
                 rotulo_x, rotulo_y, categoria, descricao, destino_mapa_id, mapa_id, instituicao_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [...values, view.id, institutionId]
            );
          }
        }
        for (const area of view.removed) {
          await conn.query("DELETE FROM mapa_areas WHERE id = ? AND mapa_id = ? AND instituicao_id = ?", [area.id, view.id, institutionId]);
        }
      }
      const retiredNames = obsoleteFloorNames.filter((name) => !mapNames.includes(name));
      if (retiredNames.length) await conn.query(
        `UPDATE mapas SET ativo = FALSE, updated_at = CURRENT_TIMESTAMP
         WHERE instituicao_id = ? AND nome IN (${retiredNames.map(() => "?").join(", ")}) AND ativo = TRUE`,
        [institutionId, ...retiredNames]
      );
    }
    await conn.commit();
    return report;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let db;
  try {
    const options = publicationOptions(process.argv.slice(2));
    const { cimolMapViews } = await import("../server/data/cimolMap.js");
    db = createDbPool();
    console.log(JSON.stringify(await publishCimolMap(db, { ...options, views: cimolMapViews }), null, 2));
  } catch {
    console.error("Publicação não concluída. Use --slug cimol e --dry-run ou --apply; confira db:migrate e a configuração do banco.");
    process.exitCode = 1;
  } finally {
    await db?.end();
  }
}
