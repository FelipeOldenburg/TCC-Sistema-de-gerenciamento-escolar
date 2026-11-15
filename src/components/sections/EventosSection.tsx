import { useEffect, useState } from "react";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Evento = {
  id: number;
  titulo: string;
  descricao: string | null;
  data_evento: string;
  hora_evento: string | null;
  local: string | null;
};

const eventGradients = [
  "from-blue-700 via-indigo-600 to-cyan-500",
  "from-violet-700 via-fuchsia-600 to-rose-500",
  "from-emerald-700 via-teal-600 to-sky-500",
  "from-amber-600 via-orange-600 to-rose-600",
];

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(
    new Date(`${value}T00:00:00`)
  );

const EventosSection = () => {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<Evento[]>("/api/eventos")
      .then((data) => {
        setEventos(data);
        setError("");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar eventos."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <CalendarDays className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">Eventos</h2>
          <p className="text-sm text-muted-foreground">Próximos eventos da escola</p>
        </div>
      </div>

      {loading && <div className="glass-card rounded-xl p-10 text-center text-muted-foreground">Carregando eventos...</div>}
      {error && <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}
      {!loading && !error && !eventos.length && (
        <div className="glass-card rounded-xl p-10 text-center">
          <p className="font-medium text-foreground">Nenhum evento publicado.</p>
          <p className="text-sm text-muted-foreground mt-1">Novas atividades aparecerão aqui assim que forem cadastradas.</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {eventos.map((evento, index) => (
          <article
            key={evento.id}
            className="glass-card glass-card-hover rounded-2xl overflow-hidden"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className={`relative flex min-h-52 flex-col justify-between overflow-hidden bg-gradient-to-br p-5 text-white ${eventGradients[evento.id % eventGradients.length]}`}>
              <div aria-hidden="true" className="absolute -right-8 -top-12 h-40 w-40 rounded-full border-[24px] border-white/10" />
              <div className="relative flex items-start justify-between gap-4">
                <CalendarDays aria-hidden="true" className="h-8 w-8 opacity-85" />
                <time dateTime={evento.data_evento} className="rounded-xl border border-white/25 bg-white/15 px-3 py-2 text-right shadow-sm backdrop-blur-sm">
                  <span className="block text-2xl font-bold leading-none">{new Date(`${evento.data_evento}T00:00:00`).getDate()}</span>
                  <span className="mt-1 block text-xs font-semibold uppercase tracking-wider">
                    {new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(new Date(`${evento.data_evento}T00:00:00`)).replace(".", "")}
                  </span>
                </time>
              </div>
              <div className="relative">
                <h3 className="font-heading text-lg font-bold leading-tight">{evento.titulo}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/90">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
                    {formatDate(evento.data_evento)}
                  </span>
                  {evento.hora_evento && <span className="inline-flex items-center gap-1.5"><Clock aria-hidden="true" className="h-3.5 w-3.5" />{evento.hora_evento}</span>}
                </div>
              </div>
            </div>
            <div className="p-5 space-y-3">
              {evento.descricao && <p className="text-sm text-muted-foreground leading-relaxed">{evento.descricao}</p>}
              {evento.local && (
                <p className="text-sm text-card-foreground inline-flex items-center gap-2">
                  <MapPin aria-hidden="true" className="w-4 h-4 text-primary" />
                  {evento.local}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default EventosSection;
