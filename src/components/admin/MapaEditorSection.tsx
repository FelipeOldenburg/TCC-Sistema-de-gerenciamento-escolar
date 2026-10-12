import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Maximize2, Minus, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { apiFetch, ApiError } from "@/lib/api";
import { adjustedBounds, adjustedPoint, areaTransform } from "@/lib/mapGeometry";
import type { AreaBounds } from "@/lib/mapGeometry";
import { pathPieces, snapAreaBounds } from "@/lib/mapSnap";
import type { SnapShape } from "@/lib/mapSnap";
import { mapTitle } from "@/controllers/useSchoolMap";
import type { MapArea, MapView } from "@/controllers/useSchoolMap";
import "@/components/school-map.css";
import "./mapa-editor.css";

type Adjustment = { ajuste_x: number; ajuste_y: number; escala_x: number; escala_y: number };
type PendingDraft = { mapId: number; areaId: number; draft: Adjustment; previous: Adjustment & { caminho_svg: string } };
type Viewport = { x: number; y: number; width: number; height: number };
type Corner = "nw" | "ne" | "sw" | "se";
type Drag = {
  pointerId: number;
  kind: "move" | "resize" | "pan";
  areaId?: number;
  startClient: { x: number; y: number };
  startPoint: { x: number; y: number };
  startViewport: Viewport;
  startDraft: Adjustment | null;
  base: AreaBounds | null;
  previous?: SnapShape;
  peers?: SnapShape[];
  blockers?: SnapShape[];
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
const readDrafts = (key: string): PendingDraft[] => {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || "[]") as PendingDraft[] | PendingDraft;
    const entries = Array.isArray(value) ? value : [value];
    return entries.filter((entry) => entry && Number.isSafeInteger(entry.mapId) && Number.isSafeInteger(entry.areaId) &&
      validAdjustment(entry.draft) && validAdjustment(entry.previous) &&
      typeof entry.previous.caminho_svg === "string");
  } catch { return []; }
};
const categoryName = (area: MapArea) => ({
  AMBIENTE: "Ambiente", CIRCULACAO: "Circulação", ESCADA: "Escada", ACESSO: "Acesso", PATIO: "Pátio",
})[area.categoria ?? "AMBIENTE"];
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

const matchingGuide = (box: SnapShape, peers: SnapShape[], axis: "x" | "y") => {
  const positions = (item: AreaBounds) => axis === "x"
    ? [item.x, item.x + item.width]
    : [item.y, item.y + item.height];
  for (const moving of box.pieces ?? [box]) for (const peer of peers) for (const target of peer.pieces ?? [peer]) {
    const overlap = axis === "x"
      ? Math.min(moving.y + moving.height, target.y + target.height) - Math.max(moving.y, target.y)
      : Math.min(moving.x + moving.width, target.x + target.width) - Math.max(moving.x, target.x);
    if (overlap <= 0) continue;
    const guide = positions(moving).find((position) => positions(target).some((edge) => Math.abs(position - edge) < 0.01));
    if (guide !== undefined) return guide;
  }
  return undefined;
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
  const [mapId, setMapId] = useState<number | null>(null);
  const [areaId, setAreaId] = useState<number | null>(null);
  const [hiddenAreaId, setHiddenAreaId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<PendingDraft[]>([]);
  const [destinationDraft, setDestinationDraft] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<NonNullable<MapArea["categoria"]>>("AMBIENTE");
  const [newDestinationId, setNewDestinationId] = useState<number | null>(null);
  const [base, setBase] = useState<AreaBounds | null>(null);
  const [allowOverlap, setAllowOverlap] = useState(false);
  const [guides, setGuides] = useState<{ x?: number; y?: number } | null>(null);
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
  const draft = selectedArea ? drafts.find((item) => item.areaId === selectedArea.id)?.draft ?? saved : null;
  const adjustmentDirty = drafts.length > 0;
  const selectedAdjustmentDirty = Boolean(selectedArea && drafts.some((item) => item.areaId === selectedArea.id));
  const destinationDirty = Boolean(selectedArea && destinationDraft !== (selectedArea.destino_mapa_id ?? null));
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
      if (drafts.length) {
        sessionStorage.setItem(draftStorageKey, JSON.stringify(drafts));
      } else sessionStorage.removeItem(draftStorageKey);
    } catch { /* The editor still warns before leaving the page when session storage is unavailable. */ }
  }, [drafts, orphanedDraft, loading, loaded, draftStorageKey]);
  useEffect(() => {
    if (!dirty && !orphanedDraft) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, orphanedDraft]);

  const loadMaps = useCallback(async (preferredMapId: number | null, preferredAreaId: number | null) => {
    setLoading(true);
    try {
      const data = await apiFetch<MapView[]>("/api/mapas", { cache: "no-store" });
      const pending = preferredMapId === null ? readDrafts(draftStorageKey) : [];
      const pendingMap = pending.length ? data.find((item) => item.id === pending[0].mapId) : null;
      const pendingArea = pendingMap?.areas.find((item) => item.id === pending[0]?.areaId);
      const map = pendingMap ?? data.find((item) => item.id === preferredMapId) ??
        data.find((item) => item.visao_geral && item.ativo !== false) ?? data.find((item) => item.ativo !== false) ?? data[0];
      const area = pendingArea ?? map?.areas.find((item) => item.id === preferredAreaId);
      const restored = pending.filter((item) => {
        const current = data.find((map) => map.id === item.mapId)?.areas.find((area) => area.id === item.areaId);
        return current && !sameAdjustment(item.draft, adjustment(current));
      });
      const stale = restored.some((item) => {
        const current = data.find((map) => map.id === item.mapId)?.areas.find((area) => area.id === item.areaId);
        return current && (!sameAdjustment(item.previous, adjustment(current)) || item.previous.caminho_svg !== current.caminho_svg);
      });
      const orphaned = pending.some((item) => !data.find((map) => map.id === item.mapId)?.areas.some((area) => area.id === item.areaId));
      setLoaded(true);
      setMaps(data);
      setMapId(map?.id ?? null);
      setAreaId(area?.id ?? null);
      setDrafts(orphaned ? pending : restored);
      setDestinationDraft(area?.destino_mapa_id ?? null);
      setCreating(false);
      setConflict(stale);
      setOrphanedDraft(orphaned);
      setError(orphaned ? "Uma área do rascunho não está mais disponível. Os ajustes foram preservados nesta sessão; descarte-os para editar a versão atual."
        : stale ? "O mapa mudou desde o rascunho anterior. Seus ajustes foram recuperados, mas precisam ser descartados antes de editar a versão atual." : "");
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

  const updateDraft = (id: number, next: Adjustment) => {
    const area = activeMap?.areas.find((item) => item.id === id);
    if (!activeMap || !area) return;
    setDrafts((current) => {
      const without = current.filter((item) => item.areaId !== id);
      if (sameAdjustment(next, adjustment(area))) return without;
      return [...without, current.find((item) => item.areaId === id) ?? {
        mapId: activeMap.id, areaId: id, draft: next,
        previous: { ...adjustment(area), caminho_svg: area.caminho_svg },
      }].map((item) => item.areaId === id ? { ...item, draft: next } : item);
    });
  };
  const chooseArea = (area: MapArea | null) => {
    if (orphanedDraft || conflict) return;
    if (creating || destinationDirty || saving) { setError(creating ? "Conclua ou cancele a inclusão antes de escolher outra área." : "Salve ou cancele o destino antes de escolher outra área."); return; }
    setAreaId(area?.id ?? null);
    setHiddenAreaId(null);
    setDestinationDraft(area?.destino_mapa_id ?? null);
    setBase(null);
    setError("");
  };
  const chooseMap = (id: number) => {
    if (dirty || saving || orphanedDraft) return;
    setMapId(id);
    setAreaId(null);
    setHiddenAreaId(null);
    setBase(null);
    setError("");
  };
  const discard = () => {
    if (conflict) {
      try { sessionStorage.removeItem(draftStorageKey); } catch { /* Reload remains available when storage is blocked. */ }
      setDrafts([]);
      void loadMaps(mapId, areaId);
      return;
    }
    setDrafts((current) => current.filter((item) => item.areaId !== selectedArea?.id));
    setDestinationDraft(selectedArea?.destino_mapa_id ?? null);
    setError("");
  };
  const discardAll = () => {
    setDrafts([]);
    setError("");
  };
  const discardOrphan = () => {
    try { sessionStorage.removeItem(draftStorageKey); } catch { /* Editing remains available when storage is blocked. */ }
    setDrafts([]);
    setOrphanedDraft(false);
    setError("");
  };
  const save = async () => {
    if (!activeMap || !drafts.length || destinationDirty || saving || conflict || orphanedDraft) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/mapas/${activeMap.id}/areas/ajustes`, {
        method: "PATCH",
        body: JSON.stringify({ ajustes: drafts.map(({ areaId, draft, previous }) => ({
          area_id: areaId, ...draft, anterior: previous,
        })) }),
      });
      setMaps((current) => current.map((map) => map.id !== activeMap.id ? map : {
        ...map,
        areas: map.areas.map((area) => ({ ...area, ...drafts.find((item) => item.areaId === area.id)?.draft })),
      }));
      setDrafts([]);
      setConflict(false);
      toast.success(`${drafts.length} ${drafts.length === 1 ? "área atualizada" : "áreas atualizadas"} no mapa.`);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        setConflict(true);
        setError("Uma das áreas foi alterada por outra pessoa. Nenhum ajuste foi salvo. Descarte e atualize para editar a versão mais recente.");
      } else setError(cause instanceof Error ? cause.message : "Não foi possível salvar os ajustes.");
    } finally {
      setSaving(false);
    }
  };

  const addArea = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nome = newName.trim();
    if (!activeMap || !nome || saving || adjustmentDirty) return;
    if (activeMap.areas.some((area) => area.nome.trim().toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"))) {
      setError("Já existe uma área com esse nome nesta vista.");
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
        body: JSON.stringify({ nome, categoria: newCategory, destino_mapa_id: newDestinationId,
          caminho_svg, rotulo_x, rotulo_y }),
      });
      setMaps((current) => current.map((map) => map.id !== activeMap.id ? map : { ...map, areas: [...map.areas, {
        id: created.id, mapa_id: activeMap.id, tipo: "OUTRO", categoria: newCategory, nome,
        caminho_svg, rotulo_x, rotulo_y, bloco_id: null, bloco_nome: null, destino_mapa_id: newDestinationId,
        sala_id: null, setor_id: null, sala_nome: null, setor_nome: null,
      }] }));
      setCreating(false);
      setAreaId(created.id);
      setDestinationDraft(newDestinationId);
      await loadMaps(activeMap.id, created.id);
      setNewName("");
      setNewCategory("AMBIENTE");
      setNewDestinationId(null);
      toast.success("Área criada. Arraste para posicionar e use as alças para ajustar o tamanho.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível adicionar a área ao mapa.");
    } finally {
      setSaving(false);
    }
  };

  const saveDestination = async () => {
    if (!activeMap || !selectedArea || !destinationDirty ||
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
  const peerBounds = (id: number) => {
    const peers: SnapShape[] = [];
    const blockers: SnapShape[] = [];
    for (const area of activeMap?.areas ?? []) {
      if (area.id === id) continue;
      const path = svgRef.current?.querySelector<SVGPathElement>(`[data-area-id="${area.id}"]`);
      const box = path?.getBBox();
      if (!box?.width || !box.height) continue;
      const draft = drafts.find((item) => item.areaId === area.id)?.draft;
      const bounds = adjustedBounds(box, draft ?? area);
      const shape = { ...bounds, pieces: pathPieces(area.caminho_svg, draft ?? area) ?? undefined };
      peers.push(shape);
      if ((area.categoria ?? "AMBIENTE") === "AMBIENTE") blockers.push(shape);
    }
    return { peers, blockers };
  };
  const snapDraft = (id: number, base: AreaBounds, candidate: Adjustment, handle: "move" | Corner,
    previous: SnapShape, peers: SnapShape[], blockers: SnapShape[], tolerance: number, showGuides: boolean): Adjustment => {
    if (!activeMap) return candidate;
    const box = adjustedBounds(base, candidate);
    const area = activeMap.areas.find((item) => item.id === id);
    const snapped = snapAreaBounds(box, peers, {
      tolerance, handle, previous, blockers,
      allowOverlap: allowOverlap || (area?.categoria ?? "AMBIENTE") !== "AMBIENTE",
      minimum: { width: base.width * 0.05, height: base.height * 0.05 },
      maximum: { width: base.width * 20, height: base.height * 20 },
      canvas: { width: activeMap.largura, height: activeMap.altura },
    });
    if (showGuides) {
      const display = { ...snapped, pieces: previous.pieces?.map((piece) => ({
        x: snapped.x + (piece.x - previous.x) * snapped.width / previous.width,
        y: snapped.y + (piece.y - previous.y) * snapped.height / previous.height,
        width: piece.width * snapped.width / previous.width,
        height: piece.height * snapped.height / previous.height,
      })) };
      const xChanged = Math.abs(snapped.x - box.x) > 0.001 || Math.abs(snapped.width - box.width) > 0.001;
      const yChanged = Math.abs(snapped.y - box.y) > 0.001 || Math.abs(snapped.height - box.height) > 0.001;
      const x = xChanged ? matchingGuide(display, peers, "x") : undefined;
      const y = yChanged ? matchingGuide(display, peers, "y") : undefined;
      setGuides(x !== undefined || y !== undefined ? { x, y } : null);
    }
    if (handle === "move") return { ...candidate,
      ajuste_x: round(candidate.ajuste_x + snapped.x - box.x),
      ajuste_y: round(candidate.ajuste_y + snapped.y - box.y),
    };
    const escala_x = round(snapped.width / base.width);
    const escala_y = round(snapped.height / base.height);
    return { escala_x, escala_y,
      ajuste_x: round(snapped.x - base.x * escala_x),
      ajuste_y: round(snapped.y - base.y * escala_y),
    };
  };
  const beginAreaDrag = (event: ReactPointerEvent<SVGElement>, area: MapArea, kind: "move" | "resize", corner?: Corner) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.stopPropagation();
    if (!activeMap || saving || orphanedDraft || creating || destinationDirty || conflict) {
      if (dirty) setError("Conclua ou cancele a inclusão ou o destino antes de mover outra área.");
      return;
    }
    const path = svgRef.current?.querySelector<SVGPathElement>(`[data-area-id="${area.id}"]`);
    const box = path?.getBBox();
    if (!box?.width || !box.height) return;
    if (area.id !== areaId) { skipPointerFocus.current = true; chooseArea(area); }
    const current = drafts.find((item) => item.areaId === area.id)?.draft ?? adjustment(area);
    const targets = peerBounds(area.id);
    setGuides(null);
    drag.current = {
      pointerId: event.pointerId, kind, corner, areaId: area.id,
      startClient: { x: event.clientX, y: event.clientY },
      startPoint: mapPoint(event.clientX, event.clientY),
      startViewport: viewport, startDraft: current,
      base: { x: box.x, y: box.y, width: box.width, height: box.height },
      previous: { ...adjustedBounds(box, current), pieces: pathPieces(area.caminho_svg, current) ?? undefined },
      ...targets, moved: false,
    };
    svgRef.current?.setPointerCapture?.(event.pointerId);
  };
  const beginPan = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.target !== event.currentTarget || !zoomed || saving) return;
    setGuides(null);
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
    const candidate = current.kind === "move"
      ? moveAdjustment(current.base, current.startDraft, dx, dy, activeMap)
      : resizeAdjustment(current.base, current.startDraft, current.corner!, dx, dy, activeMap);
    if (current.areaId !== undefined && current.previous) updateDraft(current.areaId,
      snapDraft(current.areaId, current.base, candidate, current.kind === "move" ? "move" : current.corner!,
        current.previous, current.peers ?? [], current.blockers ?? [], 8 * unitPerPixel, true));
  };
  const endPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setGuides(null);
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
    const candidate = kind === "move"
      ? moveAdjustment(base, draft, direction[0] * step, direction[1] * step, activeMap)
      : resizeAdjustment(base, draft, corner!, direction[0] * step, direction[1] * step, activeMap);
    if (selectedArea) {
      const targets = peerBounds(selectedArea.id);
      const previous = { ...adjustedBounds(base, draft), pieces: pathPieces(selectedArea.caminho_svg, draft) ?? undefined };
      updateDraft(selectedArea.id, snapDraft(selectedArea.id, base, candidate, kind === "move" ? "move" : corner!,
        previous, targets.peers, targets.blockers, 0, false));
    }
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
      <p className="mt-1 text-sm text-muted-foreground">Crie uma área com nome e função opcional, ajuste várias em sequência e salve as posições juntas.</p>
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
            value={selectedArea?.id ?? ""} disabled={!activeMap || creating || destinationDirty || saving || loading || orphanedDraft || conflict}
            onChange={(event) => chooseArea(activeMap?.areas.find((area) => area.id === Number(event.target.value)) ?? null)}>
            <option value="">Selecione no mapa ou nesta lista</option>
            {activeMap?.areas.map((area) => <option key={area.id} value={area.id}>{area.nome.replace(/\n/g, " ")} · {categoryName(area)}{drafts.some((item) => item.areaId === area.id) ? " · ajuste pendente" : ""}</option>)}
          </select>
        </label>
      </div>
      {activeMap?.ativo === false && <p role="status" className="rounded-lg border bg-muted/50 px-3 py-2 text-sm text-foreground">Esta vista está inativa. As alterações só aparecem para alunos e docentes quando ela for ativada.</p>}
      <div className="flex flex-wrap items-center gap-3">
        {!creating ? <Button type="button" variant="outline" className="gap-2" disabled={!activeMap || dirty || saving || loading || orphanedDraft || conflict}
          onClick={() => { setAreaId(null); setDestinationDraft(null); setBase(null); setCreating(true); setError(""); }}>
          <Plus className="h-4 w-4" /> Criar bloquinho
        </Button> : <Button type="button" variant="outline" className="gap-2" disabled={saving} onClick={() => { setCreating(false); setNewName(""); setNewCategory("AMBIENTE"); setNewDestinationId(null); setError(""); }}>
          <X className="h-4 w-4" /> Cancelar inclusão
        </Button>}
        <p className="text-xs text-muted-foreground">O bloquinho pertence só ao desenho do mapa; não cria uma sala ou setor no cadastro.</p>
      </div>
      {creating && activeMap && <form onSubmit={(event) => void addArea(event)} className="grid gap-3 border-t pt-4 sm:grid-cols-2" aria-label="Criar bloquinho no mapa">
        <label className="block text-sm font-medium text-foreground">Nome do bloquinho
          <input required maxLength={120} className="mt-1 block h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={newName} onChange={(event) => setNewName(event.target.value)} disabled={saving} placeholder="Ex.: Entrada do laboratório" />
        </label>
        <label className="block text-sm font-medium text-foreground">Aparência da área
          <select className="mt-1 block h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={newCategory}
            onChange={(event) => setNewCategory(event.target.value as NonNullable<MapArea["categoria"]>)} disabled={saving}>
            <option value="AMBIENTE">Ambiente</option><option value="CIRCULACAO">Circulação</option><option value="ESCADA">Escada</option>
            <option value="ACESSO">Acesso</option><option value="PATIO">Pátio</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-foreground sm:col-span-2">Função ao clicar
          <select className="mt-1 block h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={newDestinationId ?? ""}
            onChange={(event) => setNewDestinationId(Number(event.target.value) || null)} disabled={saving}>
            <option value="">Não abrir outra vista</option>
            {maps.filter((map) => map.id !== activeMap.id && map.ativo !== false).map((map) =>
              <option key={map.id} value={map.id}>{mapTitle(map)}</option>)}
          </select>
        </label>
        <p className="text-xs text-muted-foreground sm:col-span-2">O bloquinho aparece no centro da vista. Depois de criar, arraste e redimensione até a posição correta.</p>
        <Button type="submit" className="w-fit gap-2 sm:col-span-2" disabled={saving || !newName.trim()}><Plus className="h-4 w-4" />{saving ? "Criando..." : "Criar bloquinho"}</Button>
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-muted/50 px-3 py-2">
        <Switch id="mapa-editor-overlap" checked={allowOverlap} onCheckedChange={setAllowOverlap}
          aria-describedby="mapa-editor-overlap-help" />
        <label htmlFor="mapa-editor-overlap" className="cursor-pointer text-sm font-medium">Permitir sobreposição</label>
        <span id="mapa-editor-overlap-help" className="text-xs text-muted-foreground">{allowOverlap
          ? "A área de trás pode perder o clique no desenho; ela continua na lista de ambientes e acessos."
          : "Evita novas sobreposições entre ambientes; pátios e acessos mantêm suas ligações."}</span>
      </div>
      <p id="mapa-editor-help" className="text-sm text-muted-foreground">Arraste para mover e puxe uma alça para redimensionar. Bordas próximas se encaixam e mostram uma guia. Selecione outras áreas e salve os ajustes juntos. As setas fazem ajustes finos; Shift acelera.</p>
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
              const areaDraft = drafts.find((item) => item.areaId === area.id)?.draft;
              const display = areaDraft ? { ...area, ...areaDraft } : area;
              const label = area.rotulo_x != null && area.rotulo_y != null ? adjustedPoint(area.rotulo_x, area.rotulo_y, display) : null;
              const showLabel = area.id === selectedArea?.id || area.tipo === "BLOCO" || area.categoria === "PATIO";
              return <g key={area.id}>
                <path data-area-id={area.id} d={area.caminho_svg} transform={areaTransform(display)}
                  data-kind={area.tipo} data-sector={Boolean(area.setor_id)} data-category={area.categoria ?? "AMBIENTE"}
                  className={`school-map__area mapa-editor__area ${area.id === selectedArea?.id ? "is-selected" : ""} ${areaDraft ? "is-pending" : ""}`}
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
            {guides?.x !== undefined && <line x1={guides.x} y1={viewport.y} x2={guides.x} y2={viewport.y + viewport.height}
              className="mapa-editor__guide" vectorEffect="non-scaling-stroke" aria-hidden="true" />}
            {guides?.y !== undefined && <line x1={viewport.x} y1={guides.y} x2={viewport.x + viewport.width} y2={guides.y}
              className="mapa-editor__guide" vectorEffect="non-scaling-stroke" aria-hidden="true" />}
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
      {selectedArea && activeMap && !creating && <div className="grid gap-3 border-t pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="block text-sm font-medium text-foreground">Ao clicar em {selectedArea.nome.replace(/\n/g, " ")}, abrir
          <select className="mt-1 block h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={destinationDraft ?? ""}
            disabled={saving || loading || adjustmentDirty || conflict} onChange={(event) => setDestinationDraft(Number(event.target.value) || null)}>
            <option value="">Não abrir outra vista</option>
            {maps.filter((map) => map.id !== activeMap.id && map.ativo !== false).map((map) =>
              <option key={map.id} value={map.id}>{mapTitle(map)}</option>)}
          </select>
        </label>
        <Button type="button" className="gap-2" disabled={!destinationDirty || adjustmentDirty || saving || loading || conflict}
          onClick={() => void saveDestination()}><Save className="h-4 w-4" />Salvar destino</Button>
        <p className="text-xs text-muted-foreground sm:col-span-2">Escolha outra vista para criar um atalho; deixe vazio para não navegar ao clicar.</p>
      </div>}
      {(adjustmentDirty || destinationDirty) && <p role="status" className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-medium text-foreground">{adjustmentDirty
        ? `${drafts.length} ${drafts.length === 1 ? "área ajustada" : "áreas ajustadas"} sem salvar. Você pode selecionar outras áreas desta vista e salvar todas de uma vez.`
        : "Destino ainda não salvo. Salve ou cancele antes de trocar de área."}</p>}
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
      {orphanedDraft && <Button type="button" variant="outline" onClick={discardOrphan}>Descartar rascunho antigo</Button>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{selectedArea ? <><strong className="text-foreground">{selectedArea.nome.replace(/\n/g, " ")}</strong> · {categoryName(selectedArea)}</> : "Escolha uma área para começar."}</p>
        <div className="flex flex-wrap gap-2">
          {(selectedAdjustmentDirty || destinationDirty || conflict) && <Button type="button" variant="outline" onClick={discard} disabled={saving || loading} className="gap-2"><X />{conflict ? "Descartar e atualizar" : destinationDirty ? "Cancelar alteração" : "Cancelar ajuste desta área"}</Button>}
          {drafts.length > 0 && !conflict && <Button type="button" variant="outline" onClick={discardAll} disabled={saving || loading}>Descartar todos</Button>}
          {selectedArea && <Button type="button" variant="outline" className="gap-2 text-destructive" disabled={dirty || saving || loading || conflict} onClick={() => void removeArea()}><Trash2 className="h-4 w-4" />Remover do mapa</Button>}
          <Button type="button" onClick={() => void save()} disabled={!adjustmentDirty || destinationDirty || saving || loading || conflict} className="gap-2"><Save />{saving ? "Salvando..." : drafts.length > 1 ? `Salvar ${drafts.length} ajustes` : "Salvar ajuste"}</Button>
        </div>
      </div>
    </div>
  </div>;
}
