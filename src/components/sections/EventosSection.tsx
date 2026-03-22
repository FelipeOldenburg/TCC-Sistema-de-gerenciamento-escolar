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
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <h2 className="text-2xl font-heading font-bold text-card-foreground mb-6">Eventos</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {eventos.map((evento, i) => (
            <div
              key={i}
              className="rounded-lg overflow-hidden border border-border group hover:shadow-lg transition-shadow"
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src={evento.imagem}
                  alt={evento.titulo}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="text-primary-foreground font-heading font-bold text-lg">{evento.titulo}</h3>
                  <span className="text-primary-foreground/80 text-sm">{evento.data}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EventosSection;
