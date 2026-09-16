import "dotenv/config";
import { createDbPool } from "../server/db.js";

let db;
const preflight = process.argv.includes("--preflight");
const tenantConstraints = [
  "fk_salas_bloco_instituicao",
  "fk_ouvidoria_setor_instituicao",
  "fk_ouvidoria_sala_instituicao",
  "fk_ouvidoria_horario_instituicao",
  "fk_ouvidoria_mapa_area_instituicao",
  "fk_mapa_areas_mapa_instituicao",
  "fk_mapa_areas_bloco_instituicao",
  "fk_mapa_areas_sala_instituicao",
  "fk_mapa_areas_setor_instituicao",
  "fk_intervalo_grupos_intervalo_instituicao",
  "fk_intervalo_grupos_grupo_instituicao",
  "fk_importacoes_enviado_por_instituicao",
  "fk_importacoes_revisado_por_instituicao",
  "fk_sala_softwares_sala_instituicao",
  "fk_sala_softwares_software_instituicao",
  "fk_horarios_importacao_instituicao",
  "fk_horarios_sala_instituicao",
  "fk_sala_alteracoes_horario_instituicao",
  "fk_sala_alteracoes_usuario_instituicao",
  "fk_sala_alteracoes_sala_anterior_instituicao",
  "fk_sala_alteracoes_sala_nova_instituicao",
];

try {
  db = createDbPool();
  const [rows] = await db.query("SELECT to_regclass('public.instituicoes') AS instituicoes");
  if (!rows[0]?.instituicoes) throw new Error("Schema ausente. Execute npm run db:migrate.");
  const [rlsRows] = await db.query(`
    SELECT
      COALESCE((SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user), FALSE) AS bypasses_rls,
      COALESCE((
        SELECT bool_and(
          c.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
          AND NOT c.relforcerowsecurity
        )
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
      ), TRUE) AS owns_all_rls_tables,
      (SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity) AS rls_tables,
      (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') AS rls_policies
  `);
  const rls = rlsRows[0];
  const canBypassRls = rls.bypasses_rls || rls.owns_all_rls_tables;
  if (Number(rls.rls_tables) && !canBypassRls && !Number(rls.rls_policies)) {
    throw new Error("RLS está ativo sem policies para a role da API.");
  }
  const [tenantRows] = await db.query(`
    WITH inconsistencias AS (
      SELECT 'salas.bloco' AS relacao
        FROM salas s
        JOIN blocos b ON b.id = s.bloco_id
       WHERE s.instituicao_id IS DISTINCT FROM b.instituicao_id
      UNION ALL
      SELECT 'ouvidoria.setor'
        FROM ouvidoria_manifestacoes o
        JOIN setores s ON s.id = o.setor_id
       WHERE o.setor_id IS NOT NULL AND o.instituicao_id IS DISTINCT FROM s.instituicao_id
      UNION ALL
      SELECT 'ouvidoria.sala'
        FROM ouvidoria_manifestacoes o
        JOIN salas s ON s.id = o.sala_id
       WHERE o.sala_id IS NOT NULL AND o.instituicao_id IS DISTINCT FROM s.instituicao_id
      UNION ALL
      SELECT 'ouvidoria.horario'
        FROM ouvidoria_manifestacoes o
        JOIN horarios_importados h ON h.id = o.horario_id
       WHERE o.horario_id IS NOT NULL AND o.instituicao_id IS DISTINCT FROM h.instituicao_id
      UNION ALL
      SELECT 'ouvidoria.mapa_area'
        FROM ouvidoria_manifestacoes o
        JOIN mapa_areas a ON a.id = o.mapa_area_id
       WHERE o.mapa_area_id IS NOT NULL AND o.instituicao_id IS DISTINCT FROM a.instituicao_id
      UNION ALL
      SELECT 'mapa_area.mapa'
        FROM mapa_areas a
        JOIN mapas m ON m.id = a.mapa_id
       WHERE a.instituicao_id IS DISTINCT FROM m.instituicao_id
      UNION ALL
      SELECT 'mapa_area.bloco'
        FROM mapa_areas a
        JOIN blocos b ON b.id = a.bloco_id
       WHERE a.bloco_id IS NOT NULL AND a.instituicao_id IS DISTINCT FROM b.instituicao_id
      UNION ALL
      SELECT 'mapa_area.sala'
        FROM mapa_areas a
        JOIN salas s ON s.id = a.sala_id
       WHERE a.sala_id IS NOT NULL AND a.instituicao_id IS DISTINCT FROM s.instituicao_id
      UNION ALL
      SELECT 'mapa_area.setor'
        FROM mapa_areas a
        JOIN setores s ON s.id = a.setor_id
       WHERE a.setor_id IS NOT NULL AND a.instituicao_id IS DISTINCT FROM s.instituicao_id
      UNION ALL
      SELECT 'intervalo_grupo.intervalo'
        FROM intervalo_grupos ig
        JOIN intervalos i ON i.id = ig.intervalo_id
       WHERE ig.instituicao_id IS DISTINCT FROM i.instituicao_id
      UNION ALL
      SELECT 'intervalo_grupo.grupo'
        FROM intervalo_grupos ig
        JOIN grupos_academicos g ON g.id = ig.grupo_id
       WHERE ig.instituicao_id IS DISTINCT FROM g.instituicao_id
      UNION ALL
      SELECT 'importacao.enviado_por'
        FROM importacoes_horarios i
        JOIN usuarios u ON u.id = i.enviado_por
       WHERE i.instituicao_id IS DISTINCT FROM u.instituicao_id
      UNION ALL
      SELECT 'importacao.revisado_por'
        FROM importacoes_horarios i
        JOIN usuarios u ON u.id = i.revisado_por
       WHERE i.revisado_por IS NOT NULL AND i.instituicao_id IS DISTINCT FROM u.instituicao_id
      UNION ALL
      SELECT 'horario.sala'
        FROM horarios_importados h
        JOIN importacoes_horarios i ON i.id = h.importacao_id
        JOIN salas s ON s.id = h.sala_id
       WHERE h.sala_id IS NOT NULL AND i.instituicao_id IS DISTINCT FROM s.instituicao_id
      UNION ALL
      SELECT 'sala_software.software'
        FROM sala_softwares ss
        JOIN salas s ON s.id = ss.sala_id
        JOIN softwares sw ON sw.id = ss.software_id
       WHERE s.instituicao_id IS DISTINCT FROM sw.instituicao_id
      UNION ALL
      SELECT 'alteracao.usuario'
        FROM sala_alteracoes a
        JOIN horarios_importados h ON h.id = a.horario_id
        JOIN importacoes_horarios i ON i.id = h.importacao_id
        JOIN usuarios u ON u.id = a.usuario_id
       WHERE i.instituicao_id IS DISTINCT FROM u.instituicao_id
      UNION ALL
      SELECT 'alteracao.sala_anterior'
        FROM sala_alteracoes a
        JOIN horarios_importados h ON h.id = a.horario_id
        JOIN importacoes_horarios i ON i.id = h.importacao_id
        JOIN salas s ON s.id = a.sala_anterior_id
       WHERE a.sala_anterior_id IS NOT NULL AND i.instituicao_id IS DISTINCT FROM s.instituicao_id
      UNION ALL
      SELECT 'alteracao.sala_nova'
        FROM sala_alteracoes a
        JOIN horarios_importados h ON h.id = a.horario_id
        JOIN importacoes_horarios i ON i.id = h.importacao_id
        JOIN salas s ON s.id = a.sala_nova_id
       WHERE a.sala_nova_id IS NOT NULL AND i.instituicao_id IS DISTINCT FROM s.instituicao_id
    )
    SELECT relacao, COUNT(*)::int AS total
      FROM inconsistencias
     GROUP BY relacao
     ORDER BY relacao
  `);
  if (tenantRows.length) {
    throw new Error(`Há relações entre instituições diferentes: ${tenantRows.map(({ relacao }) => relacao).join(", ")}.`);
  }
  if (!preflight) {
    const [constraintRows] = await db.query(
      `SELECT c.conname
         FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public' AND c.contype = 'f'
          AND c.conname IN (${tenantConstraints.map(() => "?").join(",")})`,
      tenantConstraints
    );
    const installedConstraints = new Set(constraintRows.map(({ conname }) => conname));
    const missingConstraints = tenantConstraints.filter((constraint) => !installedConstraints.has(constraint));
    if (missingConstraints.length) {
      throw new Error(`Schema desatualizado. Execute npm run db:migrate. Constraints ausentes: ${missingConstraints.join(", ")}.`);
    }
  }
  console.log(
    `PostgreSQL e schema CIMOL disponíveis. RLS: ${rls.rls_tables} tabelas, ${rls.rls_policies} policies. Relações institucionais: íntegras${preflight ? " (pré-validação)." : " e protegidas por constraints."}`
  );
} catch (error) {
  console.error("Verificação do PostgreSQL falhou.", error.message);
  process.exitCode = 1;
} finally {
  await db?.end();
}
