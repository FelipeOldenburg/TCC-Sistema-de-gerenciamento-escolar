import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import OuvidoriaAdminSection from "@/components/admin/OuvidoriaAdminSection";

const report = (id: number) => ({
  id,
  nome: null,
  perfil: null,
  categoria: "SALA_INDISPONIVEL",
  setor_nome: null,
  sala_nome: `Sala ${id}`,
  mapa_area_nome: null,
  mapa_nome: null,
  origem: "SALA",
  contexto_json: null,
  assunto: null,
  mensagem: null,
  status: "NOVA",
  created_at: "2026-09-15T12:00:00.000Z",
});

describe("OuvidoriaAdminSection", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("permite consultar relatos além da primeira página", async () => {
    const requestedPages: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://localhost");
      const page = url.searchParams.get("page") || "1";
      requestedPages.push(page);
      return {
        ok: true,
        status: 200,
        json: async () => ({ items: [report(page === "1" ? 1 : 101)], paginacao: { pagina: Number(page), por_pagina: 100, total: 101 } }),
      } as Response;
    }));

    render(<OuvidoriaAdminSection />);
    expect(await screen.findByText("Sala 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));

    expect(await screen.findByText("Sala 101")).toBeInTheDocument();
    await waitFor(() => expect(requestedPages).toContain("2"));
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();
  });
});
