import mapaEscola from "@/assets/mapa-escola.png";
import { MapPin } from "lucide-react";

const MapaSection = () => {
  return (
    <div className="animate-fade-in">
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-heading font-bold text-card-foreground">Mapa da Escola</h2>
            <p className="text-sm text-muted-foreground">Visualização da estrutura física</p>
          </div>
        </div>
        <div className="rounded-xl overflow-hidden bg-muted/30 flex items-center justify-center p-4">
          <img
            src={mapaEscola}
            alt="Mapa 3D da Escola Técnica Monteiro Lobato"
            className="w-full max-w-3xl object-contain rounded-lg"
          />
        </div>
      </div>
    </div>
  );
};

export default MapaSection;
