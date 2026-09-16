import assert from "node:assert/strict";
import { createPlatformInstitutionController } from "./controllers/platformInstitutionController.js";

const calls = [];
const connection = {};
const controller = createPlatformInstitutionController({
  asBoolean: (value) => value === true || value === "true",
  createPassword: async () => ({ hash: "hash", salt: "salt" }),
  ensureDefaultPublicContent: async () => {},
  httpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }),
  model: {
    institutionExists: async () => true,
    withTransaction: async (work) => {
      calls.push("begin");
      const result = await work(connection);
      calls.push("commit");
      return result;
    },
    updateUser: async ({ targetDb }) => {
      assert.equal(targetDb, connection);
      calls.push("update");
      return { affectedRows: 1 };
    },
    deleteUserSessions: async (userId, targetDb) => {
      assert.equal(userId, 7);
      assert.equal(targetDb, connection);
      calls.push("revoke-sessions");
    },
  },
  normalizeUsername: (value) => String(value).trim().toLowerCase(),
  sanitizeFreeText: (value) => String(value || "").trim(),
});
const response = { json(payload) { this.payload = payload; return this; } };

await controller.updateUser(
  { params: { institutionId: "2", userId: "7" }, body: { nome: "Ana", usuario: "ana", papel: "CPD", senha: "segredo", ativo: true } },
  response,
  (error) => assert.fail(error)
);

assert.deepEqual(calls, ["begin", "update", "revoke-sessions", "commit"]);
assert.deepEqual(response.payload, { ok: true });
