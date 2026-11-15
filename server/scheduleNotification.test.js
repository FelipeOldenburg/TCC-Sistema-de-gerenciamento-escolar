import assert from "node:assert/strict";
import { createScheduleController } from "./controllers/scheduleController.js";
import { createScheduleModel } from "./models/scheduleModel.js";
import { createScheduleNotificationService } from "./services/scheduleNotificationService.js";

const state = { requestCount: 0, cooldownUntil: null };
const connection = {
  async query(sql, params = []) {
    if (sql.includes("SELECT 1")) return [[{ ok: 1 }]];
    if (sql.includes("SELECT request_count")) return [[{ request_count: state.requestCount, cooldown_until: state.cooldownUntil }]];
    if (sql.includes("SET request_count")) {
      state.requestCount = params[0];
      state.cooldownUntil = params[1];
    }
    if (sql.includes("SET cooldown_until")) state.cooldownUntil = params[0];
    return [{ affectedRows: 1 }];
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

const request = (email = "aluno@estudante.rs.gov.br") => model.createNotificationSubscription({
  email,
  institutionId: 1,
  tokenHash: "a".repeat(64),
  codeHash: "b".repeat(64),
  turma: "3A",
});

await request();
await request();
await request();
assert.equal(state.requestCount, 3);
assert.ok(state.cooldownUntil);

await assert.rejects(request(), (error) => {
  assert.equal(error.statusCode, 429);
  assert.equal(error.code, "NOTIFICATION_REQUEST_LIMIT");
  assert.ok(error.availableAt);
  return true;
});

state.cooldownUntil = new Date(Date.now() - 1_000);
await request();
assert.equal(state.requestCount, 1);

let created;
let verified;
let responseBody;
const response = {
  status(code) { this.statusCode = code; return this; },
  json(body) { responseBody = body; return this; },
  type() { return this; },
  send(body) { responseBody = body; return this; },
};
const controller = createScheduleController({
  db: {},
  httpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }),
  positiveInt: () => 1,
  roomAssignmentService: {},
  sanitizeFreeText: (value) => String(value || "").trim(),
  scheduleModel: {
    createNotificationSubscription: async (value) => { created = value; },
    confirmNotificationByCode: async (value) => { verified = value; return { status: "ATIVA" }; },
  },
  notificationService: {
    sendVerificationEmail: async () => ({ sent: true }),
  },
});
let validationError;
await controller.subscribeToNotifications(
  { body: { email: "aluno@gmail.com", turma: "3A" }, institution: { id: 1 } },
  response,
  (error) => { validationError = error; }
);
assert.equal(validationError.statusCode, 400);

await controller.subscribeToNotifications(
  { body: { email: "Aluno@Estudante.RS.GOV.BR", turma: "3A" }, institution: { id: 1 }, protocol: "https", get: () => "example.test" },
  response,
  (error) => { throw error; }
);
assert.equal(created.email, "aluno@estudante.rs.gov.br");
assert.equal(created.codeHash.length, 64);
assert.equal(response.statusCode, 201);

await controller.confirmNotificationByCode(
  { body: { email: "Aluno@Estudante.RS.GOV.BR", turma: "3A", code: "123456" }, institution: { id: 1 } },
  response,
  (error) => { throw error; }
);
assert.equal(verified.email, "aluno@estudante.rs.gov.br");
assert.equal(verified.codeHash.length, 64);
assert.deepEqual(responseBody, { status: "ATIVA" });

const operationId = "d92f0a71-bb0d-43d6-9d59-ec5f8f6534aa";
const sends = [];
const completedEvents = [];
let claimedOptions;
const batchNotificationService = createScheduleNotificationService({
  scheduleModel: {
    claimNotificationEvents: async (options) => {
      claimedOptions = options;
      return [
        { id: 51, tipo: "ALTERACAO", chave: `sala:lote:${operationId}:1A`, turma: "1A", email: "aluno@example.test", payload_json: JSON.stringify({ alteradas: [{ depois: { dia: "SEG", periodo: 1, disciplina: "Matemática", sala: "B201" }, antes: { sala: "A101" }, sala_alterada: true }] }) },
        { id: 52, tipo: "ALTERACAO", chave: `sala:lote:${operationId}:2B`, turma: "2B", email: "aluno@example.test", payload_json: JSON.stringify({ alteradas: [{ depois: { dia: "TER", periodo: 2, disciplina: "Física", sala: "B202" }, antes: { sala: "A102" }, sala_alterada: true }] }) },
        { id: 53, tipo: "ALTERACAO", chave: `sala:lote:${operationId}:2B`, turma: "2B", email: "outro@example.test", payload_json: JSON.stringify({ alteradas: [{ depois: { dia: "TER", periodo: 2, disciplina: "Física", sala: "B202" }, antes: { sala: "A102" }, sala_alterada: true }] }) },
      ];
    },
    completeNotificationEvent: async (eventId) => completedEvents.push(eventId),
    failNotificationEvent: async () => assert.fail("Não deveria falhar o envio."),
  },
  sendEmail: async (message) => { sends.push(message); return { sent: true }; },
});
const batchResult = await batchNotificationService.processPendingEvents({ institutionId: 1, operationId });
assert.deepEqual(claimedOptions, { institutionId: 1, operationId, limit: 100 });
assert.equal(sends.length, 2);
assert.match(sends.find(({ to }) => to === "aluno@example.test").text, /Turma 1A:[\s\S]*Turma 2B:/);
assert.match(sends.find(({ to }) => to === "aluno@example.test").text, /A101 → B201[\s\S]*A102 → B202/);
assert.deepEqual(completedEvents, [51, 52, 53]);
assert.deepEqual(batchResult, { tentadas: 3, enviadas: 3, sem_smtp: 0, falhas: 0 });

const claimQueries = [];
const operationClaimModel = createScheduleModel({
  db: { getConnection: async () => ({
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: async () => {},
    query: async (sql, params) => {
      claimQueries.push({ sql, params });
      return sql.startsWith("SELECT e.id") ? [[]] : [{ affectedRows: 0 }];
    },
  }) },
  dayOrderSql: "h.dia",
  httpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }),
  normalizeLookup: (value) => String(value).trim().toLowerCase(),
});
await operationClaimModel.claimNotificationEvents({ institutionId: 1, operationId });
const operationClaim = claimQueries.find(({ sql }) => sql.startsWith("SELECT e.id"));
assert.match(operationClaim.sql, /e\.chave LIKE \?/);
assert.doesNotMatch(operationClaim.sql, /LIMIT \?/);
assert.deepEqual(operationClaim.params, [1, `sala:lote:${operationId}:%`]);
