import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Maximize2, Minus, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiError } from "@/lib/api";
import { adjustedBounds, adjustedPoint, areaTransform } from "@/lib/mapGeometry";
import type { AreaBounds } from "@/lib/mapGeometry";
import { mapTitle } from "@/controllers/useSchoolMap";
import type { MapArea, MapView } from "@/controllers/useSchoolMap";
import "@/components/school-map.css";
import "./mapa-editor.css";

type Adjustment = { ajuste_x: number; ajuste_y: number; escala_x: number; escala_y: number };
type Block = { id: number; nome: string };
type PendingDraft = { mapId: number; areaId: number; draft: Adjustment; previous: Adjustment & { caminho_svg: string } };
type Viewport = { x: number; y: number; width: number; height: number };
type Corner = "nw" | "ne" | "sw" | "se";
type Drag = {
  pointerId: number;
  kind: "move" | "resize" | "pan";
  startClient: { x: number; y: number };
  startPoint: { x: number; y: number };
  startViewport: Viewport;
  startDraft: Adjustment | null;
  base: AreaBounds | null;
  corner?: Corner;
  moved: boolean;
};

const adjustment = (area: MapArea): Adjustment => ({
  ajuste_x: area.ajuste_x ?? 0,
  ajuste_y: area.ajuste_y ?? 0,
  escala_x: area.escala_x ?? 1,
  escala_y: area.escala_y ?? 1,
});
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const round = (value: number) => Math.round(value * 1000) / 1000;
const sameAdjustment = (a: Adjustment | null, b: Adjustment | null) =>
  a?.ajuste_x === b?.ajuste_x && a?.ajuste_y === b?.ajuste_y && a?.escala_x === b?.escala_x && a?.escala_y === b?.escala_y;
const validAdjustment = (value: Adjustment) => value &&
  Number.isFinite(value.ajuste_x) && Math.abs(value.ajuste_x) <= 200000 &&
  Number.isFinite(value.ajuste_y) && Math.abs(value.ajuste_y) <= 200000 &&
  Number.isFinite(value.escala_x) && value.escala_x >= 0.05 && value.escala_x <= 20 &&
  Number.isFinite(value.escala_y) && value.escala_y >= 0.05 && value.escala_y <= 20;
const readDraft = (key: string): PendingDraft | null => {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || "null") as PendingDraft | null;
    return value && Number.isSafeInteger(value.mapId) && Number.isSafeInteger(value.areaId) &&
      validAdjustment(value.draft) && validAdjustment(value.previous) &&
      typeof value.previous.caminho_svg === "string" ? value : null;
  } catch { return null; }
};
const categoryName = (area: MapArea) => ({
  AMBIENTE: "Ambiente", CIRCULACAO: "Circulação", ESCADA: "Escada", ACESSO: "Acesso", PATIO: "Pátio",
})[area.categoria ?? "AMBIENTE"];
const hasMapDestination = (area: MapArea | null) => Boolean(area && (
  area.tipo === "BLOCO" || area.categoria === "ACESSO" || area.categoria === "ESCADA" || area.destino_mapa_id != null
));

const moveAdjustment = (base: AreaBounds, start: Adjustment, dx: number, dy: number, map: MapView): Adjustment => {
  const box = adjustedBounds(base, start);
  return {
    ...start,
    ajuste_x: round(clamp(start.ajuste_x + dx, start.ajuste_x - box.x, start.ajuste_x + map.largura - box.x - box.width)),
    ajuste_y: round(clamp(start.ajuste_y + dy, start.ajuste_y - box.y, start.ajuste_y + map.altura - box.y - box.height)),
  };
};

const resizeAdjustment = (base: AreaBounds, start: Adjustment, corner: Corner, dx: number, dy: number, map: MapView): Adjustment => {
  const box = adjustedBounds(base, start);
  const minWidth = base.width * 0.05;
  const minHeight = base.height * 0.05;
  const left = corner.includes("w")
    ? clamp(box.x + dx, Math.max(0, box.x + box.width - base.width * 20), box.x + box.width - minWidth)
    : box.x;
  const right = corner.includes("e")
    ? clamp(box.x + box.width + dx, box.x + minWidth, Math.min(map.largura, box.x + base.width * 20))
    : box.x + box.width;
  const top = corner.includes("n")
    ? clamp(box.y + dy, Math.max(0, box.y + box.height - base.height * 20), box.y + box.height - minHeight)
    : box.y;
  const bottom = corner.includes("s")
    ? clamp(box.y + box.height + dy, box.y + minHeight, Math.min(map.altura, box.y + base.height * 20))
    : box.y + box.height;
  const escala_x = round((right - left) / base.width);
  const escala_y = round((bottom - top) / base.height);
  return {
    ajuste_x: round(left - base.x * escala_x),
    ajuste_y: round(top - base.y * escala_y),
    escala_x,
    escala_y,
  };
};

const corners: { id: Corner; label: string; cursor: string }[] = [
  { id: "nw", label: "superior esquerdo", cursor: "nwse-resize" },
  { id: "ne", label: "superior direito", cursor: "nesw-resize" },
  { id: "sw", label: "inferior esquerdo", cursor: "nesw-resize" },
  { id: "se", label: "inferior direito", cursor: "nwse-resize" },
];

export default function MapaEditorSection({ institutionId, onUnsavedChange, onSavingChange }: {
  institutionId: number; onUnsavedChange?: (dirty: boolean) => void; onSavingChange?: (saving: boolean) => void;
}) {
  const [maps, setMaps] = useState<MapView[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [blockLoadError, setBlockLoadError] = useState(false);
  const [mapId, setMapId] = useState<number | null>(null);
  const [areaId, setAreaId] = useState<number | null>(null);
  const [hiddenAreaId, setHiddenAreaId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Adjustment | null>(null);
  const [destinationDraft, setDestinationDraft] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [newBlockId, setNewBlockId] = useState<number | null>(null);
  const [newDestinationId, setNewDestinationId] = useState<number | null>(null);
  const [base, setBase] = useState<AreaBounds | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, width: 1000, height: 700 });
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 520 });
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [orphanedDraft, setOrphanedDraft] = useState(false);
  const [error, setError] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const skipPointerFocus = useRef(false);
  const onUnsavedChangeRef = useRef(onUnsavedChange);
  onUnsavedChangeRef.current = onUnsavedChange;
  const onSavingChangeRef = useRef(onSavingChange);
  onSavingChangeRef.current = onSavingChange;
  const draftStorageKey = `design-compass.map-editor-draft.${institutionId}`;

  const activeMap = maps.find((map) => map.id === mapId) ?? null;
  const mapWidth = activeMap?.largura;
  const mapHeight = activeMap?.altura;
  const selectedArea = activeMap?.areas.find((area) => area.id === areaId) ?? null;
  const hiddenArea = activeMap?.areas_ocultas?.find((area) => area.id === hiddenAreaId) ?? null;
  const saved = selectedArea ? adjustment(selectedArea) : null;
  const adjustmentDirty = Boolean(selectedArea && draft && !sameAdjustment(draft, saved));
  const destinationDirty = Boolean(hasMapDestination(selectedArea) && destinationDraft !== (selectedArea?.destino_mapa_id ?? null));
  const dirty = adjustmentDirty || destinationDirty || creating;
  const shownArea = selectedArea && draft ? { ...selectedArea, ...draft } : selectedArea;
  const selectedBounds = shownArea && base ? adjustedBounds(base, shownArea) : null;
  const zoomed = Boolean(activeMap && (viewport.width < activeMap.largura || viewport.height < activeMap.altura));
  const fontSize = Math.max(viewport.width / canvasSize.width, viewport.height / canvasSize.height) * 12;
  const unitPerPixel = Math.max(viewport.width / canvasSize.width, viewport.height / canvasSize.height);

  useEffect(() => { onUnsavedChangeRef.current?.(dirty || conflict || orphanedDraft); }, [dirty, conflict, orphanedDraft]);
  useEffect(() => { onSavingChangeRef.current?.(saving); }, [saving]);
  useEffect(() => () => { onUnsavedChangeRef.current?.(false); onSavingChangeRef.current?.(false); }, []);
  useEffect(() => {
    if (loading || !loaded || orphanedDraft) return;
    try {
      if (adjustmentDirty && activeMap && selectedArea && draft) {
        const previous = conflict ? readDraft(draftStorageKey)?.previous : null;
        sessionStorage.setItem(draftStorageKey, JSON.stringify({ mapId: activeMap.id, areaId: selectedArea.id, draft,
          previous: previous ?? { ...adjustment(selectedArea), caminho_svg: selectedArea.caminho_svg } }));
      } else sessionStorage.removeItem(draftStorageKey);
    } catch { /* The editor still warns before leaving the page when session storage is unavailable. */ }
  }, [activeMap, selectedArea, draft, adjustmentDirty, conflict, orphanedDraft, loading, loaded, draftStorageKey]);
  useEffect(() => {
    if (!dirty && !orphanedDraft) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, orphanedDraft]);

  const loadMaps = useCallback(async (preferredMapId: number | null, preferredAreaId: number | null) => {
    setLoading(true);
    try {
      const [mapResult, blockResult] = await Promise.allSettled([
        apiFetch<MapView[]>("/api/mapas", { cache: "no-store" }), apiFetch<Block[]>("/api/blocos"),
      ]);
      if (mapResult.status === "rejected") throw mapResult.reason;
      const data = mapResult.value;
      const pending = preferredMapId === null ? readDraft(draftStorageKey) : null;
      const pendingMap = pending && data.find((item) => item.id === pending.mapId);
      const pendingArea = pendingMap?.areas.find((item) => item.id === pending?.areaId);
      const map = pendingArea ? pendingMap : data.find((item) => item.id === preferredMapId) ??
        data.find((item) => item.visao_geral && item.ativo !== false) ?? data.find((item) => item.ativo !== false) ?? data[0];
      const area = pendingArea ?? map?.areas.find((item) => item.id === preferredAreaId);
      const restored = pendingArea && pending && !sameAdjustment(pending.draft, adjustment(pendingArea));
      const stale = Boolean(restored && (!sameAdjustment(pending.previous, adjustment(pendingArea)) || pending.previous.caminho_svg !== pendingArea.caminho_svg));
      const orphaned = Boolean(pending && !pendingArea);
      setLoaded(true);
      setMaps(data);
      setBlocks(blockResult.status === "fulfilled" ? blockResult.value : []);
      setBlockLoadError(blockResult.status === "rejected");
      setMapId(map?.id ?? null);
      setAreaId(area?.id ?? null);
      setDraft(restored ? pending.draft : area ? adjustment(area) : null);
      setDestinationDraft(area?.destino_mapa_id ?? null);
      setCreating(false);
      setConflict(stale);
      setOrphanedDraft(orphaned);
      setError(orphaned ? "A área do rascunho não está mais disponível. O ajuste foi preservado nesta sessão; descarte-o para editar outra área."
        : stale ? "O mapa mudou desde o rascunho anterior. Seu ajuste foi recuperado, mas precisa ser descartado antes de editar a versão atual." : "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os mapas.");
    } finally {
      setLoading(false);
    }
  }, [draftStorageKey]);

  useEffect(() => { void loadMaps(null, null); }, [loadMaps]);
  useEffect(() => {
    if (mapWidth && mapHeight) setViewport({ x: 0, y: 0, width: mapWidth, height: mapHeight });
  }, [mapId, mapWidth, mapHeight]);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setCanvasSize({
      width: entry.contentRect.width || 800,
      height: entry.contentRect.height || 520,
    }));
    observer.observe(svg);
    return () => observer.disconnect();
  }, [activeMap?.id, loading]);
  useLayoutEffect(() => {
    if (!activeMap || !selectedArea) { setBase(null); return; }
    const path = svgRef.current?.querySelector<SVGPathElement>(`[data-area-id="${selectedArea.id}"]`);
    if (!path?.getBBox) { setBase(null); return; }
    const box = path.getBBox();
    if (!box.width || !box.height) { setBase(null); return; }
    setBase({ x: box.x, y: box.y, width: box.width, height: box.height });
    if (skipPointerFocus.current) { skipPointerFocus.current = false; return; }
    const target = adjustedBounds(box, selectedArea);
    const aspect = canvasSize.width / canvasSize.height;
    const width = Math.min(activeMap.largura, Math.max(activeMap.largura / 20, target.width * 2.4, target.height * 2.4 * aspect));
    const height = Math.min(activeMap.altura, width / aspect);
    setViewport({
      x: clamp(target.x + target.width / 2 - width / 2, 0, activeMap.largura - width),
      y: clamp(target.y + target.height / 2 - height / 2, 0, activeMap.altura - height),
      width, height,
    });
  }, [activeMap, selectedArea, canvasSize.width, canvasSize.height]);

  const chooseArea = (area: MapArea | null) => {
    if (orphanedDraft) return;
    if (dirty || saving) { setError(creating ? "Conclua ou cancele a inclusão antes de escolher outra área." : "Salve ou cancele as alterações antes de escolher outra área."); return; }
    setAreaId(area?.id ?? null);
    setHiddenAreaId(null);
    setDraft(area ? adjustment(area) : null);
    setDestinationDraft(area?.destino_mapa_id ?? null);
    setBase(null);
    setError("");
  };
  const chooseMap = (id: number) => {
    if (dirty || saving || orphanedDraft) return;
    setMapId(id);
    setAreaId(null);
    setHiddenAreaId(null);
    setDraft(null);
    setBase(null);
    setError("");
  };
  const discard = () => {
    if (conflict) {
      try { sessionStorage.removeItem(draftStorageKey); } catch { /* Reload remains available when storage is blocked. */ }
      void loadMaps(mapId, areaId);
      return;
    }
    setDraft(saved);
    setDestinationDraft(selectedArea?.destino_mapa_id ?? null);
    setError("");
  };
  const discardOrphan = () => {
    try { sessionStorage.removeItem(draftStorageKey); } catch { /* Editing remains available when storage is blocked. */ }
    setOrphanedDraft(false);
    setError("");
  };
  const save = async () => {
    if (!activeMap || !selectedArea || !draft || !adjustmentDirty || saving) return;
    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<Adjustment>(`/api/mapas/${activeMap.id}/areas/${selectedArea.id}/ajuste`, {
        method: "PATCH",
        body: JSON.stringify({ ...draft, anterior: { ...adjustment(selectedArea), caminho_svg: selectedArea.caminho_svg } }),
      });
      setMaps((current) => current.map((map) => map.id !== activeMap.id ? map : {
        ...map,
        areas: map.areas.map((area) => area.id === selectedArea.id ? { ...area, ...updated } : area),
      }));
      setDraft(updated);
      setConflict(false);
      toast.success("Posição e tamanho atualizados no mapa.");
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        setConflict(true);
        setError("Esta área foi alterada por outra pessoa. Seu ajuste continua na tela. Cancele e atualize para editar a versão mais recente.");
      } else setError(cause instanceof Error ? cause.message : "Não foi possível salvar o ajuste.");
    } finally {
      setSaving(false);
    }
  };

  const addBlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const block = blocks.find((item) => item.id === newBlockId);
    if (!activeMap || !block || !newDestinationId || saving) return;
    if (activeMap.areas.some((area) => area.nome.trim().toLocaleLowerCase("pt-BR") === block.nome.trim().toLocaleLowerCase("pt-BR"))) {
      setError("Este bloco já possui uma área com esse nome nesta vista.");
      return;
    }
    const width = round(Math.min(activeMap.largura / 6, viewport.width / 4));
    const height = round(Math.min(activeMap.altura / 7, viewport.height / 4));
    const x = round(clamp(viewport.x + viewport.width / 2 - width / 2, 0, activeMap.largura - width));
    const y = round(clamp(viewport.y + viewport.height / 2 - height / 2, 0, activeMap.altura - height));
    const caminho_svg = `M ${x} ${y} h ${width} v ${height} h -${width} Z`;
    const rotulo_x = round(x + width / 2);
    const rotulo_y = round(y + height / 2);
    setSaving(true);
    setError("");
    try {
      const created = await apiFetch<{ id: number }>(`/api/mapas/${activeMap.id}/areas`, {
        method: "POST",
        body: JSON.stringify({ nome: block.nome, bloco_id: block.id, destino_mapa_id: newDestinationId,
          caminho_svg, rotulo_x, rotulo_y }),
      });
      setMaps((current) => current.map((map) => map.id !== activeMap.id ? map : { ...map, areas: [...map.areas, {
        id: created.id, mapa_id: activeMap.id, tipo: "BLOCO", categoria: "AMBIENTE", nome: block.nome,
        caminho_svg, rotulo_x, rotulo_y, bloco_id: block.id, bloco_nome: block.nome, destino_mapa_id: newDestinationId,
        sala_id: null, setor_id: null, sala_nome: null, setor_nome: null,
      }] }));
      setCreating(false);
      setAreaId(created.id);
      setDraft({ ajuste_x: 0, ajuste_y: 0, escala_x: 1, escala_y: 1 });
      setDestinationDraft(newDestinationId);
      await loadMaps(activeMap.id, created.id);
      setNewBlockId(null);
      setNewDestinationId(null);
      toast.success("Bloco adicionado ao mapa. Ajuste a posição e o tamanho antes de sair.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível adicionar o bloco ao mapa.");
    } finally {
      setSaving(false);
    }
  };

  const saveDestination = async () => {
    if (!activeMap || !selectedArea || !hasMapDestination(selectedArea) || !destinationDirty || !destinationDraft ||
      adjustmentDirty || saving || conflict) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/mapas/${activeMap.id}/areas/${selectedArea.id}`, {
        method: "PATCH", body: JSON.stringify({ destino_mapa_id: destinationDraft, anterior: selectedArea }),
      });
      setMaps((current) => current.map((map) => map.id !== activeMap.id ? map : { ...map,
        areas: map.areas.map((area) => area.id === selectedArea.id ? { ...area, destino_mapa_id: destinationDraft } : area),
      }));
      await loadMaps(activeMap.id, selectedArea.id);
      toast.success("Destino da área atualizado.");
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        setConflict(true);
        setError("Esta área mudou desde que você a abriu. Descarte as alterações e atualize antes de editar novamente.");
      } else setError(cause instanceof Error ? cause.message : "Não foi possível salvar o destino.");
    } finally {
      setSaving(false);
    }
  };

  const removeArea = async () => {
    if (!activeMap || !selectedArea || dirty || saving || conflict ||
      !window.confirm(`Remover “${selectedArea.nome.replace(/\n/g, " ")}” somente desta vista? Cadastros de blocos, salas e setores serão preservados.${
        selectedArea.destino_mapa_id || selectedArea.categoria === "ACESSO" || selectedArea.categoria === "ESCADA"
          ? " A ligação por esta área com outra vista ficará indisponível até restaurá-la." : ""}`)) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/mapas/${activeMap.id}/areas/${selectedArea.id}`, {
        method: "DELETE", body: JSON.stringify({ anterior: selectedArea }),
      });
      setMaps((current) => current.map((map) => map.id !== activeMap.id ? map : { ...map,
        areas: map.areas.filter((area) => area.id !== selectedArea.id),
      }));
      setAreaId(null);
      setDraft(null);
      setDestinationDraft(null);
      setHiddenAreaId(selectedArea.id);
      await loadMaps(activeMap.id, null);
      toast.success("Área removida desta vista. Você pode restaurá-la em Áreas removidas.");
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        setConflict(true);
        setError("Esta área mudou desde que você a abriu. Atualize antes de removê-la.");
      } else setError(cause instanceof Error ? cause.message : "Não foi possível remover a área do mapa.");
    } finally {
      setSaving(false);
    }
  };

  const restoreArea = async () => {
    if (!activeMap || !hiddenArea || dirty || saving || conflict) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/mapas/${activeMap.id}/areas/${hiddenArea.id}/restaurar`, {
        method: "POST", body: JSON.stringify({ anterior: hiddenArea }),
      });
      setHiddenAreaId(null);
      await loadMaps(activeMap.id, hiddenArea.id);
      toast.success("Área restaurada nesta vista.");
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        setError("Não foi possível restaurar: a área mudou ou há conflito de nome, destino ou limite da vista. Atualize o mapa e tente novamente.");
      } else setError(cause instanceof Error ? cause.message : "Não foi possível restaurar a área.");
    } finally {
      setSaving(false);
    }
  };

  const mapPoint = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const scale = Math.min(rect.width / viewport.width, rect.height / viewport.height);
    const offsetX = (rect.width - viewport.width * scale) / 2;
    const offsetY = (rect.height - viewport.height * scale) / 2;
    return { x: viewport.x + (clientX - rect.left - offsetX) / scale, y: viewport.y + (clientY - rect.top - offsetY) / scale };
  };
  const beginAreaDrag = (event: ReactPointerEvent<SVGElement>, area: MapArea, kind: "move" | "resize", corner?: Corner) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.stopPropagation();
    if (!activeMap || saving || orphanedDraft || creating || destinationDirty || conflict || (adjustmentDirty && area.id !== areaId)) {
      if (dirty) setError("Salve ou cancele as alterações antes de mover outra área.");
      return;
    }
    const path = svgRef.current?.querySelector<SVGPathElement>(`[data-area-id="${area.id}"]`);
    const box = path?.getBBox();
    if (!box?.width || !box.height) return;
    if (area.id !== areaId) { skipPointerFocus.current = true; chooseArea(area); }
    const current = area.id === areaId && draft ? draft : adjustment(area);
    drag.current = {
      pointerId: event.pointerId, kind, corner,
      startClient: { x: event.clientX, y: event.clientY },
      startPoint: mapPoint(event.clientX, event.clientY),
      startViewport: viewport, startDraft: current,
      base: { x: box.x, y: box.y, width: box.width, height: box.height }, moved: false,
    };
    svgRef.current?.setPointerCapture?.(event.pointerId);
  };
  const beginPan = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.target !== event.currentTarget || !zoomed || saving) return;
    drag.current = {
      pointerId: event.pointerId, kind: "pan",
      startClient: { x: event.clientX, y: event.clientY },
      startPoint: mapPoint(event.clientX, event.clientY),
      startViewport: viewport, startDraft: null, base: null, moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const pointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId || !activeMap) return;
    if (!current.moved && Math.abs(event.clientX - current.startClient.x) + Math.abs(event.clientY - current.startClient.y) < 3) return;
    current.moved = true;
    if (current.kind === "pan") {
      const rect = event.currentTarget.getBoundingClientRect();
      const units = Math.max(current.startViewport.width / rect.width, current.startViewport.height / rect.height);
      setViewport({ ...current.startViewport,
        x: clamp(current.startViewport.x - (event.clientX - current.startClient.x) * units, 0, activeMap.largura - current.startViewport.width),
        y: clamp(current.startViewport.y - (event.clientY - current.startClient.y) * units, 0, activeMap.altura - current.startViewport.height),
      });
      return;
    }
    if (!current.base || !current.startDraft) return;
    const point = mapPoint(event.clientX, event.clientY);
    const dx = point.x - current.startPoint.x;
    const dy = point.y - current.startPoint.y;
    setDraft(current.kind === "move"
      ? moveAdjustment(current.base, current.startDraft, dx, dy, activeMap)
      : resizeAdjustment(current.base, current.startDraft, current.corner!, dx, dy, activeMap));
  };
  const endPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const keyAdjust = (event: ReactKeyboardEvent<SVGElement>, kind: "move" | "resize", corner?: Corner) => {
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    };
    const direction = directions[event.key];
    if (!direction || !activeMap || !base || !draft || saving || creating || destinationDirty || conflict) return;
    event.preventDefault();
    event.stopPropagation();
    const step = Math.max(1, Math.round(unitPerPixel * (event.shiftKey ? 20 : 5)));
    setDraft(kind === "move"
      ? moveAdjustment(base, draft, direction[0] * step, direction[1] * step, activeMap)
      : resizeAdjustment(base, draft, corner!, direction[0] * step, direction[1] * step, activeMap));
  };
  const zoom = (factor: number) => {
    if (!activeMap) return;
    setViewport((current) => {
      const width = clamp(current.width * factor, activeMap.largura / 30, activeMap.largura);
      const height = clamp(current.height * factor, activeMap.altura / 30, activeMap.altura);
      return {
        x: clamp(current.x + (current.width - width) / 2, 0, activeMap.largura - width),
        y: clamp(current.y + (current.height - height) / 2, 0, activeMap.altura - height),
        width, height,
      };
    });
  };
  const pan = (dx: number, dy: number) => {
    if (!activeMap) return;
    setViewport((current) => ({ ...current,
      x: clamp(current.x + current.width * dx, 0, activeMap.largura - current.width),
      y: clamp(current.y + current.height * dy, 0, activeMap.altura - current.height),
    }));
  };

  if (loading && !maps.length) return <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Carregando mapas...</div>;
  if (!maps.length) return <div className="space-y-3 rounded-xl border bg-card p-6">
    <p role="alert" className="text-destructive">{error || "Não há mapas disponíveis para edição."}</p>
    {orphanedDraft && <Button type="button" variant="outline" onClick={discardOrphan}>Descartar rascunho antigo</Button>}
  </div>;

  return <div className="school-map mapa-editor space-y-5 animate-fade-in">
    <div>
      <h2 className="font-heading text-2xl font-bold text-foreground">Editar mapa</h2>
      <p className="mt-1 text-sm text-muted-foreground">Ajuste ou remova qualquer área do desenho, adicione blocos e escolha qual vista abre ao clicar em blocos, escadas e acessos.</p>
    </div>
    <div className="glass-card space-y-4 rounded-2xl p-4 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-foreground">Mapa / pavimento
          <select className="mt-1 block h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={activeMap?.id ?? ""} disabled={dirty || saving || loading || orphanedDraft || conflict} onChange={(event) => chooseMap(Number(event.target.value))}>
            {maps.map((map) => <option key={map.id} value={map.id}>{mapTitle(map)}{map.ativo === false ? " · inativo" : ""}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-foreground">Área
          <select className="mt-1 block h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={selectedArea?.id ?? ""} disabled={!activeMap || dirty || saving || loading || orphanedDraft || conflict}
            onChange={(event) => chooseArea(activeMap?.areas.find((area) => area.id === Number(event.target.value)) ?? null)}>
            <option value="">Selecione no mapa ou nesta lista</option>
            {activeMap?.areas.map((area) => <option key={area.id} value={area.id}>{area.nome.replace(/\n/g, " ")} · {categoryName(area)}</option>)}
          </select>
        </label>
      </div>
      {activeMap?.ativo === false && <p role="status" className="rounded-lg border bg-muted/50 px-3 py-2 text-sm text-foreground">Esta vista está inativa. As alterações só aparecem para alunos e docentes quando ela for ativada.</p>}
      <div className="flex flex-wrap items-center gap-3">
        {!creating ? <Button type="button" variant="outline" className="gap-2" disabled={!activeMap || dirty || saving || loading || orphanedDraft || conflict}
          onClick={() => { setAreaId(null); setDraft(null); setDestinationDraft(null); setBase(null); setCreating(true); setError(""); }}>
          <Plus className="h-4 w-4" /> Adicionar bloco ao mapa
        </Button> : <Button type="button" variant="outline" className="gap-2" disabled={saving} onClick={() => { setCreating(false); setNewBlockId(null); setNewDestinationId(null); setError(""); }}>
          <X className="h-4 w-4" /> Cancelar inclusão
        </Button>}
        <p className="text-xs text-muted-foreground">O cadastro do bloco e de suas salas fica na seção Blocos.</p>
      </div>
      {creating && activeMap && <form onSubmit={(event) => void addBlock(event)} className="grid gap-3 border-t pt-4 sm:grid-cols-2" aria-label="Adicionar bloco ao mapa">
        <label className="block text-sm font-medium text-foreground">Bloco cadastrado
          <select required className="mt-1 block h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={newBlockId ?? ""}
            onChange={(event) => setNewBlockId(Number(event.target.value) || null)} disabled={saving}>
            <option value="">Escolha um bloco</option>
            {blocks.map((block) => <option key={block.id} value={block.id}>{block.nome}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-foreground">Abrir ao clicar
          <select required className="mt-1 block h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={newDestinationId ?? ""}
            onChange={(event) => setNewDestinationId(Number(event.target.value) || null)} disabled={saving}>
            <option value="">Escolha uma vista de destino</option>
            {maps.filter((map) => map.id !== activeMap.id && map.ativo !== false).map((map) =>
              <option key={map.id} value={map.id}>{mapTitle(map)}</option>)}
          </select>
        </label>
        <p className="text-xs text-muted-foreground sm:col-span-2">O novo bloco aparece no centro da vista. Depois de criar, arraste e redimensione até a posição correta.</p>
        {!blocks.length && <p role="alert" className="text-sm text-destructive sm:col-span-2">{blockLoadError ? "Não foi possível carregar os blocos. Recarregue a página para tentar novamente." : "Cadastre um bloco na seção Blocos antes de adicioná-lo ao mapa."}</p>}
        {!maps.some((map) => map.id !== activeMap.id && map.ativo !== false) && <p role="alert" className="text-sm text-destructive sm:col-span-2">É necessário ter outra vista ativa para definir o destino deste bloco.</p>}
        <Button type="submit" className="w-fit gap-2 sm:col-span-2" disabled={saving || !newBlockId || !newDestinationId}><Plus className="h-4 w-4" />{saving ? "Adicionando..." : "Criar área do bloco"}</Button>
      </form>}
      {activeMap && (activeMap.areas_ocultas?.length ?? 0) > 0 && <div className="grid gap-3 border-t pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="block text-sm font-medium text-foreground">Áreas removidas nesta vista
          <select className="mt-1 block h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={hiddenArea?.id ?? ""} disabled={dirty || saving || loading || conflict || orphanedDraft}
            onChange={(event) => { chooseArea(null); setHiddenAreaId(Number(event.target.value) || null); }}>
            <option value="">Escolha uma área para restaurar</option>
            {activeMap.areas_ocultas?.map((area) => <option key={area.id} value={area.id}>{area.nome.replace(/\n/g, " ")} · {categoryName(area)}</option>)}
          </select>
        </label>
        <Button type="button" variant="outline" disabled={!hiddenArea || dirty || saving || loading || conflict || orphanedDraft} onClick={() => void restoreArea()}>Restaurar área</Button>
      </div>}
      <p id="mapa-editor-help" className="text-sm text-muted-foreground">Clique ou toque numa área e arraste para mover. Puxe uma das quatro alças para mudar o tamanho. Na lista, selecione áreas pequenas. Pelo teclado, as setas movem a área selecionada; nas alças, redimensionam. Shift acelera o ajuste.</p>
      {activeMap && <div className="school-map__frame overflow-hidden rounded-xl">
        <div className="school-map__frame-heading flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <h3 className="font-heading text-base font-bold">{mapTitle(activeMap)}</h3>
          <span className="text-xs font-medium">Editor orientativo · sem escala</span>
        </div>
        <div className="school-map__viewport relative">
          <svg ref={svgRef} viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`}
            className="school-map__svg mapa-editor__canvas block h-[390px] w-full sm:h-[560px]"
            role="group" aria-label={`Editar áreas de ${mapTitle(activeMap)}`} aria-describedby="mapa-editor-help"
            onPointerDown={beginPan} onPointerMove={pointerMove} onPointerUp={endPointer} onPointerCancel={endPointer}>
            <title>{mapTitle(activeMap)}</title>
            {activeMap.areas.map((area) => {
              const display = area.id === selectedArea?.id && draft ? { ...area, ...draft } : area;
              const label = area.rotulo_x != null && area.rotulo_y != null ? adjustedPoint(area.rotulo_x, area.rotulo_y, display) : null;
              const showLabel = area.id === selectedArea?.id || area.tipo === "BLOCO" || area.categoria === "PATIO";
              return <g key={area.id}>
                <path data-area-id={area.id} d={area.caminho_svg} transform={areaTransform(display)}
                  data-kind={area.tipo} data-sector={Boolean(area.setor_id)} data-category={area.categoria ?? "AMBIENTE"}
                  className={`school-map__area mapa-editor__area ${area.id === selectedArea?.id ? "is-selected" : ""}`}
                  vectorEffect="non-scaling-stroke" role="button" tabIndex={0} aria-label={`Selecionar e mover ${area.nome.replace(/\n/g, " ")}`}
                  aria-pressed={area.id === selectedArea?.id} onClick={() => { if (area.id !== selectedArea?.id) chooseArea(area); }}
                  onPointerDown={(event) => beginAreaDrag(event, area, "move")}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chooseArea(area); }
                    else if (area.id === selectedArea?.id) keyAdjust(event, "move");
                  }}><title>{area.nome.replace(/\n/g, " ")}</title></path>
                {showLabel && label && <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle" fontSize={fontSize}
                  className="school-map__label mapa-editor__label" aria-hidden="true">{area.nome.replace(/\n/g, " ")}</text>}
              </g>;
            })}
            {selectedBounds && selectedArea && <g className="mapa-editor__selection">
              <rect x={selectedBounds.x} y={selectedBounds.y} width={selectedBounds.width} height={selectedBounds.height}
                fill="none" stroke="var(--map-selection-stroke)" strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" pointerEvents="none" />
              {corners.map(({ id, label, cursor }) => {
                const x = id.includes("w") ? selectedBounds.x : selectedBounds.x + selectedBounds.width;
                const y = id.includes("n") ? selectedBounds.y : selectedBounds.y + selectedBounds.height;
                return <g key={id}>
                  <circle cx={x} cy={y} r={22 * unitPerPixel} fill="transparent" className="mapa-editor__handle"
                    style={{ cursor }} role="button" tabIndex={0} aria-label={`Redimensionar ${selectedArea.nome} pelo canto ${label}`}
                    onPointerDown={(event) => beginAreaDrag(event, selectedArea, "resize", id)}
                    onKeyDown={(event) => keyAdjust(event, "resize", id)} />
                  <circle cx={x} cy={y} r={7 * unitPerPixel} fill="hsl(var(--card))" stroke="var(--map-selection-stroke)"
                    strokeWidth={2} vectorEffect="non-scaling-stroke" pointerEvents="none" aria-hidden="true" />
                </g>;
              })}
            </g>}
          </svg>
          <div className="school-map__tools mapa-editor__tools m-3 ml-auto flex w-fit items-center gap-1 rounded-lg p-1 shadow-sm sm:absolute sm:bottom-3 sm:right-3 sm:m-0" aria-label="Controles do editor">
            <Button type="button" size="icon" variant="ghost" aria-label="Mover mapa para esquerda" title="Mover mapa para esquerda" onClick={() => pan(-0.2, 0)} disabled={!zoomed}><ArrowLeft /></Button>
            <Button type="button" size="icon" variant="ghost" aria-label="Mover mapa para cima" title="Mover mapa para cima" onClick={() => pan(0, -0.2)} disabled={!zoomed}><ArrowUp /></Button>
            <Button type="button" size="icon" variant="ghost" aria-label="Mover mapa para baixo" title="Mover mapa para baixo" onClick={() => pan(0, 0.2)} disabled={!zoomed}><ArrowDown /></Button>
            <Button type="button" size="icon" variant="ghost" aria-label="Mover mapa para direita" title="Mover mapa para direita" onClick={() => pan(0.2, 0)} disabled={!zoomed}><ArrowRight /></Button>
            <Button type="button" size="icon" variant="ghost" aria-label="Ampliar mapa" title="Ampliar mapa" onClick={() => zoom(0.75)}><Plus /></Button>
            <Button type="button" size="icon" variant="ghost" aria-label="Reduzir mapa" title="Reduzir mapa" onClick={() => zoom(1.3333)} disabled={!zoomed}><Minus /></Button>
            <Button type="button" size="icon" variant="ghost" aria-label="Enquadrar mapa" title="Enquadrar mapa" onClick={() => setViewport({ x: 0, y: 0, width: activeMap.largura, height: activeMap.altura })}><Maximize2 /></Button>
          </div>
        </div>
      </div>}
      {hasMapDestination(selectedArea) && selectedArea && activeMap && !creating && <div className="grid gap-3 border-t pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="block text-sm font-medium text-foreground">Ao clicar em {selectedArea.nome.replace(/\n/g, " ")}, abrir
          <select required className="mt-1 block h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={destinationDraft ?? ""}
            disabled={saving || loading || adjustmentDirty || conflict} onChange={(event) => setDestinationDraft(Number(event.target.value) || null)}>
            <option value="" disabled>Escolha uma vista de destino</option>
            {maps.filter((map) => map.id !== activeMap.id && map.ativo !== false).map((map) =>
              <option key={map.id} value={map.id}>{mapTitle(map)}</option>)}
          </select>
        </label>
        <Button type="button" className="gap-2" disabled={!destinationDirty || !destinationDraft || adjustmentDirty || saving || loading || conflict}
          onClick={() => void saveDestination()}><Save className="h-4 w-4" />Salvar destino</Button>
        <p className="text-xs text-muted-foreground sm:col-span-2">Esta ação abre outra vista do mapa para alunos e docentes.</p>
      </div>}
      {(adjustmentDirty || destinationDirty) && <p role="status" className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-medium text-foreground">Alteração ainda não salva. Salve ou cancele antes de trocar de área ou pavimento.</p>}
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
      {orphanedDraft && <Button type="button" variant="outline" onClick={discardOrphan}>Descartar rascunho antigo</Button>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{selectedArea ? <><strong className="text-foreground">{selectedArea.nome.replace(/\n/g, " ")}</strong> · {categoryName(selectedArea)}</> : "Escolha uma área para começar."}</p>
        <div className="flex flex-wrap gap-2">
          {(adjustmentDirty || destinationDirty || conflict) && <Button type="button" variant="outline" onClick={discard} disabled={saving || loading} className="gap-2"><X />{conflict ? "Descartar e atualizar" : destinationDirty ? "Cancelar alteração" : "Cancelar ajuste"}</Button>}
          {selectedArea && <Button type="button" variant="outline" className="gap-2 text-destructive" disabled={dirty || saving || loading || conflict} onClick={() => void removeArea()}><Trash2 className="h-4 w-4" />Remover do mapa</Button>}
          <Button type="button" onClick={() => void save()} disabled={!adjustmentDirty || saving || loading || conflict} className="gap-2"><Save />{saving ? "Salvando..." : "Salvar ajuste"}</Button>
        </div>
      </div>
    </div>
  </div>;
}
