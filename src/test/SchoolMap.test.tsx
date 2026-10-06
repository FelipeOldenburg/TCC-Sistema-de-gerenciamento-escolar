import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SchoolMap from "@/components/SchoolMap";
import type { MapArea, MapView, Room, Sector } from "@/controllers/useSchoolMap";

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
    status: "ATIVA",
    acessivel: true,
    softwares: ["VS Code"],
    observacoes: "Acesso pelo corredor principal.",
  },
];

const weekdayCodes = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
const occupancy = {
  horarios: [
    {
      id: 99,
      turma: "62-1",
      curso: "Informática",
      ano: "2",
      dia: weekdayCodes[new Date().getDay()],
      periodo: 1,
      hora_inicio: null,
      disciplina: "Banco de Dados",
      professor: "Professor responsável",
    },
  ],
};

const mockApi = ({ maps = [], roomData = rooms, sectorData = [] }: {
  maps?: MapView[]; roomData?: Room[]; sectorData?: Sector[];
}) => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    let data: unknown;
    if (url.endsWith("/api/mapas")) data = maps;
    else if (url.endsWith("/api/salas")) data = roomData;
    else if (url.endsWith("/api/setores")) data = sectorData;
    else if (url.endsWith("/ocupacao")) data = occupancy;
    else throw new Error(`Unexpected API request: ${url}`);
    return { ok: true, json: async () => data } as Response;
  }));
};
const area = (id: number, mapa_id: number, nome: string, extra: Partial<MapArea> = {}): MapArea => ({
  id, mapa_id, nome, tipo: "OUTRO", caminho_svg: "M0 0 H40 V40 Z", bloco_id: null, sala_id: null, setor_id: null,
  bloco_nome: null, sala_nome: null, setor_nome: null, ...extra,
});
const view = (id: number, nome: string, areas: MapArea[], extra: Partial<MapView> = {}): MapView => ({
  id, nome: `CIMOL · ${nome}`, piso: "2º pavimento", largura: 100, altura: 80, bloco_id: 3, bloco_nome: "Bloco C", areas, ...extra,
});
const navigationMaps = [
  view(1, "Visão geral", [area(101, 1, "Hall C/D", { categoria: "ACESSO", destino_mapa_id: 4 })], { visao_geral: true, piso: null, bloco_id: null, bloco_nome: null }),
  view(2, "Bloco C · 2º pavimento", [
    area(201, 2, "Laboratório C201", { tipo: "SALA", sala_id: 21, sala_nome: "C201", setor_id: 9, setor_nome: "Laboratórios" }),
    area(202, 2, "Escada para C3", { categoria: "ESCADA", destino_mapa_id: 5 }),
  ]),
  view(3, "Bloco C · 2º pavimento · duas salas", [area(301, 3, "Sala junto à escada própria", { tipo: "SALA", sala_id: 10, sala_nome: "C210", descricao: "Acesso somente pela escada própria." })]),
  view(4, "Hall C/D · 2º pavimento", [area(401, 4, "Acesso a D2", { categoria: "ACESSO", destino_mapa_id: 6 })], { bloco_id: null, bloco_nome: null }),
  view(5, "Bloco C · 3º pavimento", [area(501, 5, "C302 / C303")], { piso: "3º pavimento" }),
  view(6, "Bloco D · 2º pavimento", [area(601, 6, "Laboratório D201", { tipo: "SALA", sala_id: 14, sala_nome: "D201", setor_id: 9, setor_nome: "Laboratórios" })], { bloco_id: 4, bloco_nome: "Bloco D" }),
];
const navigationRooms: Room[] = [
  { ...rooms[0], id: 10, nome: "C210", bloco_id: 3, bloco_nome: "Bloco C", andar: "2º andar" },
  { ...rooms[0], id: 21, nome: "C201", bloco_id: 3, bloco_nome: "Bloco C", andar: "2º andar" },
  { ...rooms[0], id: 12, nome: "C302", bloco_id: 3, bloco_nome: "Bloco C", andar: "3º andar" },
  { ...rooms[0], id: 13, nome: "C303", bloco_id: 3, bloco_nome: "Bloco C", andar: "3º andar" },
  { ...rooms[0], id: 14, nome: "D201", bloco_id: 4, bloco_nome: "Bloco D", andar: "2º andar" },
  { ...rooms[0], id: 15, nome: "C299", bloco_id: 3, bloco_nome: "Bloco C", andar: "2º andar" },
];
const laboratories = [{ id: 9, nome: "Laboratórios", descricao: "Ambientes técnicos", localizacao: null }];
const chooseResult = (query: string, name: RegExp) => {
  fireEvent.change(screen.getByRole("combobox", { name: "Buscar uma sala ou ambiente" }), { target: { value: query } });
  fireEvent.click(within(screen.getByRole("listbox", { name: "Resultados da busca" })).getByRole("option", { name }));
};
const waitForSchedule = () => within(screen.getByRole("region", { name: "Detalhes da sala selecionada" })).findByText(/62-1/);

describe("SchoolMap", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("localiza uma sala e mostra seus detalhes", async () => {
    mockApi({});

    render(<SchoolMap />);

    await waitFor(() => expect(screen.getByText("Mapa ainda não configurado")).toBeInTheDocument());
    fireEvent.change(screen.getByRole("combobox", { name: "Buscar uma sala ou ambiente" }), {
      target: { value: "laboratorio 101" },
    });

    const results = screen.getByRole("listbox", { name: "Resultados da busca" });
    fireEvent.click(within(results).getByRole("option"));

    const details = screen.getByRole("region", { name: "Detalhes da sala selecionada" });
    expect(within(details).getByRole("heading", { name: "Laboratório 101" })).toBeInTheDocument();
    expect(within(details).getByText("24 lugares")).toBeInTheDocument();
    expect(within(details).getByText("Acessível")).toBeInTheDocument();
    expect(within(details).getByText("Computadores")).toBeInTheDocument();
    await waitFor(() => expect(within(details).getAllByText(/62-1/).length).toBeGreaterThan(0));
    expect(within(details).getByText("Acesso pelo corredor principal.")).toBeInTheDocument();
  });

  it("renderiza e seleciona somente áreas recebidas da API", async () => {
    const maps: MapView[] = [{
      id: 3, nome: "Térreo", piso: "Piso 1", largura: 100, altura: 80,
      areas: [{ id: 4, mapa_id: 3, tipo: "SETOR", nome: "Biblioteca", caminho_svg: "M0 0 L50 0 L50 50 Z", bloco_id: null, sala_id: null, setor_id: 8, bloco_nome: null, sala_nome: null, setor_nome: "Biblioteca" }],
    }];
    mockApi({ maps, sectorData: [{ id: 8, nome: "Biblioteca", descricao: "Acervo e leitura", localizacao: null }] });

    render(<SchoolMap />);
    const svg = await screen.findByRole("group", { name: "Térreo" });
    expect(within(svg).getAllByRole("button")).toHaveLength(1);
    fireEvent.keyDown(within(svg).getByRole("button", { name: "Biblioteca" }), { key: "Enter" });
    expect(screen.getByRole("region", { name: "Detalhes do setor selecionado" })).toHaveTextContent("Biblioteca");
  });

  it("encontra C210 na vista lateral pelo vínculo da sala, sem abrir C2 principal", async () => {
    mockApi({ maps: navigationMaps, roomData: navigationRooms });
    render(<SchoolMap />);
    await screen.findByRole("group", { name: "CIMOL · Visão geral" });
    chooseResult("C210", /^C210/);
    const svg = screen.getByRole("group", { name: "CIMOL · Bloco C · 2º pavimento · duas salas" });
    expect(within(svg).getByRole("button", { name: "Sala junto à escada própria" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("group", { name: "CIMOL · Bloco C · 2º pavimento" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Detalhes da sala selecionada" })).toHaveTextContent("Acesso somente pela escada própria.");
    await waitForSchedule();
  });

  it("segue o acesso do hall a D2 e a escada de C2 a C3", async () => {
    mockApi({ maps: navigationMaps, roomData: navigationRooms });
    render(<SchoolMap />);
    const campus = await screen.findByRole("group", { name: "CIMOL · Visão geral" });
    fireEvent.click(within(campus).getByRole("button", { name: "Hall C/D" }));
    const hall = screen.getByRole("group", { name: "CIMOL · Hall C/D · 2º pavimento" });
    fireEvent.click(within(hall).getByRole("button", { name: "Acesso a D2" }));
    expect(screen.getByRole("group", { name: "CIMOL · Bloco D · 2º pavimento" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Escolher bloco" }), { target: { value: "3" } });
    const c2 = screen.getByRole("group", { name: "CIMOL · Bloco C · 2º pavimento" });
    fireEvent.keyDown(within(c2).getByRole("button", { name: "Escada para C3" }), { key: " " });
    expect(screen.getByRole("group", { name: "CIMOL · Bloco C · 3º pavimento" })).toBeInTheDocument();
  });

  it("pede a escolha de ambiente para um setor presente em mais de uma vista", async () => {
    mockApi({ maps: navigationMaps, roomData: navigationRooms, sectorData: laboratories });
    render(<SchoolMap />);
    await screen.findByRole("group", { name: "CIMOL · Visão geral" });
    chooseResult("laboratorios", /^Laboratórios/);
    expect(screen.getByRole("group", { name: "CIMOL · Visão geral" })).toBeInTheDocument();
    const details = screen.getByRole("region", { name: "Detalhes do setor selecionado" });
    expect(within(details).getByText("Escolha o ambiente que procura:")).toBeInTheDocument();
    expect(within(details).getByRole("button", { name: "Laboratório C201 · Bloco C · 2º pavimento" })).toBeInTheDocument();
    fireEvent.click(within(details).getByRole("button", { name: "Laboratório D201 · Bloco D · 2º pavimento" }));
    const d2 = screen.getByRole("group", { name: "CIMOL · Bloco D · 2º pavimento" });
    expect(within(d2).getByRole("button", { name: "Laboratório D201" })).toHaveAttribute("aria-pressed", "true");
    await waitForSchedule();
  });

  it("localiza C302 e C303 no mesmo recinto sem criar uma divisão fictícia", async () => {
    mockApi({ maps: navigationMaps, roomData: navigationRooms });
    render(<SchoolMap />);
    await screen.findByRole("group", { name: "CIMOL · Visão geral" });
    chooseResult("C302", /^C302/);
    const c3 = screen.getByRole("group", { name: "CIMOL · Bloco C · 3º pavimento" });
    const shared = within(c3).getByRole("button", { name: "C302 / C303" });
    expect(shared).toHaveAttribute("aria-pressed", "true");
    expect(within(c3).getAllByRole("button")).toHaveLength(1);
    await waitForSchedule();
    chooseResult("C303", /^C303/);
    expect(within(screen.getByRole("region", { name: "Detalhes da sala selecionada" })).getByRole("heading", { name: "C303" })).toBeInTheDocument();
    expect(within(c3).getByRole("button", { name: "C302 / C303" })).toBe(shared);
    expect(shared).toHaveAttribute("aria-pressed", "true");
    expect(within(c3).getAllByRole("button")).toHaveLength(1);
    await waitForSchedule();
  });

  it("limpa o destaque anterior quando a sala buscada não tem posição identificada", async () => {
    mockApi({ maps: navigationMaps, roomData: navigationRooms });
    render(<SchoolMap />);
    await screen.findByRole("group", { name: "CIMOL · Visão geral" });
    chooseResult("C201", /^C201/);
    const c2 = screen.getByRole("group", { name: "CIMOL · Bloco C · 2º pavimento" });
    expect(within(c2).getByRole("button", { name: "Laboratório C201" })).toHaveAttribute("aria-pressed", "true");
    await waitForSchedule();
    chooseResult("C299", /^C299/);
    const details = screen.getByRole("region", { name: "Detalhes da sala selecionada" });
    expect(within(details).getByRole("heading", { name: "C299" })).toBeInTheDocument();
    expect(details).toHaveTextContent(/a posição exata desta sala não está identificada na planta/i);
    const activeMap = screen.getByRole("group", { name: "CIMOL · Visão geral" });
    expect(screen.queryByRole("group", { name: "CIMOL · Bloco C · 2º pavimento" })).not.toBeInTheDocument();
    expect(within(activeMap).queryByRole("button", { name: "Laboratório C201" })).not.toBeInTheDocument();
    await waitForSchedule();
  });

  it("mostra a vista conjunta C2/D2 nos dois blocos e ignora vistas antigas inativas", async () => {
    const campus = view(1, "Visão geral", [], { visao_geral: true, piso: null, bloco_id: null, bloco_nome: null });
    const cGround = view(2, "Bloco C · Térreo", [], { piso: "Térreo" });
    const dGround = view(3, "Bloco D · Térreo", [], { piso: "Térreo", bloco_id: 4, bloco_nome: "Bloco D" });
    const shared = view(4, "Blocos C e D · 2º pavimento", [
      area(401, 4, "C201", { tipo: "SALA", sala_id: 21 }),
      area(402, 4, "D201", { tipo: "SALA", sala_id: 14 }),
      area(403, 4, "Acesso ao C2", { tipo: "BLOCO", categoria: "ACESSO", bloco_id: 3, bloco_nome: "Bloco C" }),
      area(404, 4, "Acesso ao D2", { tipo: "BLOCO", categoria: "ACESSO", bloco_id: 4, bloco_nome: "Bloco D" }),
      area(405, 4, "C206", { tipo: "SETOR", setor_id: 9, setor_nome: "Laboratórios" }),
      area(406, 4, "D207", { tipo: "SETOR", setor_id: 9, setor_nome: "Laboratórios" }),
    ], { bloco_id: null, bloco_nome: null });
    const oldC2 = view(5, "Bloco C · 2º pavimento", [area(501, 5, "C201 antigo", { tipo: "SALA", sala_id: 21 })], { ativo: false });
    mockApi({ maps: [campus, oldC2, cGround, dGround, shared], roomData: navigationRooms, sectorData: laboratories });
    const { rerender } = render(<SchoolMap />);
    await screen.findByRole("group", { name: "CIMOL · Visão geral" });

    chooseResult("C201", /^C201/);
    expect(screen.getByRole("group", { name: "CIMOL · Blocos C e D · 2º pavimento" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bloco C · Térreo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bloco C · 2º pavimento" })).not.toBeInTheDocument();
    await waitForSchedule();
    fireEvent.click(within(screen.getByRole("group", { name: "CIMOL · Blocos C e D · 2º pavimento" })).getByRole("button", { name: "D201" }));
    expect(screen.getByRole("button", { name: "Bloco D · Térreo" })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("group", { name: "CIMOL · Blocos C e D · 2º pavimento" })).getByRole("button", { name: "Acesso ao C2" }));
    expect(screen.getByRole("group", { name: "CIMOL · Blocos C e D · 2º pavimento" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Detalhes da área selecionada" })).toHaveTextContent("Acesso ao C2");

    chooseResult("D201", /^D201/);
    expect(screen.getByRole("group", { name: "CIMOL · Blocos C e D · 2º pavimento" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bloco D · Térreo" })).toBeInTheDocument();
    await waitForSchedule();

    chooseResult("C206", /^C206/);
    expect(within(screen.getByRole("region", { name: "Detalhes do setor selecionado" })).getByRole("heading", { name: "C206" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bloco C · Térreo" })).toBeInTheDocument();
    chooseResult("D207", /^D207/);
    expect(within(screen.getByRole("region", { name: "Detalhes do setor selecionado" })).getByRole("heading", { name: "D207" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bloco D · Térreo" })).toBeInTheDocument();

    rerender(<SchoolMap selectedAreaId={401} />);
    await waitFor(() => expect(within(screen.getByRole("group", { name: "CIMOL · Blocos C e D · 2º pavimento" })).getByRole("button", { name: "C201" })).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByRole("button", { name: "Bloco C · Térreo" })).toBeInTheDocument();
  });

  it("oferece entradas de C2 e D2 sem confundi-las com a escada ao térreo", async () => {
    const campus = view(1, "Visão geral", [], { visao_geral: true, piso: null, bloco_id: null, bloco_nome: null });
    const cGround = view(2, "Bloco C · Térreo", [], { piso: "Térreo" });
    const dGround = view(3, "Bloco D · Térreo", [], { piso: "Térreo", bloco_id: 4, bloco_nome: "Bloco D" });
    const shared = view(4, "Blocos C e D · 2º pavimento", [
      area(401, 4, "Escada única C–D", { categoria: "ESCADA", destino_mapa_id: 2 }),
      area(402, 4, "Acesso ao C2", { tipo: "BLOCO", categoria: "ACESSO", bloco_id: 3, bloco_nome: "Bloco C" }),
      area(403, 4, "Acesso ao D2", { tipo: "BLOCO", categoria: "ACESSO", bloco_id: 4, bloco_nome: "Bloco D" }),
    ], { bloco_id: null, bloco_nome: null });
    mockApi({ maps: [campus, cGround, dGround, shared], roomData: [] });
    render(<SchoolMap />);
    await screen.findByRole("group", { name: "CIMOL · Visão geral" });
    fireEvent.change(screen.getByRole("combobox", { name: "Escolher bloco" }), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Blocos C e D · 2º pavimento" }));

    const entrances = screen.getByRole("group", { name: "Entradas deste pavimento" });
    fireEvent.click(within(entrances).getByRole("button", { name: "Acesso ao C2" }));
    expect(screen.getByRole("group", { name: "CIMOL · Blocos C e D · 2º pavimento" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bloco C · Térreo" })).toBeInTheDocument();
    fireEvent.click(within(entrances).getByRole("button", { name: "Acesso ao D2" }));
    expect(screen.getByRole("group", { name: "CIMOL · Blocos C e D · 2º pavimento" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bloco D · Térreo" })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("group", { name: "CIMOL · Blocos C e D · 2º pavimento" })).getByRole("button", { name: "Escada única C–D" }));
    expect(screen.getByRole("group", { name: "CIMOL · Bloco C · Térreo" })).toBeInTheDocument();
  });

  it("busca o Museu uma vez na vista detalhada sem ocultar um bloco exclusivo da visão geral", async () => {
    const campus = view(1, "Visão geral", [
      area(101, 1, "Museu"),
      area(102, 1, "Bloco B", { tipo: "BLOCO", bloco_id: 2, bloco_nome: "Bloco B" }),
    ], { visao_geral: true, piso: null, bloco_id: null, bloco_nome: null });
    const cGround = view(2, "Bloco C · Térreo", [area(201, 2, "Museu")], { piso: "Térreo" });
    mockApi({ maps: [campus, cGround], roomData: [] });
    render(<SchoolMap />);
    await screen.findByRole("group", { name: "CIMOL · Visão geral" });

    fireEvent.change(screen.getByRole("combobox", { name: "Buscar uma sala ou ambiente" }), { target: { value: "Museu" } });
    const results = screen.getByRole("listbox", { name: "Resultados da busca" });
    expect(within(results).getAllByRole("option")).toHaveLength(1);
    expect(within(results).getByRole("option", { name: /Museu/ })).toHaveTextContent("Bloco C · Térreo");
    fireEvent.click(within(results).getByRole("option", { name: /Museu/ }));
    expect(screen.getByRole("group", { name: "CIMOL · Bloco C · Térreo" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Buscar uma sala ou ambiente" }), { target: { value: "Bloco B" } });
    expect(within(screen.getByRole("listbox", { name: "Resultados da busca" })).getByRole("option", { name: /Bloco B/ })).toBeInTheDocument();
  });

  it("mostra o bloco de destino ao voltar do ginásio a C e preserva C na vista C/D", async () => {
    const campus = view(1, "Visão geral", [], { visao_geral: true, piso: null, bloco_id: null, bloco_nome: null });
    const cGround = view(2, "Bloco C · Térreo", [area(201, 2, "Escada C–D", { categoria: "ESCADA", destino_mapa_id: 4 })], { piso: "Térreo" });
    const gym = view(3, "Ginásio, anexos e Bloco E", [area(301, 3, "Voltar ao pátio de C", { categoria: "ACESSO", destino_mapa_id: 2 })], { piso: "Térreo", bloco_id: 5, bloco_nome: "Bloco E" });
    const shared = view(4, "Blocos C e D · 2º pavimento", [area(401, 4, "Entrada de C2", { tipo: "BLOCO", categoria: "ACESSO", bloco_id: 3, bloco_nome: "Bloco C" })], { bloco_id: null, bloco_nome: null });
    mockApi({ maps: [campus, cGround, gym, shared], roomData: [] });
    render(<SchoolMap />);
    await screen.findByRole("group", { name: "CIMOL · Visão geral" });

    fireEvent.change(screen.getByRole("combobox", { name: "Escolher bloco" }), { target: { value: "5" } });
    fireEvent.click(within(screen.getByRole("group", { name: "CIMOL · Ginásio, anexos e Bloco E" })).getByRole("button", { name: "Voltar ao pátio de C" }));
    expect(screen.getByRole("group", { name: "CIMOL · Bloco C · Térreo" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Escolher bloco" })).toHaveValue("3");

    fireEvent.click(within(screen.getByRole("group", { name: "CIMOL · Bloco C · Térreo" })).getByRole("button", { name: "Escada C–D" }));
    expect(screen.getByRole("group", { name: "CIMOL · Blocos C e D · 2º pavimento" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Escolher bloco" })).toHaveValue("3");
  });
});
