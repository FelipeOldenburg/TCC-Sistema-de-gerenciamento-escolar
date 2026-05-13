import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import TabNavigation, { type TabId } from "@/components/TabNavigation";
import HorariosSection from "@/components/sections/HorariosSection";
import MapaSection from "@/components/sections/MapaSection";
import EventosSection from "@/components/sections/EventosSection";
import SetoresSection from "@/components/sections/SetoresSection";
import ReclamacoesSection from "@/components/sections/ReclamacoesSection";

const sectionMap: Record<TabId, React.FC> = {
  horarios: HorariosSection,
  mapa: MapaSection,
  eventos: EventosSection,
  setores: SetoresSection,
  reclamacoes: ReclamacoesSection,
};

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>("horarios");
  const Section = sectionMap[activeTab];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="container max-w-7xl mx-auto py-6 px-4">
        <Section />
      </main>
    </div>
  );
};

export default Index;
