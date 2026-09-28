import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import SetoresSection from "@/components/sections/SetoresSection";

afterEach(() => vi.unstubAllGlobals());

it("retorna à área selecionada e foca o setor enquanto os mapas carregam", async () => {
  let resolveMaps!: (response: Response) => void;
  const pendingMaps = new Promise<Response>((resolve) => { resolveMaps = resolve; });
  const response = (data: unknown) => ({ ok: true, json: async () => data } as Response);
  const onViewMap = vi.fn();
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/api/mapas")) return pendingMaps;
    if (url.endsWith("/api/setores")) return Promise.resolve(response([{
      id: 4, nome: "Laboratórios", descricao: "Ambientes técnicos", responsavel: null, localizacao: null,
      contato: null, horario_atendimento: null, icone: "flask", cor: "emerald",
      mapa_id: 1, mapa_area_id: 10, mapa_nome: "Local anterior",
    }]));
    throw new Error(`Unexpected API request: ${url}`);
  }));

  await act(async () => {
    render(<SetoresSection selectedSectorId={4} selectedMapAreaId={77} onViewMap={onViewMap} />);
  });
  expect(screen.getByRole("article")).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Voltar ao mapa" }));
  expect(onViewMap).toHaveBeenCalledTimes(1);
  expect(onViewMap).toHaveBeenCalledWith(77);
  expect(onViewMap).not.toHaveBeenCalledWith(10);

  await act(async () => { resolveMaps(response([])); });
});
