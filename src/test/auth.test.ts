import { describe, expect, it, vi } from "vitest";
import { authenticatePlatformUser, authenticateUser, createAuthMiddleware, createPassword, normalizeUsername } from "../../server/auth.js";

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
});
