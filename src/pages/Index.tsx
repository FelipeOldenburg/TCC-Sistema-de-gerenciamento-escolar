import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import TabNavigation, { type TabId } from "@/components/TabNavigation";
import HorariosSection from "@/components/sections/HorariosSection";
import MapaSection from "@/components/sections/MapaSection";
import HistoriaSection from "@/components/sections/HistoriaSection";
import EventosSection from "@/components/sections/EventosSection";
import ProfessoresSection from "@/components/sections/ProfessoresSection";
import SetoresSection from "@/components/sections/SetoresSection";
import DocumentosSection from "@/components/sections/DocumentosSection";
import ReclamacoesSection from "@/components/sections/ReclamacoesSection";

const sectionMap: Record<TabId, React.FC> = {
  horarios: HorariosSection,
  mapa: MapaSection,
  historia: HistoriaSection,
  eventos: EventosSection,
  professores: ProfessoresSection,
  setores: SetoresSection,
  documentos: DocumentosSection,
  reclamacoes: ReclamacoesSection,
};

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>("horarios");
  const Section = sectionMap[activeTab];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="container max-w-7xl py-6 px-4">
        <Section />
      </main>
    </div>
  );
};

export default Index;
