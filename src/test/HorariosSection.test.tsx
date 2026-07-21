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

  it("bloqueia sala ocupada no mesmo periodo para CPD", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/auth/me")) {
        return ok({ user: { id: 1, nome: "CPD", usuario: "cpd", papel: "CPD" } });
      }
      if (url.includes("apenas_opcoes=1")) {
        return ok({ turmas, horarios: [] });
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
