import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HorariosSection from "@/components/sections/HorariosSection";

const turmas = [{ turma: "INFO 63 1", curso: "Informática", ano: "3" }];

const ok = (data: unknown) => ({
  ok: true,
  status: 200,
  json: async () => data,
}) as Response;

describe("HorariosSection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("pesquisa os horários por professor", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/auth/me")) {
        return { ok: false, status: 401, json: async () => ({ message: "Não autenticado." }) } as Response;
      }
      if (url.includes("apenas_opcoes=1")) {
        return ok({ turmas, professores: ["Maria Silva", "João Souza", "Camila Custódio"], horarios: [] });
      }
      if (url.includes("professor=Maria%20Silva")) {
        return ok({
          turmas,
          horarios: [
            {
              id: 1,
              turma: "INFO 63 1",
              curso: "Informática",
              ano: "3",
              dia: "SEG",
              periodo: 2,
              hora_inicio: "08:40",
              disciplina: "Banco de Dados",
              professor: "Maria Silva",
              sala_id: 10,
              ambiente: null,
              sala: "Laboratório 101",
              bloco: "Bloco A",
            },
            {
              id: 2,
              turma: "MEC 21 A",
              curso: "Mecânica",
              ano: "2",
              dia: "TER",
              periodo: 1,
              hora_inicio: "07:30",
              disciplina: "Física",
              professor: "João Souza",
              sala_id: null,
              ambiente: null,
              sala: null,
              bloco: null,
            },
          ],
        });
      }
      throw new Error(`URL inesperada: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HorariosSection />);

    fireEvent.change(screen.getByLabelText("Pesquisar professor"), { target: { value: "Maria Silva" } });
    await waitFor(() =>
      expect(Array.from(document.querySelectorAll("datalist option")).map((option) => option.getAttribute("value"))).toEqual(["Maria Silva"])
    );
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/horarios/publicados?professor=Maria%20Silva"),
        expect.any(Object),
      )
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "Horários de Maria Silva" })).toBeInTheDocument());
    expect(screen.getAllByText("INFO 63 1 · Informática · 3º ano").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Banco de Dados").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Laboratório 101").length).toBeGreaterThan(0);
    expect(screen.queryByText("João Souza")).not.toBeInTheDocument();
    expect(screen.queryByText("MEC 21 A · Mecânica · 2º ano")).not.toBeInTheDocument();
  });

  it("bloqueia sala ocupada no mesmo período para CPD", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/auth/me")) {
        return ok({ user: { id: 1, nome: "CPD", usuario: "cpd", papel: "CPD" } });
      }
      if (url.includes("apenas_opcoes=1")) {
        return ok({ turmas, professores: [], horarios: [] });
      }
      if (url.includes("turma=INFO%2063%201")) {
        return ok({
          turmas,
          horarios: [
            {
              id: 1,
              turma: "INFO 63 1",
              curso: "Informática",
              ano: "3",
              dia: "SEG",
              periodo: 2,
              hora_inicio: "08:40",
              disciplina: "Banco de Dados",
              professor: "Maria Silva",
              sala_id: null,
              ambiente: "A201",
              sala: "A201",
              bloco: null,
            },
          ],
        });
      }
      if (url.endsWith("/api/salas")) {
        return ok([
          { id: 10, nome: "A201", bloco_nome: "Bloco A", andar: "2º andar", capacidade: 30, tipo: "Sala", status: "ATIVA", acessivel: false },
        ]);
      }
      if (url.endsWith("/api/salas/ocupacoes")) {
        return ok({
          horarios: [
            {
              id: 2,
              turma: "Design de Móveis",
              dia: "SEG",
              periodo: 2,
              hora_inicio: "08:50",
              disciplina: "Projeto",
              professor: "Ana",
              sala_id: 10,
            },
          ],
        });
      }
      throw new Error(`URL inesperada: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HorariosSection />);

    fireEvent.click(await screen.findByRole("button", { name: "Informática" }));
    await screen.findAllByText("Banco de Dados");
    fireEvent.click(screen.getAllByRole("button", { name: "Configurar sala de Banco de Dados" })[0]);

    const dialog = await screen.findByRole("dialog", { name: "Configurar sala" });
    expect(within(dialog).getByText("Usar sala importada")).toBeInTheDocument();
    expect(within(dialog).queryByText(/Usar ambiente importado/)).not.toBeInTheDocument();
    const roomSelect = within(dialog).getByRole("combobox");
    await waitFor(() => expect(roomSelect).not.toBeDisabled());
    fireEvent.keyDown(roomSelect, { key: "ArrowDown" });

    const occupied = await screen.findByText(/A201 .* ocupada por Design de Móveis/);
    expect(occupied.closest("[role='option']")).toHaveAttribute("data-disabled");
  });
});
