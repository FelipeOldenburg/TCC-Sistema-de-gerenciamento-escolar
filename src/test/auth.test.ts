import { describe, expect, it } from "vitest";
import { authenticatePlatformUser, authenticateUser, createPassword, normalizeUsername } from "../../server/auth.js";

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
});
