import { Building2, BookOpen, FlaskConical, Wrench, GraduationCap, Coffee, Shield } from "lucide-react";

const setores = [
  { nome: "Direção", descricao: "Gestão e administração escolar", icon: Building2, cor: "from-blue-600 to-blue-400" },
  { nome: "Coord. Pedagógica", descricao: "Acompanhamento dos cursos", icon: GraduationCap, cor: "from-violet-500 to-purple-400" },
  { nome: "Biblioteca", descricao: "Acervo e sala de estudo", icon: BookOpen, cor: "from-amber-500 to-yellow-400" },
  { nome: "Laboratórios", descricao: "Labs técnicos e científicos", icon: FlaskConical, cor: "from-emerald-500 to-teal-400" },
  { nome: "Oficinas", descricao: "Práticas de mecânica e marcenaria", icon: Wrench, cor: "from-gray-600 to-gray-400" },
  { nome: "Cantina", descricao: "Alimentação e convivência", icon: Coffee, cor: "from-orange-500 to-amber-400" },
  { nome: "Segurança", descricao: "Portaria e vigilância", icon: Shield, cor: "from-indigo-500 to-blue-400" },
];

const SetoresSection = () => {
  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">Setores</h2>
          <p className="text-sm text-muted-foreground">Organização interna da escola</p>
        </div>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {setores.map((setor, i) => {
          const Icon = setor.icon;
          return (
            <div
              key={i}
              className="glass-card glass-card-hover rounded-xl p-6 text-center space-y-4"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${setor.cor} flex items-center justify-center mx-auto shadow-lg`}>
                <Icon className="w-7 h-7 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-card-foreground">{setor.nome}</h3>
                <p className="text-sm text-muted-foreground mt-1">{setor.descricao}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SetoresSection;
