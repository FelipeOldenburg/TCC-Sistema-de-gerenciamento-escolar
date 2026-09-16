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
  createAuthMiddleware,
  createPassword,
  createPlatformAuthMiddleware,
  normalizeUsername,
} from "./auth.js";
import { createAuthController } from "./controllers/authController.js";
import { createContentController } from "./controllers/contentController.js";
import { createFacilitiesController } from "./controllers/facilitiesController.js";
import { createInstitutionController } from "./controllers/institutionController.js";
import { createReorganizationController } from "./controllers/reorganizationController.js";
import { createScheduleController } from "./controllers/scheduleController.js";
import { createDbPool, isConnectionError, isDuplicateError, isForeignKeyError } from "./db.js";
import { createContentModel } from "./models/contentModel.js";
import { createFacilitiesModel } from "./models/facilitiesModel.js";
import { createInstitutionModel, defaultInstitutionColors, hslColorPattern } from "./models/institutionModel.js";
import { createReorganizationModel } from "./models/reorganizationModel.js";
import { createScheduleModel } from "./models/scheduleModel.js";
import { registerAuthRoutes } from "./routes/authRoutes.js";
import { registerContentRoutes } from "./routes/contentRoutes.js";
import { registerFacilitiesRoutes } from "./routes/facilitiesRoutes.js";
import { registerInstitutionRoutes } from "./routes/institutionRoutes.js";
import { createPlatformInstitutionRoutes } from "./routes/platformInstitutionRoutes.js";
import { registerReorganizationRoutes } from "./routes/reorganizationRoutes.js";
import { registerScheduleRoutes } from "./routes/scheduleRoutes.js";
import { isFirstFloorRoom, isUpperFloorRoom } from "./scheduleUtils.js";
import { isAllowedRequestOrigin, isLocalhostOrigin } from "./requestSecurity.js";
import { createRoomAssignmentService } from "./services/roomAssignmentService.js";
import { ensureDefaultPublicContent } from "./seed.js";

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

const allowedOrigins = new Set(splitEnvList(process.env.PUBLIC_ORIGIN, process.env.ALLOWED_ORIGINS));
const safeApiMethods = new Set(["GET", "HEAD", "OPTIONS"]);

const corsOptions = {
  credentials: true,
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin) || (!isProduction && isLocalhostOrigin(origin))) {
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

const db = createDbPool();
const institutionModel = createInstitutionModel(db);
const loadInstitutionBySlug = institutionModel.loadBySlug;
const databaseUnavailableMessage = "O sistema está temporariamente indisponível. Tente novamente mais tarde.";

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
app.use("/api", optionalAuth);
app.use("/api", optionalPlatformAuth);
app.use("/api", (req, res, next) => {
  if (
    safeApiMethods.has(req.method) ||
    (!req.user && !req.platformUser) ||
    isAllowedRequestOrigin({
      origin: req.get("origin"),
      protocol: req.protocol,
      host: req.get("host"),
      allowedOrigins,
      isProduction,
    })
  ) {
    return next();
  }
  return res.status(403).json({ message: "Origem não autorizada." });
});
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

registerAuthRoutes(app, createAuthController(db), { authRateLimit, requireAuth, requirePlatformAuth });

const requirePlatformManager = (req, res, next) => {
  if (!req.platformUser) return res.status(401).json({ message: "Faça login na gestão da plataforma." });
  next();
};

const normalizeInstitutionBrandPayload = (body = {}) => ({
  nome_admin: sanitizeFreeText(body.nome_admin, 120),
  nome_sistema: sanitizeFreeText(body.nome_sistema, 160),
  subtitulo_admin: sanitizeFreeText(body.subtitulo_admin, 160),
  logo_url: sanitizeFreeText(body.logo_url, 500) || null,
  cor_primaria_hsl: sanitizeFreeText(body.cor_primaria_hsl, 40) || defaultInstitutionColors.cor_primaria_hsl,
  cor_acento_hsl: sanitizeFreeText(body.cor_acento_hsl, 40) || defaultInstitutionColors.cor_acento_hsl,
  cor_header_hsl: sanitizeFreeText(body.cor_header_hsl, 40) || defaultInstitutionColors.cor_header_hsl,
  cor_nav_hsl: sanitizeFreeText(body.cor_nav_hsl, 40) || defaultInstitutionColors.cor_nav_hsl,
  cor_nav_ativa_hsl: sanitizeFreeText(body.cor_nav_ativa_hsl, 40) || defaultInstitutionColors.cor_nav_ativa_hsl,
});

const validateInstitutionBrandPayload = (brand) => {
  if (!brand.nome_admin || !brand.nome_sistema || !brand.subtitulo_admin) {
    throw httpError(400, "Preencha nome administrativo, nome do sistema e subtítulo.");
  }
  if (brand.logo_url && !/^https?:\/\//i.test(brand.logo_url)) {
    throw httpError(400, "Informe uma URL de logo iniciando com http:// ou https://.");
  }
  for (const field of Object.keys(defaultInstitutionColors)) {
    if (!hslColorPattern.test(brand[field])) throw httpError(400, "Informe cores HSL válidas.");
  }
};

registerInstitutionRoutes(
  app,
  createInstitutionController({ institutionModel, normalizeInstitutionBrandPayload, validateInstitutionBrandPayload }),
  { requireRole }
);

app.use(
  "/api/instituicoes",
  createPlatformInstitutionRoutes({
    asBoolean,
    createPassword,
    db,
    ensureDefaultPublicContent,
    httpError,
    normalizeUsername,
    requirePlatformManager,
    sanitizeFreeText,
  })
);

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

const roomAssignmentService = createRoomAssignmentService({
  dayOrderSql,
  httpError,
  isFirstFloorRoom,
  isUpperFloorRoom,
});
const reorganizationModel = createReorganizationModel({ db });
const reorganizationController = createReorganizationController({
  asBoolean,
  db,
  positiveInt,
  reorganizationModel,
  roomAssignmentService,
  sanitizeFreeText,
});
registerReorganizationRoutes(app, reorganizationController, {
  documentUpload,
  requireRole,
  uploadRateLimit,
});

const facilitiesModel = createFacilitiesModel({ db, dayOrderSql });
const facilitiesController = createFacilitiesController({
  asBoolean,
  cacheableJson,
  facilitiesModel,
  httpError,
  isForeignKeyError,
  positiveInt,
});
registerFacilitiesRoutes(app, facilitiesController, { requireRole });

const contentModel = createContentModel({ db });
const contentController = createContentController({
  contentModel,
  asBoolean,
  cacheableJson,
  hasInappropriateContent,
  httpError,
  positiveInt,
  sanitizeFreeText,
});
registerContentRoutes(app, contentController, { ouvidoriaRateLimit, requireRole });

const scheduleModel = createScheduleModel({ db, dayOrderSql, httpError, normalizeLookup });
const scheduleController = createScheduleController({
  db,
  httpError,
  positiveInt,
  roomAssignmentService,
  sanitizeFreeText,
  scheduleModel,
});
registerScheduleRoutes(app, scheduleController, {
  notificationRateLimit,
  requireRole,
  uploadRateLimit,
  uraniaUpload,
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
