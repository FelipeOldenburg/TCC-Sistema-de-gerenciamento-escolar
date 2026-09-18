import assert from "node:assert/strict";
import fs from "node:fs";
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

const transactionPooler = "postgresql://postgres.project:password@aws-0-us-east-2.pooler.supabase.com:6543/postgres";
assert.equal(resolveDbConfig({ DATABASE_URL: transactionPooler }).poolConfig.connectionString, transactionPooler);
assert.equal(
  resolveDbConfig({ DATABASE_URL: transactionPooler }, { migration: true }).poolConfig.connectionString,
  transactionPooler.replace(":6543", ":5432")
);
const dedicatedPooler = "postgresql://postgres:password@db.project.supabase.co:6543/postgres";
assert.equal(resolveDbConfig({ DATABASE_URL: dedicatedPooler }).poolConfig.connectionString, dedicatedPooler);
assert.equal(
  resolveDbConfig({ DATABASE_URL: dedicatedPooler }, { migration: true }).poolConfig.connectionString,
  dedicatedPooler.replace(":6543", ":5432")
);

const poolerFields = {
  DB_HOST: "aws-0-us-east-2.pooler.supabase.com",
  DB_PORT: "6543",
  DB_USER: "postgres.project",
  DB_PASSWORD: "password",
  DB_NAME: "postgres",
};
assert.equal(resolveDbConfig(poolerFields).poolConfig.port, 6543);
assert.equal(resolveDbConfig(poolerFields, { migration: true }).poolConfig.port, 5432);
assert.equal(resolveDbConfig({ ...poolerFields, DB_HOST: "localhost" }, { migration: true }).poolConfig.port, 6543);

const schema = fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
assert.doesNotMatch(schema, /UPDATE\s+usuarios\s+SET\s+gerencia_instituicoes\s*=\s*FALSE/i);
const groupSeed = schema.match(/INSERT INTO grupos_academicos\b[\s\S]*?;/i)?.[0] || "";
assert.match(groupSeed, /ON CONFLICT\s*\(instituicao_id,\s*tipo,\s*nome\)\s+DO NOTHING/i);

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
