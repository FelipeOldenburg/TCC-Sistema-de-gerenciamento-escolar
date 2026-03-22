import { Building2, BookOpen, FlaskConical, Wrench, GraduationCap, HeartPulse, Coffee, Shield } from "lucide-react";

const setores = [
  { nome: "Direção", descricao: "Gestão e administração escolar", icon: Building2 },
  { nome: "Coordenação Pedagógica", descricao: "Acompanhamento dos cursos", icon: GraduationCap },
  { nome: "Biblioteca", descricao: "Acervo e sala de estudo", icon: BookOpen },
  { nome: "Laboratórios", descricao: "Labs técnicos e científicos", icon: FlaskConical },
  { nome: "Oficinas", descricao: "Práticas de mecânica e marcenaria", icon: Wrench },
  { nome: "Enfermaria", descricao: "Atendimento à saúde", icon: HeartPulse },
  { nome: "Cantina", descricao: "Alimentação e convivência", icon: Coffee },
  { nome: "Segurança", descricao: "Portaria e vigilância", icon: Shield },
];

const SetoresSection = () => {
  return (
    <div className="animate-fade-in">
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <h2 className="text-2xl font-heading font-bold text-card-foreground mb-6">Setores</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {setores.map((setor, i) => {
            const Icon = setor.icon;
            return (
              <div key={i} className="p-5 rounded-lg border border-border hover:shadow-md transition-shadow text-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-heading font-bold text-card-foreground">{setor.nome}</h3>
                <p className="text-sm text-muted-foreground">{setor.descricao}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SetoresSection;
