import { User } from "lucide-react";

const professores = [
  { nome: "Prof. Fernando Silva", area: "Informática", email: "fernando@cimol.edu.br" },
  { nome: "Prof. Maria Santos", area: "Mecânica", email: "maria@cimol.edu.br" },
  { nome: "Prof. Carlos Oliveira", area: "Química", email: "carlos@cimol.edu.br" },
  { nome: "Prof. Ana Costa", area: "Eletrônica", email: "ana@cimol.edu.br" },
  { nome: "Prof. Ricardo Lima", area: "Eletrotécnica", email: "ricardo@cimol.edu.br" },
  { nome: "Prof. Juliana Pereira", area: "Meio Ambiente", email: "juliana@cimol.edu.br" },
  { nome: "Prof. Roberto Ferreira", area: "Design de Móveis", email: "roberto@cimol.edu.br" },
  { nome: "Prof. Luciana Alves", area: "Matemática", email: "luciana@cimol.edu.br" },
];

const ProfessoresSection = () => {
  return (
    <div className="animate-fade-in">
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <h2 className="text-2xl font-heading font-bold text-card-foreground mb-6">Professores</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {professores.map((prof, i) => (
            <div key={i} className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-card-foreground text-sm truncate">{prof.nome}</p>
                <p className="text-xs text-muted-foreground">{prof.area}</p>
                <p className="text-xs text-primary truncate">{prof.email}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProfessoresSection;
