import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowDown, ArrowRight, ArrowUp, Building2, Home, MapPin, MessageSquareWarning, Minus, Plus, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mapTitle, useSchoolMap, type MapArea } from "@/controllers/useSchoolMap";
import type { ReportContext } from "@/components/sections/ReclamacoesSection";

const areaStyle = (area: MapArea, selected: boolean) => {
  if (selected) return "fill-primary/25 stroke-primary stroke-[3]";
  if (area.categoria === "CIRCULACAO" || area.categoria === "PATIO") return "fill-muted/60 stroke-border";
  if (area.categoria === "ESCADA" || area.categoria === "ACESSO") return "fill-accent/25 stroke-foreground/50";
  if (area.setor_id) return "fill-primary/10 stroke-primary/50";
  return "fill-background stroke-foreground/35";
};

const SchoolMap = ({ selectedAreaId, onSelectSector, onReportContext }: {
  selectedAreaId?: number | null;
  onSelectSector?: (sectorId: number, areaId?: number) => void;
  onReportContext?: (context: ReportContext) => void;
}) => {
  const map = useSchoolMap(selectedAreaId);
  const { activeMap, activeArea, selectedRoom, selectedSector } = map;
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, width: 1000, height: 700 });
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 520 });
  const [bounds, setBounds] = useState<Record<number, { width: number; height: number }>>({});
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [resultIndex, setResultIndex] = useState(0);

  useEffect(() => {
    if (activeMap) setViewport({ x: 0, y: 0, width: activeMap.largura, height: activeMap.altura });
  }, [activeMap]);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setCanvasSize({ width: entry.contentRect.width || 800, height: entry.contentRect.height || 520 }));
    observer.observe(svg);
    return () => observer.disconnect();
  }, [activeMap]);
  useEffect(() => {
    const measured: Record<number, { width: number; height: number }> = {};
    svgRef.current?.querySelectorAll<SVGPathElement>("[data-area-id]").forEach((path) => {
      if (path.getBBox) measured[Number(path.dataset.areaId)] = path.getBBox();
    });
    setBounds(measured);
  }, [activeMap]);

  const fitMap = () => { if (activeMap) setViewport({ x: 0, y: 0, width: activeMap.largura, height: activeMap.altura }); };
  const zoom = (factor: number) => {
    if (!activeMap) return;
    setViewport((current) => {
      const width = Math.max(activeMap.largura / 5, Math.min(activeMap.largura, current.width * factor));
      const height = width * current.height / current.width;
      return { x: current.x + (current.width - width) / 2, y: current.y + (current.height - height) / 2, width, height };
    });
  };
  const pan = (dx: number, dy: number) => setViewport((current) => ({ ...current, x: current.x + current.width * dx, y: current.y + current.height * dy }));
  const focusSelection = useCallback(() => {
    if (!activeMap || !activeArea) return;
    const path = svgRef.current?.querySelector<SVGPathElement>(`[data-area-id="${activeArea.id}"]`);
    if (!path?.getBBox) return;
    const box = path.getBBox();
    const aspect = canvasSize.width / canvasSize.height;
    const width = Math.min(activeMap.largura, Math.max(box.width * 2.5, activeMap.largura / 5, box.height * 2.5 * aspect));
    const height = width / aspect;
    setViewport({ x: box.x + box.width / 2 - width / 2, y: box.y + box.height / 2 - height / 2, width, height });
  }, [activeMap, activeArea, canvasSize]);
  useEffect(() => {
    if (activeArea && !activeMap?.visao_geral) focusSelection();
  }, [activeMap, activeArea, focusSelection]);
  useEffect(() => {
    if (selectedAreaId && activeArea?.id === selectedAreaId) svgRef.current?.querySelector<SVGPathElement>(`[data-area-id="${selectedAreaId}"]`)?.focus();
  }, [selectedAreaId, activeArea]);
  const zoomed = activeMap ? viewport.width < activeMap.largura : false;
  const fontSize = Math.max(viewport.width / canvasSize.width, viewport.height / canvasSize.height) * 13;
  const sectorDetail = () => selectedSector && onSelectSector?.(selectedSector.id, activeArea?.setor_id === selectedSector.id ? activeArea.id : undefined);
  const blockChoices = map.maps.filter((view, index, views) => view.bloco_id && views.findIndex((item) => item.bloco_id === view.bloco_id) === index);

  if (map.loading) return <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Carregando mapa...</div>;
  if (map.error) return <p role="alert" className="rounded-xl border bg-card p-6 text-destructive">{map.error}</p>;

  return (
    <div className="space-y-5">
      <div className="max-w-2xl">
        <p className="mb-3 text-sm text-muted-foreground">Encontre uma sala ou setor. Selecione um bloco para conhecer seus pavimentos e acessos.</p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input aria-label="Buscar uma sala ou ambiente" role="combobox" aria-expanded={Boolean(map.query)} aria-controls="map-search-results" aria-autocomplete="list"
            aria-activedescendant={map.query && map.results[resultIndex] ? `map-result-${map.results[resultIndex].key}` : undefined}
            value={map.query} placeholder="Buscar sala, setor ou ambiente" className="pl-9"
            onChange={(event) => { map.setQuery(event.target.value); setResultIndex(0); }}
            onKeyDown={(event) => {
              if (event.key === "Escape") map.setQuery("");
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault(); setResultIndex((index) => Math.max(0, Math.min(map.results.length - 1, index + (event.key === "ArrowDown" ? 1 : -1))));
              }
              if (event.key === "Enter" && map.results[resultIndex]) { event.preventDefault(); map.results[resultIndex].select(); }
            }} />
          {map.query && (
            <div id="map-search-results" role="listbox" aria-label="Resultados da busca" className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border bg-card p-1 shadow-lg">
              {map.results.map((result, index) => (
                <button key={result.key} id={`map-result-${result.key}`} type="button" role="option" aria-selected={index === resultIndex}
                  onClick={result.select} className={`block w-full rounded-lg px-3 py-3 text-left text-sm hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${index === resultIndex ? "bg-muted" : ""}`}>
                  <span className="font-medium">{result.nome}</span><span className="ml-2 text-muted-foreground">· {result.detalhe}</span>
                </button>
              ))}
              {!map.results.length && <p className="p-3 text-sm text-muted-foreground">Nenhuma sala ou setor encontrado.</p>}
            </div>
          )}
        </div>
      </div>
      {(selectedRoom || selectedSector || activeArea) && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm lg:hidden" role="status">
        <span><strong>{selectedRoom?.nome || selectedSector?.nome || activeArea?.nome.replace(/\n/g, " ")}</strong> · {activeMap && mapTitle(activeMap)}</span>
        <a href="#map-destination" className="font-medium text-primary underline underline-offset-4">{!selectedRoom && selectedSector && map.sectorLocations.length > 1 ? "Escolher local" : "Ver detalhes"}</a>
      </div>}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-3">
          {!map.maps.length ? (
            <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border bg-card p-8 text-center">
              <MapPin className="mb-3 h-9 w-9 text-muted-foreground" />
              <h3 className="font-heading text-lg font-bold">Mapa ainda não configurado</h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">As plantas reais serão publicadas aqui após a conferência dos documentos da instituição. A busca por salas e setores continua disponível.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {map.campus && <Button size="sm" variant="outline" onClick={map.goCampus}><Home className="mr-2 h-4 w-4" /> Visão geral</Button>}
                {blockChoices.length > 0 && <select aria-label="Escolher bloco" className="h-9 max-w-full rounded-md border bg-background px-2 text-sm"
                  value={activeMap?.bloco_id ?? ""} onChange={(event) => {
                    const views = map.maps.filter((view) => view.bloco_id === Number(event.target.value));
                    const view = views.find((item) => /t[eé]rreo/i.test(item.piso ?? "")) ?? views[0];
                    if (view) map.openMap(view.id);
                  }}>
                  <option value="">Escolher bloco</option>
                  {blockChoices.map((view) => <option key={view.bloco_id} value={view.bloco_id!}>{view.bloco_nome}</option>)}
                </select>}
              </div>
              {activeMap && <h3 className="font-heading text-lg font-semibold" aria-live="polite">{mapTitle(activeMap)}</h3>}
              {(map.blockViews.length > 1 || (!map.campus && map.maps.length > 1)) && (
                <div className="flex flex-wrap gap-2" aria-label="Pavimentos do mapa">
                  {(map.blockViews.length ? map.blockViews : map.maps).map((view) => (
                    <Button key={view.id} size="sm" variant={view.id === activeMap?.id ? "default" : "outline"} aria-pressed={view.id === activeMap?.id} onClick={() => map.openMap(view.id)} className="h-auto min-h-9 whitespace-normal text-left">
                      {mapTitle(view)}
                    </Button>
                  ))}
                </div>
              )}
              {activeMap && (
                <div className="overflow-hidden rounded-xl border bg-card">
                  <div className="flex flex-wrap items-center gap-1 border-b p-2" aria-label="Controles do mapa">
                    <Button size="sm" variant="ghost" aria-label="Ampliar mapa" onClick={() => zoom(0.75)}><Plus className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" aria-label="Reduzir mapa" onClick={() => zoom(1.3333)} disabled={!zoomed}><Minus className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={fitMap}><RotateCcw className="mr-2 h-4 w-4" /> Enquadrar</Button>
                    {activeArea && <Button size="sm" variant="ghost" onClick={focusSelection}>Aproximar seleção</Button>}
                    {zoomed && <div className="ml-auto flex gap-1">
                      <Button size="sm" variant="ghost" aria-label="Mover mapa para a esquerda" onClick={() => pan(-0.2, 0)}><ArrowLeft className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" aria-label="Mover mapa para cima" onClick={() => pan(0, -0.2)}><ArrowUp className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" aria-label="Mover mapa para baixo" onClick={() => pan(0, 0.2)}><ArrowDown className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" aria-label="Mover mapa para a direita" onClick={() => pan(0.2, 0)}><ArrowRight className="h-4 w-4" /></Button>
                    </div>}
                  </div>
                  <svg ref={svgRef} viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`} role="group" aria-label={activeMap.nome}
                    className="block h-[420px] w-full bg-muted/10 sm:h-[520px]" style={{ touchAction: zoomed ? "none" : "auto" }}
                    onPointerDown={(event) => { if (zoomed && event.isPrimary !== false) drag.current = { x: event.clientX, y: event.clientY, moved: false }; }}
                    onPointerMove={(event) => {
                      const current = drag.current, svg = svgRef.current;
                      if (!current || !svg) return;
                      const dx = event.clientX - current.x, dy = event.clientY - current.y;
                      if (!current.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
                      svg.setPointerCapture?.(event.pointerId);
                      current.moved = true; current.x = event.clientX; current.y = event.clientY;
                      const rect = svg.getBoundingClientRect(), scale = Math.max(viewport.width / rect.width, viewport.height / rect.height);
                      setViewport((view) => ({ ...view, x: view.x - dx * scale, y: view.y - dy * scale }));
                    }}
                    onPointerUp={() => { if (!drag.current?.moved) drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
                    onClickCapture={(event) => { if (drag.current?.moved) { event.stopPropagation(); drag.current = null; } }}>
                    <title>{mapTitle(activeMap)}</title><desc>{activeMap.descricao || "Selecione um ambiente ou acesso. Use os controles para ampliar e mover o mapa."}</desc>
                    {activeMap.areas.map((area) => {
                      const interactive = area.categoria !== "CIRCULACAO" && area.categoria !== "PATIO";
                      const selected = area.id === activeArea?.id;
                      const box = bounds[area.id];
                      const maxChars = box ? Math.floor(box.width / (fontSize * 0.55)) : 100;
                      const compactName = area.tipo === "BLOCO" ? area.nome.replace(/^Bloco\s+/i, "") : area.nome.split(" · ")[0].replace(/ e anexos$/, "");
                      const label: string[] = [];
                      let showLabel = false;
                      for (const name of [area.nome, compactName]) {
                        label.length = 0;
                        for (const word of name.replace(/\s*\/\s*/g, " / ").split(/\s+/)) {
                          const last = label.length - 1;
                          if (last >= 0 && label[last].length + word.length + 1 <= maxChars) label[last] += ` ${word}`;
                          else label.push(word);
                        }
                        showLabel = label.every((line) => line.length <= maxChars) && (!box || label.length * fontSize * 1.2 <= box.height * 0.9);
                        if (showLabel) break;
                      }
                      return <g key={area.id}>
                        <path data-area-id={area.id} d={area.caminho_svg} role={interactive ? "button" : undefined} tabIndex={interactive ? 0 : undefined}
                          aria-label={area.nome} aria-pressed={interactive ? selected : undefined} onClick={interactive ? () => map.selectArea(area) : undefined}
                          onKeyDown={interactive ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); map.selectArea(area); } } : undefined}
                          vectorEffect="non-scaling-stroke" className={`${areaStyle(area, selected)} stroke-[1.5] ${interactive ? "cursor-pointer hover:fill-primary/20 focus-visible:outline-none focus-visible:stroke-primary focus-visible:stroke-[3]" : ""}`} />
                        {showLabel && area.rotulo_x != null && area.rotulo_y != null && <text x={area.rotulo_x} y={area.rotulo_y} textAnchor="middle" dominantBaseline="middle" fontSize={fontSize}
                          className={`pointer-events-none fill-foreground ${area.tipo === "BLOCO" || selected ? "font-semibold" : ""}`} aria-hidden="true">
                          {label.map((line, index) => <tspan key={index} x={area.rotulo_x!} dy={index === 0 ? -(label.length - 1) * fontSize * 0.6 : fontSize * 1.2}>{line}</tspan>)}
                        </text>}
                      </g>;
                    })}
                  </svg>
                </div>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Legenda do mapa">
                <span className="flex items-center gap-2"><span className="h-3 w-3 border border-foreground/35 bg-background" /> Ambientes</span>
                <span className="flex items-center gap-2"><span className="h-3 w-3 border border-primary/50 bg-primary/10" /> Setores</span>
                <span className="flex items-center gap-2"><span className="h-3 w-3 border border-foreground/50 bg-accent/25" /> Escadas e acessos</span>
              </div>
              {activeMap?.descricao && <p className="text-sm leading-relaxed text-muted-foreground">{activeMap.descricao}</p>}
              {activeMap && <details className="rounded-lg border p-3 text-sm"><summary className="cursor-pointer font-medium">Ambientes e acessos desta vista</summary>
                <div className="mt-2 flex flex-wrap gap-2">{activeMap.areas.filter((area) => area.categoria !== "CIRCULACAO" && area.categoria !== "PATIO").map((area) => (
                  <Button key={area.id} size="sm" variant="outline" onClick={() => map.selectArea(area)} className="h-auto min-h-9 whitespace-normal text-left">{area.nome.replace(/\n/g, " ")}</Button>
                ))}</div>
              </details>}
            </>
          )}
        </div>
        <aside id="map-destination" className="space-y-4 lg:sticky lg:top-4" aria-live="polite">
          {selectedRoom ? (
            <section className="rounded-xl border bg-card p-5" aria-label="Detalhes da sala selecionada">
              <h3 className="font-heading text-xl font-semibold">{selectedRoom.nome}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{selectedRoom.bloco_nome} · {map.roomLocation?.map.piso || selectedRoom.andar}</p>
              {!map.roomLocation && <p className="mt-3 text-sm">A posição exata desta sala não está identificada na planta. Consulte os pavimentos do bloco; a localização ainda precisa ser confirmada.</p>}
              {map.roomLocation?.area.descricao && <p className="mt-3 text-sm leading-relaxed">{map.roomLocation.area.descricao}</p>}
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {selectedRoom.capacidade !== null && <span className="rounded bg-muted px-2 py-1">{selectedRoom.capacidade} lugares</span>}
                {selectedRoom.acessivel && <span className="rounded bg-muted px-2 py-1">Acessível</span>}
                {selectedRoom.possui_computadores && <span className="rounded bg-muted px-2 py-1">Computadores</span>}
              </div>
              {selectedRoom.observacoes && <p className="mt-3 text-sm">{selectedRoom.observacoes}</p>}
              {selectedSector && <Button size="sm" variant="outline" className="mt-4" onClick={sectorDetail}>Sobre este setor</Button>}
              <details className="mt-4 border-t pt-3" open><summary className="cursor-pointer text-sm font-medium">Horários publicados</summary>
                {map.occupation.slice(0, 5).map((item) => <p key={item.id} className="mt-2 text-sm">{item.dia} · {item.periodo}ª · {item.turma} — {item.disciplina}</p>)}
                {!map.occupation.length && <p className="mt-2 text-sm text-muted-foreground">Nenhuma ocupação publicada.</p>}
              </details>
              <Button size="sm" variant="ghost" className="mt-3" onClick={() => onReportContext?.({ origem: "SALA", label: `${selectedRoom.nome} · ${selectedRoom.bloco_nome}`, sala_id: selectedRoom.id })}>
                <MessageSquareWarning className="mr-2 h-4 w-4" /> Relatar problema
              </Button>
            </section>
          ) : selectedSector ? (
            <section className="rounded-xl border bg-card p-5" aria-label="Detalhes do setor selecionado">
              <h3 className="font-heading text-xl font-semibold">{selectedSector.nome}</h3>
              {activeArea?.setor_id === selectedSector.id && <p className="mt-2 text-sm">{mapTitle(activeMap!)} · {activeArea.nome}</p>}
              {activeArea?.descricao && <p className="mt-3 text-sm leading-relaxed">{activeArea.descricao}</p>}
              {!map.sectorLocations.length && <p className="mt-3 text-sm">Este setor ainda não tem uma localização identificada no mapa.</p>}
              {map.sectorLocations.length > 1 && <div className="mt-3 space-y-2"><p className="text-sm">Escolha o ambiente que procura:</p>
                {map.sectorLocations.map((location) => <Button key={location.area.id} variant="outline" size="sm" className="h-auto min-h-9 w-full justify-start whitespace-normal text-left" onClick={() => map.selectLocation(location)}>
                  {location.area.nome.replace(/\n/g, " ")} · {mapTitle(location.map)}
                </Button>)}
              </div>}
              <Button size="sm" className="mt-4" onClick={sectorDetail}>Sobre este setor</Button>
            </section>
          ) : activeArea ? (
            <section className="rounded-xl border bg-card p-5" aria-label="Detalhes da área selecionada">
              <h3 className="font-heading text-xl font-semibold">{activeArea.nome.replace(/\n/g, " ")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{activeMap && mapTitle(activeMap)}</p>
              {activeArea.descricao && <p className="mt-3 text-sm leading-relaxed">{activeArea.descricao}</p>}
              <Button size="sm" variant="ghost" className="mt-4" onClick={() => onReportContext?.({ origem: "MAPA", label: `${activeMap?.nome}: ${activeArea.nome}`, mapa_area_id: activeArea.id })}>
                <MessageSquareWarning className="mr-2 h-4 w-4" /> Relatar problema
              </Button>
            </section>
          ) : <div className="rounded-xl border bg-card p-5 text-sm leading-relaxed"><Building2 className="mb-3 h-6 w-6 text-primary" />
            <p>Busque uma sala ou setor, ou selecione um ambiente no mapa.</p><p className="mt-2 text-muted-foreground">As escadas e os acessos mostram as ligações entre os pavimentos.</p>
          </div>}
        </aside>
      </div>
    </div>
  );
};

export default SchoolMap;
