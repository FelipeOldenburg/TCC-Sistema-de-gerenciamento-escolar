import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, CalendarDays, Building2, Plus, Edit, Trash2, Eye, LogOut, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import LoginPage from "./LoginPage";
import cimolLogo from "@/assets/cimol-logo.png";

type AdminTab = "horarios" | "eventos" | "setores" | "reorganizacao";

const sidebarItems = [
  { id: "horarios" as AdminTab, label: "Horários", icon: Calendar },
  { id: "eventos" as AdminTab, label: "Eventos", icon: CalendarDays },
  { id: "setores" as AdminTab, label: "Setores", icon: Building2 },
  { id: "reorganizacao" as AdminTab, label: "Reorganização", icon: AlertCircle },
];


const ReorganizacaoSection = () => {
  const [alunoMatricula, setAlunoMatricula] = useState("");
  const [ano, setAno] = useState("");
  const [turma, setTurma] = useState("");
  const [curso, setCurso] = useState("");
  const [problema, setProblema] = useState("");
  const [salas, setSalas] = useState("");
  const [registros, setRegistros] = useState<Array<{ id: number; aluno: string; ano: string; turma: string; curso: string; problema: string; salas: string; data: string }>>([
    { id: 1, aluno: "João Silva", ano: "3º", turma: "62-1", curso: "Informática", problema: "Acessibilidade - Cadeira de rodas", salas: "S101, S205", data: "2025-05-10" },
    { id: 2, aluno: "Maria Santos", ano: "2º", turma: "71-2", curso: "Mecânica", problema: "Alergia ao látex - Salas com quadros", salas: "S102, S304", data: "2025-05-08" },
  ]);

  const handleAdicionar = () => {
    if (alunoMatricula && ano && turma && curso && problema && salas) {
      const novoRegistro = {
        id: registros.length + 1,
        aluno: alunoMatricula,
        ano: ano,
        turma: turma,
        curso: curso,
        problema: problema,
        salas: salas,
        data: new Date().toISOString().split('T')[0],
      };
      setRegistros([...registros, novoRegistro]);
      setAlunoMatricula("");
      setAno("");
      setTurma("");
      setCurso("");
      setProblema("");
      setSalas("");
    }
  };

  const handleDeletar = (id: number) => {
    setRegistros(registros.filter(r => r.id !== id));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-heading font-bold text-foreground">Reorganização de Salas</h2>
        <p className="text-muted-foreground text-sm">Registrar problemas que impedem acesso às salas e reorganizar</p>
      </div>

      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h3 className="font-heading font-bold text-foreground flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-accent" />
          Registrar Novo Problema
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Aluno/Matrícula</label>
            <Input
              placeholder="Nome ou número de matrícula"
              value={alunoMatricula}
              onChange={(e) => setAlunoMatricula(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Ano</label>
              <Input
                placeholder="Ex: 1º, 2º, 3º"
                value={ano}
                onChange={(e) => setAno(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Turma</label>
              <Input
                placeholder="Ex: 62-1"
                value={turma}
                onChange={(e) => setTurma(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Curso</label>
              <Input
                placeholder="Ex: Informática"
                value={curso}
                onChange={(e) => setCurso(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Descrição do Problema</label>
            <Input
              placeholder="Ex: Acessibilidade, alergia, restrição física..."
              value={problema}
              onChange={(e) => setProblema(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Salas a Reorganizar</label>
            <Input
              placeholder="Ex: S101, S205, S304"
              value={salas}
              onChange={(e) => setSalas(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <Button onClick={handleAdicionar} className="rounded-xl gap-2 w-full">
            <Plus className="w-4 h-4" /> Registrar e Reorganizar
          </Button>
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-border/50">
          <h3 className="font-heading font-bold text-foreground">Alunos com Restrições</h3>
          <p className="text-xs text-muted-foreground mt-1">{registros.length} registros ativos</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Aluno</TableHead>
              <TableHead>Ano</TableHead>
              <TableHead>Turma</TableHead>
              <TableHead>Curso</TableHead>
              <TableHead>Problema</TableHead>
              <TableHead>Salas Reorganizadas</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registros.map((reg) => (
              <TableRow key={reg.id} className="hover:bg-muted/30">
                <TableCell className="font-medium">{reg.aluno}</TableCell>
                <TableCell className="text-sm">{reg.ano}</TableCell>
                <TableCell className="text-sm">{reg.turma}</TableCell>
                <TableCell className="text-sm">{reg.curso}</TableCell>
                <TableCell className="text-sm">{reg.problema}</TableCell>
                <TableCell className="text-sm text-primary">{reg.salas}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{reg.data}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <button className="p-2 rounded-lg hover:bg-muted transition-colors">
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-muted transition-colors">
                      <Edit className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button 
                      onClick={() => handleDeletar(reg.id)}
                      className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="bg-accent/10 border border-accent/20 rounded-2xl p-4">
        <p className="text-sm text-accent-foreground">
          <span className="font-medium">💡 Dica:</span> O sistema de reorganização irá automaticamente realocar o aluno para salas acessíveis
          conforme os problemas registrados quando implementado.
        </p>
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

const AdminPageComponent = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminUser, setAdminUser] = useState("");
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");

  useEffect(() => {
    // Verificar autenticação no mount
    checkAuth();
  }, []);

  const checkAuth = () => {
    const loggedIn = localStorage.getItem("admin_logged_in") === "true";
    const user = localStorage.getItem("admin_user") || "";
    setIsAuthenticated(loggedIn);
    setAdminUser(user);
  };

  // Verificar autenticação quando o componente renderiza
  if (!isAuthenticated && localStorage.getItem("admin_logged_in") === "true") {
    checkAuth();
  }

  const handleLogout = () => {
    localStorage.removeItem("admin_logged_in");
    localStorage.removeItem("admin_user");
    setIsAuthenticated(false);
    navigate("/");
  };

  if (!isAuthenticated && localStorage.getItem("admin_logged_in") !== "true") {
    return <LoginPage />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case "horarios": return <GenericAdmin title="Horários" description="Gerenciar horários de aula" />;
      case "eventos": return <GenericAdmin title="Eventos" description="Gerenciar eventos escolares" />;
      case "setores": return <GenericAdmin title="Setores" description="Gerenciar setores da escola" />;
      case "reorganizacao": return <ReorganizacaoSection />;
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
        <div className="p-3 border-t border-border space-y-2">
          <div className="text-xs text-muted-foreground px-3 py-2 bg-muted/30 rounded-lg truncate">
            {adminUser}
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
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

export default AdminPageComponent;
