import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminPage from "@/pages/AdminPage";

vi.mock("@/lib/institution", () => ({
  useInstitutionBrand: () => ({ name: "CIMOL", adminName: "CIMOL", logo: null }),
}));

const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => data }) as Response;

describe("Reorganização", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("seleciona uma turma publicada e envia seu código real com ano e curso", async () => {
    let submitted: FormData | undefined;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/auth/me")) return ok({ user: { id: 1, instituicao_id: 1, papel: "CPD", nome: "CPD" } });
      if (url.includes("/api/horarios/publicados?apenas_opcoes=1")) return ok({
        turmas: [{ turma: "INFO 63 1", curso: "Informática", ano: "3" }],
        horarios: [],
      });
      if (url.includes("/api/reorganizacao") && init?.method === "POST") {
        submitted = init.body as FormData;
        return ok({ id: 1, reorganizacao: { avaliadas: 0, candidatas: 0, aplicadas: [], nao_aplicadas: [] } });
      }
      if (url.includes("/api/reorganizacao")) return ok({ items: [] });
      throw new Error(`Requisição inesperada: ${url}`);
    }));

    render(<MemoryRouter><AdminPage /></MemoryRouter>);
    fireEvent.click((await screen.findAllByRole("button", { name: "Reorganização" }))[0]);
    fireEvent.change(await screen.findByRole("combobox", { name: "Turma" }), { target: { value: "INFO 63 1" } });
    expect(screen.getByDisplayValue("3º")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Informática")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Nome ou número de matrícula"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByPlaceholderText("Ex: Acessibilidade, alergia, restrição física..."), { target: { value: "Sem acesso ao segundo andar" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar e Reorganizar" }));

    await waitFor(() => expect(submitted?.get("turma")).toBe("INFO 63 1"));
    expect(submitted?.get("ano")).toBe("3º");
    expect(submitted?.get("curso")).toBe("Informática");
  });

  it("exibe o código da sala sem a subdivisão nos resultados e no histórico", async () => {
    let submitted: FormData | undefined;
    const salas = "D101(B), D101(C), Laboratório (Química), D101(Anexo)";
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/auth/me")) return ok({ user: { id: 1, instituicao_id: 1, papel: "CPD", nome: "CPD" } });
      if (url.includes("/api/horarios/publicados?apenas_opcoes=1")) return ok({
        turmas: [{ turma: "INFO 63 1", curso: "Informática", ano: "3" }], horarios: [],
      });
      if (url.includes("/api/reorganizacao") && init?.method === "POST") {
        submitted = init.body as FormData;
        return ok({ id: 1, reorganizacao: {
          avaliadas: 1, candidatas: 1,
          aplicadas: [{ horario_id: 1, dia: "SEG", periodo: 1, hora_inicio: "07:30", disciplina: "Matemática", sala_anterior: "D201(A)", sala_nova: "D101(B)" }],
          nao_aplicadas: [],
        } });
      }
      if (url.includes("/api/reorganizacao")) return ok({ items: [{
        id: 1, aluno: "Ana", ano: "3º", turma: "INFO 63 1", curso: "Informática",
        problema: "Acessibilidade", salas, arquivo_nome: null, data: "2026-11-11",
      }] });
      throw new Error(`Requisição inesperada: ${url}`);
    }));

    render(<MemoryRouter><AdminPage /></MemoryRouter>);
    fireEvent.click((await screen.findAllByRole("button", { name: "Reorganização" }))[0]);
    expect(await screen.findByText("D101, D101, Laboratório (Química), D101(Anexo)")).toBeInTheDocument();
    fireEvent.change(await screen.findByRole("combobox", { name: "Turma" }), { target: { value: "INFO 63 1" } });
    fireEvent.change(screen.getByPlaceholderText("Nome ou número de matrícula"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByPlaceholderText("Ex: Acessibilidade, alergia, restrição física..."), { target: { value: "Acessibilidade" } });
    fireEvent.change(screen.getByPlaceholderText("Opcional: S201, C303"), { target: { value: "D101(B)" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar e Reorganizar" }));

    expect(await screen.findByText("SEG · 07:30 · Matemática: D201 → D101")).toBeInTheDocument();
    expect(submitted?.get("salas")).toBe("D101(B)");
  });
});
