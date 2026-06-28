import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  DoorOpen,
  Laptop2,
  Layers3,
  LocateFixed,
  MapPin,
  Minus,
  Navigation,
  Plus,
  Projector,
  RefreshCw,
  Search,
  Users,
  Wifi,
  Wind,
  X,
} from "lucide-react";
import mapaEscola from "@/assets/mapa-escola.png";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

type Block = {
  id: number;
  nome: string;
  descricao: string | null;
  total_salas: number;
};

type Room = {
  id: number;
  nome: string;
  bloco_id: number;
  bloco_nome: string;
  andar: string;
  capacidade: number;
  tipo: string;
  possui_computadores: boolean;
  possui_data_show: boolean;
  possui_internet: boolean;
  possui_ar_condicionado: boolean;
  softwares: string[];
  observacoes: string | null;
};

const markerPositions = [
  { left: "20%", top: "58%" },
  { left: "38%", top: "25%" },
  { left: "70%", top: "43%" },
  { left: "57%", top: "69%" },
  { left: "50%", top: "43%" },
  { left: "30%", top: "43%" },
  { left: "77%", top: "61%" },
  { left: "47%", top: "78%" },
];

const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export default function SchoolMap() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null);
  const [selectedFloor, setSelectedFloor] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMapData = async () => {
    setLoading(true);
    setError("");
    const [blockResult, roomResult] = await Promise.allSettled([
      apiFetch<Block[]>("/api/blocos"),
      apiFetch<Room[]>("/api/salas"),
    ]);

    if (blockResult.status === "fulfilled") setBlocks(blockResult.value);
    if (roomResult.status === "fulfilled") setRooms(roomResult.value);
    if (blockResult.status === "rejected" || roomResult.status === "rejected") {
      setError("Não foi possível carregar todos os ambientes. Tente novamente em instantes.");
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadMapData();
  }, []);

  const availableBlocks = useMemo(() => {
    const merged = new Map<number, Block>(blocks.map((block) => [block.id, block]));
    rooms.forEach((room) => {
      if (!merged.has(room.bloco_id)) {
        merged.set(room.bloco_id, {
          id: room.bloco_id,
          nome: room.bloco_nome,
          descricao: null,
          total_salas: rooms.filter((item) => item.bloco_id === room.bloco_id).length,
        });
      }
    });
    return [...merged.values()].sort((a, b) => collator.compare(a.nome, b.nome));
  }, [blocks, rooms]);

  useEffect(() => {
    if (selectedBlockId === null && availableBlocks.length > 0) {
      setSelectedBlockId(availableBlocks[0].id);
    }
  }, [availableBlocks, selectedBlockId]);

  const selectedBlock = availableBlocks.find((block) => block.id === selectedBlockId) ?? null;
  const blockRooms = useMemo(
    () => rooms.filter((room) => room.bloco_id === selectedBlockId),
    [rooms, selectedBlockId],
  );
  const floors = useMemo(
    () => [...new Set(blockRooms.map((room) => room.andar))].sort(collator.compare),
    [blockRooms],
  );

  useEffect(() => {
    if (!floors.includes(selectedFloor)) setSelectedFloor(floors[0] ?? "");
  }, [floors, selectedFloor]);

  const visibleRooms = useMemo(
    () => blockRooms.filter((room) => room.andar === selectedFloor).sort((a, b) => collator.compare(a.nome, b.nome)),
    [blockRooms, selectedFloor],
  );
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
  const searchResults = useMemo(() => {
    const term = normalize(query.trim());
    if (!term) return [];
    return rooms
      .filter((room) => normalize(`${room.nome} ${room.bloco_nome} ${room.andar} ${room.tipo}`).includes(term))
      .sort((a, b) => collator.compare(a.nome, b.nome))
      .slice(0, 7);
  }, [query, rooms]);

  const selectBlock = (blockId: number) => {
    setSelectedBlockId(blockId);
    setSelectedRoomId(null);
  };

  const selectRoom = (room: Room) => {
    setSelectedBlockId(room.bloco_id);
    setSelectedFloor(room.andar);
    setSelectedRoomId(room.id);
    setQuery("");
  };

  const roomResources = selectedRoom
    ? [
        selectedRoom.possui_computadores && { label: "Computadores", icon: Laptop2 },
        selectedRoom.possui_data_show && { label: "Data show", icon: Projector },
        selectedRoom.possui_internet && { label: "Internet", icon: Wifi },
        selectedRoom.possui_ar_condicionado && { label: "Ar-condicionado", icon: Wind },
      ].filter(Boolean) as { label: string; icon: typeof Laptop2 }[]
    : [];

  return (
    <div className="space-y-5">
      <div className="relative z-20 max-w-2xl">
        <label htmlFor="room-search" className="sr-only">Buscar uma sala ou ambiente</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            id="room-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busque por sala, bloco, pavimento ou tipo"
            autoComplete="off"
            className="h-12 w-full rounded-xl border border-border bg-card pl-12 pr-11 text-sm shadow-sm outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Limpar busca">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {query.trim() && (
          <div className="absolute mt-2 max-h-80 w-full overflow-auto rounded-xl border bg-card p-2 shadow-xl" role="listbox" aria-label="Resultados da busca">
            {searchResults.length > 0 ? searchResults.map((room) => (
              <button key={room.id} type="button" role="option" aria-selected={room.id === selectedRoomId} onClick={() => selectRoom(room)} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-muted">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><DoorOpen className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{room.nome}</span>
                  <span className="block truncate text-xs text-muted-foreground">{room.bloco_nome} · {room.andar} · {room.tipo}</span>
                </span>
              </button>
            )) : (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhum ambiente encontrado para “{query.trim()}”.</div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="flex flex-col gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between" role="alert">
          <span className="text-destructive">{error}</span>
          <Button variant="outline" size="sm" onClick={() => void loadMapData()} className="gap-2 self-start sm:self-auto"><RefreshCw className="h-4 w-4" /> Tentar novamente</Button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-2xl border bg-card shadow-sm" aria-labelledby="campus-map-title">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
              <div>
                <h3 id="campus-map-title" className="font-heading font-bold">Visão geral da escola</h3>
                <p className="text-xs text-muted-foreground">Selecione um bloco para explorar seus ambientes</p>
              </div>
              <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
                <button type="button" onClick={() => setZoom((value) => Math.max(1, value - 0.1))} disabled={zoom <= 1} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40" aria-label="Diminuir mapa"><Minus className="h-4 w-4" /></button>
                <span className="w-10 text-center text-xs font-semibold" aria-live="polite">{Math.round(zoom * 100)}%</span>
                <button type="button" onClick={() => setZoom((value) => Math.min(1.5, value + 0.1))} disabled={zoom >= 1.5} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40" aria-label="Ampliar mapa"><Plus className="h-4 w-4" /></button>
              </div>
            </div>

            <div className="relative aspect-[4/3] overflow-hidden bg-slate-100 sm:aspect-[16/10]">
              <div className="absolute inset-0 transition-transform duration-300 ease-out" style={{ transform: `scale(${zoom})` }}>
                <img src={mapaEscola} alt="Visão ilustrada do complexo escolar" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/25 via-transparent to-white/5" />
                {availableBlocks.slice(0, markerPositions.length).map((block, index) => {
                  const isSelected = block.id === selectedBlockId;
                  return (
                    <button key={block.id} type="button" onClick={() => selectBlock(block.id)} className="group absolute -translate-x-1/2 -translate-y-1/2 text-left" style={markerPositions[index]} aria-label={`Selecionar ${block.nome}`} aria-pressed={isSelected}>
                      <span className={`flex h-10 w-10 items-center justify-center rounded-full border-2 shadow-lg transition sm:h-11 sm:w-11 ${isSelected ? "scale-110 border-white bg-primary text-primary-foreground ring-4 ring-primary/25" : "border-white bg-card text-primary hover:scale-110"}`}><Building2 className="h-4 w-4 sm:h-5 sm:w-5" /></span>
                      <span className={`absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-bold shadow-lg ${isSelected ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground group-hover:bg-primary group-hover:text-primary-foreground"}`}>{block.nome}</span>
                    </button>
                  );
                })}
              </div>
              <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-slate-950/70 px-3 py-2 text-xs text-white backdrop-blur-sm"><LocateFixed className="h-4 w-4 text-accent" /> Mapa ilustrativo</div>
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5" aria-labelledby="rooms-title">
            <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">{selectedBlock?.nome ?? "Ambientes"}</p>
                <h3 id="rooms-title" className="mt-1 font-heading text-lg font-bold">Salas por pavimento</h3>
                {selectedBlock?.descricao && <p className="mt-1 text-sm text-muted-foreground">{selectedBlock.descricao}</p>}
              </div>
              {floors.length > 0 && (
                <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1" aria-label="Selecionar pavimento">
                  {floors.map((floor) => (
                    <button key={floor} type="button" onClick={() => { setSelectedFloor(floor); setSelectedRoomId(null); }} className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold ${floor === selectedFloor ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} aria-pressed={floor === selectedFloor}>{floor}</button>
                  ))}
                </div>
              )}
            </div>

            {loading ? (
              <div className="grid gap-3 pt-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Carregando salas">{[0, 1, 2].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-muted" />)}</div>
            ) : visibleRooms.length > 0 ? (
              <div className="grid gap-3 pt-4 sm:grid-cols-2 xl:grid-cols-3">
                {visibleRooms.map((room) => (
                  <button key={room.id} type="button" onClick={() => selectRoom(room)} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md ${room.id === selectedRoomId ? "border-primary bg-primary/5 ring-2 ring-primary/10" : "bg-background"}`}>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><DoorOpen className="h-5 w-5" /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{room.nome}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{room.tipo}</span>
                      <span className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Users className="h-3 w-3" /> {room.capacidade} lugares</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center px-4 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground"><DoorOpen className="h-5 w-5" /></span>
                <p className="mt-3 text-sm font-semibold">Nenhuma sala cadastrada neste pavimento</p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">Assim que os ambientes forem cadastrados, eles aparecerão aqui automaticamente.</p>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20"><Navigation className="h-5 w-5" /></span>
              <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/10">Em breve</Badge>
            </div>
            <h3 className="mt-4 font-heading font-bold">Meu percurso</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">Quando os cursos estiverem vinculados às salas, você verá aqui os ambientes das suas próximas aulas.</p>
          </section>

          {selectedRoom ? (
            <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-label="Detalhes da sala selecionada" aria-live="polite">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs font-bold uppercase tracking-wider text-primary">Sala selecionada</p><h3 className="mt-1 font-heading text-xl font-bold">{selectedRoom.nome}</h3></div>
                <button type="button" onClick={() => setSelectedRoomId(null)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Fechar detalhes da sala"><X className="h-4 w-4" /></button>
              </div>
              <div className="mt-4 space-y-2 rounded-xl bg-muted/60 p-3 text-sm">
                <p className="flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> {selectedRoom.bloco_nome}</p>
                <p className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-primary" /> {selectedRoom.andar}</p>
                <p className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> {selectedRoom.capacidade} lugares</p>
              </div>
              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recursos</p>
                {roomResources.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">{roomResources.map(({ label, icon: Icon }) => <span key={label} className="flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-2 text-xs font-medium"><Icon className="h-3.5 w-3.5 text-primary" /> {label}</span>)}</div>
                ) : <p className="mt-2 text-sm text-muted-foreground">Nenhum recurso informado.</p>}
              </div>
              {selectedRoom.observacoes && <p className="mt-4 border-t pt-4 text-sm leading-relaxed text-muted-foreground">{selectedRoom.observacoes}</p>}
            </section>
          ) : (
            <section className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground"><MapPin className="h-5 w-5" /></div>
              <h3 className="mt-4 font-heading font-bold">Detalhes do ambiente</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">Selecione uma sala no mapa ou use a busca para consultar localização, capacidade e recursos.</p>
            </section>
          )}

          <section className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Blocos</p>
            <div className="space-y-1">
              {availableBlocks.map((block, index) => (
                <button key={block.id} type="button" onClick={() => selectBlock(block.id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${block.id === selectedBlockId ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold ${block.id === selectedBlockId ? "bg-white/15" : "bg-primary/10 text-primary"}`}>{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{block.nome}</span>
                  <span className={block.id === selectedBlockId ? "text-primary-foreground/70" : "text-muted-foreground"}>{block.total_salas}</span>
                </button>
              ))}
              {!loading && availableBlocks.length === 0 && <p className="px-3 py-4 text-center text-xs text-muted-foreground">Nenhum bloco cadastrado.</p>}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
