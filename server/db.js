import fs from "fs";
import pg from "pg";

const { Client, Pool } = pg;

const asBoolean = (value) => value === true || value === 1 || value === "1" || value === "true" || value === "on";
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
const parsedDatabaseUrl = databaseUrl ? new URL(databaseUrl) : null;
const databaseName = process.env.DB_NAME || parsedDatabaseUrl?.pathname.replace(/^\/+/, "").split("?")[0] || "cimol";

if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
  throw new Error("DB_NAME contem caracteres invalidos.");
}

const databaseSsl = asBoolean(process.env.DB_SSL)
  ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" }
  : undefined;

const poolConfig = parsedDatabaseUrl
  ? { connectionString: databaseUrl, ssl: databaseSsl }
  : {
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "",
      database: databaseName,
      ssl: databaseSsl,
    };

const quoteIdentifier = (value) => `"${String(value).replace(/"/g, "\"\"")}"`;

export const toPostgresQuery = (sql, params = []) => {
  let index = 0;
  return {
    text: String(sql).replace(/\?/g, () => `$${++index}`),
    values: params,
  };
};

const wrapResult = (sql, result) => {
  if (/^\s*(SELECT|WITH)\b/i.test(sql)) return [result.rows, result.fields];
  return [{ affectedRows: result.rowCount, insertId: result.rows?.[0]?.id || 0 }, result.fields];
};

const runQuery = async (client, sql, params = []) => {
  const { text, values } = toPostgresQuery(sql, params);
  return wrapResult(sql, await client.query(text, values));
};

export const initializeSchema = async (schemaPath) => {
  const shouldCreateDatabase =
    process.env.DB_CREATE_DATABASE == null ? !parsedDatabaseUrl : asBoolean(process.env.DB_CREATE_DATABASE);

  if (shouldCreateDatabase) {
    const client = new Client({ ...poolConfig, database: process.env.POSTGRES_MAINTENANCE_DB || "postgres" });
    await client.connect();
    try {
      const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);
      if (!existing.rowCount) await client.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
    } finally {
      await client.end();
    }
  }

  const pool = new Pool(poolConfig);
  try {
    await pool.query(fs.readFileSync(schemaPath, "utf8"));
  } finally {
    await pool.end();
  }
};

export const createDbPool = () => {
  const pool = new Pool({
    ...poolConfig,
    max: Number(process.env.DB_CONNECTION_LIMIT || (process.env.VERCEL ? 4 : 10)),
  });

  return {
    query: (sql, params) => runQuery(pool, sql, params),
    getConnection: async () => {
      const client = await pool.connect();
      return {
        query: (sql, params) => runQuery(client, sql, params),
        beginTransaction: () => client.query("BEGIN"),
        commit: () => client.query("COMMIT"),
        rollback: () => client.query("ROLLBACK"),
        release: () => client.release(),
      };
    },
  };
};

export const isDuplicateError = (error) => error?.code === "23505";
export const isForeignKeyError = (error) => error?.code === "23503";
export const isConnectionError = (error) =>
  ["08001", "08006", "57P01", "ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "ETIMEDOUT"].includes(error?.code);
