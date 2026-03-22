import { User } from "lucide-react";
import cimolLogo from "@/assets/cimol-logo.png";

const AppHeader = () => {
  return (
    <header className="bg-header px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img src={cimolLogo} alt="CIMOL" className="w-10 h-10 rounded-md" />
        <h1 className="text-primary-foreground font-heading font-bold text-lg md:text-xl">
          Escola Técnica Estadual Monteiro Lobato
          <span className="hidden md:inline text-primary-foreground/70 font-normal text-base ml-2">
            — Sistema de Gestão Escolar
          </span>
        </h1>
      </div>
      <button className="w-10 h-10 rounded-full border-2 border-primary-foreground/30 flex items-center justify-center text-primary-foreground/70 hover:border-primary-foreground/60 hover:text-primary-foreground transition-colors">
        <User className="w-5 h-5" />
      </button>
    </header>
  );
};

export default AppHeader;
