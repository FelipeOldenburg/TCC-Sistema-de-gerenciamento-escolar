import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

export type MapArea = {
  id: number; mapa_id: number; tipo: "BLOCO" | "SALA" | "SETOR" | "OUTRO";
  nome: string; caminho_svg: string; bloco_id: number | null; sala_id: number | null; setor_id: number | null;
  bloco_nome: string | null; sala_nome: string | null; setor_nome: string | null;
  categoria?: "AMBIENTE" | "CIRCULACAO" | "ESCADA" | "ACESSO" | "PATIO";
  rotulo_x?: number | null; rotulo_y?: number | null; descricao?: string | null; destino_mapa_id?: number | null;
};
export type MapView = {
  id: number; nome: string; piso: string | null; largura: number; altura: number; areas: MapArea[];
  bloco_id?: number | null; bloco_nome?: string | null; visao_geral?: boolean; descricao?: string | null;
};
export type Room = {
  id: number; nome: string; bloco_id: number; bloco_nome: string; andar: string; capacidade: number | null;
  tipo: string; acessivel: boolean; possui_computadores: boolean; possui_data_show: boolean;
  observacoes: string | null;
};
export type Sector = { id: number; nome: string; descricao: string; localizacao: string | null };
export type MapLocation = { map: MapView; area: MapArea };
type Occupation = { id: number; turma: string; dia: string; periodo: number; disciplina: string; professor: string | null };
export const normalizeMapText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export const mapTitle = (map: MapView) => map.nome.replace(/^CIMOL\s*·\s*/, "");

// Duas portas numeradas podem pertencer ao mesmo recinto na planta (C302 / C303).
export const areaContainsRoom = (area: MapArea, room: Room) => area.sala_id === room.id || (
  /^[A-E]\d{3}(?:\([A-Z]\))?$/i.test(room.nome.replace(/\s/g, "")) &&
  area.nome.toUpperCase().replace(/\s/g, "").split("/").includes(room.nome.toUpperCase().replace(/\s/g, ""))
);

export const useSchoolMap = (selectedAreaId?: number | null) => {
  const [maps, setMaps] = useState<MapView[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [activeMapId, setActiveMapId] = useState<number | null>(null);
  const [activeAreaId, setActiveAreaId] = useState<number | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [selectedSectorId, setSelectedSectorId] = useState<number | null>(null);
  const [occupation, setOccupation] = useState<Occupation[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([apiFetch<MapView[]>("/api/mapas"), apiFetch<Room[]>("/api/salas"), apiFetch<Sector[]>("/api/setores")])
      .then(([mapData, roomData, sectorData]) => {
        if (!active) return;
        setMaps(mapData); setRooms(roomData); setSectors(sectorData);
        const map = mapData.find((item) => item.areas.some((area) => area.id === selectedAreaId));
        const area = map?.areas.find((item) => item.id === selectedAreaId);
        setActiveMapId(map?.id ?? mapData.find((item) => item.visao_geral)?.id ?? mapData[0]?.id ?? null);
        setActiveAreaId(area?.id ?? null);
        setSelectedRoomId(area?.sala_id ?? null);
        setSelectedSectorId(area?.setor_id ?? null);
        setError("");
      })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Não foi possível carregar o mapa."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedAreaId]);

  useEffect(() => {
    let active = true;
    setOccupation([]);
    if (selectedRoomId) apiFetch<{ horarios: Occupation[] }>(`/api/salas/${selectedRoomId}/ocupacao`)
      .then((data) => { if (active) setOccupation(data.horarios); })
      .catch(() => { if (active) setOccupation([]); });
    return () => { active = false; };
  }, [selectedRoomId]);

  const activeMap = maps.find((map) => map.id === activeMapId) ?? null;
  const activeArea = activeMap?.areas.find((area) => area.id === activeAreaId) ?? null;
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
  const selectedSector = sectors.find((sector) => sector.id === selectedSectorId) ?? null;
  const locations = useMemo(() => maps.flatMap((map) => map.areas.map((area) => ({ map, area }))), [maps]);
  const sectorLocations = locations.filter(({ area }) => area.setor_id === selectedSectorId);
  const roomLocation = selectedRoom ? locations.find(({ area }) => areaContainsRoom(area, selectedRoom)) : undefined;
  const campus = maps.find((map) => map.visao_geral);
  const blockViews = activeMap?.bloco_id ? maps.filter((map) => map.bloco_id === activeMap.bloco_id)
    .sort((a, b) => Number(a.piso?.match(/\d+/)?.[0] ?? 0) - Number(b.piso?.match(/\d+/)?.[0] ?? 0)) : [];

  const openMap = (id: number) => {
    setActiveMapId(id); setActiveAreaId(null); setSelectedRoomId(null); setSelectedSectorId(null); setQuery("");
  };
  const selectLocation = ({ map, area }: MapLocation) => {
    setActiveMapId(map.id); setActiveAreaId(area.id); setSelectedRoomId(area.sala_id); setSelectedSectorId(area.setor_id); setQuery("");
  };
  const selectArea = (area: MapArea) => {
    const destination = area.destino_mapa_id ?? (area.tipo === "BLOCO"
      ? maps.find((map) => map.bloco_id === area.bloco_id && /t[eé]rreo/i.test(map.piso ?? ""))?.id : null);
    if (destination) openMap(destination);
    else if (activeMap) selectLocation({ map: activeMap, area });
  };
  const selectRoom = (room: Room) => {
    const location = locations.find(({ area }) => areaContainsRoom(area, room));
    const views = maps.filter((map) => map.bloco_id === room.bloco_id);
    const floor = room.andar.match(/\d+/)?.[0];
    const floors = views.filter((map) => floor && map.piso?.match(/\d+/)?.[0] === floor);
    const fallback = views.length === 1 ? views[0] : floors.length === 1 ? floors[0] : undefined;
    setActiveMapId(location?.map.id ?? fallback?.id ?? campus?.id ?? null);
    setActiveAreaId(location?.area.id ?? (!fallback ? campus?.areas.find((area) => area.bloco_id === room.bloco_id)?.id ?? null : null));
    setSelectedRoomId(room.id); setSelectedSectorId(location?.area.setor_id ?? null); setQuery("");
  };
  const selectSector = (sector: Sector) => {
    const matches = locations.filter(({ area }) => area.setor_id === sector.id);
    if (matches.length === 1) selectLocation(matches[0]);
    else {
      setActiveAreaId(null); setSelectedRoomId(null); setSelectedSectorId(sector.id); setQuery("");
      if (campus) setActiveMapId(campus.id);
    }
  };
  const goCampus = () => {
    if (!campus) return;
    const blockId = selectedRoom?.bloco_id ?? activeMap?.bloco_id;
    setActiveMapId(campus.id);
    setActiveAreaId(campus.areas.find((area) => area.bloco_id === blockId)?.id ?? null);
  };

  const results = (() => {
    const term = normalizeMapText(query.trim());
    if (!term) return [];
    return [
      ...sectors.filter((sector) => normalizeMapText(sector.nome).includes(term)).map((sector) => ({
        key: `sector-${sector.id}`, nome: sector.nome, detalhe: "Setor", select: () => selectSector(sector),
      })),
      ...rooms.filter((room) => normalizeMapText(`${room.nome} ${room.bloco_nome} ${room.tipo}`).includes(term)).map((room) => ({
        key: `room-${room.id}`, nome: room.nome,
        detalhe: `${room.bloco_nome} · ${locations.find(({ area }) => areaContainsRoom(area, room))?.map.piso || "posição a confirmar"}`,
        select: () => selectRoom(room),
      })),
      ...locations.filter(({ area }) => !area.sala_id && !area.setor_id && (area.categoria ?? "AMBIENTE") === "AMBIENTE" &&
        !rooms.some((room) => areaContainsRoom(area, room)) && normalizeMapText(area.nome).includes(term))
        .map((location) => ({ key: `area-${location.area.id}`, nome: location.area.nome, detalhe: mapTitle(location.map), select: () => selectLocation(location) })),
    ].slice(0, 12);
  })();

  return { maps, rooms, activeMap, activeArea, selectedRoom, selectedSector, roomLocation, sectorLocations, occupation,
    query, setQuery, results, loading, error, campus, blockViews, openMap, selectArea, selectLocation, goCampus };
};
