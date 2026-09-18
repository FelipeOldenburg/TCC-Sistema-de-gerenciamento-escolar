import fs from "fs";
import pg from "pg";

const { Client, Pool } = pg;

const asBoolean = (value) => value === true || value === 1 || value === "1" || value === "true" || value === "on";

export const resolveDbConfig = (env = process.env, { migration = false } = {}) => {
  const databaseUrl = env.DATABASE_URL || env.POSTGRES_URL || "";
  const parsedDatabaseUrl = databaseUrl ? new URL(databaseUrl) : null;
  const databaseName = env.DB_NAME || parsedDatabaseUrl?.pathname.replace(/^\/+/, "").split("?")[0] || "cimol";

  if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
    throw new Error("DB_NAME contem caracteres invalidos.");
  }

  const sslMode = parsedDatabaseUrl?.searchParams.get("sslmode")?.toLowerCase();
  const urlSsl = parsedDatabaseUrl?.searchParams.get("ssl")?.toLowerCase();
  const sslCa = String(env.DB_SSL_CA || "").trim();
  const sslCaFile = String(env.DB_SSL_CA_FILE || parsedDatabaseUrl?.searchParams.get("sslrootcert") || "").trim();
  const shouldUseSsl =
    asBoolean(env.DB_SSL) ||
    ["require", "verify-ca", "verify-full"].includes(sslMode) ||
    ["1", "true"].includes(urlSsl) ||
    Boolean(sslCa || sslCaFile);
  const certificateAuthority = shouldUseSsl
    ? sslCa
      ? sslCa.replace(/\\n/g, "\n")
      : sslCaFile
        ? fs.readFileSync(sslCaFile, "utf8")
        : undefined
    : undefined;
  const databaseSsl = shouldUseSsl
    ? { rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED !== "false", ...(certificateAuthority ? { ca: certificateAuthority } : {}) }
    : undefined;
  const insecureSslMode = ["disable", "prefer", "no-verify"].includes(sslMode);
  const urlDisablesSsl = ["0", "false"].includes(urlSsl);
  const databaseHost = parsedDatabaseUrl?.hostname || String(env.DB_HOST || "");
  const normalizedHost = databaseHost.toLowerCase();
  const isSupabaseHost = /(?:^|\.)supabase(?:\.co|\.com)$/.test(normalizedHost);
  const databasePort = parsedDatabaseUrl ? Number(parsedDatabaseUrl.port || 5432) : Number(env.DB_PORT || 5432);
  const isSupabaseTransactionPooler = normalizedHost.endsWith(".pooler.supabase.com") || /^db\.[^.]+\.supabase\.co$/.test(normalizedHost);
  const migrationPort = migration && databasePort === 6543 && isSupabaseTransactionPooler
    ? 5432
    : databasePort;

  if (
    env.NODE_ENV === "production" &&
    isSupabaseHost &&
    (!databaseSsl || !databaseSsl.rejectUnauthorized || !databaseSsl.ca || insecureSslMode || urlDisablesSsl)
  ) {
    throw new Error("Supabase em produção exige SSL com a CA do projeto e validação de certificado.");
  }

  const connectionString = parsedDatabaseUrl
    ? (() => {
        const url = new URL(databaseUrl);
        if (migrationPort !== databasePort) url.port = String(migrationPort);
        for (const key of ["ssl", "sslmode", "sslcert", "sslkey", "sslrootcert", "uselibpqcompat", "sslnegotiation"]) {
          url.searchParams.delete(key);
        }
        return url.toString();
      })()
    : undefined;

  return {
    databaseName,
    shouldCreateDatabase: asBoolean(env.DB_CREATE_DATABASE),
    connectionLimit: Number(env.DB_CONNECTION_LIMIT || (env.VERCEL ? 1 : 10)),
    poolConfig: parsedDatabaseUrl
      ? { connectionString, ssl: databaseSsl }
      : {
          host: env.DB_HOST || "localhost",
          port: migrationPort,
          user: env.DB_USER || "postgres",
          password: env.DB_PASSWORD || "",
          database: databaseName,
          ssl: databaseSsl,
        },
  };
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

export const initializeSchema = async (schemaPath, { createDatabase = false } = {}) => {
  const { databaseName, shouldCreateDatabase, poolConfig } = resolveDbConfig(process.env, { migration: true });

  if (createDatabase && shouldCreateDatabase) {
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
  const { connectionLimit, poolConfig } = resolveDbConfig();
  const pool = new Pool({
    ...poolConfig,
    max: connectionLimit,
  });

  return {
    query: (sql, params) => runQuery(pool, sql, params),
    end: () => pool.end(),
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
