import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  FileCode2,
  History,
  RefreshCw,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, type SessionUser } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ImportStatus = "PENDENTE" | "APROVADA" | "REJEITADA";
type ImportSummary = {
  id: number;
  fonte: "HTML" | "XML" | "MISTO";
  titulo: string;
  status: ImportStatus;
  ativa: boolean;
  total_arquivos: number;
  total_horarios: number;
  total_turmas: number;
  avisos: string[];
  observacoes_envio: string | null;
  motivo_rejeicao: string | null;
  created_at: string;
  revisado_em: string | null;
  publicado_em: string | null;
  enviado_por_nome: string;
  revisado_por_nome: string | null;
  nome_turno: string | null;
};

type Schedule = {
  id: number;
  categoria: string;
  turma: string;
  curso: string | null;
  ano: string | null;
  dia: string;
  periodo: number;
  hora_inicio: string | null;
  disciplina: string;
  professor: string | null;
  ambiente: string | null;
  sala_nome: string | null;
  bloco_nome: string | null;
};

type ImportDetail = ImportSummary & {
  turmas: { turma: string; curso: string | null; ano: string | null; categoria: string }[];
  horarios: Schedule[];
  arquivos: { id: number; nome: string; mime_type: string; tamanho: number; sha256: string }[];
  paginacao: { pagina: number; por_pagina: number; total: number };
};

const statusLabel: Record<ImportStatus, string> = {
  PENDENTE: "Pendente",
  APROVADA: "Aprovada",
  REJEITADA: "Rejeitada",
};

const statusClass: Record<ImportStatus, string> = {
  PENDENTE: "bg-amber-100 text-amber-800 border-amber-200",
  APROVADA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REJEITADA: "bg-red-100 text-red-800 border-red-200",
};

const formatDate = (value: string | null) =>
  value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";

export default function UraniaImportacoesSection({ user }: { user: SessionUser }) {
  const [imports, setImports] = useState<ImportSummary[]>([]);
  const [detail, setDetail] = useState<ImportDetail | null>(null);
  const [selectedClass, setSelectedClass] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpload, setLastUpload] = useState<{
    id: number;
    status: string;
    resumo: { fonte: string; total_horarios: number; total_turmas: number; avisos: string[] };
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadImports = async () => {
    setLoading(true);
    try {
      setImports(await apiFetch<ImportSummary[]>("/api/importacoes"));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar importações.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user.papel === "CPD") loadImports();
    else setLoading(false);
  }, [user.papel]);

  const loadDetail = async (id: number, className = "") => {
    setLoadingDetail(true);
    setError("");
    try {
      const query = className ? `?turma=${encodeURIComponent(className)}&page_size=500` : "?page_size=200";
      const data = await apiFetch<ImportDetail>(`/api/importacoes/${id}${query}`);
      setDetail(data);
      setSelectedClass(className);
      setRejectionReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao abrir importação.");
    } finally {
      setLoadingDetail(false);
    }
  };

  const upload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!files.length) {
      setError("Selecione ao menos um arquivo HTML ou XML do URÂNIA UP.");
      return;
    }
    const data = new FormData();
    files.forEach((file) => data.append("arquivos", file));
    data.append("observacoes", notes);
    setUploading(true);
    setError("");
    try {
      const result = await apiFetch<{
        id: number;
        status: string;
        resumo: { fonte: string; total_horarios: number; total_turmas: number; avisos: string[] };
      }>("/api/importacoes/urania", { method: "POST", body: data });
      toast.success("Arquivos importados para a área temporária.");
      setLastUpload(result);
      setFiles([]);
      setNotes("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao importar arquivos.");
    } finally {
      setUploading(false);
    }
  };

  const approve = async () => {
    if (!detail || !window.confirm("Aprovar e publicar esta importação? A versão ativa do mesmo escopo será substituída.")) return;
    setReviewing(true);
    try {
      await apiFetch(`/api/importacoes/${detail.id}/aprovar`, { method: "POST", body: JSON.stringify({}) });
      toast.success("Importação aprovada e publicada.");
      setDetail(null);
      await loadImports();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao aprovar importação.");
    } finally {
      setReviewing(false);
    }
  };

  const reject = async () => {
    if (!detail || !rejectionReason.trim()) {
      setError("Informe o motivo da rejeição.");
      return;
    }
    setReviewing(true);
    setError("");
    try {
      await apiFetch(`/api/importacoes/${detail.id}/rejeitar`, {
        method: "POST",
        body: JSON.stringify({ motivo: rejectionReason }),
      });
      toast.success("Importação rejeitada.");
      setDetail(null);
      await loadImports();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao rejeitar importação.");
    } finally {
      setReviewing(false);
    }
  };

  if (detail || loadingDetail) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Button variant="ghost" onClick={() => setDetail(null)} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar às importações
        </Button>
        {loadingDetail && <div className="glass-card rounded-2xl p-12 text-center">Carregando prévia...</div>}
        {detail && (
          <>
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-2xl font-heading font-bold">{detail.titulo}</h2>
                  <Badge className={statusClass[detail.status]}>{statusLabel[detail.status]}</Badge>
                  {detail.ativa && <Badge className="bg-primary text-primary-foreground">Publicação ativa</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  Enviada por {detail.enviado_por_nome} em {formatDate(detail.created_at)} · {detail.total_turmas} turmas · {detail.total_horarios} aulas
                </p>
              </div>
              <Button variant="outline" onClick={() => loadDetail(detail.id, selectedClass)} className="gap-2">
                <RefreshCw className="w-4 h-4" /> Atualizar
              </Button>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="glass-card rounded-xl p-4"><p className="text-xs text-muted-foreground">Formato</p><p className="font-semibold">{detail.fonte}</p></div>
              <div className="glass-card rounded-xl p-4"><p className="text-xs text-muted-foreground">Arquivos</p><p className="font-semibold">{detail.total_arquivos}</p></div>
              <div className="glass-card rounded-xl p-4"><p className="text-xs text-muted-foreground">Revisão</p><p className="font-semibold">{detail.revisado_por_nome || "Aguardando CPD"}</p></div>
            </div>

            {!!detail.avisos.length && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-2">
                <p className="font-semibold text-amber-900 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Avisos do parser</p>
                {detail.avisos.map((warning, index) => <p key={index} className="text-sm text-amber-800">• {warning}</p>)}
              </div>
            )}

            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="p-5 border-b flex items-end justify-between gap-4 flex-wrap">
                <div><h3 className="font-heading font-bold">Prévia dos horários</h3><p className="text-xs text-muted-foreground">{detail.paginacao.total} registros no filtro atual</p></div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Filtrar turma</label>
                  <select
                    value={selectedClass}
                    onChange={(event) => loadDetail(detail.id, event.target.value)}
                    className="h-10 rounded-md border bg-background px-3 text-sm min-w-56"
                  >
                    <option value="">Amostra geral</option>
                    {detail.turmas.filter((item) => item.categoria === "TURMA").map((item) => <option key={item.turma} value={item.turma}>{item.turma}</option>)}
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[520px]">
                <Table>
                  <TableHeader><TableRow><TableHead>Dia</TableHead><TableHead>Período</TableHead><TableHead>Turma</TableHead><TableHead>Disciplina</TableHead><TableHead>Professor</TableHead><TableHead>Sala</TableHead><TableHead>Categoria</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {detail.horarios.map((schedule) => <TableRow key={schedule.id}>
                      <TableCell className="font-semibold">{schedule.dia}</TableCell>
                      <TableCell>{schedule.hora_inicio || `${schedule.periodo}ª aula`}</TableCell>
                      <TableCell>{schedule.turma}</TableCell>
                      <TableCell>{schedule.disciplina}</TableCell>
                      <TableCell>{schedule.professor || "—"}</TableCell>
                      <TableCell>{schedule.sala_nome || schedule.ambiente || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{schedule.categoria}</Badge></TableCell>
                    </TableRow>)}
                  </TableBody>
                </Table>
              </div>
              {detail.paginacao.total > detail.horarios.length && !selectedClass && <p className="p-3 text-xs text-muted-foreground border-t">A prévia geral mostra os primeiros {detail.horarios.length} registros. Selecione uma turma para vê-la por completo.</p>}
            </div>

            {detail.status === "PENDENTE" && user.papel === "CPD" && (
              <div className="glass-card rounded-2xl p-6 space-y-4">
                <h3 className="font-heading font-bold">Decisão do CPD</h3>
                <Textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Motivo obrigatório somente em caso de rejeição" rows={3} />
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-3 flex-wrap">
                  <Button onClick={approve} disabled={reviewing} className="gap-2 bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="w-4 h-4" /> Aprovar e publicar</Button>
                  <Button onClick={reject} disabled={reviewing} variant="destructive" className="gap-2"><XCircle className="w-4 h-4" /> Rejeitar</Button>
                </div>
              </div>
            )}
            {detail.motivo_rejeicao && <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4"><p className="font-semibold text-destructive">Motivo da rejeição</p><p className="text-sm mt-1">{detail.motivo_rejeicao}</p></div>}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </>
        )}
      </div>
    );
  }

  const pending = imports.filter((item) => item.status === "PENDENTE");
  const history = imports.filter((item) => item.status !== "PENDENTE");
  const renderTable = (items: ImportSummary[]) => (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Importação</TableHead><TableHead>Status</TableHead><TableHead>Enviada por</TableHead><TableHead>Conteúdo</TableHead><TableHead>Data</TableHead><TableHead>Revisor</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={7} className="text-center py-10">Carregando...</TableCell></TableRow>}
            {!loading && !items.length && <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Nenhuma importação encontrada.</TableCell></TableRow>}
            {items.map((item) => <TableRow key={item.id}>
              <TableCell><p className="font-medium">{item.titulo}</p><p className="text-xs text-muted-foreground">{item.fonte}{item.nome_turno ? ` · ${item.nome_turno}` : ""}</p></TableCell>
              <TableCell><div className="flex gap-1 flex-wrap"><Badge className={statusClass[item.status]}>{statusLabel[item.status]}</Badge>{item.ativa && <Badge>Ativa</Badge>}</div></TableCell>
              <TableCell>{item.enviado_por_nome}</TableCell>
              <TableCell className="text-sm">{item.total_turmas} turmas<br/><span className="text-muted-foreground">{item.total_horarios} aulas</span></TableCell>
              <TableCell>{formatDate(item.created_at)}</TableCell>
              <TableCell>{item.revisado_por_nome || "—"}</TableCell>
              <TableCell><div className="flex justify-end"><Button variant="ghost" size="sm" onClick={() => loadDetail(item.id)} className="gap-2"><Eye className="w-4 h-4" /> Visualizar</Button></div></TableCell>
            </TableRow>)}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div><h2 className="text-2xl font-heading font-bold">Integração URÂNIA UP</h2><p className="text-sm text-muted-foreground">Importe, confira e publique horários com revisão do CPD.</p></div>
        {user.papel === "CPD" && <Button variant="outline" onClick={loadImports} className="gap-2"><RefreshCw className="w-4 h-4" /> Atualizar</Button>}
      </div>

      {user.papel === "ADMIN" && (
        <form onSubmit={upload} className="glass-card rounded-2xl p-6 space-y-4">
          <div><h3 className="font-heading font-bold flex items-center gap-2"><Upload className="w-5 h-5 text-primary" /> Enviar arquivos</h3><p className="text-xs text-muted-foreground mt-1">HTML/HTM exportado pelo URÂNIA ou XML oficial de integração. Até 10 arquivos de 5 MB.</p></div>
          <label className="block border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
            <FileCode2 className="w-8 h-8 mx-auto text-primary mb-2" />
            <span className="text-sm font-medium">{files.length ? `${files.length} arquivo(s) selecionado(s)` : "Selecionar arquivos do URÂNIA"}</span>
            <Input ref={fileRef} type="file" multiple accept=".html,.htm,.xml,text/html,application/xml,text/xml" className="hidden" onChange={(event) => setFiles(Array.from(event.target.files || []))} />
          </label>
          {!!files.length && <div className="flex flex-wrap gap-2">{files.map((file) => <Badge variant="outline" key={`${file.name}-${file.size}`}>{file.name}</Badge>)}</div>}
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observações para o CPD (opcional)" rows={2} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button disabled={uploading} className="gap-2"><Upload className="w-4 h-4" />{uploading ? "Importando e validando..." : "Enviar para revisão"}</Button>
        </form>
      )}

      {user.papel === "ADMIN" && lastUpload && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900">
          <p className="font-semibold flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Arquivo enviado para o CPD</p>
          <p className="text-sm mt-1">Importação #{lastUpload.id}: {lastUpload.resumo.total_turmas} turmas e {lastUpload.resumo.total_horarios} aulas aguardando análise.</p>
        </div>
      )}

      {error && user.papel !== "ADMIN" && <p className="text-sm text-destructive">{error}</p>}
      {user.papel === "CPD" && <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2"><AlertTriangle className="w-4 h-4" /> Pendentes ({pending.length})</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><History className="w-4 h-4" /> Histórico ({history.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">{renderTable(pending)}</TabsContent>
        <TabsContent value="history">{renderTable(history)}</TabsContent>
      </Tabs>}
    </div>
  );
}
