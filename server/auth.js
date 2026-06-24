import crypto from "crypto";

const SESSION_COOKIE = "cimol_session";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

const normalizeUsername = (value) => String(value || "").trim().toLowerCase();

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

const getRequestToken = (req) => {
  const cookieToken = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (cookieToken) return cookieToken;

  const authorization = req.headers.authorization;
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7).trim();
  return null;
};

export const setSessionCookie = (res, token) => {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(
      SESSION_DURATION_MS / 1000
    )}${secure}`
  );
};

export const clearSessionCookie = (res) => {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`
  );
};

export const authenticateUser = async (db, username, password) => {
  const [rows] = await db.query(
    `SELECT id, nome, usuario, senha_hash, senha_salt, papel
       FROM usuarios
      WHERE usuario = ? AND ativo = TRUE
      LIMIT 1`,
    [normalizeUsername(username)]
  );

  if (!rows.length) return null;
  const user = rows[0];
  if (!(await verifyPassword(String(password || ""), user.senha_salt, user.senha_hash))) return null;

  return { id: user.id, nome: user.nome, usuario: user.usuario, papel: user.papel };
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

export const deleteSession = async (db, req) => {
  const token = getRequestToken(req);
  if (token) await db.query("DELETE FROM sessoes WHERE token_hash = ?", [tokenHash(token)]);
};

const loadSessionUser = async (db, req) => {
  if (req.user) return req.user;
  const token = getRequestToken(req);
  if (!token) return null;

  const [rows] = await db.query(
    `SELECT u.id, u.nome, u.usuario, u.papel
       FROM sessoes s
       JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.token_hash = ?
        AND s.expires_at > NOW()
        AND u.ativo = TRUE
      LIMIT 1`,
    [tokenHash(token)]
  );

  if (!rows.length) return null;
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

export const ensureBootstrapUsers = async (db) => {
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
    const [existing] = await db.query("SELECT id FROM usuarios WHERE usuario = ? LIMIT 1", [username]);
    if (existing.length) {
      if (process.env[item.passwordEnv]) {
        const { hash, salt } = await createPassword(item.password);
        await db.query(
          "UPDATE usuarios SET nome = ?, senha_hash = ?, senha_salt = ?, papel = ?, ativo = TRUE WHERE id = ?",
          [item.nome, hash, salt, item.papel, existing[0].id]
        );
      }
      continue;
    }
    if (!item.password) continue;

    const { hash, salt } = await createPassword(item.password);
    await db.query(
      `INSERT INTO usuarios (nome, usuario, senha_hash, senha_salt, papel)
       VALUES (?, ?, ?, ?, ?)`,
      [item.nome, username, hash, salt, item.papel]
    );

    if (!process.env[item.passwordEnv]) {
      console.warn(
        `[segurança] Usuário ${username} criado com senha de desenvolvimento. Configure ${item.papel}_PASSWORD no .env.`
      );
    }
  }
};
