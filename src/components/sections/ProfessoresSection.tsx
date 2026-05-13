import { Users, Mail } from "lucide-react";

const professores = [
  { nome: "Prof. Fernando Silva", area: "Informática", email: "fernando@instituicao.edu.br" },
  { nome: "Prof. Maria Santos", area: "Mecânica", email: "maria@instituicao.edu.br" },
  { nome: "Prof. Carlos Oliveira", area: "Química", email: "carlos@instituicao.edu.br" },
  { nome: "Prof. Ana Costa", area: "Eletrônica", email: "ana@instituicao.edu.br" },
  { nome: "Prof. Ricardo Lima", area: "Eletrotécnica", email: "ricardo@instituicao.edu.br" },
  { nome: "Prof. Juliana Pereira", area: "Meio Ambiente", email: "juliana@instituicao.edu.br" },
  { nome: "Prof. Roberto Ferreira", area: "Design de Móveis", email: "roberto@instituicao.edu.br" },
  { nome: "Prof. Luciana Alves", area: "Matemática", email: "luciana@instituicao.edu.br" },
];

const getInitials = (name: string) => {
  return name.replace("Prof. ", "").split(" ").map(n => n[0]).join("").slice(0, 2);
};

const colors = [
  "from-blue-500 to-cyan-400",
  "from-rose-500 to-pink-400",
  "from-emerald-500 to-teal-400",
  "from-violet-500 to-purple-400",
  "from-amber-500 to-yellow-400",
  "from-green-600 to-emerald-400",
  "from-orange-500 to-amber-400",
  "from-indigo-500 to-blue-400",
];

const ProfessoresSection = () => {
  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">Professores</h2>
          <p className="text-sm text-muted-foreground">Corpo docente da escola</p>
        </div>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {professores.map((prof, i) => (
          <div
            key={i}
            className="glass-card glass-card-hover rounded-xl p-5 flex flex-col items-center gap-3 text-center"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${colors[i]} flex items-center justify-center shadow-lg`}>
              <span className="text-primary-foreground font-bold text-sm">{getInitials(prof.nome)}</span>
            </div>
            <div className="min-w-0 w-full">
              <p className="font-semibold text-card-foreground text-sm truncate">{prof.nome}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{prof.area}</p>
              <div className="flex items-center justify-center gap-1 mt-2 text-xs text-primary">
                <Mail className="w-3 h-3" />
                <span className="truncate">{prof.email}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProfessoresSection;
