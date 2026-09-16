import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ReclamacoesSection from "@/components/sections/ReclamacoesSection";

describe("ReclamacoesSection", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("envia um relato somente com a categoria", async () => {
    let payload: Record<string, unknown> | null = null;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/api/setores")) return { ok: true, json: async () => [] } as Response;
      payload = JSON.parse(String(init?.body));
      return { ok: true, status: 201, json: async () => ({ id: 1, status: "NOVA" }) } as Response;
    }));

    render(<ReclamacoesSection />);
    fireEvent.click(screen.getByRole("combobox", { name: "O que está errado?" }));
    fireEvent.click(await screen.findByRole("option", { name: "Sala indisponível" }));
    fireEvent.click(screen.getByRole("button", { name: "Relatar problema" }));

    await waitFor(() => expect(payload).not.toBeNull());
    expect(payload).toMatchObject({ categoria: "SALA_INDISPONIVEL", origem: "FORMULARIO", mensagem: null });
  });
});
