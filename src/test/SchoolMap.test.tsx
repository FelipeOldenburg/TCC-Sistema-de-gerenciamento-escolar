import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SchoolMap from "@/components/SchoolMap";

const blocks = [
  { id: 1, nome: "Bloco A", descricao: "Prédio principal", total_salas: 1 },
];

const rooms = [
  {
    id: 10,
    nome: "Laboratório 101",
    bloco_id: 1,
    bloco_nome: "Bloco A",
    andar: "1º andar",
    capacidade: 24,
    tipo: "Laboratório de informática",
    possui_computadores: true,
    possui_data_show: true,
    possui_internet: true,
    possui_ar_condicionado: false,
    softwares: ["VS Code"],
    observacoes: "Acesso pelo corredor principal.",
  },
];

describe("SchoolMap", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("localiza uma sala e mostra seus detalhes", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return {
        ok: true,
        json: async () => url.endsWith("/api/blocos") ? blocks : rooms,
      } as Response;
    }));

    render(<SchoolMap />);

    await waitFor(() => expect(screen.getByText("Laboratório 101")).toBeInTheDocument());
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar uma sala ou ambiente" }), {
      target: { value: "laboratorio 101" },
    });

    const results = screen.getByRole("listbox", { name: "Resultados da busca" });
    fireEvent.click(within(results).getByRole("option"));

    const details = screen.getByRole("region", { name: "Detalhes da sala selecionada" });
    expect(within(details).getByText("Sala selecionada")).toBeInTheDocument();
    expect(within(details).getByText("24 lugares")).toBeInTheDocument();
    expect(within(details).getByText("Computadores")).toBeInTheDocument();
    expect(within(details).getByText("Acesso pelo corredor principal.")).toBeInTheDocument();
  });
});
