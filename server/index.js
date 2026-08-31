import compression from "compression";
import cors from "cors";
import crypto from "crypto";
import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import fs from "fs";
import helmet from "helmet";
import multer from "multer";
import path from "path";
import swaggerUi from "swagger-ui-express";
import { fileURLToPath } from "url";
import {
  authenticateUser,
  authenticatePlatformUser,
  clearSessionCookie,
  clearPlatformSessionCookie,
  createAuthMiddleware,
  createPassword,
  createPlatformAuthMiddleware,
  createPlatformSession,
  createSession,
  deleteSession,
  deletePlatformSession,
  ensureBootstrapPlatformUser,
  ensureBootstrapUsers,
  normalizeUsername,
  setPlatformSessionCookie,
  setSessionCookie,
} from "./auth.js";
import { createDbPool, initializeSchema, isConnectionError, isDuplicateError, isForeignKeyError } from "./db.js";
import { buildScheduleComparison, isFirstFloorRoom, isUpperFloorRoom } from "./scheduleUtils.js";
import { parseUraniaFiles } from "./uraniaParser.js";

const app = express();
const port = Number(process.env.API_PORT || 3001);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, "..", "dist");
const swaggerDocument = JSON.parse(fs.readFileSync(path.join(__dirname, "swagger.json"), "utf8"));
const isProduction = process.env.NODE_ENV === "production";
const serveStaticFrontend =
  process.env.SERVE_STATIC === "true" && fs.existsSync(path.join(distPath, "index.html"));

const splitEnvList = (...values) =>
  values
    .flatMap((value) => String(value || "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);

const asBoolean = (value) => value === true || value === 1 || value === "1" || value === "true" || value === "on";
const dayOrderSql = "CASE h.dia WHEN 'SEG' THEN 1 WHEN 'TER' THEN 2 WHEN 'QUA' THEN 3 WHEN 'QUI' THEN 4 WHEN 'SEX' THEN 5 WHEN 'SAB' THEN 6 WHEN 'DOM' THEN 7 ELSE 99 END";
const ouvidoriaStatusOrderSql = "CASE o.status WHEN 'NOVA' THEN 1 WHEN 'EM_ANALISE' THEN 2 WHEN 'RESOLVIDA' THEN 3 WHEN 'ARQUIVADA' THEN 4 ELSE 99 END";

const allowedOrigins = new Set(splitEnvList(process.env.PUBLIC_ORIGIN, process.env.ALLOWED_ORIGINS));
const localhostOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

const corsOptions = {
  credentials: true,
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin) || (!isProduction && localhostOriginPattern.test(origin))) {
      return callback(null, true);
    }
    return callback(null, false);
  },
};

const normalizeTrustProxy = (value) => {
  if (value == null || value === "") return isProduction ? 1 : false;
  if (value === "true") return true;
  if (value === "false") return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
};

const trustProxy = normalizeTrustProxy(process.env.TRUST_PROXY);
app.set("trust proxy", trustProxy);

const defaultInstitutionSlug = process.env.DEFAULT_INSTITUTION_SLUG || "cimol";
const resolveInstitutionSlug = (req) => {
  const headerSlug = String(req.headers["x-institution-slug"] || "").trim().toLowerCase();
  if (headerSlug) return headerSlug;
  const host = String(req.hostname || "").toLowerCase();
  const subdomain = host.split(".")[0];
  const isIpAddress = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
  return host.includes(".") && !isIpAddress && subdomain !== "www" ? subdomain : defaultInstitutionSlug;
};

const institutionSelect = `
  id, slug, nome, nome_admin, nome_sistema, subtitulo_admin, logo_url,
  cor_primaria_hsl, cor_acento_hsl, cor_header_hsl, cor_nav_hsl, cor_nav_ativa_hsl, ativo
`;

const loadInstitutionBySlug = async (slug) => {
  const [rows] = await db.query(
    `SELECT ${institutionSelect}
       FROM instituicoes
      WHERE slug = ?
      LIMIT 1`,
    [slug]
  );
  return rows[0] || null;
};

const serializeInstitutionBrand = (row) => ({
  slug: row.slug,
  name: row.nome,
  adminName: row.nome_admin,
  systemName: row.nome_sistema,
  adminSubtitle: row.subtitulo_admin,
  logoUrl: row.logo_url,
  colors: {
    primary: row.cor_primaria_hsl,
    accent: row.cor_acento_hsl,
    header: row.cor_header_hsl,
    nav: row.cor_nav_hsl,
    navActive: row.cor_nav_ativa_hsl,
  },
});

const db = createDbPool();
let databaseReady = false;
const databaseUnavailableDetails =
  "Banco de dados PostgreSQL não conectado. Verifique as variáveis DB_* ou DATABASE_URL/POSTGRES_URL e inicie o PostgreSQL.";
const databaseUnavailableMessage = "O sistema está temporariamente indisponível. Tente novamente mais tarde.";

const ensureDefaultPublicContent = async (institutionId, targetDb = db) => {
  const [sectorCount] = await targetDb.query("SELECT COUNT(*) AS total FROM setores WHERE instituicao_id = ?", [
    institutionId,
  ]);
  if (Number(sectorCount[0]?.total || 0) === 0) {
    await targetDb.query(
      `INSERT INTO setores
       (instituicao_id, nome, descricao, responsavel, localizacao, contato, horario_atendimento, icone, cor, ativo)
       VALUES
       (?, 'Direção', 'Gestão e administração escolar', NULL, 'Prédio administrativo', NULL, NULL, 'building', 'blue', TRUE),
       (?, 'Coordenação Pedagógica', 'Acompanhamento dos cursos e turmas', NULL, 'Prédio administrativo', NULL, NULL, 'graduation', 'violet', TRUE),
       (?, 'Biblioteca', 'Acervo, leitura e sala de estudo', NULL, 'Bloco principal', NULL, NULL, 'book', 'amber', TRUE),
       (?, 'Laboratórios', 'Ambientes técnicos e científicos', NULL, 'Blocos técnicos', NULL, NULL, 'flask', 'emerald', TRUE),
       (?, 'Oficinas', 'Práticas de mecânica e marcenaria', NULL, 'Área técnica', NULL, NULL, 'wrench', 'slate', TRUE),
       (?, 'Cantina', 'Alimentação e convivência', NULL, 'Pátio central', NULL, NULL, 'coffee', 'orange', TRUE),
       (?, 'Portaria', 'Entrada, orientação e segurança', NULL, 'Acesso principal', NULL, NULL, 'shield', 'indigo', TRUE)`,
      Array(7).fill(institutionId)
    );
  }
};

const floorFromRoom = (roomName) => {
  const match = String(roomName).match(/^[A-E]\s?([1-3])/i);
  return match ? `${match[1]}º andar` : "A conferir";
};

const referenceRooms = [
  ["Bloco A", "A201", "Sala de aula", 38],
  ["Bloco A", "A202", "Sala de aula", 38],
  ["Bloco A", "A203", "Sala de aula", 38],
  ["Bloco A", "A204", "Sala de aula", 38],
  ["Bloco A", "A205", "Sala de aula", 38],
  ["Bloco A", "A206", "Sala de aula", 38],
  ["Bloco A", "A301", "Sala de aula", 29],
  ["Bloco A", "A302", "Sala de aula", 20],
  ["Bloco A", "A303", "Sala de aula", 23],
  ["Bloco A", "A304", "Sala de aula", 30],
  ["Bloco A", "A305", "Sala de aula", 38],
  ["Bloco B", "B101", "Sala de aula", 40],
  ["Bloco B", "B102", "Lab. quimica", null],
  ["Bloco B", "B103", "Sala de aula", 34],
  ["Bloco B", "B104", "Sala de aula", 20],
  ["Bloco B", "B105", "Sala de aula", 20],
  ["Bloco C", "C106", "Lab. design", null],
  ["Bloco C", "C108", "Lab. informatica", null],
  ["Bloco C", "C109", "Sala de aula", 22],
  ["Bloco C", "C201", "Lab. eletricidade", null],
  ["Bloco C", "C202", "Sala de aula", 20],
  ["Bloco C", "C204", "Lab. elo digital", null],
  ["Bloco C", "C205", "Lab. pratica", null],
  ["Bloco C", "C207", "Lab. informatica", null],
  ["Bloco C", "C208", "Lab. prat. prof.", null],
  ["Bloco C", "C210", "Lab. informatica", null],
  ["Bloco C", "C211", "Lab. informatica", null],
  ["Bloco C", "C301", "Lab. materiais", 20],
  ["Bloco C", "C302", "Sala de aula", 20],
  ["Bloco C", "C303", "Sala de aula", 20],
  ["Bloco C", "C304", "Sala de aula", 20],
  ["Bloco C", "C305", "Sala de aula", 20],
  ["Bloco C", "C306", "Sala de aula", 20],
  ["Bloco C", "C307", "Sala de aula", 24],
  ["Bloco C", "C308", "Sala de aula", 20],
  ["Bloco C", "C309", "Sala de aula", 20],
  ["Bloco C", "C311", "Sala de aula", 20],
  ["Bloco C", "C312", "Sala de aula", 20],
  ["Bloco C", "C313", "Lab. informatica", null],
  ["Bloco D", "D101", "Of. mecanica", null],
  ["Bloco D", "D101(A)", "Soldagem", null],
  ["Bloco D", "D101(B)", "Sala of. mecanica", null],
  ["Bloco D", "D101(C)", "CNC", null],
  ["Bloco D", "D201", "Telefonia", 22],
  ["Bloco D", "D202", "Lab. informatica", null],
  ["Bloco D", "D203", "Automacao", null],
  ["Bloco D", "D204", "Lab. desenho", 24],
  ["Bloco D", "D205", "Lab. informatica", null],
  ["Bloco D", "D206", "CLP", null],
  ["Bloco D", "D208", "Lab. eletro III", null],
  ["Bloco D", "D209", "Lab. medidas", null],
  ["Bloco D", "D210", "Lab. eletro II", null],
  ["Bloco D", "D211", "Lab. instalacoes", null],
  ["Bloco D", "D212", "Lab. eletronica", null],
  ["Bloco D", "D213", "Lab. informatica", null],
  ["Bloco E", "E101", "Lab. informatica", null],
  ["Bloco E", "E102", "Lab. meio amb.", 20],
];

const ensureReferenceRooms = async (institutionId) => {
  for (const blockName of ["Bloco A", "Bloco B", "Bloco C", "Bloco D", "Bloco E"]) {
    await db.query(
      `INSERT INTO blocos (instituicao_id, nome, descricao)
       VALUES (?, ?, 'Cadastro base do quadro fotografado de salas e laboratorios.')
       ON CONFLICT (instituicao_id, nome) DO NOTHING`,
      [institutionId, blockName]
    );
  }

  for (const [blockName, name, type, capacity] of referenceRooms) {
    const [blocks] = await db.query("SELECT id FROM blocos WHERE instituicao_id = ? AND nome = ? LIMIT 1", [
      institutionId,
      blockName,
    ]);
    const blockId = blocks[0]?.id;
    if (!blockId) continue;
    const [existingRooms] = await db.query(
      `SELECT id
         FROM salas
        WHERE instituicao_id = ?
          AND bloco_id = ?
          AND REPLACE(UPPER(nome), ' ', '') = REPLACE(UPPER(?), ' ', '')
        LIMIT 1`,
      [institutionId, blockId, name]
    );
    if (existingRooms.length) continue;
    const notes = [
      "Cadastro inicial a partir das fotos IMG_4403/IMG_4404.",
      capacity == null ? "Capacidade ilegivel nas fotos; conferir no CPD." : "",
    ]
      .filter(Boolean)
      .join(" ");
    await db.query(
      `INSERT INTO salas
       (instituicao_id, bloco_id, nome, andar, capacidade, tipo, observacoes)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (instituicao_id, bloco_id, nome) DO NOTHING`,
      [institutionId, blockId, name, floorFromRoom(name), capacity, type, notes]
    );
  }
};

try {
  await initializeSchema(path.join(__dirname, "schema.sql"));
  await ensureBootstrapPlatformUser(db);
  const defaultInstitution = await loadInstitutionBySlug(defaultInstitutionSlug);
  if (!defaultInstitution) throw new Error(`Instituicao padrao ${defaultInstitutionSlug} nao encontrada.`);
  await ensureBootstrapUsers(db, defaultInstitution.slug);
  await ensureDefaultPublicContent(defaultInstitution.id);
  await ensureReferenceRooms(defaultInstitution.id);
  databaseReady = true;
} catch (error) {
  console.error(databaseUnavailableDetails, error);
}

const { optionalAuth, requireAuth, requireRole } = createAuthMiddleware(db);
const { optionalPlatformAuth, requirePlatformAuth } = createPlatformAuthMiddleware(db);

app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
});
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(
  "/api",
  rateLimit({
    windowMs: Number(process.env.API_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    limit: Number(process.env.API_RATE_LIMIT || 600),
    standardHeaders: "draft-7",
    legacyHeaders: false,
  })
);
app.use("/api", (_req, res, next) => {
  if (databaseReady) return next();
  return res.status(503).json({ message: databaseUnavailableMessage });
});
app.use("/api", optionalAuth);
app.use("/api", optionalPlatformAuth);
app.use("/api", async (req, res, next) => {
  if (req.path === "/health") return next();
  if (req.path.startsWith("/plataforma/") || req.path === "/instituicoes" || req.path.startsWith("/instituicoes/")) {
    return next();
  }
  try {
    const institution = await loadInstitutionBySlug(resolveInstitutionSlug(req));
    if (!institution) return res.status(404).json({ message: "Instituição não encontrada." });
    req.institution = institution;
    if (req.user && Number(req.user.instituicao_id) !== Number(institution.id)) {
      req.user = null;
    }
    if (!institution.ativo && req.path !== "/instituicao" && req.path !== "/auth/logout") {
      return res.status(403).json({ message: "Serviço indisponível para esta instituição." });
    }
    next();
  } catch (error) {
    next(error);
  }
});
app.use("/api-CIMOL/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

if (serveStaticFrontend) {
  app.use(
    "/assets",
    express.static(path.join(distPath, "assets"), {
      immutable: true,
      maxAge: "1y",
    })
  );
  app.use(express.static(distPath, { maxAge: "5m" }));
} else {
  app.get("/", (_req, res) => res.redirect("/api-CIMOL/docs"));
}
app.get("/.well-known/appspecific/com.chrome.devtools.json", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.status(204).end();
});

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const positiveInt = (value, fallback, { min = 1, max = 500 } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
};
const parseJson = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};
const normalizeLookup = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const normalizeModerationText = (value) =>
  normalizeLookup(value)
    .replace(/0/g, "o")
    .replace(/@/g, "a")
    .replace(/[1!|]/g, "i")
    .replace(/3/g, "e")
    .replace(/[4]/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/7/g, "t");

const inappropriateTerms = new Set([
  "arrombado",
  "bosta",
  "burro",
  "caralho",
  "desgracado",
  "fdp",
  "foda",
  "foder",
  "idiota",
  "imbecil",
  "merda",
  "otario",
  "porra",
  "puta",
  "puto",
  "vagabundo",
]);

const hasInappropriateContent = (...values) => {
  const normalized = normalizeModerationText(values.join(" "));
  const tokens = normalized.split(/[^a-z]+/).filter(Boolean);
  if (tokens.some((token) => inappropriateTerms.has(token))) return true;
  const compact = normalized.replace(/[^a-z]/g, "");
  return [...inappropriateTerms].some((term) => term.length >= 5 && compact.includes(term));
};

const sanitizeFreeText = (value, maxLength) =>
  String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const cacheableJson = (req, res, payload, { maxAge = 60, staleWhileRevalidate = 300 } = {}) => {
  const body = JSON.stringify(payload);
  const etag = `"${crypto.createHash("sha256").update(body).digest("base64url")}"`;
  res.setHeader("Cache-Control", `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`);
  res.setHeader("ETag", etag);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.headers["if-none-match"] === etag) return res.status(304).end();
  return res.send(body);
};

app.get("/api/instituicao", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(serializeInstitutionBrand(req.institution));
  } catch (error) {
    next(error);
  }
});

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const hashToken = (value) => crypto.createHash("sha256").update(value).digest("hex");

const publicBaseUrl = (req) =>
  String(process.env.PUBLIC_ORIGIN || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");

const sendEmail = async ({ to, subject, text }) => {
  if (!process.env.SMTP_HOST) return { sent: false, reason: "SMTP_HOST ausente" };
  if (!process.env.SMTP_FROM && !process.env.SMTP_USER) return { sent: false, reason: "SMTP_FROM ausente" };
  const nodemailer = (await import("nodemailer")).default;
  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE ? asBoolean(process.env.SMTP_SECURE) : port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" }
      : undefined,
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
  });
  return { sent: true };
};

const authRateLimit = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  limit: Number(process.env.AUTH_RATE_LIMIT || 20),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

const uploadRateLimit = rateLimit({
  windowMs: Number(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  limit: Number(process.env.UPLOAD_RATE_LIMIT || 30),
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

const ouvidoriaRateLimit = rateLimit({
  windowMs: Number(process.env.OUVIDORIA_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  limit: Number(process.env.OUVIDORIA_RATE_LIMIT || 8),
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

const notificationRateLimit = rateLimit({
  windowMs: Number(process.env.NOTIFICATION_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  limit: Number(process.env.NOTIFICATION_RATE_LIMIT || 10),
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/jpg",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    cb(allowed.includes(file.mimetype) ? null : new Error("Tipo de arquivo não permitido. Use PDF, imagem ou Word."), allowed.includes(file.mimetype));
  },
});

const uraniaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const allowed = [".html", ".htm", ".xml"].includes(extension);
    cb(allowed ? null : new Error("Formato inválido. Envie arquivos HTML, HTM ou XML do URÂNIA UP."), allowed);
  },
});

// ---------------------------------------------------------------------------
// Autenticação e permissões
// ---------------------------------------------------------------------------
app.post("/api/auth/login", authRateLimit, async (req, res, next) => {
  try {
    const user = await authenticateUser(db, req.body?.usuario, req.body?.senha, req.institution.id);
    if (!user) return res.status(401).json({ message: "Usuário ou senha inválidos." });
    const token = await createSession(db, user.id);
    setSessionCookie(res, token);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", async (req, res, next) => {
  try {
    await deleteSession(db, req);
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => res.json({ user: req.user }));

app.post("/api/plataforma/auth/login", authRateLimit, async (req, res, next) => {
  try {
    const user = await authenticatePlatformUser(db, req.body?.usuario, req.body?.senha);
    if (!user) return res.status(401).json({ message: "Usuário ou senha inválidos." });
    const token = await createPlatformSession(db, user.id);
    setPlatformSessionCookie(res, token);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

app.post("/api/plataforma/auth/logout", async (req, res, next) => {
  try {
    await deletePlatformSession(db, req);
    clearPlatformSessionCookie(res);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/plataforma/auth/me", requirePlatformAuth, (req, res) => res.json({ user: req.platformUser }));

const requirePlatformManager = (req, res, next) => {
  if (!req.platformUser) return res.status(401).json({ message: "Faça login na gestão da plataforma." });
  next();
};

const defaultInstitutionColors = {
  cor_primaria_hsl: "228 65% 48%",
  cor_acento_hsl: "45 100% 51%",
  cor_header_hsl: "228 62% 32%",
  cor_nav_hsl: "228 62% 42%",
  cor_nav_ativa_hsl: "228 50% 52%",
};

const hslColorPattern = /^\d{1,3}(?:\.\d+)?\s+\d{1,3}(?:\.\d+)?%\s+\d{1,3}(?:\.\d+)?%$/;
const normalizeInstitutionSlug = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const normalizeInstitutionPayload = (body = {}) => ({
  slug: normalizeInstitutionSlug(body.slug),
  nome: sanitizeFreeText(body.nome, 120),
  nome_admin: sanitizeFreeText(body.nome_admin, 120),
  nome_sistema: sanitizeFreeText(body.nome_sistema, 160),
  subtitulo_admin: sanitizeFreeText(body.subtitulo_admin, 160),
  logo_url: sanitizeFreeText(body.logo_url, 500) || null,
  cor_primaria_hsl: sanitizeFreeText(body.cor_primaria_hsl, 40) || defaultInstitutionColors.cor_primaria_hsl,
  cor_acento_hsl: sanitizeFreeText(body.cor_acento_hsl, 40) || defaultInstitutionColors.cor_acento_hsl,
  cor_header_hsl: sanitizeFreeText(body.cor_header_hsl, 40) || defaultInstitutionColors.cor_header_hsl,
  cor_nav_hsl: sanitizeFreeText(body.cor_nav_hsl, 40) || defaultInstitutionColors.cor_nav_hsl,
  cor_nav_ativa_hsl: sanitizeFreeText(body.cor_nav_ativa_hsl, 40) || defaultInstitutionColors.cor_nav_ativa_hsl,
  ativo: body.ativo == null ? true : asBoolean(body.ativo),
});

const validateInstitutionPayload = (institution) => {
  if (!institution.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(institution.slug)) {
    throw httpError(400, "Informe um slug válido para o subdomínio.");
  }
  if (!institution.nome || !institution.nome_admin || !institution.nome_sistema || !institution.subtitulo_admin) {
    throw httpError(400, "Preencha nome, nome administrativo, nome do sistema e subtítulo.");
  }
  if (institution.logo_url && !/^https?:\/\//i.test(institution.logo_url)) {
    throw httpError(400, "Informe uma URL de logo iniciando com http:// ou https://.");
  }
  for (const field of Object.keys(defaultInstitutionColors)) {
    if (!hslColorPattern.test(institution[field])) throw httpError(400, "Informe cores HSL válidas.");
  }
};

const serializeAdminInstitution = (row) => ({
  ...row,
  ativo: Boolean(row.ativo),
  total_usuarios: Number(row.total_usuarios || 0),
  total_salas: Number(row.total_salas || 0),
  total_importacoes: Number(row.total_importacoes || 0),
});

const parseInstitutionId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw httpError(400, "Instituição inválida.");
  return id;
};

const parseUserId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw httpError(400, "Usuário inválido.");
  return id;
};

const ensureInstitutionExists = async (targetDb, institutionId) => {
  const [rows] = await targetDb.query("SELECT id FROM instituicoes WHERE id = ? LIMIT 1", [institutionId]);
  if (!rows.length) throw httpError(404, "Instituição não encontrada.");
};

const normalizeInstitutionUserPayload = (body = {}) => {
  const papel = String(body.papel || "ADMIN").trim().toUpperCase();
  return {
    nome: sanitizeFreeText(body.nome, 120),
    usuario: normalizeUsername(body.usuario).slice(0, 60),
    senha: String(body.senha || ""),
    papel,
    gerencia_instituicoes: false,
    ativo: body.ativo == null ? true : asBoolean(body.ativo),
  };
};

const normalizeInitialInstitutionAdmin = (body = {}) =>
  normalizeInstitutionUserPayload({
    nome: body.admin_nome,
    usuario: body.admin_usuario,
    senha: body.admin_senha,
    papel: "CPD",
    gerencia_instituicoes: false,
    ativo: true,
  });

const validateInstitutionUserPayload = (user, { creating = false } = {}) => {
  if (!user.nome) throw httpError(400, "Informe o nome do usuário.");
  if (!/^[a-z0-9._-]{3,60}$/.test(user.usuario)) {
    throw httpError(400, "Informe um usuário com 3 a 60 letras, números, pontos, hífens ou sublinhados.");
  }
  if (!["ADMIN", "CPD"].includes(user.papel)) throw httpError(400, "Papel inválido.");
  if ((creating || user.senha) && user.senha.length < 6) {
    throw httpError(400, "Informe uma senha com pelo menos 6 caracteres.");
  }
};

const serializeInstitutionUser = (row) => ({
  id: row.id,
  instituicao_id: row.instituicao_id,
  nome: row.nome,
  usuario: row.usuario,
  papel: row.papel,
  ativo: Boolean(row.ativo),
  created_at: row.created_at,
  updated_at: row.updated_at,
});

app.get("/api/instituicoes", requirePlatformManager, async (_req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT i.id, i.slug, i.nome, i.nome_admin, i.nome_sistema, i.subtitulo_admin, i.logo_url,
              i.cor_primaria_hsl, i.cor_acento_hsl, i.cor_header_hsl, i.cor_nav_hsl, i.cor_nav_ativa_hsl,
              i.ativo, i.created_at, i.updated_at,
              (SELECT COUNT(*) FROM usuarios u WHERE u.instituicao_id = i.id)::int AS total_usuarios,
              (SELECT COUNT(*) FROM salas s WHERE s.instituicao_id = i.id)::int AS total_salas,
              (SELECT COUNT(*) FROM importacoes_horarios h WHERE h.instituicao_id = i.id)::int AS total_importacoes
         FROM instituicoes i
        ORDER BY i.ativo DESC, i.nome`
    );
    res.json(rows.map(serializeAdminInstitution));
  } catch (error) {
    next(error);
  }
});

app.post("/api/instituicoes", requirePlatformManager, async (req, res, next) => {
  const institution = normalizeInstitutionPayload(req.body);
  const adminUser = normalizeInitialInstitutionAdmin(req.body);
  let conn;
  try {
    validateInstitutionPayload(institution);
    validateInstitutionUserPayload(adminUser, { creating: true });
    conn = await db.getConnection();
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO instituicoes
       (slug, nome, nome_admin, nome_sistema, subtitulo_admin, logo_url,
        cor_primaria_hsl, cor_acento_hsl, cor_header_hsl, cor_nav_hsl, cor_nav_ativa_hsl, ativo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [
        institution.slug,
        institution.nome,
        institution.nome_admin,
        institution.nome_sistema,
        institution.subtitulo_admin,
        institution.logo_url,
        institution.cor_primaria_hsl,
        institution.cor_acento_hsl,
        institution.cor_header_hsl,
        institution.cor_nav_hsl,
        institution.cor_nav_ativa_hsl,
        institution.ativo,
      ]
    );
    await ensureDefaultPublicContent(result.insertId, conn);
    const { hash, salt } = await createPassword(adminUser.senha);
    const [adminResult] = await conn.query(
      `INSERT INTO usuarios
       (instituicao_id, nome, usuario, senha_hash, senha_salt, papel, gerencia_instituicoes, ativo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [result.insertId, adminUser.nome, adminUser.usuario, hash, salt, adminUser.papel, false, true]
    );
    await conn.commit();
    res.status(201).json({ id: result.insertId, usuario_inicial_id: adminResult.insertId });
  } catch (error) {
    if (conn) await conn.rollback();
    next(error);
  } finally {
    if (conn) conn.release();
  }
});

app.put("/api/instituicoes/:id", requirePlatformManager, async (req, res, next) => {
  const institution = normalizeInstitutionPayload(req.body);
  try {
    validateInstitutionPayload(institution);
    const [result] = await db.query(
      `UPDATE instituicoes
          SET slug = ?, nome = ?, nome_admin = ?, nome_sistema = ?, subtitulo_admin = ?, logo_url = ?,
              cor_primaria_hsl = ?, cor_acento_hsl = ?, cor_header_hsl = ?, cor_nav_hsl = ?,
              cor_nav_ativa_hsl = ?, ativo = ?
        WHERE id = ?`,
      [
        institution.slug,
        institution.nome,
        institution.nome_admin,
        institution.nome_sistema,
        institution.subtitulo_admin,
        institution.logo_url,
        institution.cor_primaria_hsl,
        institution.cor_acento_hsl,
        institution.cor_header_hsl,
        institution.cor_nav_hsl,
        institution.cor_nav_ativa_hsl,
        institution.ativo,
        req.params.id,
      ]
    );
    if (!result.affectedRows) throw httpError(404, "Instituição não encontrada.");
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/instituicoes/:institutionId/usuarios", requirePlatformManager, async (req, res, next) => {
  try {
    const institutionId = parseInstitutionId(req.params.institutionId);
    await ensureInstitutionExists(db, institutionId);
    const [rows] = await db.query(
      `SELECT id, instituicao_id, nome, usuario, papel, ativo, created_at, updated_at
         FROM usuarios
        WHERE instituicao_id = ?
        ORDER BY ativo DESC, papel DESC, nome`,
      [institutionId]
    );
    res.json(rows.map(serializeInstitutionUser));
  } catch (error) {
    next(error);
  }
});

app.post("/api/instituicoes/:institutionId/usuarios", requirePlatformManager, async (req, res, next) => {
  const user = normalizeInstitutionUserPayload(req.body);
  try {
    const institutionId = parseInstitutionId(req.params.institutionId);
    validateInstitutionUserPayload(user, { creating: true });
    await ensureInstitutionExists(db, institutionId);
    const { hash, salt } = await createPassword(user.senha);
    const [result] = await db.query(
      `INSERT INTO usuarios
       (instituicao_id, nome, usuario, senha_hash, senha_salt, papel, gerencia_instituicoes, ativo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [institutionId, user.nome, user.usuario, hash, salt, user.papel, false, user.ativo]
    );
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    next(error);
  }
});

app.put("/api/instituicoes/:institutionId/usuarios/:userId", requirePlatformManager, async (req, res, next) => {
  const user = normalizeInstitutionUserPayload(req.body);
  try {
    const institutionId = parseInstitutionId(req.params.institutionId);
    const userId = parseUserId(req.params.userId);
    validateInstitutionUserPayload(user);
    await ensureInstitutionExists(db, institutionId);

    const updates = ["nome = ?", "usuario = ?", "papel = ?", "gerencia_instituicoes = FALSE", "ativo = ?"];
    const params = [user.nome, user.usuario, user.papel, user.ativo];
    if (user.senha) {
      const { hash, salt } = await createPassword(user.senha);
      updates.push("senha_hash = ?", "senha_salt = ?");
      params.push(hash, salt);
    }
    params.push(userId, institutionId);

    const [result] = await db.query(
      `UPDATE usuarios SET ${updates.join(", ")} WHERE id = ? AND instituicao_id = ?`,
      params
    );
    if (!result.affectedRows) throw httpError(404, "Usuário não encontrado.");
    if (!user.ativo || user.senha) await db.query("DELETE FROM sessoes WHERE usuario_id = ?", [userId]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// Mantém compatibilidade temporária com consumidores antigos da API de reorganização.
const cpdOrLegacyAuth = (req, res, next) => {
  const secretKey = process.env.VITE_API_KEY;
  const providedKey = req.headers["x-api-key"];
  if (req.user?.papel === "CPD" || (secretKey && providedKey === secretKey)) return next();
  if (req.user) return res.status(403).json({ message: "Somente o CPD pode acessar esta função." });
  return res.status(401).json({ message: "Acesso não autorizado." });
};

const updatePublishedScheduleRoom = async (conn, { institutionId, scheduleId, roomId, userId, studentCount, reason }) => {
  const [schedules] = await conn.query(
    `SELECT h.id, h.importacao_id, h.turma, h.dia, h.periodo, h.hora_inicio, h.sala_id,
            h.disciplina, h.professor, h.ambiente, s.nome AS sala_nome
       FROM horarios_importados h
       JOIN importacoes_horarios i ON i.id = h.importacao_id
       LEFT JOIN salas s ON s.id = h.sala_id AND s.instituicao_id = i.instituicao_id
      WHERE h.id = ?
        AND i.instituicao_id = ?
        AND h.categoria = 'TURMA'
        AND i.status = 'APROVADA'
        AND i.ativa = TRUE
      FOR UPDATE`,
    [scheduleId, institutionId]
  );
  if (!schedules.length) throw httpError(404, "Horário publicado não encontrado.");
  const schedule = schedules[0];

  let roomName = null;

  if (roomId !== null) {
    const [rooms] = await conn.query(
      "SELECT id, nome, capacidade, status FROM salas WHERE id = ? AND instituicao_id = ? LIMIT 1",
      [roomId, institutionId]
    );
    if (!rooms.length) throw httpError(400, "Sala não encontrada.");
    if (rooms[0].status !== "ATIVA") throw httpError(409, `A sala ${rooms[0].nome} não está ativa.`);
    if (studentCount !== null && rooms[0].capacidade !== null && studentCount > Number(rooms[0].capacidade)) {
      throw httpError(409, `A sala ${rooms[0].nome} comporta ${rooms[0].capacidade} alunos.`);
    }
    roomName = rooms[0].nome;

    const [conflicts] = await conn.query(
      `SELECT turma, disciplina, professor
         FROM horarios_importados
        WHERE importacao_id = ?
          AND id <> ?
          AND categoria = 'TURMA'
          AND dia = ?
          AND periodo = ?
          AND (
            sala_id = ?
            OR (
              sala_id IS NULL
              AND ambiente IS NOT NULL
              AND REPLACE(LOWER(TRIM(ambiente)), ' ', '') = REPLACE(LOWER(TRIM(?)), ' ', '')
            )
          )
        LIMIT 1`,
      [
        schedule.importacao_id,
        scheduleId,
        schedule.dia,
        schedule.periodo,
        roomId,
        roomName,
      ]
    );
    if (conflicts.length) {
      const conflict = conflicts[0];
      throw httpError(
        409,
        `A sala já está ocupada por ${conflict.turma} em ${conflict.disciplina}${conflict.professor ? ` (${conflict.professor})` : ""}.`
      );
    }
  }

  const changed = Number(schedule.sala_id || 0) !== Number(roomId || 0);
  if (changed) {
    await conn.query("UPDATE horarios_importados SET sala_id = ? WHERE id = ?", [roomId, scheduleId]);
    await conn.query(
      `INSERT INTO sala_alteracoes
       (horario_id, usuario_id, turma, dia, periodo, sala_anterior_id, sala_nova_id, quantidade_alunos, motivo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        scheduleId,
        userId,
        schedule.turma,
        schedule.dia,
        schedule.periodo,
        schedule.sala_id || null,
        roomId,
        studentCount,
        reason,
      ]
    );
  }

  return {
    ok: true,
    id: scheduleId,
    sala_id: roomId,
    turma: schedule.turma,
    updated: changed ? 1 : 0,
    changed,
    alteracoes: changed ? [{
      horario_id: schedule.id,
      dia: schedule.dia,
      periodo: schedule.periodo,
      hora_inicio: schedule.hora_inicio,
      disciplina: schedule.disciplina,
      sala_anterior: schedule.sala_nome || schedule.ambiente || null,
      sala_nova: roomName,
    }] : [],
  };
};

const addReorganizationRooms = async (conn, requestId, rooms) => {
  const names = [...new Set(rooms.map((value) => String(value || "").trim().slice(0, 50)).filter(Boolean))];
  for (const room of names) {
    await conn.query(
      "INSERT INTO reorganizacao_salas_relacionadas (reorganizacao_id, sala) VALUES (?, ?) ON CONFLICT DO NOTHING",
      [requestId, room]
    );
  }
};

const applyGroundFloorReorganization = async (conn, { institutionId, turma, userId, studentCount, reason }) => {
  const [schedules] = await conn.query(
    `SELECT h.id, h.turma, h.dia, h.periodo, TO_CHAR(h.hora_inicio, 'HH24:MI') AS hora_inicio,
            h.disciplina, h.professor, h.sala_id, h.ambiente,
            s.nome AS sala_nome, s.andar AS sala_andar
       FROM horarios_importados h
       JOIN importacoes_horarios i ON i.id = h.importacao_id
       LEFT JOIN salas s ON s.id = h.sala_id AND s.instituicao_id = i.instituicao_id
      WHERE i.status = 'APROVADA'
        AND i.ativa = TRUE
        AND i.instituicao_id = ?
        AND h.categoria = 'TURMA'
        AND h.turma = ?
      ORDER BY ${dayOrderSql}, h.periodo`,
    [institutionId, turma]
  );
  const upperSchedules = schedules.filter((schedule) =>
    isUpperFloorRoom({ nome: schedule.sala_nome || schedule.ambiente, andar: schedule.sala_andar })
  );
  const [rooms] = await conn.query(
    `SELECT s.id, s.nome, s.andar, s.capacidade, s.acessivel, s.tipo, b.nome AS bloco_nome
       FROM salas s
       JOIN blocos b ON b.id = s.bloco_id
      WHERE s.instituicao_id = ?
        AND s.status = 'ATIVA'
      ORDER BY s.acessivel DESC,
               CASE WHEN LOWER(s.tipo) LIKE '%sala%' THEN 0 ELSE 1 END,
               b.nome, s.nome`,
    [institutionId]
  );
  const candidates = rooms.filter(isFirstFloorRoom);
  if (!upperSchedules.length) {
    return { avaliadas: 0, candidatas: candidates.length, aplicadas: [], nao_aplicadas: [] };
  }

  const applied = [];
  const skipped = [];

  for (const schedule of upperSchedules) {
    let lastError = "";
    for (const room of candidates) {
      if (Number(room.id) === Number(schedule.sala_id || 0)) continue;
      try {
        const result = await updatePublishedScheduleRoom(conn, {
          institutionId,
          scheduleId: schedule.id,
          roomId: room.id,
          userId,
          studentCount,
          reason,
        });
        applied.push(...result.alteracoes);
        break;
      } catch (error) {
        if (![400, 409].includes(error.statusCode)) throw error;
        lastError = error.message;
      }
    }
    if (!applied.some((item) => item.horario_id === schedule.id)) {
      skipped.push({
        horario_id: schedule.id,
        dia: schedule.dia,
        periodo: schedule.periodo,
        hora_inicio: schedule.hora_inicio,
        disciplina: schedule.disciplina,
        sala_anterior: schedule.sala_nome || schedule.ambiente || null,
        motivo: lastError || "Nenhuma sala de primeiro andar livre para este horário.",
      });
    }
  }

  return { avaliadas: upperSchedules.length, candidatas: candidates.length, aplicadas: applied, nao_aplicadas: skipped };
};

// ---------------------------------------------------------------------------
// Saúde da API
// ---------------------------------------------------------------------------
app.get("/api/health", async (_req, res, next) => {
  try {
    await db.query("SELECT 1");
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Módulo existente: reorganização de salas
// ---------------------------------------------------------------------------
app.get("/api/reorganizacao", cpdOrLegacyAuth, async (req, res, next) => {
  try {
    const institutionId = req.institution.id;
    const paginated = req.query.page || req.query.page_size;
    const page = positiveInt(req.query.page, 1, { max: 100000 });
    const pageSize = positiveInt(req.query.page_size, 100, { min: 10, max: 500 });
    const limitClause = paginated ? "LIMIT ? OFFSET ?" : "";
    const params = paginated ? [institutionId, pageSize, (page - 1) * pageSize] : [institutionId];
    const [rows] = await db.query(`
      SELECT r.id, a.nome AS aluno, a.ano, a.turma, a.curso, r.problema,
             r.arquivo_nome, TO_CHAR(r.data, 'YYYY-MM-DD') AS data,
             STRING_AGG(sr.sala, ', ' ORDER BY sr.sala) AS salas
        FROM reorganizacoes r
        JOIN alunos a ON r.aluno_id = a.id
        LEFT JOIN reorganizacao_salas_relacionadas sr ON r.id = sr.reorganizacao_id
       WHERE a.instituicao_id = ?
       GROUP BY r.id, a.id
       ORDER BY r.id DESC
       ${limitClause}
    `, params);
    if (!paginated) return res.json(rows);

    const [countRows] = await db.query(
      "SELECT COUNT(*) AS total FROM reorganizacoes r JOIN alunos a ON a.id = r.aluno_id WHERE a.instituicao_id = ?",
      [institutionId]
    );
    res.json({
      items: rows,
      paginacao: { pagina: page, por_pagina: pageSize, total: Number(countRows[0].total) },
    });
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/reorganizacao",
  uploadRateLimit,
  cpdOrLegacyAuth,
  documentUpload.single("arquivo"),
  async (req, res, next) => {
    const { aluno, ano, turma, curso, problema, salas } = req.body;
    const shouldReorganizeUpperFloors = asBoolean(req.body?.restricao_andar_superior);
    const rawStudentCount = req.body?.quantidade_alunos;
    const studentCount =
      rawStudentCount === null || rawStudentCount === undefined || rawStudentCount === ""
        ? null
        : Number(rawStudentCount);
    if (!aluno || !ano || !turma || !curso || !problema) {
      return res.status(400).json({ message: "Preencha todos os campos obrigatórios." });
    }
    if (shouldReorganizeUpperFloors && !req.user?.id) {
      return res.status(403).json({ message: "A troca automática de salas exige usuário CPD autenticado." });
    }
    if (studentCount !== null && (!Number.isInteger(studentCount) || studentCount < 1)) {
      return res.status(400).json({ message: "Informe uma quantidade de alunos válida." });
    }

    const conn = await db.getConnection();
    try {
      const institutionId = req.institution.id;
      await conn.beginTransaction();
      const [existingStudents] = await conn.query(
        "SELECT id FROM alunos WHERE instituicao_id = ? AND nome = ? AND ano = ? AND turma = ? AND curso = ?",
        [institutionId, aluno, ano, turma, curso]
      );
      let studentId = existingStudents[0]?.id;
      if (!studentId) {
        const [newStudent] = await conn.query(
          "INSERT INTO alunos (instituicao_id, nome, ano, turma, curso) VALUES (?, ?, ?, ?, ?) RETURNING id",
          [institutionId, aluno, ano, turma, curso]
        );
        studentId = newStudent.insertId;
      }

      const [newRequest] = await conn.query(
        `INSERT INTO reorganizacoes (aluno_id, problema, arquivo_nome, arquivo_dados, data)
         VALUES (?, ?, ?, ?, CURRENT_DATE)
         RETURNING id`,
        [studentId, problema, req.file?.originalname || null, req.file?.buffer || null]
      );
      const requestId = newRequest.insertId;
      await addReorganizationRooms(conn, requestId, String(salas || "").split(","));

      let reorganization = null;
      if (shouldReorganizeUpperFloors) {
        reorganization = await applyGroundFloorReorganization(conn, {
          institutionId,
          turma,
          userId: req.user.id,
          studentCount,
          reason: sanitizeFreeText(`Reorganização por acessibilidade: ${problema}`, 255),
        });
        await addReorganizationRooms(conn, requestId, [
          ...reorganization.aplicadas.map((item) => item.sala_anterior),
          ...reorganization.aplicadas.map((item) => item.sala_nova),
          ...reorganization.nao_aplicadas.map((item) => item.sala_anterior),
        ]);
      }
      await conn.commit();
      res.status(201).json({ id: requestId, reorganizacao: reorganization });
    } catch (error) {
      await conn.rollback();
      next(error);
    } finally {
      conn.release();
    }
  }
);

app.get("/api/reorganizacao/:id/arquivo", cpdOrLegacyAuth, async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT r.arquivo_nome, r.arquivo_dados
         FROM reorganizacoes r
         JOIN alunos a ON a.id = r.aluno_id
        WHERE r.id = ? AND a.instituicao_id = ?`,
      [req.params.id, req.institution.id]
    );
    if (!rows.length || !rows[0].arquivo_dados) {
      return res.status(404).json({ message: "Arquivo não encontrado." });
    }
    res.setHeader("Content-Disposition", `attachment; filename="${rows[0].arquivo_nome}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(rows[0].arquivo_dados);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/reorganizacao/:id", cpdOrLegacyAuth, async (req, res, next) => {
  try {
    await db.query(
      `DELETE FROM reorganizacoes r
        USING alunos a
       WHERE a.id = r.aluno_id
         AND r.id = ?
         AND a.instituicao_id = ?`,
      [req.params.id, req.institution.id]
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Blocos
// ---------------------------------------------------------------------------
app.get("/api/blocos", async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT b.id, b.nome, b.descricao, b.created_at, b.updated_at,
             COUNT(s.id)::int AS total_salas
        FROM blocos b
        LEFT JOIN salas s ON s.bloco_id = b.id AND s.instituicao_id = b.instituicao_id
       WHERE b.instituicao_id = ?
       GROUP BY b.id
       ORDER BY b.nome
    `, [req.institution.id]);
    if (req.user) return res.json(rows);
    return cacheableJson(req, res, rows, { maxAge: 60, staleWhileRevalidate: 300 });
  } catch (error) {
    next(error);
  }
});

app.post("/api/blocos", requireRole("CPD"), async (req, res, next) => {
  try {
    const nome = String(req.body?.nome || "").trim();
    const descricao = String(req.body?.descricao || "").trim() || null;
    if (!nome) throw httpError(400, "Informe o nome do bloco.");
    const [result] = await db.query(
      "INSERT INTO blocos (instituicao_id, nome, descricao) VALUES (?, ?, ?) RETURNING id",
      [req.institution.id, nome, descricao]
    );
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    next(error);
  }
});

app.put("/api/blocos/:id", requireRole("CPD"), async (req, res, next) => {
  try {
    const nome = String(req.body?.nome || "").trim();
    const descricao = String(req.body?.descricao || "").trim() || null;
    if (!nome) throw httpError(400, "Informe o nome do bloco.");
    const [result] = await db.query("UPDATE blocos SET nome = ?, descricao = ? WHERE id = ? AND instituicao_id = ?", [
      nome,
      descricao,
      req.params.id,
      req.institution.id,
    ]);
    if (!result.affectedRows) throw httpError(404, "Bloco não encontrado.");
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/blocos/:id", requireRole("CPD"), async (req, res, next) => {
  try {
    const [result] = await db.query("DELETE FROM blocos WHERE id = ? AND instituicao_id = ?", [
      req.params.id,
      req.institution.id,
    ]);
    if (!result.affectedRows) throw httpError(404, "Bloco não encontrado.");
    res.json({ ok: true });
  } catch (error) {
    if (isForeignKeyError(error)) {
      next(httpError(409, "O bloco possui salas e não pode ser excluído."));
    } else next(error);
  }
});

// ---------------------------------------------------------------------------
// Salas
// ---------------------------------------------------------------------------
const roomSelect = `
  SELECT s.id, s.instituicao_id, s.nome, s.bloco_id, b.nome AS bloco_nome, s.andar, s.capacidade, s.tipo,
         s.status, s.acessivel, s.possui_computadores, s.possui_data_show, s.possui_internet,
         s.possui_ar_condicionado, s.observacoes, s.created_at, s.updated_at,
         STRING_AGG(sw.nome, '||' ORDER BY sw.nome) AS softwares
    FROM salas s
    JOIN blocos b ON b.id = s.bloco_id AND b.instituicao_id = s.instituicao_id
    LEFT JOIN sala_softwares ss ON ss.sala_id = s.id
    LEFT JOIN softwares sw ON sw.id = ss.software_id AND sw.instituicao_id = s.instituicao_id
`;

const serializeRoom = (row) => ({
  ...row,
  acessivel: Boolean(row.acessivel),
  possui_computadores: Boolean(row.possui_computadores),
  possui_data_show: Boolean(row.possui_data_show),
  possui_internet: Boolean(row.possui_internet),
  possui_ar_condicionado: Boolean(row.possui_ar_condicionado),
  softwares: row.softwares ? row.softwares.split("||") : [],
});

app.get("/api/salas", async (req, res, next) => {
  try {
    const conditions = ["s.instituicao_id = ?"];
    const params = [req.institution.id];
    if (req.query.bloco_id) {
      conditions.push("s.bloco_id = ?");
      params.push(req.query.bloco_id);
    }
    if (req.query.tipo) {
      conditions.push("s.tipo = ?");
      params.push(req.query.tipo);
    }
    if (req.query.capacidade_minima) {
      conditions.push("s.capacidade >= ?");
      params.push(Number(req.query.capacidade_minima));
    }
    if (req.query.status) {
      conditions.push("s.status = ?");
      params.push(String(req.query.status).toUpperCase());
    } else if (!req.user) {
      conditions.push("s.status = 'ATIVA'");
    }
    for (const resource of [
      "possui_computadores",
      "possui_data_show",
      "possui_internet",
      "possui_ar_condicionado",
    ]) {
      if (req.query[resource] === "true" || req.query[resource] === "1") {
        conditions.push(`s.${resource} = TRUE`);
      }
    }
    if (req.query.software) {
      conditions.push(`EXISTS (
        SELECT 1 FROM sala_softwares filter_ss
        JOIN softwares filter_sw ON filter_sw.id = filter_ss.software_id
        WHERE filter_ss.sala_id = s.id AND filter_sw.instituicao_id = s.instituicao_id AND filter_sw.nome ILIKE ?
      )`);
      params.push(`%${req.query.software}%`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const paginated = req.query.page || req.query.page_size;
    const page = positiveInt(req.query.page, 1, { max: 100000 });
    const pageSize = positiveInt(req.query.page_size, 100, { min: 10, max: 500 });
    const limitClause = paginated ? "LIMIT ? OFFSET ?" : "";
    const queryParams = paginated ? [...params, pageSize, (page - 1) * pageSize] : params;
    const [rows] = await db.query(
      `${roomSelect} ${where} GROUP BY s.id, b.nome ORDER BY b.nome, s.nome ${limitClause}`,
      queryParams
    );
    const items = rows.map(serializeRoom);
    if (!paginated) {
      if (req.user) return res.json(items);
      return cacheableJson(req, res, items, { maxAge: 60, staleWhileRevalidate: 300 });
    }

    const [countRows] = await db.query(
      `SELECT COUNT(DISTINCT s.id) AS total
         FROM salas s
         JOIN blocos b ON b.id = s.bloco_id
         LEFT JOIN sala_softwares ss ON ss.sala_id = s.id
         LEFT JOIN softwares sw ON sw.id = ss.software_id
       ${where}`,
      params
    );
    const payload = {
      items,
      paginacao: { pagina: page, por_pagina: pageSize, total: Number(countRows[0].total) },
    };
    if (req.user) return res.json(payload);
    return cacheableJson(req, res, payload, { maxAge: 60, staleWhileRevalidate: 300 });
  } catch (error) {
    next(error);
  }
});

app.get("/api/salas/ocupacoes", async (req, res, next) => {
  try {
    const institutionId = req.institution.id;
    const publicStatusFilter = req.user ? "" : "AND s.status = 'ATIVA'";
    const [rows] = await db.query(
      `SELECT h.id, COALESCE(h.sala_id, s.id) AS sala_id, s.nome AS sala_nome, b.nome AS bloco_nome,
              h.turma, h.curso, h.ano, h.dia, h.periodo,
              TO_CHAR(h.hora_inicio, 'HH24:MI') AS hora_inicio,
              h.disciplina, h.professor
         FROM horarios_importados h
         JOIN importacoes_horarios i ON i.id = h.importacao_id
         LEFT JOIN (
           SELECT MIN(id) AS id, REPLACE(LOWER(TRIM(nome)), ' ', '') AS nome_key
             FROM salas
            WHERE instituicao_id = ?
            GROUP BY nome_key
           HAVING COUNT(*) = 1
         ) sala_importada ON h.sala_id IS NULL
                          AND h.ambiente IS NOT NULL
                          AND sala_importada.nome_key = REPLACE(LOWER(TRIM(h.ambiente)), ' ', '')
         JOIN salas s ON s.id = COALESCE(h.sala_id, sala_importada.id) AND s.instituicao_id = i.instituicao_id
         JOIN blocos b ON b.id = s.bloco_id
        WHERE i.status = 'APROVADA'
          AND i.ativa = TRUE
          AND i.instituicao_id = ?
          AND h.categoria = 'TURMA'
          ${publicStatusFilter}
        ORDER BY b.nome, s.nome, ${dayOrderSql}, h.periodo, h.turma`,
      [institutionId, institutionId]
    );
    const payload = { horarios: rows };
    if (req.user) return res.json(payload);
    return cacheableJson(req, res, payload, { maxAge: 60, staleWhileRevalidate: 300 });
  } catch (error) {
    next(error);
  }
});

app.get("/api/salas/:id", async (req, res, next) => {
  try {
    const publicStatusFilter = req.user ? "" : "AND s.status = 'ATIVA'";
    const [rows] = await db.query(
      `${roomSelect} WHERE s.instituicao_id = ? AND s.id = ? ${publicStatusFilter} GROUP BY s.id, b.nome`,
      [req.institution.id, req.params.id]
    );
    if (!rows.length) throw httpError(404, "Sala não encontrada.");
    res.json(serializeRoom(rows[0]));
  } catch (error) {
    next(error);
  }
});

app.get("/api/salas/:id/ocupacao", async (req, res, next) => {
  const roomId = Number(req.params.id);
  if (!Number.isInteger(roomId) || roomId < 1) return next(httpError(400, "Sala inválida."));

  try {
    const institutionId = req.institution.id;
    const publicStatusFilter = req.user ? "" : "AND s.status = 'ATIVA'";
    const [rows] = await db.query(
      `SELECT h.id, h.turma, h.curso, h.ano, h.dia, h.periodo,
              TO_CHAR(h.hora_inicio, 'HH24:MI') AS hora_inicio,
              h.disciplina, h.professor
         FROM horarios_importados h
         JOIN importacoes_horarios i ON i.id = h.importacao_id
         JOIN salas s ON s.id = h.sala_id
        WHERE i.status = 'APROVADA'
          AND i.ativa = TRUE
          AND i.instituicao_id = ?
          AND h.categoria = 'TURMA'
          AND h.sala_id = ?
          AND s.instituicao_id = ?
          ${publicStatusFilter}
        ORDER BY ${dayOrderSql}, h.periodo, h.turma`,
      [institutionId, roomId, institutionId]
    );
    const payload = { horarios: rows };
    if (req.user) return res.json(payload);
    return cacheableJson(req, res, payload, { maxAge: 60, staleWhileRevalidate: 300 });
  } catch (error) {
    next(error);
  }
});

app.get("/api/sala-alteracoes", requireRole("CPD"), async (req, res, next) => {
  try {
    const limit = positiveInt(req.query.limit, 50, { min: 1, max: 200 });
    const [rows] = await db.query(
      `SELECT a.id, a.horario_id, a.turma, a.dia, a.periodo, a.quantidade_alunos,
              TO_CHAR(h.hora_inicio, 'HH24:MI') AS hora_inicio,
              a.motivo, a.created_at,
              anterior.nome AS sala_anterior,
              nova.nome AS sala_nova,
              u.nome AS usuario_nome
         FROM sala_alteracoes a
         JOIN usuarios u ON u.id = a.usuario_id
         JOIN horarios_importados h ON h.id = a.horario_id
         JOIN importacoes_horarios i ON i.id = h.importacao_id
         LEFT JOIN salas anterior ON anterior.id = a.sala_anterior_id AND anterior.instituicao_id = i.instituicao_id
         LEFT JOIN salas nova ON nova.id = a.sala_nova_id AND nova.instituicao_id = i.instituicao_id
        WHERE i.instituicao_id = ?
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT ?`,
      [req.institution.id, limit]
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

const normalizeRoomPayload = (body = {}) => {
  const softwares = Array.isArray(body.softwares)
    ? body.softwares
    : String(body.softwares || "").split(",");
  const rawCapacity = body.capacidade === null || body.capacidade === undefined || body.capacidade === "" ? null : Number(body.capacidade);
  return {
    bloco_id: Number(body.bloco_id),
    nome: String(body.nome || "").trim(),
    andar: String(body.andar || "").trim(),
    capacidade: rawCapacity,
    tipo: String(body.tipo || "").trim(),
    status: String(body.status || "ATIVA").trim().toUpperCase(),
    acessivel: asBoolean(body.acessivel),
    possui_computadores: asBoolean(body.possui_computadores),
    possui_data_show: asBoolean(body.possui_data_show),
    possui_internet: asBoolean(body.possui_internet),
    possui_ar_condicionado: asBoolean(body.possui_ar_condicionado),
    observacoes: String(body.observacoes || "").trim() || null,
    softwares: [...new Set(softwares.map((value) => String(value).trim()).filter(Boolean))],
  };
};

const validateRoom = (room) => {
  if (!room.bloco_id || !room.nome || !room.andar || !room.tipo) {
    throw httpError(400, "Preencha bloco, nome, andar e tipo da sala.");
  }
  if (room.capacidade !== null && (!Number.isInteger(room.capacidade) || room.capacidade < 1)) {
    throw httpError(400, "Informe uma capacidade válida ou deixe em branco para conferência.");
  }
  if (!["ATIVA", "INATIVA", "MANUTENCAO"].includes(room.status)) {
    throw httpError(400, "Status da sala inválido.");
  }
};

const ensureBlockBelongsToInstitution = async (conn, blockId, institutionId) => {
  const [rows] = await conn.query("SELECT id FROM blocos WHERE id = ? AND instituicao_id = ? LIMIT 1", [
    blockId,
    institutionId,
  ]);
  if (!rows.length) throw httpError(400, "Bloco não encontrado.");
};

const saveRoomSoftwares = async (conn, roomId, softwares, institutionId) => {
  await conn.query("DELETE FROM sala_softwares WHERE sala_id = ?", [roomId]);
  for (const software of softwares) {
    const [result] = await conn.query(
      `INSERT INTO softwares (instituicao_id, nome) VALUES (?, ?)
       ON CONFLICT (instituicao_id, nome) DO UPDATE SET nome = EXCLUDED.nome
       RETURNING id`,
      [institutionId, software]
    );
    await conn.query("INSERT INTO sala_softwares (sala_id, software_id) VALUES (?, ?) ON CONFLICT DO NOTHING", [
      roomId,
      result.insertId,
    ]);
  }
  await conn.query(`DELETE FROM softwares WHERE NOT EXISTS (
    SELECT 1 FROM sala_softwares WHERE sala_softwares.software_id = softwares.id
  ) AND instituicao_id = ?`, [institutionId]);
};

app.post("/api/salas", requireRole("CPD"), async (req, res, next) => {
  const room = normalizeRoomPayload(req.body);
  try {
    validateRoom(room);
  } catch (error) {
    return next(error);
  }
  const conn = await db.getConnection();
  try {
    const institutionId = req.institution.id;
    await conn.beginTransaction();
    await ensureBlockBelongsToInstitution(conn, room.bloco_id, institutionId);
    const [result] = await conn.query(
      `INSERT INTO salas
       (instituicao_id, bloco_id, nome, andar, capacidade, tipo, status, acessivel, possui_computadores, possui_data_show,
        possui_internet, possui_ar_condicionado, observacoes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [
        institutionId,
        room.bloco_id,
        room.nome,
        room.andar,
        room.capacidade,
        room.tipo,
        room.status,
        room.acessivel,
        room.possui_computadores,
        room.possui_data_show,
        room.possui_internet,
        room.possui_ar_condicionado,
        room.observacoes,
      ]
    );
    await saveRoomSoftwares(conn, result.insertId, room.softwares, institutionId);
    await conn.commit();
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
});

app.put("/api/salas/:id", requireRole("CPD"), async (req, res, next) => {
  const room = normalizeRoomPayload(req.body);
  try {
    validateRoom(room);
  } catch (error) {
    return next(error);
  }
  const conn = await db.getConnection();
  try {
    const institutionId = req.institution.id;
    await conn.beginTransaction();
    await ensureBlockBelongsToInstitution(conn, room.bloco_id, institutionId);
    const [result] = await conn.query(
      `UPDATE salas SET bloco_id = ?, nome = ?, andar = ?, capacidade = ?, tipo = ?, status = ?, acessivel = ?,
       possui_computadores = ?, possui_data_show = ?, possui_internet = ?,
       possui_ar_condicionado = ?, observacoes = ? WHERE id = ? AND instituicao_id = ?`,
      [
        room.bloco_id,
        room.nome,
        room.andar,
        room.capacidade,
        room.tipo,
        room.status,
        room.acessivel,
        room.possui_computadores,
        room.possui_data_show,
        room.possui_internet,
        room.possui_ar_condicionado,
        room.observacoes,
        req.params.id,
        institutionId,
      ]
    );
    if (!result.affectedRows) throw httpError(404, "Sala não encontrada.");
    await saveRoomSoftwares(conn, req.params.id, room.softwares, institutionId);
    await conn.commit();
    res.json({ ok: true });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
});

app.delete("/api/salas/:id", requireRole("CPD"), async (req, res, next) => {
  try {
    const institutionId = req.institution.id;
    if (asBoolean(req.query.definitivo)) {
      const [activeSchedules] = await db.query(
        `SELECT COUNT(*) AS total
           FROM horarios_importados h
           JOIN importacoes_horarios i ON i.id = h.importacao_id
          WHERE h.sala_id = ?
            AND i.status = 'APROVADA'
            AND i.ativa = TRUE
            AND i.instituicao_id = ?`,
        [req.params.id, institutionId]
      );
      if (Number(activeSchedules[0]?.total || 0) > 0) {
        throw httpError(409, "Remova a sala dos horários publicados antes de excluir definitivamente.");
      }
      const [result] = await db.query("DELETE FROM salas WHERE id = ? AND instituicao_id = ?", [
        req.params.id,
        institutionId,
      ]);
      if (!result.affectedRows) throw httpError(404, "Sala não encontrada.");
      return res.json({ ok: true, deleted: true });
    }
    const [result] = await db.query("UPDATE salas SET status = 'INATIVA' WHERE id = ? AND instituicao_id = ?", [
      req.params.id,
      institutionId,
    ]);
    if (!result.affectedRows) throw httpError(404, "Sala não encontrada.");
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------
const serializeEvent = (row) => ({
  ...row,
  ativo: Boolean(row.ativo),
  data_evento: row.data_evento instanceof Date ? row.data_evento.toISOString().slice(0, 10) : row.data_evento,
  hora_evento: row.hora_evento ? String(row.hora_evento).slice(0, 5) : null,
});

const normalizeEventPayload = (body = {}) => ({
  titulo: sanitizeFreeText(body.titulo, 140),
  descricao: sanitizeFreeText(body.descricao, 1000) || null,
  data_evento: String(body.data_evento || "").trim(),
  hora_evento: String(body.hora_evento || "").trim() || null,
  local: sanitizeFreeText(body.local, 140) || null,
  imagem_url: sanitizeFreeText(body.imagem_url, 500) || null,
  ativo: body.ativo == null ? true : asBoolean(body.ativo),
});

const validateEvent = (event) => {
  if (!event.titulo || !event.data_evento) throw httpError(400, "Informe título e data do evento.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.data_evento)) throw httpError(400, "Data do evento inválida.");
  if (event.hora_evento && !/^\d{2}:\d{2}$/.test(event.hora_evento)) throw httpError(400, "Horário do evento inválido.");
  if (event.imagem_url && !/^https?:\/\//i.test(event.imagem_url)) {
    throw httpError(400, "Informe uma URL de imagem iniciando com http:// ou https://.");
  }
};

app.get("/api/eventos", async (req, res, next) => {
  try {
    const includeInactive = req.user?.papel === "CPD" && asBoolean(req.query.incluir_inativos);
    const where = includeInactive
      ? "WHERE instituicao_id = ?"
      : "WHERE instituicao_id = ? AND ativo = TRUE AND data_evento >= CURRENT_DATE";
    const [rows] = await db.query(
      `SELECT id, titulo, descricao, data_evento, TO_CHAR(hora_evento, 'HH24:MI') AS hora_evento,
              local, imagem_url, ativo, created_at, updated_at
         FROM eventos
         ${where}
        ORDER BY data_evento ASC, hora_evento IS NULL, hora_evento ASC, id ASC`,
      [req.institution.id]
    );
    const payload = rows.map(serializeEvent);
    if (req.user) return res.json(payload);
    return cacheableJson(req, res, payload, { maxAge: 60, staleWhileRevalidate: 300 });
  } catch (error) {
    next(error);
  }
});

app.post("/api/eventos", requireRole("CPD"), async (req, res, next) => {
  const event = normalizeEventPayload(req.body);
  try {
    validateEvent(event);
    const [result] = await db.query(
      `INSERT INTO eventos (instituicao_id, titulo, descricao, data_evento, hora_evento, local, imagem_url, ativo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [req.institution.id, event.titulo, event.descricao, event.data_evento, event.hora_evento, event.local, event.imagem_url, event.ativo]
    );
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    next(error);
  }
});

app.put("/api/eventos/:id", requireRole("CPD"), async (req, res, next) => {
  const event = normalizeEventPayload(req.body);
  try {
    validateEvent(event);
    const [result] = await db.query(
      `UPDATE eventos
          SET titulo = ?, descricao = ?, data_evento = ?, hora_evento = ?, local = ?, imagem_url = ?, ativo = ?
        WHERE id = ? AND instituicao_id = ?`,
      [
        event.titulo,
        event.descricao,
        event.data_evento,
        event.hora_evento,
        event.local,
        event.imagem_url,
        event.ativo,
        req.params.id,
        req.institution.id,
      ]
    );
    if (!result.affectedRows) throw httpError(404, "Evento não encontrado.");
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/eventos/:id", requireRole("CPD"), async (req, res, next) => {
  try {
    const [result] = await db.query("DELETE FROM eventos WHERE id = ? AND instituicao_id = ?", [
      req.params.id,
      req.institution.id,
    ]);
    if (!result.affectedRows) throw httpError(404, "Evento não encontrado.");
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Setores
// ---------------------------------------------------------------------------
const allowedSectorIcons = new Set(["building", "graduation", "book", "flask", "wrench", "coffee", "shield", "monitor", "users"]);
const allowedSectorColors = new Set(["blue", "violet", "amber", "emerald", "slate", "orange", "indigo", "cyan", "rose"]);

const serializeSector = (row) => ({ ...row, ativo: Boolean(row.ativo) });

const normalizeSectorPayload = (body = {}) => ({
  nome: sanitizeFreeText(body.nome, 120),
  descricao: sanitizeFreeText(body.descricao, 255),
  responsavel: sanitizeFreeText(body.responsavel, 120) || null,
  localizacao: sanitizeFreeText(body.localizacao, 160) || null,
  contato: sanitizeFreeText(body.contato, 160) || null,
  horario_atendimento: sanitizeFreeText(body.horario_atendimento, 160) || null,
  icone: allowedSectorIcons.has(String(body.icone || "")) ? String(body.icone) : "building",
  cor: allowedSectorColors.has(String(body.cor || "")) ? String(body.cor) : "blue",
  ativo: body.ativo == null ? true : asBoolean(body.ativo),
});

const validateSector = (sector) => {
  if (!sector.nome || !sector.descricao) throw httpError(400, "Informe nome e descrição do setor.");
};

app.get("/api/setores", async (req, res, next) => {
  try {
    const includeInactive = req.user?.papel === "CPD" && asBoolean(req.query.incluir_inativos);
    const where = includeInactive ? "WHERE instituicao_id = ?" : "WHERE instituicao_id = ? AND ativo = TRUE";
    const [rows] = await db.query(
      `SELECT id, nome, descricao, responsavel, localizacao, contato, horario_atendimento,
              icone, cor, ativo, created_at, updated_at
         FROM setores
         ${where}
        ORDER BY nome`,
      [req.institution.id]
    );
    const payload = rows.map(serializeSector);
    if (req.user) return res.json(payload);
    return cacheableJson(req, res, payload, { maxAge: 60, staleWhileRevalidate: 300 });
  } catch (error) {
    next(error);
  }
});

app.post("/api/setores", requireRole("CPD"), async (req, res, next) => {
  const sector = normalizeSectorPayload(req.body);
  try {
    validateSector(sector);
    const [result] = await db.query(
      `INSERT INTO setores
       (instituicao_id, nome, descricao, responsavel, localizacao, contato, horario_atendimento, icone, cor, ativo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [
        req.institution.id,
        sector.nome,
        sector.descricao,
        sector.responsavel,
        sector.localizacao,
        sector.contato,
        sector.horario_atendimento,
        sector.icone,
        sector.cor,
        sector.ativo,
      ]
    );
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    next(error);
  }
});

app.put("/api/setores/:id", requireRole("CPD"), async (req, res, next) => {
  const sector = normalizeSectorPayload(req.body);
  try {
    validateSector(sector);
    const [result] = await db.query(
      `UPDATE setores
          SET nome = ?, descricao = ?, responsavel = ?, localizacao = ?, contato = ?,
              horario_atendimento = ?, icone = ?, cor = ?, ativo = ?
        WHERE id = ? AND instituicao_id = ?`,
      [
        sector.nome,
        sector.descricao,
        sector.responsavel,
        sector.localizacao,
        sector.contato,
        sector.horario_atendimento,
        sector.icone,
        sector.cor,
        sector.ativo,
        req.params.id,
        req.institution.id,
      ]
    );
    if (!result.affectedRows) throw httpError(404, "Setor não encontrado.");
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/setores/:id", requireRole("CPD"), async (req, res, next) => {
  try {
    const [result] = await db.query("DELETE FROM setores WHERE id = ? AND instituicao_id = ?", [
      req.params.id,
      req.institution.id,
    ]);
    if (!result.affectedRows) throw httpError(404, "Setor não encontrado.");
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Ouvidoria
// ---------------------------------------------------------------------------
const allowedOuvidoriaProfiles = new Set(["ALUNO", "DOCENTE", "RESPONSAVEL", "COMUNIDADE"]);
const allowedOuvidoriaCategories = new Set(["IDEIA", "MELHORIA", "PROBLEMA", "AVISO"]);
const allowedOuvidoriaStatuses = new Set(["NOVA", "EM_ANALISE", "RESOLVIDA", "ARQUIVADA"]);

const normalizeOuvidoriaPayload = (body = {}) => ({
  nome: sanitizeFreeText(body.nome, 120) || null,
  perfil: String(body.perfil || "").toUpperCase(),
  categoria: String(body.categoria || "").toUpperCase(),
  setor_id: body.setor_id ? Number(body.setor_id) : null,
  assunto: sanitizeFreeText(body.assunto, 120),
  mensagem: sanitizeFreeText(body.mensagem, 700),
});

const validateOuvidoria = async (manifestation, institutionId) => {
  if (!allowedOuvidoriaProfiles.has(manifestation.perfil)) throw httpError(400, "Selecione seu perfil.");
  if (!allowedOuvidoriaCategories.has(manifestation.categoria)) throw httpError(400, "Selecione uma categoria válida.");
  if (!manifestation.assunto || manifestation.assunto.length < 6) throw httpError(400, "Informe um assunto com pelo menos 6 caracteres.");
  if (!manifestation.mensagem || manifestation.mensagem.length < 20) throw httpError(400, "Descreva a situação com pelo menos 20 caracteres.");
  if (/https?:\/\/|www\./i.test(`${manifestation.assunto} ${manifestation.mensagem}`)) {
    throw httpError(400, "Não envie links na manifestação.");
  }
  if (/(.)\1{7,}/i.test(`${manifestation.assunto} ${manifestation.mensagem}`)) {
    throw httpError(400, "Revise o texto antes de enviar.");
  }
  if (hasInappropriateContent(manifestation.nome, manifestation.assunto, manifestation.mensagem)) {
    throw httpError(400, "Revise o texto: a ouvidoria não aceita termos ofensivos ou impróprios.");
  }
  if (manifestation.setor_id !== null) {
    if (!Number.isInteger(manifestation.setor_id) || manifestation.setor_id < 1) {
      throw httpError(400, "Setor inválido.");
    }
    const [rows] = await db.query(
      "SELECT id FROM setores WHERE id = ? AND instituicao_id = ? AND ativo = TRUE LIMIT 1",
      [manifestation.setor_id, institutionId]
    );
    if (!rows.length) throw httpError(400, "Setor não encontrado.");
  }
};

app.post("/api/ouvidoria", ouvidoriaRateLimit, async (req, res, next) => {
  const manifestation = normalizeOuvidoriaPayload(req.body);
  try {
    const institutionId = req.institution.id;
    await validateOuvidoria(manifestation, institutionId);
    const [result] = await db.query(
      `INSERT INTO ouvidoria_manifestacoes
       (instituicao_id, nome, perfil, categoria, setor_id, assunto, mensagem)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [
        institutionId,
        manifestation.nome,
        manifestation.perfil,
        manifestation.categoria,
        manifestation.setor_id,
        manifestation.assunto,
        manifestation.mensagem,
      ]
    );
    res.status(201).json({ id: result.insertId, status: "NOVA" });
  } catch (error) {
    next(error);
  }
});

app.get("/api/ouvidoria", requireRole("CPD"), async (req, res, next) => {
  try {
    const status = String(req.query.status || "").toUpperCase();
    const params = [req.institution.id];
    const conditions = ["o.instituicao_id = ?"];
    if (allowedOuvidoriaStatuses.has(status)) {
      conditions.push("o.status = ?");
      params.push(status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const page = positiveInt(req.query.page, 1, { max: 100000 });
    const pageSize = positiveInt(req.query.page_size, 100, { min: 10, max: 200 });
    const [rows] = await db.query(
      `SELECT o.id, o.nome, o.perfil, o.categoria, o.setor_id, s.nome AS setor_nome,
              o.assunto, o.mensagem, o.status, o.created_at, o.updated_at
         FROM ouvidoria_manifestacoes o
         LEFT JOIN setores s ON s.id = o.setor_id AND s.instituicao_id = o.instituicao_id
         ${where}
        ORDER BY ${ouvidoriaStatusOrderSql}, o.created_at DESC
        LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    const [countRows] = await db.query(`SELECT COUNT(*) AS total FROM ouvidoria_manifestacoes o ${where}`, params);
    res.json({
      items: rows,
      paginacao: { pagina: page, por_pagina: pageSize, total: Number(countRows[0].total) },
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/ouvidoria/:id", requireRole("CPD"), async (req, res, next) => {
  try {
    const status = String(req.body?.status || "").toUpperCase();
    if (!allowedOuvidoriaStatuses.has(status)) throw httpError(400, "Status inválido.");
    const [result] = await db.query("UPDATE ouvidoria_manifestacoes SET status = ? WHERE id = ? AND instituicao_id = ?", [
      status,
      req.params.id,
      req.institution.id,
    ]);
    if (!result.affectedRows) throw httpError(404, "Manifestação não encontrada.");
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Importações URÂNIA UP
// ---------------------------------------------------------------------------
const insertScheduleChunks = async (conn, importId, schedules, roomByName) => {
  const columns = [
    "importacao_id",
    "categoria",
    "turma",
    "curso",
    "ano",
    "dia",
    "periodo",
    "hora_inicio",
    "disciplina",
    "professor",
    "ambiente",
    "sala_id",
    "tipo_turma",
    "tipo_disciplina",
    "valor_original",
  ];
  for (let offset = 0; offset < schedules.length; offset += 200) {
    const chunk = schedules.slice(offset, offset + 200);
    const values = [];
    const placeholders = chunk.map((schedule) => {
      const roomId = schedule.ambiente ? roomByName.get(normalizeLookup(schedule.ambiente)) || null : null;
      values.push(
        importId,
        schedule.categoria,
        schedule.turma,
        schedule.curso || null,
        schedule.ano || null,
        schedule.dia,
        schedule.periodo,
        schedule.hora_inicio || null,
        schedule.disciplina,
        schedule.professor || null,
        schedule.ambiente || null,
        roomId,
        schedule.tipo_turma || null,
        schedule.tipo_disciplina || null,
        schedule.valor_original || null
      );
      return `(${columns.map(() => "?").join(",")})`;
    });
    await conn.query(
      `INSERT INTO horarios_importados (${columns.join(",")}) VALUES ${placeholders.join(",")}`,
      values
    );
  }
};

const preserveRoomsFromActiveImport = async (conn, importId, scopeKey, institutionId) => {
  const [result] = await conn.query(
    `UPDATE horarios_importados AS candidate
        SET sala_id = active.sala_id
       FROM importacoes_horarios AS active_import, horarios_importados AS active
      WHERE active_import.escopo_chave = ?
        AND active_import.instituicao_id = ?
        AND active_import.status = 'APROVADA'
        AND active_import.ativa = TRUE
        AND active_import.id <> candidate.importacao_id
        AND active.importacao_id = active_import.id
        AND active.categoria = candidate.categoria
        AND active.turma = candidate.turma
        AND active.dia = candidate.dia
        AND active.periodo = candidate.periodo
        AND active.sala_id IS NOT NULL
        AND candidate.importacao_id = ?
        AND candidate.categoria = 'TURMA'
        AND candidate.sala_id IS NULL`,
    [scopeKey, institutionId, importId]
  );
  return result.affectedRows || 0;
};

app.post(
  "/api/importacoes/urania",
  uploadRateLimit,
  requireRole("ADMIN"),
  uraniaUpload.array("arquivos", 10),
  async (req, res, next) => {
    if (!req.files?.length) return res.status(400).json({ message: "Selecione ao menos um arquivo do URÂNIA." });
    try {
      const institutionId = req.institution.id;
      const parsed = await parseUraniaFiles(req.files);
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        const [result] = await conn.query(
          `INSERT INTO importacoes_horarios
           (instituicao_id, fonte, titulo, escopo_chave, codigo_escola, codigo_turno, nome_turno, lote_hash,
            total_arquivos, total_horarios, total_turmas, avisos_json, observacoes_envio, enviado_por)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           RETURNING id`,
          [
            institutionId,
            parsed.fonte,
            parsed.titulo,
            parsed.escopo_chave,
            parsed.codigo_escola,
            parsed.codigo_turno,
            parsed.nome_turno,
            parsed.lote_hash,
            req.files.length,
            parsed.horarios.length,
            parsed.total_turmas,
            JSON.stringify(parsed.avisos || []),
            String(req.body?.observacoes || "").trim() || null,
            req.user.id,
          ]
        );
        const importId = result.insertId;
        for (const file of req.files) {
          await conn.query(
            `INSERT INTO importacao_arquivos
             (importacao_id, nome, mime_type, tamanho, sha256, conteudo)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              importId,
              file.originalname,
              file.mimetype || "application/octet-stream",
              file.size,
              crypto.createHash("sha256").update(file.buffer).digest("hex"),
              file.buffer,
            ]
          );
        }
        const [rooms] = await conn.query("SELECT id, nome FROM salas WHERE instituicao_id = ?", [institutionId]);
        const roomByName = new Map();
        for (const room of rooms) {
          const key = normalizeLookup(room.nome);
          roomByName.set(key, roomByName.has(key) ? null : room.id);
        }
        const importedEnvironments = [
          ...new Set(parsed.horarios.map((schedule) => schedule.ambiente).filter(Boolean)),
        ];
        const unmappedEnvironments = importedEnvironments.filter(
          (environment) => !roomByName.get(normalizeLookup(environment))
        );
        if (unmappedEnvironments.length) {
          parsed.avisos.push(
            `${unmappedEnvironments.length} ambientes não foram vinculados a uma sala cadastrada: ${unmappedEnvironments.join(", ")}`
          );
          await conn.query("UPDATE importacoes_horarios SET avisos_json = ? WHERE id = ?", [
            JSON.stringify(parsed.avisos),
            importId,
          ]);
        }
        await insertScheduleChunks(conn, importId, parsed.horarios, roomByName);
        await preserveRoomsFromActiveImport(conn, importId, parsed.escopo_chave, institutionId);
        await conn.commit();
        res.status(201).json({
          id: importId,
          status: "PENDENTE",
          resumo: {
            fonte: parsed.fonte,
            total_horarios: parsed.horarios.length,
            total_turmas: parsed.total_turmas,
            avisos: parsed.avisos,
          },
        });
      } catch (error) {
        await conn.rollback();
        next(error);
      } finally {
        conn.release();
      }
    } catch (error) {
      next(error);
    }
  }
);

app.get("/api/importacoes", requireRole("CPD"), async (req, res, next) => {
  try {
    const statuses = ["PENDENTE", "APROVADA", "REJEITADA"];
    const status = String(req.query.status || "").toUpperCase();
    const params = [req.institution.id];
    const conditions = ["i.instituicao_id = ?"];
    if (statuses.includes(status)) {
      conditions.push("i.status = ?");
      params.push(status);
    }
    const where = `WHERE ${conditions.join(" AND ")}`;
    const paginated = req.query.page || req.query.page_size;
    const page = positiveInt(req.query.page, 1, { max: 100000 });
    const pageSize = positiveInt(req.query.page_size, 50, { min: 10, max: 200 });
    const limitClause = paginated ? "LIMIT ? OFFSET ?" : "";
    const queryParams = paginated ? [...params, pageSize, (page - 1) * pageSize] : params;
    const [rows] = await db.query(
      `SELECT i.id, i.fonte, i.titulo, i.escopo_chave, i.codigo_escola, i.codigo_turno,
              i.nome_turno, i.status, i.ativa, i.total_arquivos, i.total_horarios,
              i.total_turmas, i.avisos_json, i.observacoes_envio, i.motivo_rejeicao,
              i.created_at, i.revisado_em, i.publicado_em,
              sender.nome AS enviado_por_nome, sender.usuario AS enviado_por_usuario,
              reviewer.nome AS revisado_por_nome, reviewer.usuario AS revisado_por_usuario
         FROM importacoes_horarios i
         JOIN usuarios sender ON sender.id = i.enviado_por
         LEFT JOIN usuarios reviewer ON reviewer.id = i.revisado_por
         ${where}
        ORDER BY i.created_at DESC
        ${limitClause}`,
      queryParams
    );
    const items = rows.map((row) => ({ ...row, ativa: Boolean(row.ativa), avisos: parseJson(row.avisos_json, []) }));
    if (!paginated) return res.json(items);

    const [countRows] = await db.query(`SELECT COUNT(*) AS total FROM importacoes_horarios i ${where}`, params);
    res.json({
      items,
      paginacao: { pagina: page, por_pagina: pageSize, total: Number(countRows[0].total) },
    });
  } catch (error) {
    next(error);
  }
});

const scheduleComparisonSelect = `
  SELECT h.categoria, h.turma, h.dia, h.periodo,
         TO_CHAR(h.hora_inicio, 'HH24:MI') AS hora_inicio,
         h.disciplina, h.professor, h.ambiente,
         s.nome AS sala_nome, h.tipo_disciplina
    FROM horarios_importados h
    LEFT JOIN salas s ON s.id = h.sala_id
   WHERE h.importacao_id = ?
     AND h.categoria = 'TURMA'
   ORDER BY h.turma, ${dayOrderSql}, h.periodo`;

const loadScheduleComparison = async (conn, importId, scopeKey, institutionId) => {
  const [activeImports] = await conn.query(
    `SELECT id, titulo, publicado_em
       FROM importacoes_horarios
      WHERE escopo_chave = ?
        AND instituicao_id = ?
        AND status = 'APROVADA'
        AND ativa = TRUE
        AND id <> ?
      ORDER BY publicado_em DESC, id DESC
      LIMIT 1`,
    [scopeKey, institutionId, importId]
  );
  if (!activeImports.length) return null;
  const [candidateSchedules] = await conn.query(scheduleComparisonSelect, [importId]);
  const [activeSchedules] = await conn.query(scheduleComparisonSelect, [activeImports[0].id]);
  return buildScheduleComparison(candidateSchedules, activeSchedules, activeImports[0]);
};

const loadScheduleNotificationSubscribers = async (conn, classes, institutionId) => {
  if (!classes.length) return [];
  const [rows] = await conn.query(
    `SELECT email, turma
       FROM horario_notificacoes
      WHERE ativo = TRUE
        AND instituicao_id = ?
        AND turma IN (${classes.map(() => "?").join(",")})`,
    [institutionId, ...classes]
  );
  return rows;
};

const notifyScheduleSubscribers = async ({ subscribers, comparison }) => {
  const result = { tentadas: subscribers.length, enviadas: 0, sem_smtp: 0, falhas: 0 };
  const changedClasses = new Set(comparison.turmas_afetadas);
  for (const subscriber of subscribers) {
    if (!changedClasses.has(subscriber.turma)) continue;
    try {
      const sent = await sendEmail({
        to: subscriber.email,
        subject: `Horário atualizado - turma ${subscriber.turma}`,
        text: [
          `A grade da turma ${subscriber.turma} foi atualizada.`,
          "",
          `Aulas com mudança: ${comparison.aulas_mudaram}`,
          `Turmas afetadas: ${comparison.turmas_afetadas.join(", ")}`,
          "",
          "Acesse o site do CIMOL para conferir os horários publicados.",
        ].join("\n"),
      });
      if (sent.sent) result.enviadas += 1;
      else result.sem_smtp += 1;
    } catch (error) {
      result.falhas += 1;
      console.error({ error, email: subscriber.email, turma: subscriber.turma }, "Falha ao enviar notificação de horário");
    }
  }
  return result;
};

app.get("/api/importacoes/:id", requireRole("CPD"), async (req, res, next) => {
  try {
    const [imports] = await db.query(
      `SELECT i.*, sender.nome AS enviado_por_nome, sender.usuario AS enviado_por_usuario,
              reviewer.nome AS revisado_por_nome, reviewer.usuario AS revisado_por_usuario
         FROM importacoes_horarios i
         JOIN usuarios sender ON sender.id = i.enviado_por
         LEFT JOIN usuarios reviewer ON reviewer.id = i.revisado_por
        WHERE i.id = ? AND i.instituicao_id = ?`,
      [req.params.id, req.institution.id]
    );
    if (!imports.length) throw httpError(404, "Importação não encontrada.");

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(500, Math.max(20, Number(req.query.page_size) || 200));
    const turma = String(req.query.turma || "").trim();
    const scheduleParams = [req.params.id];
    const turmaWhere = turma ? "AND h.turma = ?" : "";
    if (turma) scheduleParams.push(turma);
    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total FROM horarios_importados h WHERE h.importacao_id = ? ${turmaWhere}`,
      scheduleParams
    );
    const [schedules] = await db.query(
      `SELECT h.id, h.categoria, h.turma, h.curso, h.ano, h.dia, h.periodo,
              TO_CHAR(h.hora_inicio, 'HH24:MI') AS hora_inicio, h.disciplina, h.professor,
              h.ambiente, h.sala_id, s.nome AS sala_nome, b.nome AS bloco_nome,
              h.tipo_turma, h.tipo_disciplina, h.valor_original
         FROM horarios_importados h
         LEFT JOIN salas s ON s.id = h.sala_id
         LEFT JOIN blocos b ON b.id = s.bloco_id
        WHERE h.importacao_id = ? ${turmaWhere}
        ORDER BY ${dayOrderSql}, h.periodo, h.turma
        LIMIT ? OFFSET ?`,
      [...scheduleParams, pageSize, (page - 1) * pageSize]
    );
    const [classes] = await db.query(
      `SELECT DISTINCT turma, curso, ano, categoria
         FROM horarios_importados WHERE importacao_id = ? ORDER BY categoria, turma`,
      [req.params.id]
    );
    const [files] = await db.query(
      `SELECT id, nome, mime_type, tamanho, sha256, created_at
         FROM importacao_arquivos WHERE importacao_id = ? ORDER BY id`,
      [req.params.id]
    );
    const item = imports[0];
    let comparison = null;
    if (item.status === "PENDENTE") {
      comparison = await loadScheduleComparison(db, item.id, item.escopo_chave, req.institution.id);
    }
    res.json({
      ...item,
      ativa: Boolean(item.ativa),
      avisos: parseJson(item.avisos_json, []),
      arquivos: files,
      turmas: classes,
      horarios: schedules,
      comparacao: comparison,
      paginacao: { pagina: page, por_pagina: pageSize, total: Number(countRows[0].total) },
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/importacoes/horarios/:id/sala", requireRole("CPD"), async (req, res, next) => {
  const scheduleId = Number(req.params.id);
  const rawRoomId = req.body?.sala_id;
  const roomId = rawRoomId === null || rawRoomId === undefined || rawRoomId === "" ? null : Number(rawRoomId);
  if (!Number.isInteger(scheduleId) || scheduleId < 1) return next(httpError(400, "Horário inválido."));
  if (roomId !== null && (!Number.isInteger(roomId) || roomId < 1)) return next(httpError(400, "Sala inválida."));

  const conn = await db.getConnection();
  try {
    const institutionId = req.institution.id;
    await conn.beginTransaction();
    const [schedules] = await conn.query(
      `SELECT h.id, h.importacao_id, h.turma, h.dia, h.periodo, h.disciplina
         FROM horarios_importados h
         JOIN importacoes_horarios i ON i.id = h.importacao_id
        WHERE h.id = ?
          AND i.instituicao_id = ?
          AND h.categoria = 'TURMA'
          AND i.status = 'PENDENTE'
        FOR UPDATE`,
      [scheduleId, institutionId]
    );
    if (!schedules.length) throw httpError(404, "Horário pendente não encontrado.");

    let room = null;
    if (roomId !== null) {
      const [rooms] = await conn.query(
        `SELECT s.id, s.nome, s.status, b.nome AS bloco_nome
          FROM salas s
          JOIN blocos b ON b.id = s.bloco_id AND b.instituicao_id = s.instituicao_id
          WHERE s.id = ? AND s.instituicao_id = ?
          LIMIT 1`,
        [roomId, institutionId]
      );
      if (!rooms.length) throw httpError(400, "Sala não encontrada.");
      if (rooms[0].status !== "ATIVA") throw httpError(409, `A sala ${rooms[0].nome} não está ativa.`);
      room = rooms[0];
      const [conflicts] = await conn.query(
        `SELECT turma, disciplina
           FROM horarios_importados
          WHERE importacao_id = ?
            AND id <> ?
            AND categoria = 'TURMA'
            AND dia = ?
            AND periodo = ?
            AND (
              sala_id = ?
              OR (
                sala_id IS NULL
                AND ambiente IS NOT NULL
                AND REPLACE(LOWER(TRIM(ambiente)), ' ', '') = REPLACE(LOWER(TRIM(?)), ' ', '')
              )
            )
          LIMIT 1`,
        [schedules[0].importacao_id, scheduleId, schedules[0].dia, schedules[0].periodo, roomId, room.nome]
      );
      if (conflicts.length) {
        throw httpError(409, `A sala já está ocupada por ${conflicts[0].turma} em ${conflicts[0].disciplina}.`);
      }
    }

    await conn.query("UPDATE horarios_importados SET sala_id = ? WHERE id = ?", [roomId, scheduleId]);
    await conn.commit();
    res.json({ ok: true, id: scheduleId, sala_id: roomId, sala_nome: room?.nome || null, bloco_nome: room?.bloco_nome || null });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
});

app.post("/api/importacoes/:id/aprovar", requireRole("CPD"), async (req, res, next) => {
  const conn = await db.getConnection();
  let committed = false;
  let comparison = null;
  let notificationSubscribers = [];
  try {
    const institutionId = req.institution.id;
    await conn.beginTransaction();
    const [rows] = await conn.query(
      "SELECT id, status, escopo_chave FROM importacoes_horarios WHERE id = ? AND instituicao_id = ? FOR UPDATE",
      [req.params.id, institutionId]
    );
    if (!rows.length) throw httpError(404, "Importação não encontrada.");
    if (rows[0].status !== "PENDENTE") throw httpError(409, "Somente importações pendentes podem ser aprovadas.");
    await preserveRoomsFromActiveImport(conn, rows[0].id, rows[0].escopo_chave, institutionId);
    comparison = await loadScheduleComparison(conn, rows[0].id, rows[0].escopo_chave, institutionId);
    if (comparison?.aulas_mudaram) {
      notificationSubscribers = await loadScheduleNotificationSubscribers(conn, comparison.turmas_afetadas, institutionId);
    }
    await conn.query(
      `UPDATE importacoes_horarios
          SET ativa = FALSE
        WHERE instituicao_id = ? AND ativa = TRUE AND status = 'APROVADA' AND escopo_chave = ?`,
      [institutionId, rows[0].escopo_chave]
    );
    await conn.query(
      `UPDATE importacoes_horarios
          SET status = 'APROVADA', ativa = TRUE, revisado_por = ?, revisado_em = NOW(),
              publicado_em = NOW(), motivo_rejeicao = NULL
        WHERE id = ? AND instituicao_id = ?`,
      [req.user.id, req.params.id, institutionId]
    );
    await conn.commit();
    committed = true;
    const notificacoes = comparison?.aulas_mudaram
      ? await notifyScheduleSubscribers({ subscribers: notificationSubscribers, comparison })
      : { tentadas: 0, enviadas: 0, sem_smtp: 0, falhas: 0 };
    res.json({ ok: true, status: "APROVADA", ativa: true, notificacoes });
  } catch (error) {
    if (!committed) await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
});

app.post("/api/importacoes/:id/rejeitar", requireRole("CPD"), async (req, res, next) => {
  const reason = String(req.body?.motivo || "").trim();
  if (!reason) return res.status(400).json({ message: "Informe o motivo da rejeição." });
  try {
    const [result] = await db.query(
      `UPDATE importacoes_horarios
          SET status = 'REJEITADA', ativa = FALSE, revisado_por = ?, revisado_em = NOW(),
              motivo_rejeicao = ?
        WHERE id = ? AND instituicao_id = ? AND status = 'PENDENTE'`,
      [req.user.id, reason, req.params.id, req.institution.id]
    );
    if (!result.affectedRows) throw httpError(409, "A importação não existe ou já foi revisada.");
    res.json({ ok: true, status: "REJEITADA" });
  } catch (error) {
    next(error);
  }
});

app.post("/api/horarios/notificacoes", notificationRateLimit, async (req, res, next) => {
  const email = normalizeEmail(req.body?.email);
  const turma = sanitizeFreeText(req.body?.turma, 120);
  if (!isValidEmail(email)) return next(httpError(400, "Informe um e-mail válido."));
  if (!turma) return next(httpError(400, "Selecione uma turma."));

  try {
    const institutionId = req.institution.id;
    const [classes] = await db.query(
      `SELECT 1
         FROM horarios_importados h
         JOIN importacoes_horarios i ON i.id = h.importacao_id
        WHERE i.status = 'APROVADA'
          AND i.ativa = TRUE
          AND i.instituicao_id = ?
          AND h.categoria = 'TURMA'
          AND h.turma = ?
        LIMIT 1`,
      [institutionId, turma]
    );
    if (!classes.length) throw httpError(400, "Turma não encontrada nos horários publicados.");
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    await db.query(
      `INSERT INTO horario_notificacoes (instituicao_id, email, turma, ativo, confirmacao_token_hash, confirmacao_expira_em)
       VALUES (?, ?, ?, FALSE, ?, NOW() + INTERVAL '2 days')
       ON CONFLICT (instituicao_id, email, turma) DO UPDATE
         SET ativo = FALSE,
             confirmacao_token_hash = EXCLUDED.confirmacao_token_hash,
             confirmacao_expira_em = EXCLUDED.confirmacao_expira_em,
             updated_at = CURRENT_TIMESTAMP`,
      [institutionId, email, turma, tokenHash]
    );
    const confirmationUrl = `${publicBaseUrl(req)}/api/horarios/notificacoes/confirmar?token=${encodeURIComponent(token)}`;
    const sent = await sendEmail({
      to: email,
      subject: `Confirmar aviso de horário - turma ${turma}`,
      text: [
        `Confirme que você quer receber avisos quando a grade da turma ${turma} mudar.`,
        "",
        confirmationUrl,
        "",
        "Se você não pediu isso, ignore este e-mail.",
      ].join("\n"),
    });
    res.status(201).json({ ok: true, pendente_confirmacao: true, email_enviado: sent.sent });
  } catch (error) {
    next(error);
  }
});

app.get("/api/horarios/notificacoes/confirmar", async (req, res, next) => {
  const token = String(req.query.token || "");
  if (!token) return next(httpError(400, "Token inválido."));

  try {
    const [result] = await db.query(
      `UPDATE horario_notificacoes
          SET ativo = TRUE, confirmacao_token_hash = NULL, confirmacao_expira_em = NULL
        WHERE confirmacao_token_hash = ?
          AND instituicao_id = ?
          AND confirmacao_expira_em > NOW()`,
      [hashToken(token), req.institution.id]
    );
    if (!result.affectedRows) throw httpError(400, "Link de confirmação inválido ou expirado.");
    res.type("html").send("<p>Notificação de horários ativada. Você já pode fechar esta página.</p>");
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Horários publicados: endpoint público para alunos, professores e totens.
// ---------------------------------------------------------------------------
app.get("/api/horarios/publicados", async (req, res, next) => {
  try {
    const institutionId = req.institution.id;
    res.set("Cache-Control", "no-store");
    const [options] = await db.query(
      `SELECT DISTINCT h.turma, h.curso, h.ano
         FROM horarios_importados h
         JOIN importacoes_horarios i ON i.id = h.importacao_id
        WHERE i.instituicao_id = ? AND i.status = 'APROVADA' AND i.ativa = TRUE AND h.categoria = 'TURMA'
        ORDER BY h.curso, h.ano, h.turma`,
      [institutionId]
    );
    if (req.query.apenas_opcoes === "1" || req.query.apenas_opcoes === "true") {
      const [teachers] = await db.query(
        `SELECT DISTINCT h.professor
           FROM horarios_importados h
           JOIN importacoes_horarios i ON i.id = h.importacao_id
          WHERE i.instituicao_id = ? AND i.status = 'APROVADA' AND i.ativa = TRUE AND h.categoria = 'TURMA'
            AND h.professor IS NOT NULL AND h.professor <> ''
          ORDER BY h.professor`,
        [institutionId]
      );
      const payload = { turmas: options, professores: teachers.map((item) => item.professor), horarios: [] };
      return res.json(payload);
    }
    const conditions = ["i.instituicao_id = ?", "i.status = 'APROVADA'", "i.ativa = TRUE", "h.categoria = 'TURMA'"];
    const params = [institutionId];
    for (const [queryName, column] of [
      ["turma", "h.turma"],
      ["curso", "h.curso"],
      ["ano", "h.ano"],
      ["dia", "h.dia"],
    ]) {
      if (req.query[queryName]) {
        conditions.push(`${column} = ?`);
        params.push(String(req.query[queryName]));
      }
    }
    const teacher = String(req.query.professor || "").trim();
    if (teacher) {
      conditions.push("h.professor ILIKE ?");
      params.push(`%${teacher}%`);
    }
    const [schedules] = await db.query(
      `SELECT h.id, h.turma, h.curso, h.ano, h.dia, h.periodo,
              TO_CHAR(h.hora_inicio, 'HH24:MI') AS hora_inicio,
              h.disciplina, h.professor, h.sala_id, h.ambiente,
              COALESCE(s.nome, h.ambiente) AS sala,
              b.nome AS bloco, i.id AS importacao_id, i.publicado_em
         FROM horarios_importados h
         JOIN importacoes_horarios i ON i.id = h.importacao_id
         LEFT JOIN salas s ON s.id = h.sala_id AND s.instituicao_id = i.instituicao_id
         LEFT JOIN blocos b ON b.id = s.bloco_id AND b.instituicao_id = i.instituicao_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY ${dayOrderSql}, h.periodo, h.turma`,
      params
    );
    const payload = { turmas: options, horarios: schedules };
    return res.json(payload);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/horarios/publicados/:id/sala", requireRole("CPD"), async (req, res, next) => {
  const scheduleId = Number(req.params.id);
  const rawRoomId = req.body?.sala_id;
  const roomId = rawRoomId === null || rawRoomId === undefined || rawRoomId === "" ? null : Number(rawRoomId);
  const rawStudentCount = req.body?.quantidade_alunos;
  const studentCount =
    rawStudentCount === null || rawStudentCount === undefined || rawStudentCount === ""
      ? null
      : Number(rawStudentCount);
  const reason = sanitizeFreeText(req.body?.motivo, 255) || null;

  if (!Number.isInteger(scheduleId) || scheduleId < 1) {
    return next(httpError(400, "Horário inválido."));
  }
  if (roomId !== null && (!Number.isInteger(roomId) || roomId < 1)) {
    return next(httpError(400, "Sala inválida."));
  }
  if (studentCount !== null && (!Number.isInteger(studentCount) || studentCount < 1)) {
    return next(httpError(400, "Informe uma quantidade de alunos válida."));
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await updatePublishedScheduleRoom(conn, {
      institutionId: req.institution.id,
      scheduleId,
      roomId,
      userId: req.user.id,
      studentCount,
      reason,
    });
    await conn.commit();
    res.json(result);
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
});

if (serveStaticFrontend) {
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/api-CIMOL")) return next();
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.use((error, req, res, _next) => {
  console.error({ requestId: req.id, error });
  let status = error.statusCode || 500;
  if (error instanceof multer.MulterError || error.message?.includes("Formato") || error.message?.includes("Tipo")) {
    status = 400;
  } else if (isConnectionError(error)) {
    status = 503;
  } else if (isDuplicateError(error)) {
    status = 409;
  } else if (isForeignKeyError(error)) {
    status = 400;
  }
  res.status(status).json({
    message:
      status === 503
        ? databaseUnavailableMessage
        : status === 500
          ? "Não foi possível concluir a operação no banco de dados."
          : error.message || "Não foi possível concluir a operação.",
  });
});

if (!process.env.VERCEL) {
  const server = app.listen(port);
  server.on("listening", () => {
    console.log(`API rodando em http://localhost:${port}`);
  });
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Porta ${port} já está em uso. Encerre o outro servidor ou defina API_PORT para outra porta.`);
      process.exit(1);
    }
    throw error;
  });
}

export default app;
