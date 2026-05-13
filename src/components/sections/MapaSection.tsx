import { MapPin } from "lucide-react";
import Map3D from "@/components/Map3DNew";

const MapaSection = () => {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <MapPin className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-heading font-bold text-card-foreground">Mapa 3D da Escola</h2>
          <p className="text-sm text-muted-foreground">Visualização interativa com rotação contínua</p>
        </div>
      </div>

      <Map3D />
    </div>
  );
};

export default MapaSection;
