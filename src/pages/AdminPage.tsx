import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, Building2, CalendarDays, DoorOpen, Download, Edit, Eye, FileUp, LogOut, MessageSquareWarning, Paperclip, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import cimolLogo from "@/assets/cimol-logo.png";
import BlocosSection from "@/components/admin/BlocosSection";
import EventosAdminSection from "@/components/admin/EventosAdminSection";
import OuvidoriaAdminSection from "@/components/admin/OuvidoriaAdminSection";
import SalasSection from "@/components/admin/SalasSection";
import SetoresAdminSection from "@/components/admin/SetoresAdminSection";
import UraniaImportacoesSection from "@/components/admin/UraniaImportacoesSection";
import { apiFetch, apiUrl, type SessionUser, type UserRole } from "@/lib/api";

type AdminTab = "horarios" | "blocos" | "salas" | "eventos" | "setores" | "ouvidoria" | "reorganizacao";

type ReorganizacaoRegistro = {
  id: number;
  aluno: string;
  ano: string;
  turma: string;
  curso: string;
  problema: string;
  salas: string;
  arquivo_nome: string | null;
  data: string;
};

const sidebarItems: { id: AdminTab; label: string; icon: typeof FileUp; roles: UserRole[] }[] = [
  { id: "horarios", label: "URÂNIA UP", icon: FileUp, roles: ["ADMIN", "CPD"] },
  { id: "blocos", label: "Blocos", icon: Building2, roles: ["CPD"] },
  { id: "salas", label: "Salas", icon: DoorOpen, roles: ["CPD"] },
  { id: "eventos", label: "Eventos", icon: CalendarDays, roles: ["CPD"] },
  { id: "setores", label: "Setores", icon: Building2, roles: ["CPD"] },
  { id: "ouvidoria", label: "Ouvidoria", icon: MessageSquareWarning, roles: ["CPD"] },
  { id: "reorganizacao", label: "Reorganização", icon: AlertCircle, roles: ["CPD"] },
];

const ReorganizacaoSection = () => {
  const [alunoMatricula, setAlunoMatricula] = useState("");
  const [ano, setAno] = useState("");
  const [turma, setTurma] = useState("");
  const [curso, setCurso] = useState("");
  const [problema, setProblema] = useState("");
  const [salas, setSalas] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [registros, setRegistros] = useState<ReorganizacaoRegistro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const cursosDisponiveis = [
    "Informática",
    "Mecânica",
    "Química",
    "Eletrônica",
    "Eletrotécnica",
    "Móveis",
    "Design de Móveis",
    "Meio Ambiente"
  ];

  const handleAnoChange = (value: string) => {
    // Se o novo valor for menor que o anterior (deletando), limpa o campo
    if (value.length < ano.length) {
      setAno("");
      return;
    }
    // Permite limpar o campo
    if (!value) {
      setAno("");
      return;
    }
    // Apenas pega o primeiro dígito numérico digitado
    const apenasNumeros = value.replace(/\D/g, "");
    if (!apenasNumeros) {
      setAno("");
      return;
    }
    // Restringe apenas para 1, 2 ou 3 e adiciona o 'º'
    const digito = apenasNumeros[0];
    if (["1", "2", "3"].includes(digito)) {
      setAno(`${digito}º`);
    }
  };

  const handleTurmaChange = (value: string) => {
    if (!value) {
      setTurma("");
      return;
    }
    // Remove qualquer caractere não numérico
    const numeros = value.replace(/\D/g, "");
    if (!numeros) {
      setTurma("");
      return;
    }

    // O primeiro dígito precisa ser '6'
    if (numeros[0] !== "6") {
      return;
    }

    let formatado = "6";

    // O segundo dígito precisa ser de 1 a 8 (cursos 61 a 68)
    if (numeros.length >= 2) {
      const segundo = numeros[1];
      if (["1", "2", "3", "4", "5", "6", "7", "8"].includes(segundo)) {
        formatado += segundo;
      } else {
        setTurma(formatado);
        return;
      }
    }

    // O terceiro dígito vira o dígito após o hífen: 62-1
    if (numeros.length >= 3) {
      const terceiro = numeros[2];
      formatado += `-${terceiro}`;
    }

    setTurma(formatado.slice(0, 4));
  };

  const carregarRegistros = async () => {
    setErro("");
    setCarregando(true);

    try {
      const resposta = await fetch(apiUrl("/api/reorganizacao?page_size=100"), { credentials: "include" });

      if (!resposta.ok) {
        throw new Error("Não foi possível carregar os registros.");
      }

      const dados = await resposta.json();
      setRegistros(Array.isArray(dados) ? dados : dados.items);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao carregar registros.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarRegistros();
  }, []);

  const handleAdicionar = async () => {
    if (!alunoMatricula || !ano || !turma || !curso || !problema || !salas) {
      setErro("Preencha todos os campos antes de registrar.");
      return;
    }

    setErro("");
    setSalvando(true);

    try {
      // Usa FormData para suportar envio de arquivo junto com os dados
      const formData = new FormData();
      formData.append("aluno", alunoMatricula);
      formData.append("ano", ano);
      formData.append("turma", turma);
      formData.append("curso", curso);
      formData.append("problema", problema);
      formData.append("salas", salas);
      if (arquivo) formData.append("arquivo", arquivo);

      const resposta = await fetch(apiUrl("/api/reorganizacao"), {
        credentials: "include",
        method: "POST",
        body: formData, // sem Content-Type manual — browser define multipart automaticamente
      });

      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => null);
        throw new Error(dados?.message || "Não foi possível salvar o registro.");
      }

      await carregarRegistros();
      setAlunoMatricula("");
      setAno("");
      setTurma("");
      setCurso("");
      setProblema("");
      setSalas("");
      setArquivo(null);
      if (arquivoRef.current) arquivoRef.current.value = "";
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao salvar registro.");
    } finally {
      setSalvando(false);
    }
  };

  const handleDeletar = async (id: number) => {
    setErro("");

    try {
      const resposta = await fetch(apiUrl(`/api/reorganizacao/${id}`), {
        credentials: "include",
        method: "DELETE",
      });

      if (!resposta.ok) {
        throw new Error("Não foi possível remover o registro.");
      }

      setRegistros(registros.filter((registro) => registro.id !== id));
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao remover registro.");
    }
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
                placeholder="Ex: 1, 2 ou 3"
                value={ano}
                onChange={(e) => handleAnoChange(e.target.value)}
                className="rounded-xl"
                maxLength={2}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Turma</label>
              <Input
                placeholder="Ex: 621 (fica 62-1)"
                value={turma}
                onChange={(e) => handleTurmaChange(e.target.value)}
                className="rounded-xl"
                maxLength={4}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Curso</label>
              <select
                value={curso}
                onChange={(e) => setCurso(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Selecione o curso</option>
                {cursosDisponiveis.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
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

          {/* Upload de documento justificativo */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              Documento Justificativo
              <span className="ml-1 text-xs text-muted-foreground font-normal">(opcional — PDF, imagem ou Word, máx. 10 MB)</span>
            </label>
            {arquivo ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-primary/40 bg-primary/5">
                <Paperclip className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm text-foreground truncate flex-1">{arquivo.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {(arquivo.size / 1024).toFixed(0)} KB
                </span>
                <button
                  type="button"
                  onClick={() => { setArquivo(null); if (arquivoRef.current) arquivoRef.current.value = ""; }}
                  className="p-0.5 rounded hover:bg-destructive/10 transition-colors"
                  title="Remover arquivo"
                >
                  <X className="w-4 h-4 text-destructive" />
                </button>
              </div>
            ) : (
              <label
                htmlFor="upload-arquivo"
                className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all group"
              >
                <Paperclip className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  Clique para anexar um documento de justificativa
                </span>
                <input
                  id="upload-arquivo"
                  ref={arquivoRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <Button onClick={handleAdicionar} disabled={salvando} className="rounded-xl gap-2 w-full">
            <Plus className="w-4 h-4" /> {salvando ? "Salvando..." : "Registrar e Reorganizar"}
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
              <TableHead>Documento</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {carregando && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                  Carregando registros...
                </TableCell>
              </TableRow>
            )}
            {!carregando && registros.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                  Nenhum aluno com restrição cadastrado.
                </TableCell>
              </TableRow>
            )}
            {registros.map((reg) => (
              <TableRow key={reg.id} className="hover:bg-muted/30">
                <TableCell className="font-medium">{reg.aluno}</TableCell>
                <TableCell className="text-sm">{reg.ano}</TableCell>
                <TableCell className="text-sm">{reg.turma}</TableCell>
                <TableCell className="text-sm">{reg.curso}</TableCell>
                <TableCell className="text-sm">{reg.problema}</TableCell>
                <TableCell className="text-sm text-primary">{reg.salas}</TableCell>
                <TableCell className="text-sm">
                  {reg.arquivo_nome ? (
                    <a
                      href={apiUrl(`/api/reorganizacao/${reg.id}/arquivo`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline"
                      title={reg.arquivo_nome}
                    >
                      <Download className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate max-w-[120px]">{reg.arquivo_nome}</span>
                    </a>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{reg.data}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <button className="p-2 rounded-lg hover:bg-muted transition-colors" title="Visualizar">
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-muted transition-colors" title="Editar">
                      <Edit className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => handleDeletar(reg.id)}
                      className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
                      title="Excluir"
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
          <span className="font-medium">Dica:</span> O sistema de reorganização irá automaticamente realocar o aluno para salas acessíveis
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
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>("horarios");

  useEffect(() => {
    apiFetch<{ user: SessionUser }>("/api/auth/me")
      .then((response) => setUser(response.user))
      .catch(() => navigate("/login", { replace: true }))
      .finally(() => setCheckingAuth(false));
  }, [navigate]);

  const handleLogout = async () => {
    await apiFetch("/api/auth/logout", { method: "POST", body: JSON.stringify({}) }).catch(() => null);
    setUser(null);
    navigate("/", { replace: true });
  };

  if (checkingAuth || !user) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Verificando acesso...</div>;
  }

  const visibleItems = sidebarItems.filter((item) => item.roles.includes(user.papel));

  const renderContent = () => {
    switch (activeTab) {
      case "horarios":
        return <UraniaImportacoesSection user={user} />;
      case "blocos":
        return <BlocosSection />;
      case "salas":
        return <SalasSection />;
      case "eventos":
        return <EventosAdminSection />;
      case "setores":
        return <SetoresAdminSection />;
      case "ouvidoria":
        return <OuvidoriaAdminSection />;
      case "reorganizacao":
        return <ReorganizacaoSection />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-64 bg-card border-r border-border flex-col shrink-0 hidden md:flex">
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
          {visibleItems.map((item) => {
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
            <span className="font-medium text-foreground">{user.papel === "ADMIN" ? "Operador URÂNIA" : user.nome}</span>
            <span className="block">{user.papel === "CPD" ? "CPD" : "Somente upload"}</span>
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

      <div className="md:hidden fixed top-0 left-0 right-0 bg-card border-b border-border p-3 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-accent/20 p-0.5">
            <img src={cimolLogo} alt="CIMOL" className="w-full h-full object-contain" />
          </div>
          <span className="font-heading font-bold text-sm">{user.papel === "CPD" ? "CPD" : "URÂNIA"}</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleLogout} className="flex items-center gap-1 text-xs text-destructive font-medium">
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
          <Link to="/" className="text-xs text-primary font-medium">Voltar</Link>
        </div>
      </div>

      <main className="flex-1 p-6 md:p-8 overflow-auto md:mt-0 mt-14">
        <div className="max-w-6xl mx-auto">
          {renderContent()}
        </div>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex justify-start overflow-x-auto p-2 z-30">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-lg text-[10px] shrink-0 ${
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
