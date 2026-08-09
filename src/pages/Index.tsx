import { useEffect, useRef, useState } from "react";
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

const HOME_TAB_STORAGE_KEY = "cimol_home_tab";
const HOME_SCROLL_STORAGE_KEY = "cimol_home_scroll";

const isHomeTab = (tab: string | null): tab is TabId =>
  Boolean(tab && tab in sectionMap);

const readStoredHomeTab = (): TabId => {
  const hashTab = window.location.hash.replace("#", "");
  if (isHomeTab(hashTab)) return hashTab;

  const storedTab = localStorage.getItem(HOME_TAB_STORAGE_KEY);
  return isHomeTab(storedTab) ? storedTab : "horarios";
};

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>(readStoredHomeTab);
  const initialScroll = useRef(Number(localStorage.getItem(HOME_SCROLL_STORAGE_KEY)) || 0);
  const Section = sectionMap[activeTab];

  useEffect(() => {
    const scrollY = initialScroll.current;
    if (!scrollY) return;

    const restoreScroll = () => window.scrollTo(0, scrollY);
    const firstTimeout = window.setTimeout(restoreScroll, 0);
    const secondTimeout = window.setTimeout(restoreScroll, 250);
    return () => {
      window.clearTimeout(firstTimeout);
      window.clearTimeout(secondTimeout);
    };
  }, []);

  useEffect(() => {
    const saveScroll = () => localStorage.setItem(HOME_SCROLL_STORAGE_KEY, String(window.scrollY));
    const saveState = () => {
      localStorage.setItem(HOME_TAB_STORAGE_KEY, activeTab);
      saveScroll();
    };

    if (window.location.hash !== `#${activeTab}`) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${activeTab}`);
    }

    localStorage.setItem(HOME_TAB_STORAGE_KEY, activeTab);
    window.addEventListener("scroll", saveScroll, { passive: true });
    window.addEventListener("beforeunload", saveState);
    return () => {
      window.removeEventListener("scroll", saveScroll);
      window.removeEventListener("beforeunload", saveState);
    };
  }, [activeTab]);

  const handleTabChange = (tab: TabId) => {
    localStorage.setItem(HOME_TAB_STORAGE_KEY, tab);
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />
      <main className="container max-w-7xl mx-auto py-6 px-4">
        <Section />
      </main>
    </div>
  );
};

export default Index;
