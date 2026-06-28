import { Calendar, MapPin, CalendarDays, Building2, MessageSquareWarning } from "lucide-react";
import { useRef, useEffect } from "react";

const tabs = [
  { id: "horarios", label: "Horários", icon: Calendar },
  { id: "mapa", label: "Mapa", icon: MapPin },
  { id: "eventos", label: "Eventos", icon: CalendarDays },
  { id: "setores", label: "Setores", icon: Building2 },
  { id: "reclamacoes", label: "Ouvidoria", icon: MessageSquareWarning },
] as const;

export type TabId = (typeof tabs)[number]["id"];

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TabNavigation = ({ activeTab, onTabChange }: TabNavigationProps) => {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeTab]);

  return (
    <nav className="bg-nav overflow-x-auto scrollbar-hide shadow-md relative z-10">
      <div className="container max-w-7xl mx-auto px-4">
        <div className="flex justify-center min-w-max">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={isActive ? activeRef : null}
              onClick={() => onTabChange(tab.id)}
              aria-label={tab.label}
              aria-pressed={isActive}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all relative whitespace-nowrap rounded-t-lg mt-1 ${
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/5"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>
      </div>
    </nav>
  );
};

export default TabNavigation;
