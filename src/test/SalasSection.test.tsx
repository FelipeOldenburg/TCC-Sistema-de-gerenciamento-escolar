import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SalasSection from "@/components/admin/SalasSection";

const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => data }) as Response;

describe("SalasSection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("seleciona períodos vazios de salas e aloca as turmas correspondentes em uma operação", async () => {
    const horarios = [
      { id: 1, turma: "1A", curso: "Informática", ano: "1", dia: "SEG", periodo: 1, hora_inicio: "07:30", disciplina: "Matemática", professor: "Ana", sala_id: 1, sala: "A101", bloco: "Bloco A" },
      { id: 2, turma: "1A", curso: "Informática", ano: "1", dia: "SEG", periodo: 2, hora_inicio: "08:20", disciplina: "Português", professor: "Beto", sala_id: 1, sala: "A101", bloco: "Bloco A" },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/blocos")) return ok([{ id: 1, nome: "Bloco A" }]);
      if (url.endsWith("/api/salas")) return ok([
        { id: 1, nome: "A101", bloco_id: 1, bloco_nome: "Bloco A", andar: "1º", capacidade: 30, tipo: "Sala de aula", status: "ATIVA", acessivel: false, possui_computadores: false, possui_data_show: false, possui_internet: false, possui_ar_condicionado: false, softwares: [], observacoes: null },
        { id: 2, nome: "B201", bloco_id: 1, bloco_nome: "Bloco A", andar: "2º", capacidade: 30, tipo: "Sala de aula", status: "ATIVA", acessivel: false, possui_computadores: false, possui_data_show: false, possui_internet: false, possui_ar_condicionado: false, softwares: [], observacoes: null },
      ]);
      if (url.includes("/api/horarios/publicados?dia=")) return ok({ horarios });
      if (url.endsWith("/api/sala-alteracoes?limit=20")) return ok([]);
      if (url.endsWith("/api/horarios/publicados/salas/lote") && init?.method === "PATCH") return ok({ updated: 2 });
      throw new Error(`URL inesperada: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SalasSection />);
    fireEvent.click(await screen.findByRole("button", { name: "Selecionar período 1 da sala B201, manhã" }));
    fireEvent.click(screen.getByRole("button", { name: "Selecionar período 2 da sala B201, manhã" }));
    fireEvent.click(screen.getByRole("button", { name: "Alocar turma nos períodos" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Turma para B201, manhã, período 1" }), { target: { value: "1" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Turma para B201, manhã, período 2" }), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Quantidade de alunos em B201, período 1"), { target: { value: "25" } });
    fireEvent.change(screen.getByLabelText("Motivo (opcional)"), { target: { value: "Remanejamento" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar alocação" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith("/api/horarios/publicados/salas/lote") && init?.method === "PATCH");
      expect(call).toBeDefined();
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        alocacoes: [
          { horario_id: 1, sala_id: 2, quantidade_alunos: 25 },
          { horario_id: 2, sala_id: 2 },
        ],
        motivo: "Remanejamento",
      });
    });
  });
});
