import { CalendarDays } from "lucide-react";
import eventoPingpong from "@/assets/evento-pingpong.jpg";
import eventoTalentos from "@/assets/evento-talentos.jpg";
import eventoFeira from "@/assets/evento-feira.jpg";

const eventos = [
  { titulo: "Campeonato de Ping Pong", data: "12/09/2025", imagem: eventoPingpong },
  { titulo: "Show de Talentos", data: "25/09/2025", imagem: eventoTalentos },
  { titulo: "Feira de Ciências", data: "10/10/2025", imagem: eventoFeira },
];

const EventosSection = () => {
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
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {eventos.map((evento, i) => (
          <div
            key={i}
            className="glass-card glass-card-hover rounded-2xl overflow-hidden group"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="relative h-52 overflow-hidden">
              <img
                src={evento.imagem}
                alt={evento.titulo}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/90 via-foreground/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <h3 className="text-primary-foreground font-heading font-bold text-lg leading-tight">{evento.titulo}</h3>
                <div className="flex items-center gap-1.5 mt-2">
                  <CalendarDays className="w-3.5 h-3.5 text-accent" />
                  <span className="text-primary-foreground/80 text-sm">{evento.data}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EventosSection;
