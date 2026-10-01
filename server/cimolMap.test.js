import assert from "node:assert/strict";
import { publicationOptions, publishCimolMap, validateMapViews } from "../scripts/publish-cimol-map.mjs";

const sampleViews = [
  { key: "main", nome: "C · 2º pavimento", bloco_nome: "Bloco C", piso: "2º pavimento", largura: 300, altura: 200,
    areas: [
      { key: "room", nome: "C201", sala_nome: "C 201", setor_nome: "Laboratórios", caminho_svg: "M0 0 H40 V40 Z" },
      { key: "missing", nome: "C299", sala_nome: "C299", setor_nome: "Laboratórios", caminho_svg: "M50 0 H90 V40 Z" },
      { key: "sector", nome: "Laboratórios", setor_nome: "Laboratórios", caminho_svg: "M100 0 H140 V40 Z" },
      { key: "stairs", nome: "Escada própria", categoria: "ESCADA", destino_key: "side", caminho_svg: "M0 50 H40 V90 Z" },
    ] },
  { key: "side", nome: "C · 2º pavimento lateral", bloco_nome: "Bloco C", piso: "2º pavimento", largura: 100, altura: 100,
    areas: [{ key: "unregistered", nome: "Sala lateral", caminho_svg: "M0 0 H40 V40 Z" }] },
];

assert.deepEqual(publicationOptions([]), { slug: "cimol", apply: false });
assert.equal(publicationOptions(["--apply"]).apply, true);
assert.throws(() => publicationOptions(["--slug", "CIMOL"]), /slug exato/);
assert.throws(() => publicationOptions(["--slug", "outra"]), /slug exato/);
assert.throws(() => publicationOptions(["--apply", "--dry-run"]), /nunca ambos/);
validateMapViews(sampleViews);
const invalidDestination = structuredClone(sampleViews);
invalidDestination[0].areas[3].destino_key = "missing";
assert.throws(() => validateMapViews(invalidDestination), /destino inválido/);
const repeatedArea = structuredClone(sampleViews);
repeatedArea[0].areas[1].nome = "C201";
assert.throws(() => validateMapViews(repeatedArea), /nomes únicos/);

// In-memory SQL spy: checks transaction/scoping and retained IDs without a live database.
const state = {
  maps: [
    { id: 700, instituicao_id: 2, nome: "CIMOL · C · 2º pavimento" },
    { id: 710, instituicao_id: 1, nome: "Mapa personalizado" },
    { id: 720, instituicao_id: 1, nome: "CIMOL · Bloco C · Ala principal · 2º pavimento", ativo: true },
    { id: 721, instituicao_id: 1, nome: "CIMOL · Bloco D · 2º pavimento", ativo: true },
    { id: 722, instituicao_id: 1, nome: "CIMOL · Acessos de C2 e D2", ativo: true },
    { id: 723, instituicao_id: 2, nome: "CIMOL · Bloco D · 2º pavimento", ativo: true },
  ],
  areas: [{ id: 800, instituicao_id: 2, mapa_id: 700, nome: "C201" }, { id: 810, instituicao_id: 1, mapa_id: 710, nome: "Área personalizada" }],
};
const protectedRows = structuredClone(state);
const events = [];
let nextId = 1000;
let snapshot;
let readOnly = false;
let failArea = false;
let connections = 0;
const db = { getConnection: async () => {
  connections++;
  return {
    beginTransaction: async () => { snapshot = structuredClone(state); readOnly = false; events.push("begin"); },
    commit: async () => events.push("commit"),
    rollback: async () => { Object.assign(state, snapshot); events.push("rollback"); },
    release: () => events.push("release"),
    query: async (query, params = []) => {
      const sql = query.replace(/\s+/g, " ").trim();
      if (sql === "SET TRANSACTION READ ONLY") { readOnly = true; return [{}]; }
      if (sql.startsWith("SELECT id FROM instituicoes")) {
        assert.deepEqual(params, ["cimol"]);
        return [[{ id: 1 }]];
      }
      if (sql.startsWith("SELECT id, nome FROM blocos")) {
        assert.deepEqual(params, [1]);
        assert.match(sql, /WHERE instituicao_id = \?/);
        return [[{ id: 101, nome: "Bloco C" }]];
      }
      if (sql.startsWith("SELECT id, nome, bloco_id FROM salas")) {
        assert.deepEqual(params, [1]);
        assert.match(sql, /WHERE instituicao_id = \?/);
        return [[{ id: 301, nome: "C201", bloco_id: 101 }]];
      }
      if (sql.startsWith("SELECT id, nome FROM setores")) {
        assert.deepEqual(params, [1]);
        assert.match(sql, /WHERE instituicao_id = \?/);
        return [[{ id: 501, nome: "Laboratórios" }]];
      }
      if (sql.startsWith("SELECT id, nome FROM mapas")) {
        assert.match(sql, /WHERE instituicao_id = \?/);
        return [state.maps.filter((map) => map.instituicao_id === params[0] && params.slice(1).includes(map.nome))];
      }
      if (sql.startsWith("SELECT a.id, a.mapa_id, a.nome")) {
        assert.match(sql, /m.instituicao_id = a.instituicao_id/);
        assert.match(sql, /WHERE a.instituicao_id = \?/);
        return [state.areas.filter((area) => area.instituicao_id === params[0] && state.maps.some((map) =>
          map.id === area.mapa_id && map.instituicao_id === area.instituicao_id && params.slice(1).includes(map.nome)))];
      }
      assert.equal(readOnly, false, "dry-run must not write");
      if (sql.startsWith("UPDATE mapas SET ativo = FALSE")) {
        assert.match(sql, /WHERE instituicao_id = \? AND nome IN/);
        const retired = state.maps.filter((map) => map.instituicao_id === params[0] && params.slice(1).includes(map.nome) && map.ativo);
        retired.forEach((map) => { map.ativo = false; });
        return [{ affectedRows: retired.length }];
      }
      if (sql.startsWith("INSERT INTO mapas")) {
        assert.match(sql, /ON CONFLICT \(instituicao_id, nome\)/);
        assert.equal(params[0], 1);
        let map = state.maps.find((row) => row.instituicao_id === params[0] && row.nome === params[1]);
        if (!map) { map = { id: nextId++ }; state.maps.push(map); }
        Object.assign(map, { instituicao_id: params[0], nome: params[1] });
        return [{ insertId: map.id }];
      }
      if (sql.startsWith("INSERT INTO mapa_areas") || sql.startsWith("UPDATE mapa_areas")) {
        if (failArea) throw new Error("Falha simulada após gravar as vistas.");
        const update = sql.startsWith("UPDATE");
        const institutionId = params[update ? 13 : 12];
        const mapId = params[update ? 12 : 11];
        assert.equal(institutionId, 1);
        assert.ok(state.maps.some((map) => map.id === mapId && map.instituicao_id === institutionId));
        const area = update ? state.areas.find((row) => row.id === params[11] && row.mapa_id === mapId && row.instituicao_id === institutionId)
          : { id: nextId++, instituicao_id: institutionId, mapa_id: mapId };
        assert.ok(area);
        if (!update) state.areas.push(area);
        else assert.match(sql, /WHERE id = \? AND mapa_id = \? AND instituicao_id = \?/);
        Object.assign(area, { tipo: params[0], nome: params[1], bloco_id: params[3], sala_id: params[4], setor_id: params[5], destino_mapa_id: params[10] });
        return [{ insertId: area.id }];
      }
      if (sql.startsWith("DELETE FROM mapa_areas")) {
        assert.match(sql, /WHERE id = \? AND mapa_id = \? AND instituicao_id = \?/);
        state.areas = state.areas.filter((area) => !(area.id === params[0] && area.mapa_id === params[1] && area.instituicao_id === params[2]));
        return [{}];
      }
      assert.fail(`Unexpected query: ${sql}`);
    },
  };
} };

await assert.rejects(publishCimolMap(db, { views: sampleViews, slug: "outra" }), /slug exato/);
assert.equal(connections, 0);
const preview = await publishCimolMap(db, { views: sampleViews });
assert.equal(preview.mode, "dry-run");
assert.equal(preview.createdMaps, 2);
assert.deepEqual(state, protectedRows);
assert.deepEqual(events.slice(-3), ["begin", "commit", "release"]);

const first = await publishCimolMap(db, { views: sampleViews, apply: true });
assert.equal(first.createdMaps, 2);
assert.equal(first.createdAreas, 5);
assert.ok(state.maps.filter((map) => [720, 721, 722].includes(map.id)).every((map) => map.ativo === false));
assert.equal(state.maps.find((map) => map.id === 723).ativo, true);
assert.deepEqual(first.unmatched.salas, [{ vista: "main", area: "missing", nome: "C299" }]);
const roomArea = state.areas.find((area) => area.mapa_id !== 700 && area.nome === "C201");
assert.equal(roomArea.tipo, "SALA");
assert.equal(roomArea.sala_id, 301);
assert.equal(roomArea.setor_id, 501);
assert.equal(state.areas.find((area) => area.nome === "C299").tipo, "OUTRO");
assert.equal(state.areas.find((area) => area.nome === "C299").setor_id, null);
assert.equal(state.areas.find((area) => area.nome === "Escada própria").destino_mapa_id,
  state.maps.find((map) => map.nome.endsWith("lateral")).id);
const firstIds = { maps: state.maps.map((map) => map.id), areas: state.areas.map((area) => area.id) };
const second = await publishCimolMap(db, { views: sampleViews, apply: true });
assert.equal(second.createdMaps, 0);
assert.equal(second.createdAreas, 0);
assert.deepEqual({ maps: state.maps.map((map) => map.id), areas: state.areas.map((area) => area.id) }, firstIds);
assert.deepEqual(state.maps.filter((map) => [700, 710, 723].includes(map.id)),
  protectedRows.maps.filter((map) => [700, 710, 723].includes(map.id)));
assert.deepEqual(state.areas.filter((area) => area.id === 800 || area.id === 810), protectedRows.areas);

const beforeFailure = structuredClone(state);
failArea = true;
const failureViews = [...sampleViews, { key: "new", nome: "Vista nova", largura: 100, altura: 100, areas: [] }];
await assert.rejects(publishCimolMap(db, { views: failureViews, apply: true }), /Falha simulada/);
assert.deepEqual(state, beforeFailure);
assert.deepEqual(events.slice(-3), ["begin", "rollback", "release"]);

const { cimolMapViews } = await import("./data/cimolMap.js");
validateMapViews(cimolMapViews);
const sharedFloor = cimolMapViews.find((view) => view.key === "acesso-cd-2");
assert.ok(sharedFloor, "C2 e D2 devem aparecer na mesma vista.");
assert.ok(sharedFloor.areas.some((area) => /^C2\d{2}$/.test(area.sala_nome || "")));
assert.ok(sharedFloor.areas.some((area) => /^D2\d{2}$/.test(area.sala_nome || "")));
assert.equal(sharedFloor.areas.filter((area) => area.categoria === "ESCADA" && area.destino_key === "c-terreo").length, 1,
  "C2 e D2 compartilham uma única escada vinda do térreo.");
assert.ok(!cimolMapViews.some((view) => view.key === "c-2" || view.key === "d-2"), "Não devem sobrar vistas duplicadas de C2 e D2.");
const lateral = cimolMapViews.find((view) => view.key === "c-2-lateral");
assert.ok(lateral, "As duas salas isoladas de C2 têm vista própria.");
assert.ok(!lateral.areas.some((area) => area.destino_key === "c-2"), "A ala isolada não tem ligação direta à ala principal.");
assert.ok(cimolMapViews.some((view) => view.areas.some((area) => /eletrotécnica/i.test(area.nome))), "A coordenação deve usar o nome confirmado.");
const bGround = cimolMapViews.find((view) => view.key === "b-terreo");
assert.ok(bGround.areas.find((area) => area.key === "entrada-patio").rotulo_y >
  bGround.areas.find((area) => area.key === "saida-c").rotulo_y, "A entrada de B fica abaixo da saída dos fundos.");
const cGround = cimolMapViews.find((view) => view.key === "c-terreo");
const gym = cimolMapViews.find((view) => view.key === "ginasio-e");
assert.ok(cGround.areas.some((area) => area.key === "museu" && area.categoria === "AMBIENTE"), "O Museu deve aparecer como lugar no pátio de C.");
assert.ok(cGround.areas.some((area) => area.key === "museu-portao" && area.categoria === "ACESSO"), "O Museu deve ser indicado pelo pátio de C.");
assert.ok(!gym.areas.some((area) => /museu/i.test(area.nome)), "O ginásio não deve sugerir entrada direta no Museu.");
assert.equal(gym.areas.find((area) => area.key === "entrada-c").destino_key, "c-terreo", "A saída do ginásio deve retornar ao pátio de C.");
const wcC = cGround.areas.find((area) => area.key === "wc-masculino");
const stairC = cGround.areas.find((area) => area.key === "escada-banheiros");
assert.ok(stairC.rotulo_x > wcC.rotulo_x && stairC.rotulo_x - wcC.rotulo_x < 100 &&
  Math.abs(stairC.rotulo_y - wcC.rotulo_y) < 100, "A escada C–D deve ficar ao lado dos WC de C.");
const reachable = (start) => {
  const visited = new Set([start]);
  for (const key of visited) {
    for (const area of cimolMapViews.find((view) => view.key === key).areas) {
      if (area.destino_key && !["CIRCULACAO", "PATIO"].includes(area.categoria)) visited.add(area.destino_key);
    }
  }
  return visited;
};
assert.equal(reachable("campus").size, cimolMapViews.length, "Todas as vistas devem ter acesso a partir do campus.");
for (const view of cimolMapViews) assert.ok(reachable(view.key).has("campus"), `A vista ${view.key} precisa de um caminho de volta.`);

console.log("CIMOL map: geometry, isolated wing, dry-run, tenant scope, retained IDs and atomic rollback verified.");
