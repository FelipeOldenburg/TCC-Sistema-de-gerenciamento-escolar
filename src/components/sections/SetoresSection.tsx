import { useEffect, useState } from "react";
import {
  BookOpen,
  Building2,
  Coffee,
  FlaskConical,
  GraduationCap,
  MapPin,
  Monitor,
  MessageSquareWarning,
  Shield,
  Users,
  Wrench,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { ReportContext } from "@/components/sections/ReclamacoesSection";
import { mapTitle, type MapView } from "@/controllers/useSchoolMap";

type Setor = {
  id: number;
  nome: string;
  descricao: string;
  responsavel: string | null;
  localizacao: string | null;
  contato: string | null;
  horario_atendimento: string | null;
  icone: string;
  cor: string;
  mapa_id: number | null;
  mapa_area_id: number | null;
  mapa_nome: string | null;
};

const iconMap = {
  building: Building2,
  graduation: GraduationCap,
  book: BookOpen,
  flask: FlaskConical,
  wrench: Wrench,
  coffee: Coffee,
  shield: Shield,
  monitor: Monitor,
  users: Users,
} as const;

const colorMap: Record<string, string> = {
  blue: "from-blue-600 to-blue-400",
  violet: "from-violet-500 to-purple-400",
  amber: "from-amber-500 to-yellow-400",
  emerald: "from-emerald-500 to-teal-400",
  slate: "from-gray-600 to-gray-400",
  orange: "from-orange-500 to-amber-400",
  indigo: "from-indigo-500 to-blue-400",
  cyan: "from-cyan-500 to-sky-400",
  rose: "from-rose-500 to-pink-400",
};

const SetoresSection = ({ selectedSectorId, selectedMapAreaId, onViewMap, onReportContext }: {
  selectedSectorId?: number | null;
  selectedMapAreaId?: number | null;
  onViewMap?: (areaId: number) => void;
  onReportContext?: (context: ReportContext) => void;
}) => {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [maps, setMaps] = useState<MapView[]>([]);

  useEffect(() => {
    apiFetch<Setor[]>("/api/setores")
      .then((data) => {
        setSetores(data);
        setError("");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar setores."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch<MapView[]>("/api/mapas").then((data) => { if (active) setMaps(data); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (selectedSectorId && setores.length) {
      const card = document.getElementById(`setor-${selectedSectorId}`);
      card?.focus({ preventScroll: true });
      card?.scrollIntoView({ block: "center" });
    }
  }, [selectedSectorId, setores]);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">Setores</h2>
          <p className="text-sm text-muted-foreground">Organização interna da escola</p>
        </div>
      </div>

      {loading && <div className="glass-card rounded-xl p-10 text-center text-muted-foreground">Carregando setores...</div>}
      {error && <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}
      {!loading && !error && !setores.length && (
        <div className="glass-card rounded-xl p-10 text-center text-muted-foreground">Nenhum setor publicado.</div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {setores.map((setor, index) => {
          const Icon = iconMap[setor.icone as keyof typeof iconMap] || Building2;
          const color = colorMap[setor.cor] || colorMap.blue;
          const locations = maps.flatMap((map) => (map.areas || []).filter((area) => area.setor_id === setor.id).map((area) => ({ map, area })));
          const preferred = setor.id === selectedSectorId ? locations.find(({ area }) => area.id === selectedMapAreaId) : undefined;
          const returnAreaId = preferred?.area.id ?? (!maps.length && setor.id === selectedSectorId ? selectedMapAreaId : null);
          return (
            <article
              key={setor.id}
              id={`setor-${setor.id}`}
              tabIndex={-1}
              className={`glass-card glass-card-hover rounded-xl p-6 space-y-4 ${selectedSectorId === setor.id ? "ring-2 ring-primary" : ""}`}
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg shrink-0`}>
                  <Icon className="w-7 h-7 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-heading font-bold text-card-foreground">{setor.nome}</h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{setor.descricao}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                {setor.localizacao && (
                  <p className="flex items-center gap-2 text-card-foreground">
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    {setor.localizacao}
                  </p>
                )}
                {setor.responsavel && <p><span className="font-medium">Responsável:</span> {setor.responsavel}</p>}
                {setor.horario_atendimento && <p><span className="font-medium">Atendimento:</span> {setor.horario_atendimento}</p>}
                {setor.contato && <p><span className="font-medium">Contato:</span> {setor.contato}</p>}
              </div>
              <div className="flex flex-wrap gap-2 border-t pt-3">
                {(returnAreaId || locations.length === 1 || (!maps.length && setor.mapa_area_id)) && (
                  <Button size="sm" variant="outline" onClick={() => onViewMap?.(returnAreaId ?? locations[0]?.area.id ?? setor.mapa_area_id!)}>
                    <MapPin className="mr-1 h-4 w-4" /> {returnAreaId ? "Voltar ao mapa" : "Ver no mapa"}
                  </Button>
                )}
                {locations.length > 1 && <details className="w-full text-sm">
                  <summary className="cursor-pointer py-2 font-medium">Ver locais no mapa ({locations.length})</summary>
                  <div className="mt-2 space-y-2">{locations.map(({ map, area }) => (
                    <Button key={area.id} size="sm" variant="outline" className="h-auto min-h-9 w-full justify-start whitespace-normal text-left" onClick={() => onViewMap?.(area.id)}>
                      {area.nome.replace(/\n/g, " ")} · {mapTitle(map)}
                    </Button>
                  ))}</div>
                </details>}
                <Button size="sm" variant="ghost" onClick={() => onReportContext?.({ origem: "SETOR", label: setor.nome, setor_id: setor.id })}>
                  <MessageSquareWarning className="mr-1 h-4 w-4" /> Relatar problema
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default SetoresSection;
