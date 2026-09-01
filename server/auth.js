import crypto from "crypto";

const SESSION_COOKIE = "cimol_session";
const PLATFORM_SESSION_COOKIE = "plataforma_session";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

export const normalizeUsername = (value) => String(value || "").trim().toLowerCase();
const asBoolean = (value) => value === true || value === "true" || value === "1" || value === "on";

const sessionCookieAttributes = () => {
  const sameSite = ["Strict", "Lax", "None"].includes(process.env.COOKIE_SAMESITE)
    ? process.env.COOKIE_SAMESITE
    : "Lax";
  const secure =
    process.env.COOKIE_SECURE == null
      ? process.env.NODE_ENV === "production" || sameSite === "None"
      : asBoolean(process.env.COOKIE_SECURE);
  const domain = String(process.env.COOKIE_DOMAIN || "").trim();
  return [
    "HttpOnly",
    `SameSite=${sameSite}`,
    "Path=/",
    domain && `Domain=${domain}`,
    secure && "Secure",
  ]
    .filter(Boolean)
    .join("; ");
};

const derivePasswordHash = (password, salt) =>
  new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(key.toString("base64"));
    });
  });

export const createPassword = async (password) => {
  const salt = crypto.randomBytes(24).toString("base64url");
  return { salt, hash: await derivePasswordHash(password, salt) };
};

const verifyPassword = async (password, salt, expectedHash) => {
  const actualHash = await derivePasswordHash(password, salt);
  const actual = Buffer.from(actualHash);
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

const parseCookies = (header = "") =>
  Object.fromEntries(
    header
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const separator = item.indexOf("=");
        return separator < 0
          ? [item, ""]
          : [item.slice(0, separator), decodeURIComponent(item.slice(separator + 1))];
      })
  );

const tokenHash = (token) => crypto.createHash("sha256").update(token).digest("hex");

const getRequestToken = (req, cookieName = SESSION_COOKIE) => {
  const cookieToken = parseCookies(req.headers.cookie)[cookieName];
  if (cookieToken) return cookieToken;

  const authorization = req.headers.authorization;
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7).trim();
  return null;
};

export const setSessionCookie = (res, token) => {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; ${sessionCookieAttributes()}; Max-Age=${Math.floor(
      SESSION_DURATION_MS / 1000
    )}`
  );
};

export const clearSessionCookie = (res) => {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; ${sessionCookieAttributes()}; Max-Age=0`
  );
};

export const setPlatformSessionCookie = (res, token) => {
  res.setHeader(
    "Set-Cookie",
    `${PLATFORM_SESSION_COOKIE}=${encodeURIComponent(token)}; ${sessionCookieAttributes()}; Max-Age=${Math.floor(
      SESSION_DURATION_MS / 1000
    )}`
  );
};

export const clearPlatformSessionCookie = (res) => {
  res.setHeader(
    "Set-Cookie",
    `${PLATFORM_SESSION_COOKIE}=; ${sessionCookieAttributes()}; Max-Age=0`
  );
};

export const authenticateUser = async (db, username, password, institutionId) => {
  const [rows] = await db.query(
    `SELECT id, instituicao_id, nome, usuario, senha_hash, senha_salt, papel, gerencia_instituicoes
       FROM usuarios
      WHERE instituicao_id = ? AND usuario = ? AND ativo = TRUE
      LIMIT 1`,
    [institutionId, normalizeUsername(username)]
  );

  if (!rows.length) return null;
  const user = rows[0];
  if (!(await verifyPassword(String(password || ""), user.senha_salt, user.senha_hash))) return null;

  return {
    id: user.id,
    instituicao_id: user.instituicao_id,
    nome: user.nome,
    usuario: user.usuario,
    papel: user.papel,
    gerencia_instituicoes: Boolean(user.gerencia_instituicoes),
  };
};

export const createSession = async (db, userId) => {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.query("DELETE FROM sessoes WHERE expires_at <= NOW()");
  await db.query(
    "INSERT INTO sessoes (token_hash, usuario_id, expires_at) VALUES (?, ?, ?)",
    [tokenHash(token), userId, expiresAt]
  );
  return token;
};

export const createPlatformSession = async (db, userId) => {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.query("DELETE FROM plataforma_sessoes WHERE expires_at <= NOW()");
  await db.query(
    "INSERT INTO plataforma_sessoes (token_hash, usuario_id, expires_at) VALUES (?, ?, ?)",
    [tokenHash(token), userId, expiresAt]
  );
  return token;
};

export const deleteSession = async (db, req) => {
  const token = getRequestToken(req);
  if (token) await db.query("DELETE FROM sessoes WHERE token_hash = ?", [tokenHash(token)]);
};

export const deletePlatformSession = async (db, req) => {
  const token = getRequestToken(req, PLATFORM_SESSION_COOKIE);
  if (token) await db.query("DELETE FROM plataforma_sessoes WHERE token_hash = ?", [tokenHash(token)]);
};

const loadSessionUser = async (db, req) => {
  const matchesRequestInstitution = (user) =>
    !req.institution || Number(user.instituicao_id) === Number(req.institution.id);

  if (req.user) {
    if (matchesRequestInstitution(req.user)) return req.user;
    req.user = null;
    return null;
  }
  const token = getRequestToken(req);
  if (!token) return null;

  const [rows] = await db.query(
    `SELECT u.id, u.instituicao_id, i.slug AS instituicao_slug, u.nome, u.usuario, u.papel,
            u.gerencia_instituicoes
       FROM sessoes s
       JOIN usuarios u ON u.id = s.usuario_id
       JOIN instituicoes i ON i.id = u.instituicao_id
      WHERE s.token_hash = ?
        AND s.expires_at > NOW()
        AND u.ativo = TRUE
        AND i.ativo = TRUE
      LIMIT 1`,
    [tokenHash(token)]
  );

  if (!rows.length) return null;
  if (!matchesRequestInstitution(rows[0])) return null;
  req.user = rows[0];
  return req.user;
};

export const createAuthMiddleware = (db) => {
  const optionalAuth = async (req, _res, next) => {
    try {
      await loadSessionUser(db, req);
      next();
    } catch (error) {
      next(error);
    }
  };

  const requireAuth = async (req, res, next) => {
    try {
      const user = await loadSessionUser(db, req);
      if (!user) return res.status(401).json({ message: "Faça login para continuar." });
      next();
    } catch (error) {
      next(error);
    }
  };

  const requireRole = (...roles) => async (req, res, next) => {
    try {
      const user = await loadSessionUser(db, req);
      if (!user) return res.status(401).json({ message: "Faça login para continuar." });
      if (!roles.includes(user.papel)) {
        return res.status(403).json({ message: "Seu usuário não possui permissão para esta ação." });
      }
      next();
    } catch (error) {
      next(error);
    }
  };

  return { optionalAuth, requireAuth, requireRole };
};

export const authenticatePlatformUser = async (db, username, password) => {
  const [rows] = await db.query(
    `SELECT id, nome, usuario, senha_hash, senha_salt
       FROM plataforma_usuarios
      WHERE usuario = ? AND ativo = TRUE
      LIMIT 1`,
    [normalizeUsername(username)]
  );

  if (!rows.length) return null;
  const user = rows[0];
  if (!(await verifyPassword(String(password || ""), user.senha_salt, user.senha_hash))) return null;
  return { id: user.id, nome: user.nome, usuario: user.usuario };
};

const loadPlatformSessionUser = async (db, req) => {
  if (req.platformUser) return req.platformUser;
  const token = getRequestToken(req, PLATFORM_SESSION_COOKIE);
  if (!token) return null;

  const [rows] = await db.query(
    `SELECT u.id, u.nome, u.usuario
       FROM plataforma_sessoes s
       JOIN plataforma_usuarios u ON u.id = s.usuario_id
      WHERE s.token_hash = ?
        AND s.expires_at > NOW()
        AND u.ativo = TRUE
      LIMIT 1`,
    [tokenHash(token)]
  );

  if (!rows.length) return null;
  req.platformUser = rows[0];
  return req.platformUser;
};

export const createPlatformAuthMiddleware = (db) => {
  const optionalPlatformAuth = async (req, _res, next) => {
    try {
      await loadPlatformSessionUser(db, req);
      next();
    } catch (error) {
      next(error);
    }
  };

  const requirePlatformAuth = async (req, res, next) => {
    try {
      const user = await loadPlatformSessionUser(db, req);
      if (!user) return res.status(401).json({ message: "Faça login para continuar." });
      next();
    } catch (error) {
      next(error);
    }
  };

  return { optionalPlatformAuth, requirePlatformAuth };
};

export const ensureBootstrapUsers = async (db, institutionSlug = process.env.DEFAULT_INSTITUTION_SLUG || "cimol") => {
  const [institutions] = await db.query("SELECT id FROM instituicoes WHERE slug = ? LIMIT 1", [institutionSlug]);
  const institutionId = institutions[0]?.id;
  if (!institutionId) throw new Error(`Instituicao ${institutionSlug} nao encontrada para criar usuarios iniciais.`);

  const isProduction = process.env.NODE_ENV === "production";
  const defaults = [
    {
      nome: process.env.ADMIN_NAME || "Administrador",
      usuario: process.env.ADMIN_USER || "admin",
      password: process.env.ADMIN_PASSWORD || (!isProduction ? "admin123" : ""),
      passwordEnv: "ADMIN_PASSWORD",
      papel: "ADMIN",
    },
    {
      nome: process.env.CPD_NAME || "CPD",
      usuario: process.env.CPD_USER || "cpd",
      password: process.env.CPD_PASSWORD || (!isProduction ? "cpd123" : ""),
      passwordEnv: "CPD_PASSWORD",
      papel: "CPD",
    },
  ];

  for (const item of defaults) {
    const username = normalizeUsername(item.usuario);
    const [existing] = await db.query("SELECT id FROM usuarios WHERE instituicao_id = ? AND usuario = ? LIMIT 1", [
      institutionId,
      username,
    ]);
    if (existing.length) {
      if (process.env[item.passwordEnv]) {
        const { hash, salt } = await createPassword(item.password);
        await db.query(
          "UPDATE usuarios SET nome = ?, senha_hash = ?, senha_salt = ?, papel = ?, gerencia_instituicoes = ?, ativo = TRUE WHERE id = ?",
          [item.nome, hash, salt, item.papel, false, existing[0].id]
        );
      }
      continue;
    }
    if (!item.password) continue;

    const { hash, salt } = await createPassword(item.password);
    await db.query(
      `INSERT INTO usuarios (instituicao_id, nome, usuario, senha_hash, senha_salt, papel, gerencia_instituicoes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [institutionId, item.nome, username, hash, salt, item.papel, false]
    );

    if (!process.env[item.passwordEnv]) {
      console.warn(
        `[segurança] Usuário ${username} criado com senha de desenvolvimento. Configure ${item.papel}_PASSWORD no .env.`
      );
    }
  }
};

export const ensureBootstrapPlatformUser = async (db) => {
  const password = process.env.PLATFORM_ADMIN_PASSWORD || "";
  if (!password) return;

  const username = normalizeUsername(process.env.PLATFORM_ADMIN_USER || "plataforma");
  const name = process.env.PLATFORM_ADMIN_NAME || "Gestor da plataforma";
  const { hash, salt } = await createPassword(password);
  const [existing] = await db.query("SELECT id FROM plataforma_usuarios WHERE usuario = ? LIMIT 1", [username]);

  if (existing.length) {
    await db.query(
      "UPDATE plataforma_usuarios SET nome = ?, senha_hash = ?, senha_salt = ?, ativo = TRUE WHERE id = ?",
      [name, hash, salt, existing[0].id]
    );
    return;
  }

  await db.query(
    "INSERT INTO plataforma_usuarios (nome, usuario, senha_hash, senha_salt) VALUES (?, ?, ?, ?)",
    [name, username, hash, salt]
  );
};
