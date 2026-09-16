import AppHeader from "@/components/AppHeader";
import TabNavigation from "@/components/TabNavigation";
import HorariosSection from "@/components/sections/HorariosSection";
import MapaSection from "@/components/sections/MapaSection";
import EventosSection from "@/components/sections/EventosSection";
import SetoresSection from "@/components/sections/SetoresSection";
import ReclamacoesSection from "@/components/sections/ReclamacoesSection";
import { ProblemReportDialog, type ReportContext } from "@/components/sections/ReclamacoesSection";
import { useHomeController } from "@/controllers/useHomeController";
import { useState } from "react";

const Index = () => {
  const { activeTab, handleTabChange } = useHomeController();
  const [reportContext, setReportContext] = useState<ReportContext | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const [selectedSectorId, setSelectedSectorId] = useState<number | null>(null);

  const section = activeTab === "horarios"
    ? <HorariosSection onReportContext={setReportContext} />
    : activeTab === "mapa"
      ? <MapaSection selectedAreaId={selectedAreaId} onReportContext={setReportContext} onSelectSector={(id) => { setSelectedSectorId(id); handleTabChange("setores"); }} />
      : activeTab === "eventos"
        ? <EventosSection />
        : activeTab === "setores"
          ? <SetoresSection selectedSectorId={selectedSectorId} onReportContext={setReportContext} onViewMap={(id) => { setSelectedAreaId(id); handleTabChange("mapa"); }} />
          : <ReclamacoesSection />;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />
      <main className="container max-w-7xl mx-auto py-6 px-4">
        {section}
      </main>
      <ProblemReportDialog context={reportContext} onOpenChange={(open) => { if (!open) setReportContext(null); }} />
    </div>
  );
};

export default Index;
