import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Users, Calendar, FileText, CalendarDays, Building2, BarChart3, Plus, Edit, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import cimolLogo from "@/assets/cimol-logo.png";

type AdminTab = "dashboard" | "horarios" | "professores" | "eventos" | "documentos" | "setores";

const sidebarItems = [
  { id: "dashboard" as AdminTab, label: "Dashboard", icon: BarChart3 },
  { id: "horarios" as AdminTab, label: "Horários", icon: Calendar },
  { id: "professores" as AdminTab, label: "Professores", icon: Users },
  { id: "eventos" as AdminTab, label: "Eventos", icon: CalendarDays },
  { id: "documentos" as AdminTab, label: "Documentos", icon: FileText },
  { id: "setores" as AdminTab, label: "Setores", icon: Building2 },
];

const stats = [
  { label: "Alunos Matriculados", valor: "847", mudanca: "+12%", icon: Users, cor: "from-blue-500 to-cyan-400" },
  { label: "Professores Ativos", valor: "42", mudanca: "+2", icon: Users, cor: "from-emerald-500 to-teal-400" },
  { label: "Turmas Ativas", valor: "32", mudanca: "=", icon: Calendar, cor: "from-violet-500 to-purple-400" },
  { label: "Eventos este mês", valor: "5", mudanca: "+3", icon: CalendarDays, cor: "from-amber-500 to-yellow-400" },
];

const recentActivities = [
  { acao: "Horário atualizado", detalhe: "Turma 62-1 — Informática", tempo: "2 min atrás" },
  { acao: "Novo professor cadastrado", detalhe: "Prof. Ana Paula — Química", tempo: "15 min atrás" },
  { acao: "Evento criado", detalhe: "Feira de Ciências 2025", tempo: "1h atrás" },
  { acao: "Documento enviado", detalhe: "Calendário Acadêmico 2025", tempo: "3h atrás" },
  { acao: "Turma criada", detalhe: "71-2 — Mecânica", tempo: "5h atrás" },
];

const DashboardContent = () => (
  <div className="space-y-6 animate-fade-in">
    <div>
      <h2 className="text-2xl font-heading font-bold text-foreground">Dashboard</h2>
      <p className="text-muted-foreground text-sm">Visão geral do sistema</p>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <div key={i} className="glass-card rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.cor} flex items-center justify-center`}>
                <Icon className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">{stat.mudanca}</span>
            </div>
            <div>
              <p className="text-2xl font-heading font-bold text-foreground">{stat.valor}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        );
      })}
    </div>
    <div className="glass-card rounded-2xl p-6">
      <h3 className="font-heading font-bold text-foreground mb-4">Atividade Recente</h3>
      <div className="space-y-3">
        {recentActivities.map((act, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
            <div>
              <p className="font-medium text-sm text-foreground">{act.acao}</p>
              <p className="text-xs text-muted-foreground">{act.detalhe}</p>
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">{act.tempo}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const ProfessoresAdmin = () => {
  const profs = [
    { id: 1, nome: "Fernando Silva", area: "Informática", email: "fernando@cimol.edu.br", status: "Ativo" },
    { id: 2, nome: "Maria Santos", area: "Mecânica", email: "maria@cimol.edu.br", status: "Ativo" },
    { id: 3, nome: "Carlos Oliveira", area: "Química", email: "carlos@cimol.edu.br", status: "Ativo" },
    { id: 4, nome: "Ana Costa", area: "Eletrônica", email: "ana@cimol.edu.br", status: "Licença" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">Professores</h2>
          <p className="text-muted-foreground text-sm">Gerenciar corpo docente</p>
        </div>
        <Button className="rounded-xl gap-2">
          <Plus className="w-4 h-4" /> Novo Professor
        </Button>
      </div>
      <div className="glass-card rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Nome</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profs.map((p) => (
              <TableRow key={p.id} className="hover:bg-muted/30">
                <TableCell className="font-medium">{p.nome}</TableCell>
                <TableCell>{p.area}</TableCell>
                <TableCell className="text-primary text-sm">{p.email}</TableCell>
                <TableCell>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    p.status === "Ativo" ? "bg-success/10 text-success" : "bg-accent/20 text-accent-foreground"
                  }`}>
                    {p.status}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <button className="p-2 rounded-lg hover:bg-muted transition-colors"><Eye className="w-4 h-4 text-muted-foreground" /></button>
                    <button className="p-2 rounded-lg hover:bg-muted transition-colors"><Edit className="w-4 h-4 text-muted-foreground" /></button>
                    <button className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"><Trash2 className="w-4 h-4 text-destructive" /></button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const GenericAdmin = ({ title, description }: { title: string; description: string }) => (
  <div className="space-y-6 animate-fade-in">
    <div className="flex items-center justify-between flex-wrap gap-4">
      <div>
        <h2 className="text-2xl font-heading font-bold text-foreground">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <Button className="rounded-xl gap-2">
        <Plus className="w-4 h-4" /> Adicionar
      </Button>
    </div>
    <div className="glass-card rounded-2xl p-6">
      <div className="relative mb-4">
        <Input placeholder={`Buscar em ${title.toLowerCase()}...`} className="rounded-xl" />
      </div>
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Nenhum registro encontrado.</p>
        <p className="text-xs mt-1">Clique em "Adicionar" para criar o primeiro.</p>
      </div>
    </div>
  </div>
);

const AdminPage = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard": return <DashboardContent />;
      case "professores": return <ProfessoresAdmin />;
      case "horarios": return <GenericAdmin title="Horários" description="Gerenciar horários de aula" />;
      case "eventos": return <GenericAdmin title="Eventos" description="Gerenciar eventos escolares" />;
      case "documentos": return <GenericAdmin title="Documentos" description="Gerenciar documentos" />;
      case "setores": return <GenericAdmin title="Setores" description="Gerenciar setores da escola" />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col shrink-0 hidden md:flex">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg overflow-hidden bg-accent/20 p-0.5">
              <img src={cimolLogo} alt="CIMOL" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="font-heading font-bold text-sm text-foreground">CIMOL Admin</p>
              <p className="text-xs text-muted-foreground">Painel de controle</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <Link
            to="/"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao site
          </Link>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-card border-b border-border p-3 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-accent/20 p-0.5">
            <img src={cimolLogo} alt="CIMOL" className="w-full h-full object-contain" />
          </div>
          <span className="font-heading font-bold text-sm">Admin</span>
        </div>
        <Link to="/" className="text-xs text-primary font-medium">← Voltar</Link>
      </div>

      {/* Main content */}
      <main className="flex-1 p-6 md:p-8 overflow-auto md:mt-0 mt-14">
        <div className="max-w-6xl mx-auto">
          {renderContent()}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex justify-around p-2 z-30">
        {sidebarItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg text-[10px] ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default AdminPage;
