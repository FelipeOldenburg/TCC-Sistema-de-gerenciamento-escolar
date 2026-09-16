import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureBootstrapPlatformUser, ensureBootstrapUsers } from "../server/auth.js";
import { createDbPool, initializeSchema } from "../server/db.js";
import { createInstitutionModel } from "../server/models/institutionModel.js";
import { ensureDefaultPublicContent, ensureReferenceRooms } from "../server/seed.js";

let db;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultInstitutionSlug = process.env.DEFAULT_INSTITUTION_SLUG || "cimol";

try {
  db = createDbPool();
  await initializeSchema(path.resolve(__dirname, "../server/schema.sql"), { createDatabase: true });
  await ensureBootstrapPlatformUser(db);
  const defaultInstitution = await createInstitutionModel(db).loadBySlug(defaultInstitutionSlug);
  if (!defaultInstitution) throw new Error(`Instituicao padrao ${defaultInstitutionSlug} nao encontrada.`);
  await ensureBootstrapUsers(db, defaultInstitution.slug);
  await ensureDefaultPublicContent(defaultInstitution.id, db);
  await ensureReferenceRooms(defaultInstitution.id, db);
  console.log("Dados iniciais aplicados.");
} catch (error) {
  console.error("Não foi possível aplicar os dados iniciais.", error);
  process.exitCode = 1;
} finally {
  await db?.end();
}
