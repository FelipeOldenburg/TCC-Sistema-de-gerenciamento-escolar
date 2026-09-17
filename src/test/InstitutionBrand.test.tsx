import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

import AppHeader from "@/components/AppHeader";

const brandResponse = (slug: string, name: string) => ({
  ok: true,
  json: async () => ({
    slug,
    name,
    adminName: `${name} Admin`,
    systemName: "Sistema Escolar",
    adminSubtitle: "Painel Administrativo",
    logoUrl: null,
    colors: {
      primary: "220 60% 40%",
      accent: "220 60% 40%",
      header: "220 60% 40%",
      nav: "220 60% 40%",
      navActive: "220 60% 40%",
    },
  }),
} as Response);

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
  localStorage.clear();
});

it("não mostra a marca CIMOL antes de carregar outra instituição", async () => {
  window.history.replaceState(null, "", "/?instituicao=outra-escola");
  document.title = "CIMOL";

  let resolveRequest!: (response: Response) => void;
  const request = new Promise<Response>((resolve) => { resolveRequest = resolve; });
  const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => request);
  vi.stubGlobal("fetch", fetchMock);

  render(<AppHeader />, { wrapper: MemoryRouter });

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe("/api/instituicao");
  expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("x-institution-slug")).toBe("outra-escola");

  const showedCimolWhileLoading = Boolean(screen.queryByRole("heading", { name: "CIMOL" }));
  const showedCimolLogoWhileLoading = Boolean(screen.queryByRole("img", { name: "CIMOL" }));
  const showedCimolTitleWhileLoading = document.title.includes("CIMOL");
  resolveRequest(brandResponse("outra-escola", "Outra Escola"));

  expect(showedCimolWhileLoading).toBe(false);
  expect(showedCimolLogoWhileLoading).toBe(false);
  expect(showedCimolTitleWhileLoading).toBe(false);
  await waitFor(() => expect(screen.getByRole("heading", { name: "Outra Escola" })).toBeInTheDocument());
});

it("troca a marca sem mostrar a instituição anterior ao abrir outra na mesma aba", async () => {
  window.history.replaceState(null, "", "/?instituicao=escola-a");

  let resolveSecondRequest!: (response: Response) => void;
  const secondRequest = new Promise<Response>((resolve) => { resolveSecondRequest = resolve; });
  let requestCount = 0;
  const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
    ++requestCount === 1 ? Promise.resolve(brandResponse("escola-a", "Escola A")) : secondRequest,
  );
  vi.stubGlobal("fetch", fetchMock);

  const firstView = render(<AppHeader />, { wrapper: MemoryRouter });
  await screen.findByRole("heading", { name: "Escola A" });
  firstView.unmount();

  window.history.replaceState(null, "", "/?instituicao=escola-b");
  render(<AppHeader />, { wrapper: MemoryRouter });

  const showedOldBrandWhileLoading = Boolean(screen.queryByRole("heading", { name: "Escola A" }));
  resolveSecondRequest(brandResponse("escola-b", "Escola B"));

  expect(showedOldBrandWhileLoading).toBe(false);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get("x-institution-slug")).toBe("escola-b");
  await waitFor(() => expect(screen.getByRole("heading", { name: "Escola B" })).toBeInTheDocument());
});
