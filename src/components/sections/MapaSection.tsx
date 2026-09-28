import { Map } from "lucide-react";
import SchoolMap from "@/components/SchoolMap";
import type { ReportContext } from "@/components/sections/ReclamacoesSection";

const MapaSection = ({ selectedAreaId, onSelectSector, onReportContext }: {
  selectedAreaId?: number | null;
  onSelectSector?: (sectorId: number, areaId?: number) => void;
  onReportContext?: (context: ReportContext) => void;
}) => {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Map className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-heading font-bold text-card-foreground">Mapa da escola</h2>
          <p className="mt-1 text-sm text-muted-foreground">Localize salas, setores e os acessos entre os blocos.</p>
        </div>
      </div>

      <SchoolMap selectedAreaId={selectedAreaId} onSelectSector={onSelectSector} onReportContext={onReportContext} />
    </div>
  );
};

export default MapaSection;
