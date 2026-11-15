import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { apiFetch } from "@/lib/api";
import EventosSection from "@/components/sections/EventosSection";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

describe("EventosSection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exibe eventos antigos com a capa de gradiente sem carregar as imagens legadas", async () => {
    vi.mocked(apiFetch).mockResolvedValue([{
      id: 3,
      titulo: "Semana de projetos",
      descricao: "Apresentações dos cursos.",
      data_evento: "2026-10-02",
      hora_evento: "09:30",
      local: "Auditório",
      imagem_url: "https://example.com/legada.jpg",
    }]);

    render(<EventosSection />);

    expect(await screen.findByRole("heading", { name: "Semana de projetos" })).toBeInTheDocument();
    expect(screen.getByText("Auditório")).toBeInTheDocument();
    expect(screen.getByText("09:30")).toBeInTheDocument();
    expect(screen.getByText("2", { selector: "span" })).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
