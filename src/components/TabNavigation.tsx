import { Calendar, MapPin, BookOpen, CalendarDays, Users, Building2, FileText, MessageSquareWarning } from "lucide-react";
import { useRef, useEffect } from "react";

const tabs = [
  { id: "horarios", label: "Horários", icon: Calendar },
  { id: "mapa", label: "Mapa", icon: MapPin },
  { id: "historia", label: "História", icon: BookOpen },
  { id: "eventos", label: "Eventos", icon: CalendarDays },
  { id: "professores", label: "Professores", icon: Users },
  { id: "setores", label: "Setores", icon: Building2 },
  { id: "documentos", label: "Documentos", icon: FileText },
  { id: "reclamacoes", label: "Feedback", icon: MessageSquareWarning },
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
      <div className="flex min-w-max px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={isActive ? activeRef : null}
              onClick={() => onTabChange(tab.id)}
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
    </nav>
  );
};

export default TabNavigation;
