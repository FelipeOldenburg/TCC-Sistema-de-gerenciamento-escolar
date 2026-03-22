import { Calendar, MapPin, BookOpen, CalendarDays, Users, Building2, FileText, MessageSquareWarning } from "lucide-react";

const tabs = [
  { id: "horarios", label: "HORÁRIOS", icon: Calendar },
  { id: "mapa", label: "MAPA", icon: MapPin },
  { id: "historia", label: "HISTÓRIA", icon: BookOpen },
  { id: "eventos", label: "EVENTOS", icon: CalendarDays },
  { id: "professores", label: "PROFESSORES", icon: Users },
  { id: "setores", label: "SETORES", icon: Building2 },
  { id: "documentos", label: "DOCUMENTOS", icon: FileText },
  { id: "reclamacoes", label: "RECLAMAÇÕES", icon: MessageSquareWarning },
] as const;

export type TabId = (typeof tabs)[number]["id"];

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TabNavigation = ({ activeTab, onTabChange }: TabNavigationProps) => {
  return (
    <nav className="bg-nav overflow-x-auto">
      <div className="flex min-w-max">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-all relative whitespace-nowrap ${
                isActive
                  ? "bg-nav-active text-primary-foreground"
                  : "text-primary-foreground/70 hover:text-primary-foreground hover:bg-nav-active/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-accent rounded-t-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default TabNavigation;
