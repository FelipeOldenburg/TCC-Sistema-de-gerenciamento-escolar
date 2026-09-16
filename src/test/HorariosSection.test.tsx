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
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
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

  it("mostra apenas intervalos ligados ao grupo da turma", async () => {
    const option = { ...turmas[0], grupo_ids: [1, 2, 3] };
    const otherOption = { turma: "MEC 21 A", curso: "Mecânica", ano: "2", grupo_ids: [99] };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/auth/me")) return { ok: false, status: 401, json: async () => ({ message: "Não autenticado." }) } as Response;
      if (url.endsWith("/api/intervalos")) return ok([
        { id: 1, nome: "Recreio", hora_inicio: "09:30", hora_fim: "09:45", grupos: [{ id: 3, tipo: "CURSO", nome: "Informática" }] },
        { id: 2, nome: "Outro turno", hora_inicio: "15:00", hora_fim: "15:15", grupos: [{ id: 99, tipo: "CURSO", nome: "Mecânica" }] },
      ]);
      if (url.includes("apenas_opcoes=1")) return ok({ turmas: [option, otherOption], professores: [], horarios: [] });
      if (url.includes("turma=INFO%2063%201")) return ok({ turmas: [option], horarios: [{ id: 1, ...option, dia: "SEG", periodo: 1, hora_inicio: "07:30", disciplina: "Programação", professor: "Ana", sala_id: null, ambiente: null, sala: null, bloco: null }] });
      throw new Error(`URL inesperada: ${url}`);
    }));

    render(<HorariosSection />);
    const summary = await screen.findByRole("region", { name: "Intervalos e merenda por curso" });
    expect(summary).toHaveTextContent("Recreio");
    expect(summary).toHaveTextContent("Informática");
    expect(summary).toHaveTextContent("Outro turno");
    expect(summary).toHaveTextContent("Mecânica");
    fireEvent.click(await screen.findByRole("button", { name: "Informática" }));
    const intervals = await screen.findByRole("region", { name: "Intervalos da turma" });
    expect(intervals).toHaveTextContent("Recreio");
    expect(intervals).not.toHaveTextContent("Outro turno");
  });

  it("agrupa cursos com os mesmos horários em uma linha de manhã e tarde", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/auth/me")) return { ok: false, status: 401, json: async () => ({ message: "Não autenticado." }) } as Response;
      if (url.endsWith("/api/intervalos")) return ok([
        { id: 1, nome: "Intervalo da manhã", hora_inicio: "09:10", hora_fim: "09:25", grupos: [{ id: 1, tipo: "CURSO", nome: "Informática" }] },
        { id: 2, nome: "Intervalo da manhã", hora_inicio: "09:10", hora_fim: "09:25", grupos: [{ id: 2, tipo: "CURSO", nome: "Eletrônica" }] },
        { id: 3, nome: "Intervalo da tarde", hora_inicio: "14:40", hora_fim: "14:55", grupos: [{ id: 2, tipo: "CURSO", nome: "Eletrônica" }, { id: 1, tipo: "CURSO", nome: "Informática" }] },
        { id: 4, nome: "Merenda noturna", hora_inicio: "18:45", hora_fim: "19:30", grupos: [{ id: 1, tipo: "CURSO", nome: "Informática" }, { id: 2, tipo: "CURSO", nome: "Eletrônica" }] },
      ]);
      if (url.includes("apenas_opcoes=1")) return ok({
        turmas: [
          { turma: "INFO 63 1", curso: "Informática", ano: "3", grupo_ids: [1] },
          { turma: "ELE 63 1", curso: "Eletrônica", ano: "3", grupo_ids: [2] },
        ],
        professores: [],
        horarios: [],
      });
      throw new Error("URL inesperada: " + url);
    }));

    render(<HorariosSection />);
    const table = await screen.findByRole("table", { name: "Intervalos diurnos por curso" });
    const row = within(table).getByText("09:10–09:25").closest('[role="row"]');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("Informática")).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText("Eletrônica")).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText("14:40–14:55")).toBeInTheDocument();
    expect(within(table).getAllByText("09:10–09:25")).toHaveLength(1);
    const night = screen.getByText("Merenda noturna").parentElement;
    expect(night).toHaveTextContent("18:45–19:30");
    expect(night).toHaveTextContent("Informática");
    expect(night).toHaveTextContent("Eletrônica");
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

  it("alterna o dia visivel no mobile", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-28T12:00:00"));
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/auth/me")) {
        return { ok: false, status: 401, json: async () => ({ message: "Nao autenticado." }) } as Response;
      }
      if (url.includes("apenas_opcoes=1")) {
        return ok({ turmas: [{ turma: "T1", curso: "Teste", ano: "1" }], professores: [], horarios: [] });
      }
      if (url.includes("turma=T1")) {
        return ok({
          turmas: [],
          horarios: [
            {
              id: 1,
              turma: "T1",
              curso: "Teste",
              ano: "1",
              dia: "SEG",
              periodo: 1,
              hora_inicio: "07:30",
              disciplina: "Matematica",
              professor: "Ana",
              sala_id: null,
              ambiente: null,
              sala: "A101",
              bloco: null,
            },
            {
              id: 2,
              turma: "T1",
              curso: "Teste",
              ano: "1",
              dia: "SEX",
              periodo: 2,
              hora_inicio: "08:40",
              disciplina: "Historia",
              professor: "Bia",
              sala_id: null,
              ambiente: null,
              sala: "B202",
              bloco: null,
            },
          ],
        });
      }
      throw new Error(`URL inesperada: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HorariosSection />);

    fireEvent.click(await screen.findByRole("button", { name: "Teste" }));
    await screen.findAllByText("Matematica");

    const monday = screen.getByRole("heading", { name: "Segunda-feira" }).closest("section");
    const friday = screen.getByRole("heading", { name: "Sexta-feira" }).closest("section");
    await waitFor(() => expect(friday).not.toHaveClass("hidden"));
    expect(monday).toHaveClass("hidden");

    const mondayButton = screen.getByRole("button", { name: "Seg 1" });
    const fridayButton = screen.getByRole("button", { name: "Sex 1" });
    expect(fridayButton.parentElement).toHaveClass("grid");
    expect(fridayButton.parentElement?.parentElement).not.toHaveClass("overflow-x-auto");

    fireEvent.click(mondayButton);
    expect(monday).not.toHaveClass("hidden");
    expect(friday).toHaveClass("hidden");
  });

  it("restaura a ultima turma aberta", async () => {
    localStorage.setItem("cimol_horarios_state", JSON.stringify({
      view: "tabela",
      course: "InformÃ¡tica",
      year: "2",
      className: "62-1",
      teacherQuery: "",
    }));

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/auth/me")) {
        return { ok: false, status: 401, json: async () => ({ message: "NÃ£o autenticado." }) } as Response;
      }
      if (url.includes("apenas_opcoes=1")) {
        return ok({
          turmas: [
            { turma: "62-1", curso: "InformÃ¡tica", ano: "2" },
            { turma: "63-1", curso: "InformÃ¡tica", ano: "3" },
          ],
          professores: [],
          horarios: [],
        });
      }
      if (url.includes("turma=62-1")) {
        return ok({
          turmas: [],
          horarios: [
            {
              id: 1,
              turma: "62-1",
              curso: "InformÃ¡tica",
              ano: "2",
              dia: "SEG",
              periodo: 1,
              hora_inicio: "07:30",
              disciplina: "Banco de Dados",
              professor: "Maria Silva",
              sala_id: null,
              ambiente: null,
              sala: "LaboratÃ³rio 201",
              bloco: "Bloco A",
            },
          ],
        });
      }
      throw new Error(`URL inesperada: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HorariosSection />);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/horarios/publicados?turma=62-1"),
        expect.any(Object),
      )
    );
    expect((await screen.findAllByText("Banco de Dados")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("LaboratÃ³rio 201").length).toBeGreaterThan(0);
  });
});
