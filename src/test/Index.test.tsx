import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import Index from "@/pages/Index";

vi.mock("@/components/sections/HorariosSection", () => ({ default: () => <div>Conteudo Horarios</div> }));
vi.mock("@/components/sections/MapaSection", () => ({ default: () => <div>Conteudo Mapa</div> }));
vi.mock("@/components/sections/EventosSection", () => ({ default: () => <div>Conteudo Eventos</div> }));
vi.mock("@/components/sections/SetoresSection", () => ({ default: () => <div>Conteudo Setores</div> }));
vi.mock("@/components/sections/ReclamacoesSection", () => ({ default: () => <div>Conteudo Ouvidoria</div> }));

describe("Index", () => {
  afterEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("volta para a ultima secao aberta do site", () => {
    const view = render(<Index />, { wrapper: MemoryRouter });

    fireEvent.click(screen.getByRole("button", { name: "Eventos" }));

    expect(localStorage.getItem("cimol_home_tab")).toBe("eventos");
    expect(window.location.hash).toBe("#eventos");
    expect(screen.getByText("Conteudo Eventos")).toBeInTheDocument();

    view.unmount();
    render(<Index />, { wrapper: MemoryRouter });

    expect(screen.getByText("Conteudo Eventos")).toBeInTheDocument();
  });

  it("prioriza a secao salva na URL", () => {
    localStorage.setItem("cimol_home_tab", "mapa");
    window.history.replaceState(null, "", "/#setores");

    render(<Index />, { wrapper: MemoryRouter });

    expect(screen.getByText("Conteudo Setores")).toBeInTheDocument();
  });
});
