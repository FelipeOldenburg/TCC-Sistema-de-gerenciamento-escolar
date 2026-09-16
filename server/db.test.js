import assert from "node:assert/strict";
import { resolveDbConfig } from "./db.js";

const supabaseUrl = "postgresql://postgres:password@db.project.supabase.co:5432/postgres";
const testCertificate = "-----BEGIN CERTIFICATE-----\\nCA DE TESTE\\n-----END CERTIFICATE-----";
const supabase = resolveDbConfig({
  DATABASE_URL: supabaseUrl,
  DB_SSL: "true",
  DB_SSL_REJECT_UNAUTHORIZED: "true",
  DB_SSL_CA: testCertificate,
  VERCEL: "1",
});

assert.deepEqual(supabase.poolConfig, {
  connectionString: supabaseUrl,
  ssl: { rejectUnauthorized: true, ca: testCertificate.replace(/\\n/g, "\n") },
});
assert.equal(supabase.shouldCreateDatabase, false);
assert.equal(supabase.connectionLimit, 1);

const sslFromUrl = resolveDbConfig({
  DATABASE_URL: `${supabaseUrl}?sslmode=require`,
  NODE_ENV: "production",
  DB_SSL_CA: testCertificate,
});
assert.equal(sslFromUrl.poolConfig.connectionString, supabaseUrl);
assert.deepEqual(sslFromUrl.poolConfig.ssl, { rejectUnauthorized: true, ca: testCertificate.replace(/\\n/g, "\n") });

const sslBooleanFromUrl = resolveDbConfig({
  DATABASE_URL: `${supabaseUrl}?ssl=true`,
  DB_SSL_CA: testCertificate,
});
assert.equal(sslBooleanFromUrl.poolConfig.connectionString, supabaseUrl);
assert.deepEqual(sslBooleanFromUrl.poolConfig.ssl, { rejectUnauthorized: true, ca: testCertificate.replace(/\\n/g, "\n") });

const local = resolveDbConfig({
  DB_HOST: "localhost",
  DB_PORT: "5433",
  DB_USER: "cimol",
  DB_PASSWORD: "local-password",
  DB_NAME: "cimol_dev",
  DB_CREATE_DATABASE: "true",
});

assert.deepEqual(local.poolConfig, {
  host: "localhost",
  port: 5433,
  user: "cimol",
  password: "local-password",
  database: "cimol_dev",
  ssl: undefined,
});
assert.equal(local.shouldCreateDatabase, true);
assert.equal(local.connectionLimit, 10);

assert.throws(
  () =>
    resolveDbConfig({
      DATABASE_URL: supabaseUrl,
      NODE_ENV: "production",
      DB_SSL: "true",
      DB_SSL_REJECT_UNAUTHORIZED: "false",
      DB_SSL_CA: testCertificate,
    }),
  /Supabase em produção exige SSL/
);

assert.throws(
  () =>
    resolveDbConfig({
      DATABASE_URL: `${supabaseUrl}?sslmode=no-verify`,
      NODE_ENV: "production",
      DB_SSL: "true",
      DB_SSL_CA: testCertificate,
    }),
  /Supabase em produção exige SSL/
);

assert.throws(
  () =>
    resolveDbConfig({
      DATABASE_URL: supabaseUrl,
      NODE_ENV: "production",
      DB_SSL: "true",
    }),
  /CA do projeto/
);

assert.throws(
  () =>
    resolveDbConfig({
      DB_HOST: "db.project.supabase.co",
      DB_NAME: "postgres",
      NODE_ENV: "production",
      DB_SSL: "true",
    }),
  /CA do projeto/
);
