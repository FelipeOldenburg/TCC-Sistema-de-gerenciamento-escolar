import assert from "node:assert/strict";
import { createScheduleController } from "./controllers/scheduleController.js";
import { registerScheduleRoutes } from "./routes/scheduleRoutes.js";

const routes = [];
const app = Object.fromEntries(["get", "post", "patch", "put", "delete"].map((method) => [method, (...args) => routes.push([method, ...args])]));
const controller = Object.fromEntries(
  [
    "uploadUrania", "listImports", "getImport", "assignPendingRoom", "approveImport", "rejectImport",
    "subscribeToNotifications", "confirmNotification", "listPublishedSchedules", "assignPublishedRoom",
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
  "post /api/importacoes/:id/aprovar",
  "post /api/importacoes/:id/rejeitar",
  "post /api/horarios/notificacoes",
  "get /api/horarios/notificacoes/confirmar",
  "get /api/horarios/publicados",
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
