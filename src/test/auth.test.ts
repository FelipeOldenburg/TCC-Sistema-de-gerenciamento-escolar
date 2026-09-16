import { describe, expect, it, vi } from "vitest";
import {
  authenticatePlatformUser,
  authenticateUser,
  createAuthMiddleware,
  createPassword,
  deleteSession,
  ensureBootstrapPlatformUser,
  ensureBootstrapUsers,
  normalizeUsername,
  setSessionCookie,
} from "../../server/auth.js";

describe("auth por instituicao", () => {
  it("normaliza usuario e autentica somente na instituicao informada", async () => {
    const { hash, salt } = await createPassword("senha123");
    const db = {
      query: async (_sql: string, params: unknown[]) => [
        params[0] === 2 && params[1] === "cpd.teste"
          ? [
              {
                id: 10,
                instituicao_id: 2,
                nome: "CPD Teste",
                usuario: "cpd.teste",
                senha_hash: hash,
                senha_salt: salt,
                papel: "CPD",
                gerencia_instituicoes: false,
              },
            ]
          : [],
      ],
    };

    expect(normalizeUsername("  CPD.Teste  ")).toBe("cpd.teste");
    await expect(authenticateUser(db, "CPD.Teste", "senha123", 1)).resolves.toBeNull();
    await expect(authenticateUser(db, "CPD.Teste", "senha123", 2)).resolves.toMatchObject({
      instituicao_id: 2,
      usuario: "cpd.teste",
      gerencia_instituicoes: false,
    });
  });

  it("autentica usuario de plataforma sem instituicao", async () => {
    const { hash, salt } = await createPassword("senha123");
    const db = {
      query: async (_sql: string, params: unknown[]) => [
        params[0] === "gestor"
          ? [{ id: 1, nome: "Gestor", usuario: "gestor", senha_hash: hash, senha_salt: salt }]
          : [],
      ],
    };

    await expect(authenticatePlatformUser(db, "gestor", "senha123")).resolves.toEqual({
      id: 1,
      nome: "Gestor",
      usuario: "gestor",
    });
    await expect(authenticatePlatformUser(db, "gestor", "errada")).resolves.toBeNull();
  });

  it("bloqueia sessao de outra instituicao", async () => {
    const { requireAuth } = createAuthMiddleware({
      query: async () => [
        [
          {
            id: 10,
            instituicao_id: 1,
            instituicao_slug: "cimol",
            nome: "Admin CIMOL",
            usuario: "admin",
            papel: "CPD",
            gerencia_instituicoes: false,
          },
        ],
      ],
    });
    const req = { headers: { cookie: "cimol_session=token" }, institution: { id: 2 } };
    const res = { status: vi.fn(), json: vi.fn() };
    const next = vi.fn();
    res.status.mockReturnValue(res);

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("descarta uma sessao ja carregada de outra instituicao", async () => {
    const db = { query: vi.fn() };
    const { requireAuth } = createAuthMiddleware(db);
    const req = {
      headers: {},
      institution: { id: 2 },
      user: { id: 10, instituicao_id: 1, papel: "CPD" },
    };
    const res = { status: vi.fn(), json: vi.fn() };
    const next = vi.fn();
    res.status.mockReturnValue(res);

    await requireAuth(req, res, next);

    expect(req.user).toBeNull();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(db.query).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("mantem o cookie seguro em producao mesmo com configuracao antiga", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousCookieSecure = process.env.COOKIE_SECURE;
    try {
      process.env.NODE_ENV = "production";
      process.env.COOKIE_SECURE = "false";
      const response = { setHeader: vi.fn() };

      setSessionCookie(response, "token");

      expect(response.setHeader).toHaveBeenCalledWith("Set-Cookie", expect.stringContaining("Secure"));
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousCookieSecure === undefined) delete process.env.COOKIE_SECURE;
      else process.env.COOKIE_SECURE = previousCookieSecure;
    }
  });

  it("limita logout a sessao da instituicao resolvida", async () => {
    const db = { query: vi.fn() };

    await deleteSession(db, { headers: { cookie: "cimol_session=token" }, institution: { id: 2 } });

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining("u.instituicao_id = ?"), [expect.any(String), 2]);
  });

  it("revoga sessoes quando o bootstrap redefine uma senha", async () => {
    const keys = ["NODE_ENV", "ADMIN_PASSWORD", "CPD_PASSWORD", "PLATFORM_ADMIN_PASSWORD"];
    const previous = new Map(keys.map((key) => [key, process.env[key]]));
    try {
      process.env.NODE_ENV = "production";
      process.env.ADMIN_PASSWORD = "senha-nova";
      delete process.env.CPD_PASSWORD;
      process.env.PLATFORM_ADMIN_PASSWORD = "senha-plataforma-nova";
      const schoolDb = {
        query: vi.fn(async (sql: string) => {
          if (sql.includes("FROM instituicoes")) return [[{ id: 2 }]];
          if (sql.includes("FROM usuarios")) return [[{ id: 10 }]];
          return [{}];
        }),
      };
      const platformDb = {
        query: vi.fn(async (sql: string) => (sql.includes("FROM plataforma_usuarios") ? [[{ id: 11 }]] : [{}])),
      };

      await ensureBootstrapUsers(schoolDb, "escola-teste");
      await ensureBootstrapPlatformUser(platformDb);

      expect(schoolDb.query).toHaveBeenCalledWith("DELETE FROM sessoes WHERE usuario_id = ?", [10]);
      expect(platformDb.query).toHaveBeenCalledWith("DELETE FROM plataforma_sessoes WHERE usuario_id = ?", [11]);
    } finally {
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
