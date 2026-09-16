import { useEffect, useRef, useState } from "react";
import { homeTabIds, type HomeTabId } from "@/models/homeTabs";

const HOME_TAB_STORAGE_KEY = "cimol_home_tab";
const HOME_SCROLL_STORAGE_KEY = "cimol_home_scroll";

const isHomeTab = (tab: string | null): tab is HomeTabId => Boolean(tab && homeTabIds.includes(tab as HomeTabId));

const readStoredHomeTab = (): HomeTabId => {
  const hashTab = window.location.hash.replace("#", "");
  if (isHomeTab(hashTab)) return hashTab;

  const storedTab = localStorage.getItem(HOME_TAB_STORAGE_KEY);
  return isHomeTab(storedTab) ? storedTab : "horarios";
};

export const useHomeController = () => {
  const [activeTab, setActiveTab] = useState<HomeTabId>(readStoredHomeTab);
  const initialScroll = useRef(Number(localStorage.getItem(HOME_SCROLL_STORAGE_KEY)) || 0);

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

  const handleTabChange = (tab: HomeTabId) => {
    localStorage.setItem(HOME_TAB_STORAGE_KEY, tab);
    setActiveTab(tab);
  };

  return { activeTab, handleTabChange };
};
