import assert from "node:assert/strict";
import { createScheduleController } from "./controllers/scheduleController.js";
import { registerScheduleRoutes } from "./routes/scheduleRoutes.js";

const routes = [];
const app = Object.fromEntries(["get", "post", "patch", "put", "delete"].map((method) => [method, (...args) => routes.push([method, ...args])]));
const controller = Object.fromEntries(
  [
    "uploadUrania", "listImports", "getImport", "assignPendingRoom", "approveImport", "rejectImport",
    "assignPendingRooms",
    "subscribeToNotifications", "confirmNotificationByCode", "confirmNotification", "maintainNotifications", "listPublishedSchedules", "assignPublishedRoom", "assignPublishedRooms",
    "listAcademicGroups", "listIntervals", "saveInterval", "deactivateInterval",
  ].map((name) => [name, () => {}])
);
const requireRole = (role) => { assert.ok(["ADMIN", "CPD"].includes(role)); return () => {}; };
registerScheduleRoutes(app, controller, {
  notificationRateLimit: () => {},
  requireRole,
  uploadRateLimit: () => {},
  uraniaUpload: { array: (field, limit) => { assert.equal(field, "arquivos"); assert.equal(limit, 10); return () => {}; } },
});
assert.deepEqual(routes.map(([method, path]) => `${method} ${path}`), [
  "post /api/importacoes/urania",
  "get /api/importacoes",
  "get /api/importacoes/:id",
  "patch /api/importacoes/horarios/:id/sala",
  "patch /api/importacoes/:id/horarios/sala/lote",
  "post /api/importacoes/:id/aprovar",
  "post /api/importacoes/:id/rejeitar",
  "post /api/horarios/notificacoes",
  "post /api/horarios/notificacoes/verificar",
  "get /api/horarios/notificacoes/confirmar",
  "get /api/horarios/notificacoes/manutencao",
  "get /api/horarios/publicados",
  "patch /api/horarios/publicados/salas/lote",
  "patch /api/horarios/publicados/:id/sala",
  "get /api/grupos-academicos",
  "get /api/intervalos",
  "post /api/intervalos",
  "put /api/intervalos/:id",
  "delete /api/intervalos/:id",
]);

const scheduleController = createScheduleController({
  db: {},
  httpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }),
  positiveInt: () => 1,
  roomAssignmentService: {},
  sanitizeFreeText: (value) => value,
  scheduleModel: {},
});
let error;
await scheduleController.assignPendingRoom({ params: { id: "0" }, body: {}, institution: { id: 1 } }, {}, (value) => { error = value; });
assert.equal(error.statusCode, 400);

let savedInterval;
let deactivatedInterval;
const intervalResponse = {
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
};
const intervalController = createScheduleController({
  db: {},
  httpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }),
  positiveInt: () => 1,
  roomAssignmentService: {},
  sanitizeFreeText: (value) => String(value || "").trim(),
  scheduleModel: {
    saveInterval: async (value) => { savedInterval = value; return { id: 4 }; },
    deactivateInterval: async (value) => { deactivatedInterval = value; return { affectedRows: 1 }; },
  },
});
await intervalController.saveInterval(
  { body: { nome: "Recreio", hora_inicio: "09:30", hora_fim: "09:45", grupo_ids: [8, 8] }, params: {}, institution: { id: 2 } },
  intervalResponse,
  (value) => { error = value; }
);
assert.deepEqual(savedInterval.interval.grupo_ids, [8]);
assert.equal(intervalResponse.statusCode, 201);

await intervalController.saveInterval(
  { body: { nome: "Recreio editado", hora_inicio: "09:35", hora_fim: "09:50", grupo_ids: [8] }, params: { id: "4" }, institution: { id: 2 } },
  intervalResponse,
  (value) => { error = value; }
);
assert.equal(savedInterval.intervalId, "4");
assert.equal(intervalResponse.statusCode, 200);

await intervalController.deactivateInterval(
  { params: { id: "4" }, institution: { id: 2 } },
  intervalResponse,
  (value) => { error = value; }
);
assert.deepEqual(deactivatedInterval, { institutionId: 2, intervalId: 4 });
assert.deepEqual(intervalResponse.payload, { ok: true });

const makeBulkController = (service, transactionState, captures) => createScheduleController({
  db: {
    getConnection: async () => ({
      beginTransaction: async () => { transactionState.began = true; },
      commit: async () => { transactionState.committed = true; },
      rollback: async () => { transactionState.rolledBack = true; },
      release: () => { transactionState.released = true; },
    }),
  },
  httpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }),
  positiveInt: () => 1,
  roomAssignmentService: { updatePublishedScheduleRooms: service },
  sanitizeFreeText: (value) => String(value || "").trim(),
  scheduleModel: { enqueueNotificationEvents: async (_conn, value) => { captures.events = value.events; } },
  notificationService: { processPendingEvents: async (options) => {
    captures.notificationRuns = (captures.notificationRuns || 0) + 1;
    captures.notificationOptions = options;
  } },
});
const transactionState = {};
const bulkCaptures = {};
let bulkArgs;
const changes = [
  { horario_id: 21, alteracao_id: 91, turma: "1A", dia: "SEG", periodo: 1, hora_inicio: "07:30", disciplina: "Matemática", sala_anterior: "A101", sala_nova: "B201" },
  { horario_id: 22, alteracao_id: 92, turma: "1A", dia: "TER", periodo: 1, hora_inicio: "07:30", disciplina: "Física", sala_anterior: "A101", sala_nova: "B201" },
  { horario_id: 23, alteracao_id: 93, turma: "2B", dia: "QUA", periodo: 2, hora_inicio: "09:00", disciplina: "Química", sala_anterior: "A102", sala_nova: "B201" },
];
const bulkController = makeBulkController(async (_conn, args) => {
  bulkArgs = args;
  return { ok: true, sala_id: 8, updated: changes.length, changed: true, alteracoes: changes };
}, transactionState, bulkCaptures);
const bulkResponse = {
  json(payload) { this.payload = payload; return this; },
};
error = undefined;
await bulkController.assignPublishedRooms(
  { body: { horario_ids: [22, 21, 23], sala_id: 8, motivo: " Mudança de espaço " }, institution: { id: 12 }, user: { id: 5 } },
  bulkResponse,
  (value) => { error = value; }
);
assert.equal(error, undefined);
assert.equal(bulkArgs.institutionId, 12);
assert.deepEqual(bulkArgs.assignments, [
  { scheduleId: 22, roomId: 8, studentCount: null },
  { scheduleId: 21, roomId: 8, studentCount: null },
  { scheduleId: 23, roomId: 8, studentCount: null },
]);
assert.equal(bulkArgs.userId, 5);
assert.equal(bulkArgs.reason, "Mudança de espaço");
assert.equal(transactionState.committed, true);
assert.equal(bulkCaptures.notificationRuns, 1);
assert.equal(bulkCaptures.events.length, 2);
assert.equal(bulkCaptures.events[0].payload.alteradas.length, 2);
assert.equal(bulkCaptures.events[1].payload.alteradas.length, 1);
assert.match(bulkCaptures.notificationOptions.operationId, /^[0-9a-f-]{36}$/i);
assert.ok(bulkCaptures.events.every(({ chave }) => chave.includes(bulkCaptures.notificationOptions.operationId)));

const failureTransaction = {};
const failureCaptures = {};
const failingBulkController = makeBulkController(async () => { throw Object.assign(new Error("Conflito de sala."), { statusCode: 409 }); }, failureTransaction, failureCaptures);
await failingBulkController.assignPublishedRooms(
  { body: { horario_ids: [21, 22], sala_id: 8 }, institution: { id: 12 }, user: { id: 5 } },
  bulkResponse,
  (value) => { error = value; }
);
assert.equal(error.statusCode, 409);
assert.equal(failureTransaction.rolledBack, true);
assert.equal(failureTransaction.committed, undefined);
assert.equal(failureCaptures.events, undefined);
assert.equal(failureCaptures.notificationRuns, undefined);

const mappedTransaction = {};
const mappedCaptures = {};
const mappedController = makeBulkController(async (_conn, args) => {
  bulkArgs = args;
  return { ok: true, updated: 2, changed: true, alteracoes: changes.slice(0, 2) };
}, mappedTransaction, mappedCaptures);
error = undefined;
await mappedController.assignPublishedRooms(
  { body: { alocacoes: [{ horario_id: 21, sala_id: 8, quantidade_alunos: 25 }, { horario_id: 22, sala_id: 9 }] }, institution: { id: 12 }, user: { id: 5 } },
  bulkResponse,
  (value) => { error = value; }
);
assert.equal(error, undefined);
assert.deepEqual(bulkArgs.assignments, [
  { scheduleId: 21, roomId: 8, studentCount: 25 },
  { scheduleId: 22, roomId: 9, studentCount: null },
]);
assert.equal(mappedTransaction.committed, true);

let importDetailArgs;
const importDetailController = createScheduleController({
  db: {},
  httpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }),
  positiveInt: (value, fallback) => Number(value) || fallback,
  roomAssignmentService: {},
  sanitizeFreeText: (value) => String(value || "").trim(),
  scheduleModel: {
    getImportDetail: async (args) => {
      importDetailArgs = args;
      return { item: { id: 77 }, files: [], classes: [], schedules: Array.from({ length: 205 }, (_, id) => ({ id })), comparison: null, total: 205 };
    },
  },
});
await importDetailController.getImport(
  { params: { id: "77" }, query: { todos: "1" }, institution: { id: 12 } }, intervalResponse, (value) => { error = value; }
);
assert.equal(importDetailArgs.all, true);
assert.equal(importDetailArgs.institutionId, 12);
assert.equal(intervalResponse.payload.horarios.length, 205);
assert.deepEqual(intervalResponse.payload.paginacao, { pagina: 1, por_pagina: 205, total: 205 });
