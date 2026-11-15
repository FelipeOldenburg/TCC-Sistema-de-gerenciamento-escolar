import assert from "node:assert/strict";
import { createContentController } from "./controllers/contentController.js";
import { createContentModel } from "./models/contentModel.js";
import { registerContentRoutes } from "./routes/contentRoutes.js";

const routes = [];
const app = Object.fromEntries(
  ["get", "post", "put", "patch", "delete"].map((method) => [method, (...args) => routes.push([method, ...args])])
);
const controller = new Proxy({}, { get: () => () => {} });
const cpdOnly = () => {};
registerContentRoutes(app, controller, {
  ouvidoriaRateLimit: () => {},
  requireRole: (role) => { assert.equal(role, "CPD"); return cpdOnly; },
});
assert.deepEqual(routes.slice(-3).map(([method, path]) => `${method} ${path}`), [
  "post /api/relatos",
  "get /api/relatos",
  "patch /api/relatos/:id",
]);

let saved;
const reportController = createContentController({
  contentModel: {
    resolveManifestationContext: async ({ institutionId }) => institutionId === 2 ? { sala: { id: 7, nome: "A101" } } : null,
    createManifestation: async (value) => { saved = value; return { insertId: 10 }; },
  },
  asBoolean: Boolean,
  cacheableJson: () => {},
  hasInappropriateContent: () => false,
  httpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }),
  positiveInt: () => 1,
  sanitizeFreeText: (value, max) => String(value || "").trim().slice(0, max),
});
const response = {
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
};
let receivedError;
await reportController.createManifestation(
  { body: { categoria: "SALA_INDISPONIVEL", origem: "SALA", sala_id: 7 }, institution: { id: 2 } },
  response,
  (error) => { receivedError = error; }
);
assert.equal(receivedError, undefined);
assert.equal(response.statusCode, 201);
assert.equal(saved.manifestation.mensagem, null);
assert.equal(saved.manifestation.contexto.sala.nome, "A101");

await reportController.createManifestation(
  { body: { categoria: "SALA_INDISPONIVEL", origem: "SALA", sala_id: 7 }, institution: { id: 3 } },
  response,
  (error) => { receivedError = error; }
);
assert.equal(receivedError.statusCode, 400);

const eventQueries = [];
const eventModel = createContentModel({ db: { query: async (sql, params) => {
  eventQueries.push({ sql, params });
  return [{ insertId: 7, affectedRows: 1 }];
} } });
await eventModel.createEvent({
  institutionId: 2,
  event: { titulo: "Mostra", descricao: null, data_evento: "2026-10-02", hora_evento: null, local: null, ativo: true },
});
await eventModel.updateEvent({
  id: 7,
  institutionId: 2,
  event: { titulo: "Mostra atualizada", descricao: null, data_evento: "2026-10-03", hora_evento: null, local: null, ativo: true },
});
assert.ok(eventQueries.every(({ sql }) => !sql.includes("imagem_url")));
assert.ok(eventQueries.every(({ params }) => params.includes(2)));
