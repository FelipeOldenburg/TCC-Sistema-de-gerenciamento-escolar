import assert from "node:assert/strict";
import { createScheduleModel } from "./models/scheduleModel.js";

const queries = [];
const connection = {
  query: async (sql, params = []) => {
    queries.push({ sql, params });
    if (sql.includes("INSERT INTO importacoes_horarios")) return [{ insertId: 3 }];
    if (sql.includes("SELECT id, nome FROM salas")) return [[]];
    return [{ affectedRows: 0 }];
  },
  beginTransaction: async () => {},
  commit: async () => {},
  rollback: async () => {},
  release: () => {},
};
const model = createScheduleModel({
  db: { getConnection: async () => connection },
  dayOrderSql: "h.dia",
  httpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }),
  normalizeLookup: (value) => String(value).trim().toLowerCase(),
});

await model.createImport({
  files: [],
  institutionId: 2,
  observations: null,
  parsed: {
    avisos: [], fonte: "HTML", titulo: "Horário", escopo_chave: "manha", codigo_escola: null, codigo_turno: null,
    nome_turno: null, lote_hash: "a".repeat(64), total_turmas: 1,
    horarios: [{ categoria: "TURMA", turma: "1A", curso: null, ano: null, dia: "SEG", periodo: 1, hora_inicio: null, disciplina: "Matemática", professor: null, ambiente: null }],
  },
  userId: 8,
});

const schedules = queries.find(({ sql }) => sql.includes("INSERT INTO horarios_importados"));
assert.match(schedules.sql, /instituicao_id/);
assert.deepEqual(schedules.params.slice(0, 2), [3, 2]);
const syncedGroups = queries.find(({ sql }) => sql.includes("INSERT INTO grupos_academicos"));
assert.match(syncedGroups.sql, /ON CONFLICT \(instituicao_id, tipo, nome\) DO UPDATE SET ativo = TRUE/);
const inactiveGroupMappingModel = createScheduleModel({
  db: { query: async (sql) => {
    if (sql.includes("SELECT DISTINCT h.turma")) return [[{ turma: "1A", curso: null, ano: null }]];
    if (sql.includes("SELECT id, tipo, nome FROM grupos_academicos")) return [[{ id: 5, tipo: "TURMA", nome: "1A", ativo: false }]];
    return [[]];
  } },
  dayOrderSql: "h.dia",
  httpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }),
  normalizeLookup: (value) => String(value).trim().toLowerCase(),
});
const mappedInactiveOptions = await inactiveGroupMappingModel.listPublishedSchedules({ institutionId: 2, onlyOptions: true, query: {} });
assert.deepEqual(mappedInactiveOptions.turmas[0].grupo_ids, [5]);

const importDetailQueries = [];
const completeSchedules = Array.from({ length: 205 }, (_, index) => ({ id: index + 1, categoria: "TURMA", turma: "1A" }));
const importDetailModel = createScheduleModel({
  db: { query: async (sql, params = []) => {
    importDetailQueries.push({ sql, params });
    if (sql.includes("FROM importacoes_horarios i")) return [[{ id: 77, status: "REJEITADA", escopo_chave: "manha" }]];
    if (sql.includes("SELECT COUNT(*) AS total FROM horarios_importados")) return [[{ total: completeSchedules.length }]];
    if (sql.includes("FROM horarios_importados h") && sql.includes("ORDER BY")) return [completeSchedules];
    if (sql.includes("SELECT DISTINCT turma, curso, ano, categoria")) return [[{ turma: "1A", categoria: "TURMA" }]];
    return [[]];
  } },
  dayOrderSql: "h.dia",
  httpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }),
  normalizeLookup: (value) => String(value).trim().toLowerCase(),
});
const completeImportDetail = await importDetailModel.getImportDetail({
  importId: 77, institutionId: 2, page: 1, pageSize: 200, turma: "", all: true,
});
const completeScheduleQuery = importDetailQueries.find(({ sql }) => sql.includes("FROM horarios_importados h") && sql.includes("ORDER BY"));
assert.equal(completeImportDetail.schedules.length, 205);
assert.equal(completeImportDetail.total, 205);
assert.doesNotMatch(completeScheduleQuery.sql, /\bLIMIT\b|\bOFFSET\b/i);
assert.deepEqual(completeScheduleQuery.params, [77]);

const createPendingRoomModel = (conflictScheduleId = null) => {
  const state = { committed: false, rolledBack: false, updates: [], queries: [] };
  const connection = {
    beginTransaction: async () => {},
    commit: async () => { state.committed = true; },
    rollback: async () => { state.rolledBack = true; },
    release: () => {},
    query: async (sql, params = []) => {
      state.queries.push({ sql, params });
      if (sql.includes("SELECT id, status FROM importacoes_horarios")) return [[{ id: 71, status: "PENDENTE" }]];
      if (sql.includes("FROM salas s")) return [[{ id: 8, nome: "B201", status: "ATIVA", bloco_nome: "Bloco B" }]];
      if (sql.includes("FOR UPDATE OF h")) return [[{
        id: Number(params[0]), importacao_id: 71, turma: "1A", dia: "SEG", periodo: Number(params[0]),
        disciplina: "Matemática", sala_id: null,
      }]];
      if (sql.includes("SELECT turma, disciplina")) {
        return Number(params[1]) === conflictScheduleId ? [[{ turma: "2B", disciplina: "Física" }]] : [[]];
      }
      if (sql.startsWith("UPDATE horarios_importados SET sala_id")) {
        state.updates.push({ sql, params });
        return [{ affectedRows: 1 }];
      }
      return [[]];
    },
  };
  const model = createScheduleModel({
    db: { getConnection: async () => connection },
    dayOrderSql: "h.dia",
    httpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }),
    normalizeLookup: (value) => String(value).trim().toLowerCase(),
  });
  return { model, state };
};

const conflictingPendingBatch = createPendingRoomModel(2);
await assert.rejects(
  conflictingPendingBatch.model.assignPendingRooms({ institutionId: 2, importId: 71, roomId: 8, scheduleIds: [2, 1] }),
  (error) => error.statusCode === 409
);
assert.equal(conflictingPendingBatch.state.rolledBack, true);
assert.equal(conflictingPendingBatch.state.committed, false);
assert.equal(conflictingPendingBatch.state.updates.length, 1);
assert.ok(conflictingPendingBatch.state.queries.some(({ sql, params }) => sql.includes("h.instituicao_id = ?") && params[1] === 2));

const validPendingBatch = createPendingRoomModel();
const pendingBatchResult = await validPendingBatch.model.assignPendingRooms({
  institutionId: 2, importId: 71, roomId: 8, scheduleIds: [2, 1],
});
assert.equal(validPendingBatch.state.committed, true);
assert.equal(validPendingBatch.state.updates.length, 2);
assert.deepEqual(pendingBatchResult.horarios, [1, 2]);
