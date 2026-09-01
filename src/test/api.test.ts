import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, INSTITUTION_SLUG_STORAGE_KEY } from "@/lib/api";

afterEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});

describe("apiFetch", () => {
  it("envia o slug selecionado nas chamadas da instituicao", async () => {
    window.localStorage.setItem(INSTITUTION_SLUG_STORAGE_KEY, "escola-teste");
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);

    await apiFetch("/api/instituicao");

    const headers = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(headers.get("x-institution-slug")).toBe("escola-teste");
  });

  it("usa o slug da URL ao abrir instituicao em nova aba", async () => {
    window.history.replaceState(null, "", "/?instituicao=escola-nova");
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);

    await apiFetch("/api/instituicao");

    const headers = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(headers.get("x-institution-slug")).toBe("escola-nova");
    expect(window.localStorage.getItem(INSTITUTION_SLUG_STORAGE_KEY)).toBe("escola-nova");
  });
});
