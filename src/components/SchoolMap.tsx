import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, Home, LocateFixed, MapPin, MessageSquareWarning, Minus, Plus, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mapTitle, useSchoolMap } from "@/controllers/useSchoolMap";
import type { ReportContext } from "@/components/sections/ReclamacoesSection";
import "@/components/school-map.css";

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
    if (!activeMap) return;
    const wideOnPhone = canvasSize.width < 600 && activeMap.largura / activeMap.altura > 1.8;
    const width = wideOnPhone ? Math.min(activeMap.largura, activeMap.altura * canvasSize.width / canvasSize.height) : activeMap.largura;
    setViewport({ x: (activeMap.largura - width) / 2, y: 0, width, height: activeMap.altura });
  }, [activeMap, canvasSize.width, canvasSize.height]);
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
  const pan = (dx: number, dy: number) => {
    if (!activeMap) return;
    setViewport((current) => ({ ...current,
      x: Math.max(0, Math.min(activeMap.largura - current.width, current.x + current.width * dx)),
      y: Math.max(0, Math.min(activeMap.altura - current.height, current.y + current.height * dy)),
    }));
  };
  const focusSelection = useCallback(() => {
    if (!activeMap || !activeArea) return;
    const path = svgRef.current?.querySelector<SVGPathElement>(`[data-area-id="${activeArea.id}"]`);
    if (!path?.getBBox) return;
    const box = path.getBBox();
    const commonStair = activeMap.areas.find((area) => area.nome === "Escada única C–D");
    const stairBox = commonStair && commonStair.id !== activeArea.id
      ? svgRef.current?.querySelector<SVGPathElement>(`[data-area-id="${commonStair.id}"]`)?.getBBox() : null;
    const target = stairBox ? {
      x: Math.min(box.x, stairBox.x), y: Math.min(box.y, stairBox.y),
      width: Math.max(box.x + box.width, stairBox.x + stairBox.width) - Math.min(box.x, stairBox.x),
      height: Math.max(box.y + box.height, stairBox.y + stairBox.height) - Math.min(box.y, stairBox.y),
    } : box;
    const aspect = canvasSize.width / canvasSize.height;
    const width = Math.min(activeMap.largura, Math.max(box.width * 3, target.width * 1.2, activeMap.largura * 0.48, box.height * 3 * aspect, activeMap.altura * 0.48 * aspect));
    const height = Math.min(activeMap.altura, width / aspect);
    setViewport({
      x: Math.max(0, Math.min(activeMap.largura - width, target.x + target.width / 2 - width / 2)),
      y: Math.max(0, Math.min(activeMap.altura - height, target.y + target.height / 2 - height / 2)),
      width, height,
    });
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
  const blocks = new Map<number, string>();
  for (const view of map.maps) {
    if (view.bloco_id) blocks.set(view.bloco_id, view.bloco_nome || `Bloco ${view.bloco_id}`);
    for (const area of view.areas) if (area.bloco_id && area.bloco_nome) blocks.set(area.bloco_id, area.bloco_nome);
  }
  const blockChoices = [...blocks].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));

  if (map.loading) return <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Carregando mapa...</div>;
  if (map.error) return <p role="alert" className="rounded-xl border bg-card p-6 text-destructive">{map.error}</p>;

  return (
    <div className="school-map space-y-4">
      <div className="school-map__search flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
        <div className="min-w-0 sm:max-w-64">
          <h3 className="font-heading text-base font-bold text-foreground sm:text-lg">Para onde você vai?</h3>
          <p className="mt-1 text-sm leading-snug text-muted-foreground">Digite uma sala ou setor para ver onde fica.</p>
        </div>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-primary" />
          <Input aria-label="Buscar uma sala ou ambiente" role="combobox" aria-expanded={Boolean(map.query)} aria-controls="map-search-results" aria-autocomplete="list"
            aria-activedescendant={map.query && map.results[resultIndex] ? `map-result-${map.results[resultIndex].key}` : undefined}
            value={map.query} placeholder="Ex.: C201, biblioteca, refeitório" className="school-map__search-input h-12 pl-11 text-base"
            onChange={(event) => { map.setQuery(event.target.value); setResultIndex(0); }}
            onKeyDown={(event) => {
              if (event.key === "Escape") map.setQuery("");
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault(); setResultIndex((index) => Math.max(0, Math.min(map.results.length - 1, index + (event.key === "ArrowDown" ? 1 : -1))));
              }
              if (event.key === "Enter" && map.results[resultIndex]) { event.preventDefault(); map.results[resultIndex].select(); }
            }} />
          {map.query && (
            <div id="map-search-results" role="listbox" aria-label="Resultados da busca" className="school-map__results absolute z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border bg-card p-1 shadow-lg">
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
      {(selectedRoom || selectedSector || activeArea) && <div className="school-map__mobile-selection flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm lg:hidden" role="status">
        <span><strong>{selectedRoom?.nome || selectedSector?.nome || activeArea?.nome.replace(/\n/g, " ")}</strong> · {activeMap && mapTitle(activeMap)}</span>
        <a href="#map-destination" className="font-medium text-primary underline underline-offset-4">{!selectedRoom && selectedSector && activeArea?.setor_id !== selectedSector.id && map.sectorLocations.length > 1 ? "Escolher local" : "Ver detalhes"}</a>
      </div>}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_288px]">
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
                {map.campus && <Button size="sm" variant={activeMap?.visao_geral ? "default" : "outline"} aria-pressed={Boolean(activeMap?.visao_geral)} onClick={map.goCampus}><Home className="h-4 w-4" /> Visão geral</Button>}
                {blockChoices.length > 0 && <select aria-label="Escolher bloco" className="school-map__block-select h-9 min-w-36 max-w-full rounded-md border bg-background px-3 text-sm"
                  value={activeMap?.visao_geral ? "" : map.navigationBlockId ?? ""} onChange={(event) => {
                    const blockId = Number(event.target.value);
                    const views = map.maps.filter((view) => !view.visao_geral && (view.bloco_id === blockId || view.areas.some((area) => area.bloco_id === blockId)));
                    const view = views.find((item) => /t[eé]rreo/i.test(item.piso ?? "")) ?? views[0];
                    if (view) map.openMap(view.id, blockId);
                  }}>
                  <option value="">Escolher bloco</option>
                  {blockChoices.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>}
              </div>
              {map.blockViews.length > 1 && !activeMap?.visao_geral && (
                <div className="school-map__floor-list flex gap-2 overflow-x-auto pb-1" aria-label="Pavimentos do mapa">
                  {map.blockViews.map((view) => (
                    <Button key={view.id} size="sm" variant={view.id === activeMap?.id ? "default" : "outline"} aria-pressed={view.id === activeMap?.id} onClick={() => map.openMap(view.id)} className="h-auto min-h-9 whitespace-normal text-left">
                      {mapTitle(view)}
                    </Button>
                  ))}
                </div>
              )}
              {activeMap && (
                <div className="school-map__frame overflow-hidden rounded-xl">
                  <div className="school-map__frame-heading flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5" aria-live="polite">
                    <h3 className="font-heading text-base font-bold sm:text-lg">{mapTitle(activeMap)}</h3>
                    <span className="text-xs font-medium">Mapa orientativo · sem escala</span>
                  </div>
                  <div className="school-map__viewport relative">
                  <svg ref={svgRef} viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`} role="group" aria-label={activeMap.nome}
                    aria-describedby={zoomed ? "school-map-pan-help" : undefined} tabIndex={zoomed ? 0 : undefined}
                    className="school-map__svg block h-[340px] w-full sm:h-[520px]" style={{ touchAction: zoomed ? "none" : "auto" }}
                    onKeyDown={(event) => {
                      const directions: Record<string, [number, number]> = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, -0.15], ArrowDown: [0, 0.15] };
                      const direction = directions[event.key];
                      if (zoomed && direction) { event.preventDefault(); pan(...direction); }
                    }}
                    onPointerDown={(event) => { if (zoomed && event.isPrimary !== false) drag.current = { x: event.clientX, y: event.clientY, moved: false }; }}
                    onPointerMove={(event) => {
                      const current = drag.current, svg = svgRef.current;
                      if (!current || !svg) return;
                      const dx = event.clientX - current.x, dy = event.clientY - current.y;
                      if (!current.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
                      svg.setPointerCapture?.(event.pointerId);
                      current.moved = true; current.x = event.clientX; current.y = event.clientY;
                      const rect = svg.getBoundingClientRect(), scale = Math.max(viewport.width / rect.width, viewport.height / rect.height);
                      setViewport((view) => ({ ...view,
                        x: Math.max(0, Math.min(activeMap.largura - view.width, view.x - dx * scale)),
                        y: Math.max(0, Math.min(activeMap.altura - view.height, view.y - dy * scale)),
                      }));
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
                      const showOnOverview = area.tipo === "BLOCO" ||
                        (canvasSize.width >= 480 && area.categoria === "PATIO") ||
                        ((area.categoria ?? "AMBIENTE") === "AMBIENTE" && /^(Museu|Ginásio)/i.test(area.nome));
                      const labelEligible = !activeMap.visao_geral || showOnOverview || selected;
                      let showLabel = false;
                      for (const name of labelEligible ? [area.nome, compactName] : []) {
                        label.length = 0;
                        for (const word of name.replace(/\s*\/\s*/g, " / ").split(/\s+/)) {
                          const last = label.length - 1;
                          if (last >= 0 && label[last].length + word.length + 1 <= maxChars) label[last] += ` ${word}`;
                          else label.push(word);
                        }
                        showLabel = label.every((line) => line.length <= maxChars) && (!box || label.length * fontSize * 1.2 <= box.height * 0.9);
                        if (showLabel) break;
                      }
                      if (activeMap.visao_geral && !box && area.tipo !== "BLOCO") showLabel = false;
                      return <g key={area.id}>
                        <path data-area-id={area.id} d={area.caminho_svg} role={interactive ? "button" : undefined} tabIndex={interactive ? 0 : undefined}
                          aria-label={area.nome} aria-pressed={interactive ? selected : undefined} onClick={interactive ? () => map.selectArea(area) : undefined}
                          onKeyDown={interactive ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); map.selectArea(area); } } : undefined}
                          data-category={area.categoria ?? "AMBIENTE"} data-kind={area.tipo} data-sector={Boolean(area.setor_id)}
                          vectorEffect="non-scaling-stroke" className={`school-map__area ${interactive ? "school-map__area--interactive" : ""} ${selected ? "is-selected" : ""}`} />
                        {showLabel && area.rotulo_x != null && area.rotulo_y != null && <text x={area.rotulo_x} y={area.rotulo_y} textAnchor="middle" dominantBaseline="middle" fontSize={fontSize}
                          className={`school-map__label pointer-events-none ${area.tipo === "BLOCO" || selected ? "font-semibold" : ""}`} aria-hidden="true">
                          {label.map((line, index) => <tspan key={index} x={area.rotulo_x!} dy={index === 0 ? -(label.length - 1) * fontSize * 0.6 : fontSize * 1.2}>{line}</tspan>)}
                        </text>}
                      </g>;
                    })}
                  </svg>
                    {zoomed && <span id="school-map-pan-help" className="school-map__pan-hint mx-3 mt-3 block w-fit rounded-md px-2.5 py-1.5 text-xs font-medium sm:absolute sm:left-3 sm:top-3 sm:m-0">Arraste ou use as setas para explorar</span>}
                    <div className="school-map__tools m-3 ml-auto flex w-fit items-center gap-1 rounded-lg p-1 shadow-sm sm:absolute sm:bottom-3 sm:right-3 sm:m-0" aria-label="Controles do mapa">
                      {activeArea && <Button size="sm" variant="ghost" aria-label="Aproximar seleção" title="Aproximar seleção" onClick={focusSelection}><LocateFixed /></Button>}
                      <Button size="sm" variant="ghost" aria-label="Ampliar mapa" title="Ampliar mapa" onClick={() => zoom(0.75)}><Plus /></Button>
                      <Button size="sm" variant="ghost" aria-label="Reduzir mapa" title="Reduzir mapa" onClick={() => zoom(1.3333)} disabled={!zoomed}><Minus /></Button>
                      <Button size="sm" variant="ghost" aria-label="Enquadrar mapa" title="Enquadrar mapa" onClick={fitMap}><RotateCcw /></Button>
                    </div>
                  </div>
                  <div className="school-map__frame-footer flex flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-3 text-xs sm:px-5">
                    <div className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Legenda do mapa">
                      <span className="flex items-center gap-2"><span className="school-map__swatch school-map__swatch--building" /> Prédios</span>
                      <span className="flex items-center gap-2"><span className="school-map__swatch school-map__swatch--yard" /> Pátios</span>
                      <span className="flex items-center gap-2"><span className="school-map__swatch school-map__swatch--route" /> Circulação</span>
                      <span className="flex items-center gap-2"><span className="school-map__swatch school-map__swatch--stairs" /> Escadas e acessos</span>
                    </div>
                    <span className="hidden sm:inline">Selecione um ambiente para ver os detalhes</span>
                  </div>
                </div>
              )}
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
            <section className="school-map__detail rounded-xl border bg-card p-5" aria-label="Detalhes da sala selecionada">
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
            <section className="school-map__detail rounded-xl border bg-card p-5" aria-label="Detalhes do setor selecionado">
              <h3 className="font-heading text-xl font-semibold">{activeArea?.setor_id === selectedSector.id ? activeArea.nome.replace(/\n/g, " ") : selectedSector.nome}</h3>
              {activeArea?.setor_id === selectedSector.id && <p className="mt-2 text-sm text-muted-foreground">{mapTitle(activeMap!)} · Setor: {selectedSector.nome}</p>}
              {activeArea?.descricao && <p className="mt-3 text-sm leading-relaxed">{activeArea.descricao}</p>}
              {!map.sectorLocations.length && <p className="mt-3 text-sm">Este setor ainda não tem uma localização identificada no mapa.</p>}
              {map.sectorLocations.length > 1 && activeArea?.setor_id !== selectedSector.id && <div className="mt-3 space-y-2"><p className="text-sm">Escolha o ambiente que procura:</p>
                {map.sectorLocations.map((location) => <Button key={location.area.id} variant="outline" size="sm" className="h-auto min-h-9 w-full justify-start whitespace-normal text-left" onClick={() => map.selectLocation(location)}>
                  {location.area.nome.replace(/\n/g, " ")} · {mapTitle(location.map)}
                </Button>)}
              </div>}
              <Button size="sm" className="mt-4" onClick={sectorDetail}>Sobre este setor</Button>
            </section>
          ) : activeArea ? (
            <section className="school-map__detail rounded-xl border bg-card p-5" aria-label="Detalhes da área selecionada">
              <h3 className="font-heading text-xl font-semibold">{activeArea.nome.replace(/\n/g, " ")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{activeMap && mapTitle(activeMap)}</p>
              {activeArea.descricao && <p className="mt-3 text-sm leading-relaxed">{activeArea.descricao}</p>}
              <Button size="sm" variant="ghost" className="mt-4" onClick={() => onReportContext?.({ origem: "MAPA", label: `${activeMap?.nome}: ${activeArea.nome}`, mapa_area_id: activeArea.id })}>
                <MessageSquareWarning className="mr-2 h-4 w-4" /> Relatar problema
              </Button>
            </section>
          ) : <div className="school-map__detail rounded-xl border bg-card p-5 text-sm leading-relaxed"><Building2 className="mb-3 h-6 w-6 text-primary" />
            <p>Busque uma sala ou setor, ou selecione um ambiente no mapa.</p><p className="mt-2 text-muted-foreground">As escadas e os acessos mostram as ligações entre os pavimentos.</p>
          </div>}
        </aside>
      </div>
    </div>
  );
};

export default SchoolMap;
