import { User, Settings, Compass } from "lucide-react";
import { Link } from "react-router-dom";

const AppHeader = () => {
  return (
    <header className="bg-header px-4 md:px-6 py-3 flex items-center justify-between shadow-lg relative z-20">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-lg bg-accent/20 p-0.5 ring-2 ring-accent/30 flex items-center justify-center">
          <Compass className="w-6 h-6 text-accent" />
        </div>
        <div>
          <h1 className="text-primary-foreground font-heading font-bold text-base md:text-lg leading-tight">
            Design Compass
          </h1>
          <p className="hidden md:block text-primary-foreground/60 text-xs leading-tight">
            Sistema de Gestão e Navegação
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          to="/admin"
          className="w-10 h-10 rounded-xl bg-primary-foreground/10 flex items-center justify-center text-primary-foreground/70 hover:bg-primary-foreground/20 hover:text-primary-foreground transition-all"
          title="Painel Administrativo"
        >
          <Settings className="w-5 h-5" />
        </Link>
        <button className="w-10 h-10 rounded-xl bg-primary-foreground/10 flex items-center justify-center text-primary-foreground/70 hover:bg-primary-foreground/20 hover:text-primary-foreground transition-all">
          <User className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};

export default AppHeader;
