import assert from "node:assert/strict";
import { createReorganizationController } from "./controllers/reorganizationController.js";
import { registerReorganizationRoutes } from "./routes/reorganizationRoutes.js";

const routes = [];
const app = Object.fromEntries(["get", "post", "delete"].map((method) => [method, (...args) => routes.push([method, ...args])]));
const controller = { list() {}, create() {}, downloadAttachment() {}, remove() {} };
const requireCpd = () => {};
const upload = { single: (field) => { assert.equal(field, "arquivo"); return () => {}; } };
registerReorganizationRoutes(app, controller, {
  documentUpload: upload,
  requireRole: (role) => {
    assert.equal(role, "CPD");
    return requireCpd;
  },
  uploadRateLimit: () => {},
});
assert.deepEqual(routes.map(([method, path]) => `${method} ${path}`), [
  "get /api/reorganizacao",
  "post /api/reorganizacao",
  "get /api/reorganizacao/:id/arquivo",
  "delete /api/reorganizacao/:id",
]);
assert.equal(routes[0][2], requireCpd);
assert.equal(routes[1][3], requireCpd);
assert.equal(routes[2][2], requireCpd);
assert.equal(routes[3][2], requireCpd);

const reorganizationController = createReorganizationController({
  asBoolean: (value) => value === true,
  db: {},
  positiveInt: () => 1,
  reorganizationModel: {},
  roomAssignmentService: {},
  sanitizeFreeText: (value) => value,
});
const response = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
await reorganizationController.create(
  { body: { aluno: "", ano: "1", turma: "A", curso: "Curso", problema: "Problema" } },
  response,
  () => assert.fail("não deve chamar next")
);
assert.equal(response.statusCode, 400);
