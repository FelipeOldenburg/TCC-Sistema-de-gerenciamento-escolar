import { Map } from "lucide-react";
import SchoolMap from "@/components/SchoolMap";

const MapaSection = () => {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Map className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-heading font-bold text-card-foreground">Mapa da escola</h2>
          <p className="mt-1 text-sm text-muted-foreground">Encontre blocos, pavimentos e salas com facilidade.</p>
        </div>
      </div>

      <SchoolMap />
    </div>
  );
};

export default MapaSection;
