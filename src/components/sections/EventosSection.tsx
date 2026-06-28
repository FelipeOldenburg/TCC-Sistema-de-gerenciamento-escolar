import { useEffect, useState } from "react";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import { apiFetch } from "@/lib/api";
import eventoPingpong from "@/assets/evento-pingpong.jpg";
import eventoTalentos from "@/assets/evento-talentos.jpg";
import eventoFeira from "@/assets/evento-feira.jpg";

type Evento = {
  id: number;
  titulo: string;
  descricao: string | null;
  data_evento: string;
  hora_evento: string | null;
  local: string | null;
  imagem_url: string | null;
};

const fallbackImages = [eventoPingpong, eventoTalentos, eventoFeira];

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
            className="glass-card glass-card-hover rounded-2xl overflow-hidden group"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="relative h-52 overflow-hidden">
              <img
                src={evento.imagem_url || fallbackImages[index % fallbackImages.length]}
                alt={evento.titulo}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/90 via-foreground/25 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <h3 className="text-primary-foreground font-heading font-bold text-lg leading-tight">{evento.titulo}</h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-primary-foreground/85 text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-accent" />
                    {formatDate(evento.data_evento)}
                  </span>
                  {evento.hora_evento && (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-accent" />
                      {evento.hora_evento}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="p-5 space-y-3">
              {evento.descricao && <p className="text-sm text-muted-foreground leading-relaxed">{evento.descricao}</p>}
              {evento.local && (
                <p className="text-sm text-card-foreground inline-flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
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
