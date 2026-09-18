import assert from "node:assert/strict";
import { createScheduleController } from "./controllers/scheduleController.js";
import { createScheduleModel } from "./models/scheduleModel.js";

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
