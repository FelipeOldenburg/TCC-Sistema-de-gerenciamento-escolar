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
    if (url.endsWith("/api/mapas/1/areas/ajustes") && init?.method === "PATCH") {
      if (patchStatus === 409) return new Response(JSON.stringify({ message: "A área mudou." }), { status: 409 });
      const body = JSON.parse(String(init.body));
      currentMaps = currentMaps.map((map) => map.id !== 1 ? map : { ...map, areas: map.areas.map((item) => {
        const next = body.ajustes.find((adjustment: { area_id: number }) => adjustment.area_id === item.id);
        return next ? { ...item, ajuste_x: next.ajuste_x, ajuste_y: next.ajuste_y,
          escala_x: next.escala_x, escala_y: next.escala_y } : item;
      }) });
      return new Response(JSON.stringify({ ok: true }));
    }
    if (url.endsWith("/api/mapas/1/areas") && init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      currentMaps = currentMaps.map((map) => map.id !== 1 ? map : { ...map, areas: [...map.areas, {
        ...body, id: 6, mapa_id: 1, tipo: "OUTRO", bloco_id: null, bloco_nome: null,
        sala_id: null, setor_id: null, sala_nome: null, setor_nome: null,
      }] });
      return new Response(JSON.stringify({ id: 6 }), { status: 201 });
    }
    if (/\/api\/mapas\/1\/areas\/\d+$/.test(url) && init?.method === "PATCH") {
      const areaId = Number(url.split("/").pop());
      const body = JSON.parse(String(init.body));
      currentMaps = currentMaps.map((map) => map.id !== 1 ? map : { ...map, areas: map.areas.map((item) =>
        item.id === areaId ? { ...item, ...(Object.hasOwn(body, "nome") ? { nome: body.nome } : {}),
          ...(Object.hasOwn(body, "destino_mapa_id") ? { destino_mapa_id: body.destino_mapa_id } : {}) } : item) });
      return new Response(JSON.stringify({ ok: true }));
    }
    if (/\/api\/mapas\/1\/areas\/\d+$/.test(url) && init?.method === "DELETE") {
      const areaId = Number(url.split("/").pop());
      currentMaps = currentMaps.map((map) => map.id !== 1 ? map : {
        ...map,
        areas: map.areas.filter((item) => item.id !== areaId),
        areas_ocultas: [...(map.areas_ocultas ?? []), ...map.areas.filter((item) => item.id === areaId)],
      });
      return new Response(JSON.stringify({ ok: true }));
    }
    if (/\/api\/mapas\/1\/areas\/\d+\/restaurar$/.test(url) && init?.method === "POST") {
      const areaId = Number(url.split("/").at(-2));
      currentMaps = currentMaps.map((map) => map.id !== 1 ? map : {
        ...map,
        areas: [...map.areas, ...(map.areas_ocultas ?? []).filter((item) => item.id === areaId)],
        areas_ocultas: map.areas_ocultas?.filter((item) => item.id !== areaId),
      });
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
  fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/areas/ajustes"));

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

  it("cria um bloquinho com nome livre e destino opcional, altera seu destino e o remove", async () => {
    const mapData = [maps[0], { ...maps[0], id: 2, nome: "CIMOL · Bloco D · Térreo", areas: [] },
      { ...maps[0], id: 3, nome: "CIMOL · Bloco D · 2º pavimento", areas: [] }];
    const fetchMock = mockApi(200, mapData);
    vi.stubGlobal("confirm", vi.fn(() => true));
    render(<MapaEditorSection institutionId={1} />);

    fireEvent.click(await screen.findByRole("button", { name: "Criar bloquinho" }));
    fireEvent.change(screen.getByLabelText("Nome do bloquinho"), { target: { value: "Entrada lateral" } });
    fireEvent.change(screen.getByLabelText("Aparência da área"), { target: { value: "ACESSO" } });
    fireEvent.change(screen.getByLabelText("Função ao clicar"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar bloquinho" }));
    await screen.findByRole("button", { name: "Selecionar e mover Entrada lateral" });
    const post = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith("/api/mapas/1/areas") && init?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ nome: "Entrada lateral", categoria: "ACESSO", destino_mapa_id: 2 });
    expect(JSON.parse(String(post?.[1]?.body))).not.toHaveProperty("bloco_id");
    expect(screen.getByLabelText("Ao clicar em Entrada lateral, abrir")).toHaveValue("2");

    fireEvent.change(screen.getByLabelText("Ao clicar em Entrada lateral, abrir"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar destino" }));
    await waitFor(() => expect(screen.getByLabelText("Ao clicar em Entrada lateral, abrir")).toHaveValue("3"));
    const change = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith("/api/mapas/1/areas/6") && init?.method === "PATCH");
    expect(JSON.parse(String(change?.[1]?.body))).toMatchObject({ destino_mapa_id: 3, anterior: { nome: "Entrada lateral", destino_mapa_id: 2 } });

    fireEvent.click(screen.getByRole("button", { name: "Remover do mapa" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Selecionar e mover Entrada lateral" })).not.toBeInTheDocument());
    const removal = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith("/api/mapas/1/areas/6") && init?.method === "DELETE");
    expect(JSON.parse(String(removal?.[1]?.body))).toMatchObject({ anterior: { nome: "Entrada lateral", destino_mapa_id: 3 } });
    expect(fetchMock.mock.calls.some(([input, init]) => String(input).includes("/api/blocos/") && init?.method === "DELETE")).toBe(false);
  });

  it("remove qualquer tipo de área do desenho e permite restaurá-la", async () => {
    const fetchMock = mockApi();
    const confirm = vi.fn((message: string) => Boolean(message));
    vi.stubGlobal("confirm", confirm);
    render(<MapaEditorSection institutionId={1} />);

    for (const item of areas) {
      await selectArea(item.id);
      if (item.id > 1) expect(screen.getByLabelText("Áreas removidas nesta vista")).toHaveValue("");
      fireEvent.click(screen.getByRole("button", { name: "Remover do mapa" }));
      await waitFor(() => expect(screen.queryByRole("button", { name: `Selecionar e mover ${item.nome}` })).not.toBeInTheDocument());
      const deletion = fetchMock.mock.calls.find(([input, init]) =>
        String(input).endsWith(`/api/mapas/1/areas/${item.id}`) && init?.method === "DELETE");
      expect(JSON.parse(String(deletion?.[1]?.body))).toMatchObject({ anterior: { id: item.id, nome: item.nome } });
    }

    expect(confirm).toHaveBeenCalledTimes(areas.length);
    expect(confirm.mock.calls[2][0]).toContain("ligação por esta área");
    const removed = screen.getByLabelText("Áreas removidas nesta vista");
    expect(within(removed).getAllByRole("option")).toHaveLength(areas.length + 1);
    fireEvent.change(removed, { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Restaurar área" }));
    expect(await screen.findByRole("button", { name: "Selecionar e mover Corredor" })).toBeInTheDocument();
    const restoration = fetchMock.mock.calls.find(([input, init]) =>
      String(input).endsWith("/api/mapas/1/areas/2/restaurar") && init?.method === "POST");
    expect(JSON.parse(String(restoration?.[1]?.body))).toMatchObject({ anterior: { id: 2, nome: "Corredor" } });
    expect(fetchMock.mock.calls.some(([input, init]) => String(input).includes("/api/blocos/") && init?.method === "DELETE")).toBe(false);
  });

  it("não cria um bloquinho com o mesmo nome de uma área existente na vista", async () => {
    const fetchMock = mockApi(200, [{ ...maps[0], areas: [...areas, area(7, "Bloco D", "AMBIENTE")] },
      { ...maps[0], id: 2, areas: [] }]);
    render(<MapaEditorSection institutionId={1} />);
    fireEvent.click(await screen.findByRole("button", { name: "Criar bloquinho" }));
    fireEvent.change(screen.getByLabelText("Nome do bloquinho"), { target: { value: " bloco d " } });
    fireEvent.click(screen.getByRole("button", { name: "Criar bloquinho" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/já existe uma área/i);
    expect(fetchMock.mock.calls.some(([input, init]) => String(input).endsWith("/api/mapas/1/areas") && init?.method === "POST")).toBe(false);
  });

  it("cria um bloquinho sem destino nem cadastro de bloco", async () => {
    const fetchMock = mockApi();
    render(<MapaEditorSection institutionId={1} />);
    fireEvent.click(await screen.findByRole("button", { name: "Criar bloquinho" }));
    fireEvent.change(screen.getByLabelText("Nome do bloquinho"), { target: { value: "Sala de apoio" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar bloquinho" }));
    expect(await screen.findByRole("button", { name: "Selecionar e mover Sala de apoio" })).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith("/api/mapas/1/areas") && init?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ nome: "Sala de apoio", categoria: "AMBIENTE", destino_mapa_id: null });
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

  it("permite definir e limpar o destino de qualquer bloquinho", async () => {
    const fetchMock = mockApi(200, [{ ...maps[0], areas: [areas[1], areas[4]] },
      { ...maps[0], id: 2, nome: "CIMOL · Pátio C", areas: [] }]);
    render(<MapaEditorSection institutionId={1} />);
    await selectArea(2);
    fireEvent.change(screen.getByLabelText("Ao clicar em Corredor, abrir"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar destino" }));
    await waitFor(() => expect(screen.getByLabelText("Ao clicar em Corredor, abrir")).toHaveValue("2"));
    fireEvent.change(screen.getByLabelText("Ao clicar em Corredor, abrir"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar destino" }));
    await waitFor(() => expect(screen.getByLabelText("Ao clicar em Corredor, abrir")).toHaveValue(""));
    const patches = fetchMock.mock.calls.filter(([input, init]) => String(input).endsWith("/api/mapas/1/areas/2") && init?.method === "PATCH");
    expect(patches).toHaveLength(2);
    expect(JSON.parse(String(patches[1][1]?.body))).toMatchObject({ destino_mapa_id: null });
  });

  it("renomeia bloquinhos existentes sem alterar o cadastro nem o destino", async () => {
    const linkedBlock = { ...area(7, "Bloco C", "AMBIENTE"), tipo: "BLOCO" as const,
      bloco_id: 9, bloco_nome: "Bloco C", destino_mapa_id: 2 };
    const fetchMock = mockApi(200, [{ ...maps[0], areas: [linkedBlock, areas[1]] },
      { ...maps[0], id: 2, nome: "CIMOL · Bloco C · 3º pavimento", areas: [] }]);
    render(<MapaEditorSection institutionId={1} />);

    for (const [id, oldName, newName] of [[7, "Bloco C", "Entrada principal"], [2, "Corredor", "Corredor central"]] as const) {
      await selectArea(id);
      fireEvent.change(screen.getByLabelText("Nome do bloquinho"), { target: { value: ` ${newName} ` } });
      expect(screen.getByLabelText("Área")).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));
      expect(await screen.findByRole("button", { name: `Selecionar e mover ${newName}` })).toBeInTheDocument();
      const patch = fetchMock.mock.calls.find(([input, init]) =>
        String(input).endsWith(`/api/mapas/1/areas/${id}`) && init?.method === "PATCH");
      expect(JSON.parse(String(patch?.[1]?.body))).toMatchObject({ nome: newName,
        anterior: { id, nome: oldName, caminho_svg: path } });
      expect(JSON.parse(String(patch?.[1]?.body))).not.toHaveProperty("destino_mapa_id");
    }
    expect(screen.getByRole("button", { name: "Selecionar e mover Entrada principal" })).toHaveAttribute("data-kind", "BLOCO");
    await selectArea(7);
    expect(screen.getByLabelText("Ao clicar em Entrada principal, abrir")).toHaveValue("2");
  });

  it("impede renomear uma área para o nome de outra na mesma vista", async () => {
    const fetchMock = mockApi();
    render(<MapaEditorSection institutionId={1} />);
    await selectArea(2);
    fireEvent.change(screen.getByLabelText("Nome do bloquinho"), { target: { value: " sala 201 " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/já existe uma área/i);
    expect(fetchMock.mock.calls.some(([input, init]) => String(input).endsWith("/api/mapas/1/areas/2") && init?.method === "PATCH")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar alteração" }));
    expect(screen.getByLabelText("Nome do bloquinho")).toHaveValue("Corredor");
  });

  it("salva nome e função do mesmo bloquinho em uma edição", async () => {
    const fetchMock = mockApi(200, [maps[0], { ...maps[0], id: 2, nome: "CIMOL · Pátio", areas: [] }]);
    render(<MapaEditorSection institutionId={1} />);
    await selectArea(4);
    fireEvent.change(screen.getByLabelText("Nome do bloquinho"), { target: { value: "Acesso ao pátio" } });
    fireEvent.change(screen.getByLabelText("Ao clicar em Entrada, abrir"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByRole("button", { name: "Selecionar e mover Acesso ao pátio" })).toBeInTheDocument();
    expect(screen.getByLabelText("Ao clicar em Acesso ao pátio, abrir")).toHaveValue("2");
    const patch = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith("/api/mapas/1/areas/4") && init?.method === "PATCH");
    expect(JSON.parse(String(patch?.[1]?.body))).toMatchObject({ nome: "Acesso ao pátio", destino_mapa_id: 2,
      anterior: { nome: "Entrada" } });
  });

  it("ajusta várias áreas em sequência e salva todas em uma requisição", async () => {
    const fetchMock = mockApi();
    render(<MapaEditorSection institutionId={1} />);
    await selectArea(1);
    fireEvent.keyDown(screen.getByRole("button", { name: "Selecionar e mover Sala 201" }), { key: "ArrowRight" });
    await selectArea(2);
    expect(screen.getByRole("button", { name: "Selecionar e mover Sala 201" })).toHaveAttribute("transform", "matrix(1 0 0 1 1 0)");
    fireEvent.keyDown(screen.getByRole("button", { name: "Selecionar e mover Corredor" }), { key: "ArrowDown" });
    expect(screen.getByRole("button", { name: "Selecionar e mover Corredor" })).toHaveAttribute("transform", "matrix(1 0 0 1 0 1)");
    expect(screen.getByRole("status")).toHaveTextContent("2 áreas ajustadas sem salvar");
    expect(screen.getByLabelText("Mapa / pavimento")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Criar bloquinho" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Salvar 2 ajustes" }));
    await waitFor(() => expect(patchCalls(fetchMock)).toHaveLength(1));
    expect(JSON.parse(String(patchCalls(fetchMock)[0][1]?.body))).toEqual({ ajustes: [
      { area_id: 1, ajuste_x: 1, ajuste_y: 0, escala_x: 1, escala_y: 1,
        anterior: { ajuste_x: 0, ajuste_y: 0, escala_x: 1, escala_y: 1, caminho_svg: path } },
      { area_id: 2, ajuste_x: 0, ajuste_y: 1, escala_x: 1, escala_y: 1,
        anterior: { ajuste_x: 0, ajuste_y: 0, escala_x: 1, escala_y: 1, caminho_svg: path } },
    ] });
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar ajuste" })).toBeDisabled());
    expect(screen.getByLabelText("Mapa / pavimento")).toBeEnabled();
  });

  it("recupera vários ajustes na sessão e só descarta todos por ação explícita", async () => {
    mockApi();
    const first = render(<MapaEditorSection institutionId={1} />);
    await selectArea(1);
    fireEvent.keyDown(screen.getByRole("button", { name: "Selecionar e mover Sala 201" }), { key: "ArrowRight" });
    await selectArea(2);
    fireEvent.keyDown(screen.getByRole("button", { name: "Selecionar e mover Corredor" }), { key: "ArrowDown" });
    expect(JSON.parse(sessionStorage.getItem("design-compass.map-editor-draft.1") ?? "[]")).toHaveLength(2);
    first.unmount();
    render(<MapaEditorSection institutionId={1} />);
    expect(await screen.findByRole("button", { name: "Salvar 2 ajustes" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Selecionar e mover Sala 201" })).toHaveAttribute("transform", "matrix(1 0 0 1 1 0)");
    expect(screen.getByRole("button", { name: "Selecionar e mover Corredor" })).toHaveAttribute("transform", "matrix(1 0 0 1 0 1)");
    fireEvent.click(screen.getByRole("button", { name: "Descartar todos" }));
    expect(screen.getByRole("button", { name: "Salvar ajuste" })).toBeDisabled();
    expect(sessionStorage.getItem("design-compass.map-editor-draft.1")).toBeNull();
  });

  it("move por teclado e salva o ajuste com o caminho anterior como snapshot", async () => {
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
    expect(JSON.parse(String(request?.body))).toEqual({ ajustes: [{
      area_id: 1, ajuste_x: 1, ajuste_y: 0, escala_x: 1, escala_y: 1,
      anterior: { ajuste_x: 0, ajuste_y: 0, escala_x: 1, escala_y: 1, caminho_svg: path },
    }] });
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

  it("encaixa bordas com guia, permite ajuste fino e libera sobreposição pelo controle", async () => {
    Object.defineProperty(SVGElement.prototype, "getBBox", {
      configurable: true,
      value: function (this: SVGElement) {
        return { x: this.getAttribute("data-area-id") === "2" ? 35 : 10, y: 10, width: 20, height: 20 };
      },
    });
    mockApi(200, [{ ...maps[0], areas: [area(1, "Sala 201", "AMBIENTE"), {
      ...area(2, "Sala 202", "AMBIENTE"), caminho_svg: "M 35 10 H 55 V 30 H 35 Z",
    }] }]);
    render(<MapaEditorSection institutionId={1} />);
    const svg = await screen.findByRole("group", { name: "Editar áreas de Bloco C · 2º pavimento" });
    Object.defineProperty(svg, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, width: 800, height: 520 }),
    });
    const selected = screen.getByRole("button", { name: "Selecionar e mover Sala 201" });
    fireEvent(selected, Object.assign(new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 100, clientY: 100 }), { pointerId: 1, pointerType: "mouse" }));
    fireEvent(svg, Object.assign(new MouseEvent("pointermove", { bubbles: true, clientX: 126, clientY: 100 }), { pointerId: 1 }));
    expect(selected).toHaveAttribute("transform", "matrix(1 0 0 1 5 0)");
    expect(svg.querySelector(".mapa-editor__guide")).toHaveAttribute("x1", "35");
    fireEvent(svg, Object.assign(new MouseEvent("pointerup", { bubbles: true }), { pointerId: 1 }));
    expect(svg.querySelector(".mapa-editor__guide")).toBeNull();

    fireEvent.keyDown(selected, { key: "ArrowLeft" });
    expect(selected).toHaveAttribute("transform", "matrix(1 0 0 1 4 0)");
    fireEvent.click(screen.getByRole("switch", { name: "Permitir sobreposição" }));
    expect(screen.getByRole("switch", { name: "Permitir sobreposição" })).toBeChecked();
    fireEvent(selected, Object.assign(new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 100, clientY: 100 }), { pointerId: 2, pointerType: "mouse" }));
    fireEvent(svg, Object.assign(new MouseEvent("pointermove", { bubbles: true, clientX: 230, clientY: 100 }), { pointerId: 2 }));
    expect(selected).toHaveAttribute("transform", "matrix(1 0 0 1 25 0)");
  });

  it("cancela o ajuste local sem enviar PATCH", async () => {
    const fetchMock = mockApi();
    render(<MapaEditorSection institutionId={1} />);
    await selectArea();
    const selected = screen.getByRole("button", { name: "Selecionar e mover Sala 201" });
    fireEvent.keyDown(selected, { key: "ArrowDown" });
    expect(selected).toHaveAttribute("transform", "matrix(1 0 0 1 0 1)");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar ajuste desta área" }));
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
    expect(JSON.parse(String(patchCalls(fetchMock)[0][1]?.body))).toMatchObject({ ajustes: [{ area_id: 1, escala_x: 1.05, escala_y: 1.05 }] });
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
