import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeSchema } from "../server/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  await initializeSchema(path.resolve(__dirname, "../server/schema.sql"));
  console.log("Schema PostgreSQL aplicado.");
} catch (error) {
  console.error("Não foi possível aplicar o schema PostgreSQL.", error);
  process.exitCode = 1;
}
