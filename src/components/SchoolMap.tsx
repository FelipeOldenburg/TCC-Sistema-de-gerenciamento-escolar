import { useEffect, useMemo, useState } from "react";
import { Building2, MapPin, MessageSquareWarning, Search } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ReportContext } from "@/components/sections/ReclamacoesSection";

type MapArea = {
  id: number;
  mapa_id: number;
  tipo: "BLOCO" | "SALA" | "SETOR" | "OUTRO";
  nome: string;
  caminho_svg: string;
  bloco_id: number | null;
  sala_id: number | null;
  setor_id: number | null;
  bloco_nome: string | null;
  sala_nome: string | null;
  setor_nome: string | null;
};

type MapView = {
  id: number;
  nome: string;
  piso: string | null;
  largura: number;
  altura: number;
  areas: MapArea[];
};

type Room = {
  id: number;
  nome: string;
  bloco_nome: string;
  andar: string;
  capacidade: number | null;
  tipo: string;
  acessivel: boolean;
  possui_computadores: boolean;
  possui_data_show: boolean;
  possui_internet: boolean;
  possui_ar_condicionado: boolean;
  observacoes: string | null;
  softwares: string[];
};

type Occupation = { id: number; turma: string; dia: string; periodo: number; disciplina: string; professor: string | null };

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const SchoolMap = ({
  selectedAreaId,
  onSelectSector,
  onReportContext,
}: {
  selectedAreaId?: number | null;
  onSelectSector?: (sectorId: number) => void;
  onReportContext?: (context: ReportContext) => void;
}) => {
  const [maps, setMaps] = useState<MapView[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeMapId, setActiveMapId] = useState<number | null>(null);
  const [activeAreaId, setActiveAreaId] = useState<number | null>(selectedAreaId || null);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [occupation, setOccupation] = useState<Occupation[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([apiFetch<MapView[]>("/api/mapas"), apiFetch<Room[]>("/api/salas")])
      .then(([mapData, roomData]) => {
        setMaps(mapData);
        setRooms(roomData);
        const selectedMap = selectedAreaId
          ? mapData.find((map) => (map.areas || []).some((area) => area.id === selectedAreaId))
          : null;
        setActiveMapId(selectedMap?.id || mapData[0]?.id || null);
        setActiveAreaId(selectedAreaId || null);
        setError("");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Não foi possível carregar o mapa."))
      .finally(() => setLoading(false));
  }, [selectedAreaId]);

  useEffect(() => {
    if (!selectedRoomId) return setOccupation([]);
    apiFetch<{ horarios: Occupation[] }>(`/api/salas/${selectedRoomId}/ocupacao`)
      .then((data) => setOccupation(data.horarios))
      .catch(() => setOccupation([]));
  }, [selectedRoomId]);

  const activeMap = maps.find((map) => map.id === activeMapId) || null;
  const activeArea = activeMap?.areas?.find((area) => area.id === activeAreaId) || null;
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) || null;
  const results = useMemo(() => {
    const term = normalize(query.trim());
    if (!term) return [];
    return rooms.filter((room) => normalize(`${room.nome} ${room.bloco_nome} ${room.tipo}`).includes(term)).slice(0, 8);
  }, [query, rooms]);

  const selectArea = (area: MapArea) => {
    setActiveAreaId(area.id);
    setSelectedRoomId(area.sala_id);
  };

  const selectRoom = (room: Room) => {
    setSelectedRoomId(room.id);
    setQuery("");
    const map = maps.find((item) => (item.areas || []).some((area) => area.sala_id === room.id));
    const area = map?.areas?.find((item) => item.sala_id === room.id);
    if (map && area) {
      setActiveMapId(map.id);
      setActiveAreaId(area.id);
    }
  };

  if (loading) return <div className="glass-card rounded-2xl p-8 text-center text-muted-foreground">Carregando mapa...</div>;
  if (error) return <p role="alert" className="glass-card rounded-2xl p-6 text-destructive">{error}</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Buscar uma sala ou ambiente"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar sala ou ambiente"
            className="pl-9"
          />
          {query && (
            <div role="listbox" aria-label="Resultados da busca" className="absolute z-20 mt-1 w-full rounded-xl border bg-card p-1 shadow-lg">
              {results.map((room) => (
                <button key={room.id} role="option" aria-selected={room.id === selectedRoomId} onClick={() => selectRoom(room)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted">
                  <span className="font-medium">{room.nome}</span> <span className="text-muted-foreground">· {room.bloco_nome}</span>
                </button>
              ))}
              {!results.length && <p className="p-3 text-sm text-muted-foreground">Nenhuma sala encontrada.</p>}
            </div>
          )}
        </div>

        {!maps.length ? (
          <div className="glass-card flex min-h-80 flex-col items-center justify-center rounded-2xl p-8 text-center">
            <MapPin className="mb-3 h-9 w-9 text-muted-foreground" />
            <h3 className="font-heading text-lg font-bold">Mapa ainda não configurado</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">As plantas reais serão publicadas aqui após a conferência dos documentos da instituição. A busca por salas continua disponível.</p>
          </div>
        ) : (
          <div className="glass-card rounded-2xl p-4">
            {maps.length > 1 && (
              <div className="mb-3 flex gap-2 overflow-x-auto" aria-label="Pavimentos do mapa">
                {maps.map((map) => (
                  <Button key={map.id} size="sm" variant={map.id === activeMapId ? "default" : "outline"} onClick={() => { setActiveMapId(map.id); setActiveAreaId(null); setSelectedRoomId(null); }}>
                    {map.nome}{map.piso ? ` · ${map.piso}` : ""}
                  </Button>
                ))}
              </div>
            )}
            {activeMap && (
              <svg viewBox={`0 0 ${activeMap.largura} ${activeMap.altura}`} className="h-auto max-h-[65vh] w-full rounded-xl bg-muted/30" aria-label={activeMap.nome} role="group">
                {(activeMap.areas || []).map((area) => (
                  <path
                    key={area.id}
                    d={area.caminho_svg}
                    role="button"
                    tabIndex={0}
                    aria-label={area.nome}
                    aria-pressed={area.id === activeAreaId}
                    onClick={() => selectArea(area)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectArea(area); }
                    }}
                    className={`cursor-pointer stroke-primary stroke-2 transition-colors focus:outline-none focus:stroke-accent ${area.id === activeAreaId ? "fill-primary/50" : "fill-primary/15 hover:fill-primary/30"}`}
                  />
                ))}
              </svg>
            )}
          </div>
        )}
      </div>

      <aside className="space-y-4">
        {activeArea && (
          <section className="glass-card rounded-2xl p-5" aria-label="Detalhes da área selecionada">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Área selecionada</p>
            <h3 className="mt-1 font-heading text-lg font-bold">{activeArea.nome}</h3>
            <p className="text-sm text-muted-foreground">{activeArea.setor_nome || activeArea.sala_nome || activeArea.bloco_nome || activeArea.tipo}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {activeArea.setor_id && <Button size="sm" variant="outline" onClick={() => onSelectSector?.(activeArea.setor_id!)}>Ver setor</Button>}
              <Button size="sm" variant="ghost" className="gap-1" onClick={() => onReportContext?.({ origem: "MAPA", label: `${activeMap?.nome}: ${activeArea.nome}`, mapa_area_id: activeArea.id })}>
                <MessageSquareWarning className="h-4 w-4" /> Relatar problema
              </Button>
            </div>
          </section>
        )}

        {selectedRoom ? (
          <section className="glass-card rounded-2xl p-5" aria-label="Detalhes da sala selecionada">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sala selecionada</p>
            <h3 className="mt-1 font-heading text-lg font-bold">{selectedRoom.nome}</h3>
            <p className="text-sm text-muted-foreground">{selectedRoom.bloco_nome} · {selectedRoom.andar}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {selectedRoom.capacidade !== null && <span className="rounded-full bg-muted px-2 py-1">{selectedRoom.capacidade} lugares</span>}
              {selectedRoom.acessivel && <span className="rounded-full bg-muted px-2 py-1">Acessível</span>}
              {selectedRoom.possui_computadores && <span className="rounded-full bg-muted px-2 py-1">Computadores</span>}
              {selectedRoom.possui_data_show && <span className="rounded-full bg-muted px-2 py-1">Projetor</span>}
            </div>
            {selectedRoom.observacoes && <p className="mt-3 text-sm">{selectedRoom.observacoes}</p>}
            <div className="mt-4 border-t pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Horários publicados</p>
              {occupation.slice(0, 5).map((item) => <p key={item.id} className="text-sm">{item.dia} · {item.periodo}ª · {item.turma} — {item.disciplina}</p>)}
              {!occupation.length && <p className="text-sm text-muted-foreground">Nenhuma ocupação publicada.</p>}
            </div>
            <Button size="sm" variant="outline" className="mt-4 w-full gap-1" onClick={() => onReportContext?.({ origem: "SALA", label: `${selectedRoom.nome} · ${selectedRoom.bloco_nome}`, sala_id: selectedRoom.id })}>
              <MessageSquareWarning className="h-4 w-4" /> Relatar problema nesta sala
            </Button>
          </section>
        ) : (
          <div className="glass-card rounded-2xl p-5 text-center text-sm text-muted-foreground">
            <Building2 className="mx-auto mb-2 h-6 w-6" /> Busque uma sala ou selecione uma área do mapa.
          </div>
        )}
      </aside>
    </div>
  );
};

export default SchoolMap;
