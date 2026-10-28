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
});
