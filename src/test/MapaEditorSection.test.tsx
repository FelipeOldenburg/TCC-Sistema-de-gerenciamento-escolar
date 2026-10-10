import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MapaEditorSection from "@/components/admin/MapaEditorSection";
import type { MapArea, MapView } from "@/controllers/useSchoolMap";

const path = "M 10 10 H 30 V 30 H 10 Z";
const area = (id: number, nome: string, categoria: MapArea["categoria"]): MapArea => ({
  id, mapa_id: 1, nome, categoria, tipo: "OUTRO", caminho_svg: path,
  bloco_id: null, sala_id: null, setor_id: null,
  bloco_nome: null, sala_nome: null, setor_nome: null,
});
const areas = [
  area(1, "Sala 201", "AMBIENTE"),
  area(2, "Corredor", "CIRCULACAO"),
  area(3, "Escada", "ESCADA"),
  area(4, "Entrada", "ACESSO"),
  area(5, "Pátio", "PATIO"),
];
const maps: MapView[] = [{
  id: 1, nome: "CIMOL · Bloco C · 2º pavimento", piso: "2º pavimento",
  largura: 100, altura: 80, areas,
}];

const mockApi = (patchStatus = 200, mapData: MapView[] = maps) => {
  let currentMaps = structuredClone(mapData);
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/api/mapas")) return new Response(JSON.stringify(currentMaps));
    if (url.endsWith("/api/blocos")) return new Response(JSON.stringify([{ id: 3, nome: "Bloco C" }, { id: 4, nome: "Bloco D" }]));
    if (url.endsWith("/api/mapas/1/areas/1/ajuste")) {
      if (patchStatus === 409) return new Response(JSON.stringify({ message: "A área mudou." }), { status: 409 });
      const { anterior: _anterior, ...updated } = JSON.parse(String(init?.body));
      return new Response(JSON.stringify(updated));
    }
    if (url.endsWith("/api/mapas/1/areas") && init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      currentMaps = currentMaps.map((map) => map.id !== 1 ? map : { ...map, areas: [...map.areas, {
        ...body, id: 6, mapa_id: 1, tipo: "BLOCO", categoria: "AMBIENTE", bloco_nome: "Bloco D",
        sala_id: null, setor_id: null, sala_nome: null, setor_nome: null,
      }] });
      return new Response(JSON.stringify({ id: 6 }), { status: 201 });
    }
    if (/\/api\/mapas\/1\/areas\/\d+$/.test(url) && init?.method === "PATCH") {
      const areaId = Number(url.split("/").pop());
      const body = JSON.parse(String(init.body));
      currentMaps = currentMaps.map((map) => map.id !== 1 ? map : { ...map, areas: map.areas.map((item) =>
        item.id === areaId ? { ...item, destino_mapa_id: body.destino_mapa_id } : item) });
      return new Response(JSON.stringify({ ok: true }));
    }
    if (url.endsWith("/api/mapas/1/areas/6") && init?.method === "DELETE") {
      currentMaps = currentMaps.map((map) => map.id !== 1 ? map : { ...map, areas: map.areas.filter((item) => item.id !== 6) });
      return new Response(JSON.stringify({ ok: true }));
    }
    throw new Error(`Chamada inesperada: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const selectArea = async (id = 1) => {
  const selector = await screen.findByLabelText("Área");
  fireEvent.change(selector, { target: { value: String(id) } });
};

const patchCalls = (fetchMock: ReturnType<typeof mockApi>) =>
  fetchMock.mock.calls.filter(([input]) => String(input).includes("/ajuste"));

describe("MapaEditorSection", () => {
  const originalGetBBox = Object.getOwnPropertyDescriptor(SVGElement.prototype, "getBBox");

  beforeEach(() => {
    sessionStorage.clear();
    Object.defineProperty(SVGElement.prototype, "getBBox", {
      configurable: true,
      value: () => ({ x: 10, y: 10, width: 20, height: 20 }),
    });
  });

  afterEach(() => {
    if (originalGetBBox) Object.defineProperty(SVGElement.prototype, "getBBox", originalGetBBox);
    else Reflect.deleteProperty(SVGElement.prototype, "getBBox");
    vi.unstubAllGlobals();
  });

  it("lista e permite selecionar ambientes, circulação, escadas, acessos e pátios", async () => {
    mockApi();
    render(<MapaEditorSection institutionId={1} />);
    const selector = await screen.findByLabelText("Área");
    expect(within(selector).getAllByRole("option")).toHaveLength(6);
    const categories = ["Ambiente", "Circulação", "Escada", "Acesso", "Pátio"];
    for (const [index, item] of areas.entries()) {
      expect(within(selector).getByRole("option", { name: `${item.nome} · ${categories[index]}` })).toBeInTheDocument();
      fireEvent.change(selector, { target: { value: String(item.id) } });
      expect(screen.getByRole("button", { name: `Selecionar e mover ${item.nome}` })).toHaveAttribute("aria-pressed", "true");
    }
  });

  it("permite preparar uma vista inativa sem publicá-la", async () => {
    mockApi(200, [...maps, { ...maps[0], id: 2, nome: "CIMOL · Rascunho", ativo: false,
      areas: [area(20, "Acesso futuro", "ACESSO")] }]);
    render(<MapaEditorSection institutionId={1} />);
    const mapSelector = await screen.findByLabelText("Mapa / pavimento");
    expect(within(mapSelector).getByRole("option", { name: "Rascunho · inativo" })).toBeInTheDocument();
    fireEvent.change(mapSelector, { target: { value: "2" } });
    expect(within(screen.getByLabelText("Área")).getByRole("option", { name: "Acesso futuro · Acesso" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/vista está inativa.*só aparecem para alunos e docentes/i);
  });

  it("cria uma área de bloco, altera seu destino e a remove sem excluir o cadastro", async () => {
    const mapData = [maps[0], { ...maps[0], id: 2, nome: "CIMOL · Bloco D · Térreo", areas: [] },
      { ...maps[0], id: 3, nome: "CIMOL · Bloco D · 2º pavimento", areas: [] }];
    const fetchMock = mockApi(200, mapData);
    vi.stubGlobal("confirm", vi.fn(() => true));
    render(<MapaEditorSection institutionId={1} />);

    fireEvent.click(await screen.findByRole("button", { name: "Adicionar bloco ao mapa" }));
    fireEvent.change(screen.getByLabelText("Bloco cadastrado"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Abrir ao clicar"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar área do bloco" }));
    await screen.findByRole("button", { name: "Selecionar e mover Bloco D" });
    const post = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith("/api/mapas/1/areas") && init?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ nome: "Bloco D", bloco_id: 4, destino_mapa_id: 2 });
    expect(screen.getByLabelText("Ao clicar em Bloco D, abrir")).toHaveValue("2");

    fireEvent.change(screen.getByLabelText("Ao clicar em Bloco D, abrir"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar destino" }));
    await waitFor(() => expect(screen.getByLabelText("Ao clicar em Bloco D, abrir")).toHaveValue("3"));
    const change = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith("/api/mapas/1/areas/6") && init?.method === "PATCH");
    expect(JSON.parse(String(change?.[1]?.body))).toMatchObject({ destino_mapa_id: 3, anterior: { nome: "Bloco D", destino_mapa_id: 2 } });

    fireEvent.click(screen.getByRole("button", { name: "Remover do mapa" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Selecionar e mover Bloco D" })).not.toBeInTheDocument());
    const removal = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith("/api/mapas/1/areas/6") && init?.method === "DELETE");
    expect(JSON.parse(String(removal?.[1]?.body))).toMatchObject({ anterior: { nome: "Bloco D", destino_mapa_id: 3 } });
    expect(fetchMock.mock.calls.some(([input, init]) => String(input).endsWith("/api/blocos/4") && init?.method === "DELETE")).toBe(false);
  });

  it("não adiciona um bloco com o mesmo nome de uma área existente na vista", async () => {
    const fetchMock = mockApi(200, [{ ...maps[0], areas: [...areas, area(7, "Bloco D", "AMBIENTE")] },
      { ...maps[0], id: 2, areas: [] }]);
    render(<MapaEditorSection institutionId={1} />);
    fireEvent.click(await screen.findByRole("button", { name: "Adicionar bloco ao mapa" }));
    fireEvent.change(screen.getByLabelText("Bloco cadastrado"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Abrir ao clicar"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar área do bloco" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/já possui uma área/i);
    expect(fetchMock.mock.calls.some(([input, init]) => String(input).endsWith("/api/mapas/1/areas") && init?.method === "POST")).toBe(false);
  });

  it("mantém o ajuste do mapa disponível quando o cadastro de blocos falha", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => String(input).endsWith("/api/mapas")
      ? new Response(JSON.stringify(maps)) : new Response(JSON.stringify({ message: "Falha ao carregar blocos" }), { status: 503 })));
    render(<MapaEditorSection institutionId={1} />);
    await selectArea();
    expect(screen.getByRole("button", { name: "Selecionar e mover Sala 201" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar bloco ao mapa" }));
    expect(screen.getAllByRole("alert").some((alert) => /não foi possível carregar os blocos/i.test(alert.textContent ?? ""))).toBe(true);
    expect(screen.getByRole("button", { name: "Criar área do bloco" })).toBeDisabled();
  });

  it("permite corrigir o destino de um acesso sem trocar o desenho", async () => {
    const fetchMock = mockApi(200, [{ ...maps[0], areas: areas.map((item) => item.id === 4 ? { ...item, destino_mapa_id: null } : item) },
      { ...maps[0], id: 2, nome: "CIMOL · Pátio", areas: [] }]);
    render(<MapaEditorSection institutionId={1} />);
    await selectArea(4);
    fireEvent.change(screen.getByLabelText("Ao clicar em Entrada, abrir"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar destino" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar destino" })).toBeDisabled());
    const patch = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith("/api/mapas/1/areas/4") && init?.method === "PATCH");
    expect(JSON.parse(String(patch?.[1]?.body))).toMatchObject({ destino_mapa_id: 2, anterior: { nome: "Entrada", caminho_svg: path, destino_mapa_id: null } });
    expect(screen.getByRole("button", { name: "Selecionar e mover Entrada" })).toHaveAttribute("d", path);
  });

  it("move por teclado e salva só o ajuste com o caminho anterior como snapshot", async () => {
    const fetchMock = mockApi();
    render(<MapaEditorSection institutionId={1} />);
    await selectArea();
    const selected = screen.getByRole("button", { name: "Selecionar e mover Sala 201" });
    fireEvent.keyDown(selected, { key: "ArrowRight" });
    expect(selected).toHaveAttribute("d", path);
    expect(selected).toHaveAttribute("transform", "matrix(1 0 0 1 1 0)");

    fireEvent.click(screen.getByRole("button", { name: "Salvar ajuste" }));
    await waitFor(() => expect(patchCalls(fetchMock)).toHaveLength(1));
    const [, request] = patchCalls(fetchMock)[0];
    expect(request?.method).toBe("PATCH");
    expect(JSON.parse(String(request?.body))).toEqual({
      ajuste_x: 1, ajuste_y: 0, escala_x: 1, escala_y: 1,
      anterior: { ajuste_x: 0, ajuste_y: 0, escala_x: 1, escala_y: 1, caminho_svg: path },
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar ajuste" })).toBeDisabled());
  });

  it("não muda o zoom ao começar a arrastar uma área ainda não selecionada", async () => {
    mockApi();
    render(<MapaEditorSection institutionId={1} />);
    const svg = await screen.findByRole("group", { name: "Editar áreas de Bloco C · 2º pavimento" });
    Object.defineProperty(svg, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, width: 800, height: 520 }),
    });
    const selected = screen.getByRole("button", { name: "Selecionar e mover Sala 201" });
    const initialViewBox = svg.getAttribute("viewBox");
    fireEvent(selected, Object.assign(new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 100, clientY: 100 }), { pointerId: 1, pointerType: "mouse" }));
    expect(svg).toHaveAttribute("viewBox", initialViewBox);
    fireEvent(svg, Object.assign(new MouseEvent("pointermove", { bubbles: true, clientX: 120, clientY: 120 }), { pointerId: 1 }));
    expect(selected.getAttribute("transform")).toMatch(/^matrix\(1 0 0 1 [1-9]/);
  });

  it("cancela o ajuste local sem enviar PATCH", async () => {
    const fetchMock = mockApi();
    render(<MapaEditorSection institutionId={1} />);
    await selectArea();
    const selected = screen.getByRole("button", { name: "Selecionar e mover Sala 201" });
    fireEvent.keyDown(selected, { key: "ArrowDown" });
    expect(selected).toHaveAttribute("transform", "matrix(1 0 0 1 0 1)");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar ajuste" }));
    expect(selected).toHaveAttribute("transform", "matrix(1 0 0 1 0 0)");
    expect(screen.getByRole("button", { name: "Salvar ajuste" })).toBeDisabled();
    expect(patchCalls(fetchMock)).toHaveLength(0);
  });

  it("recupera o rascunho da sessão após sair e voltar sem gravar", async () => {
    const fetchMock = mockApi();
    const first = render(<MapaEditorSection institutionId={1} />);
    await selectArea();
    fireEvent.keyDown(screen.getByRole("button", { name: "Selecionar e mover Sala 201" }), { key: "ArrowRight" });
    expect(sessionStorage.getItem("design-compass.map-editor-draft.1")).toContain('"areaId":1');
    first.unmount();

    render(<MapaEditorSection institutionId={1} />);
    const selected = await screen.findByRole("button", { name: "Selecionar e mover Sala 201" });
    await waitFor(() => expect(selected).toHaveAttribute("transform", "matrix(1 0 0 1 1 0)"));
    expect(screen.getByRole("button", { name: "Salvar ajuste" })).toBeEnabled();
    expect(patchCalls(fetchMock)).toHaveLength(0);
  });

  it("impede salvar um rascunho recuperado sobre uma versão nova", async () => {
    sessionStorage.setItem("design-compass.map-editor-draft.1", JSON.stringify({ mapId: 1, areaId: 1,
      draft: { ajuste_x: 1, ajuste_y: 0, escala_x: 1, escala_y: 1 },
      previous: { ajuste_x: 0, ajuste_y: 0, escala_x: 1, escala_y: 1, caminho_svg: path },
    }));
    mockApi(200, [{ ...maps[0], areas: maps[0].areas.map((item) => item.id === 1 ? { ...item, ajuste_x: 2 } : item) }]);
    render(<MapaEditorSection institutionId={1} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/mapa mudou/i);
    expect(screen.getByRole("button", { name: "Salvar ajuste" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descartar e atualizar" })).toBeEnabled();
  });

  it("preserva o rascunho quando o mapa falha ao carregar ou a área desaparece", async () => {
    const pending = JSON.stringify({ mapId: 1, areaId: 999,
      draft: { ajuste_x: 1, ajuste_y: 0, escala_x: 1, escala_y: 1 },
      previous: { ajuste_x: 0, ajuste_y: 0, escala_x: 1, escala_y: 1, caminho_svg: path },
    });
    sessionStorage.setItem("design-compass.map-editor-draft.1", pending);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "Falha de rede" }), { status: 503 })));
    const failed = render(<MapaEditorSection institutionId={1} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha de rede");
    expect(sessionStorage.getItem("design-compass.map-editor-draft.1")).toBe(pending);
    failed.unmount();

    mockApi();
    render(<MapaEditorSection institutionId={1} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/área do rascunho não está mais disponível/i);
    expect(sessionStorage.getItem("design-compass.map-editor-draft.1")).toBe(pending);
    fireEvent.click(screen.getByRole("button", { name: "Descartar rascunho antigo" }));
    expect(sessionStorage.getItem("design-compass.map-editor-draft.1")).toBeNull();
    expect(screen.getByLabelText("Área")).toBeEnabled();
  });

  it("redimensiona pela alça e grava as novas escalas", async () => {
    const fetchMock = mockApi();
    render(<MapaEditorSection institutionId={1} />);
    await selectArea();
    const handle = screen.getByRole("button", { name: "Redimensionar Sala 201 pelo canto inferior direito" });
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    const selected = screen.getByRole("button", { name: "Selecionar e mover Sala 201" });
    expect(selected).toHaveAttribute("d", path);
    expect(selected).toHaveAttribute("transform", "matrix(1.05 0 0 1.05 -0.5 -0.5)");
    fireEvent.click(screen.getByRole("button", { name: "Salvar ajuste" }));
    await waitFor(() => expect(patchCalls(fetchMock)).toHaveLength(1));
    expect(JSON.parse(String(patchCalls(fetchMock)[0][1]?.body))).toMatchObject({ escala_x: 1.05, escala_y: 1.05 });
  });

  it("mostra o conflito 409 e mantém o ajuste visível até descarte explícito", async () => {
    const fetchMock = mockApi(409);
    render(<MapaEditorSection institutionId={1} />);
    await selectArea();
    const selected = screen.getByRole("button", { name: "Selecionar e mover Sala 201" });
    fireEvent.keyDown(selected, { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("button", { name: "Salvar ajuste" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/alterada por outra pessoa/i);
    expect(selected).toHaveAttribute("transform", "matrix(1 0 0 1 1 0)");
    expect(screen.getByRole("button", { name: "Salvar ajuste" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descartar e atualizar" })).toBeInTheDocument();
    expect(patchCalls(fetchMock)).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Descartar e atualizar" }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/api/mapas"))).toHaveLength(2));
    await waitFor(() => expect(selected).toHaveAttribute("transform", "matrix(1 0 0 1 0 0)"));
  });
});
