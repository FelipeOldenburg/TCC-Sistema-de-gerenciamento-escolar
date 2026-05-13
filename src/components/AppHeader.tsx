import { User } from "lucide-react";
import { Link } from "react-router-dom";
import cimolLogo from "@/assets/cimol-logo.png";

const AppHeader = () => {
  return (
    <header className="bg-header px-4 md:px-6 py-3 flex items-center justify-between shadow-lg relative z-20">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-lg overflow-hidden bg-accent/20 p-0.5 ring-2 ring-accent/30">
          <img src={cimolLogo} alt="CIMOL" className="w-full h-full object-contain" />
        </div>
        <div>
          <h1 className="text-primary-foreground font-heading font-bold text-base md:text-lg leading-tight">
            CIMOL
          </h1>
          <p className="hidden md:block text-primary-foreground/60 text-xs leading-tight">
            Sistema de Gestão Escolar
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          to="/admin"
          className="w-10 h-10 rounded-xl bg-primary-foreground/10 flex items-center justify-center text-primary-foreground/70 hover:bg-primary-foreground/20 hover:text-primary-foreground transition-all"
          title="Perfil e Configurações"
        >
          <User className="w-5 h-5" />
        </Link>
      </div>
    </header>
  );
};

export default AppHeader;
