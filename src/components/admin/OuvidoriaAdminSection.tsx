import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Status = "NOVA" | "EM_ANALISE" | "RESOLVIDA" | "ARQUIVADA";

type Manifestacao = {
  id: number;
  nome: string | null;
  perfil: string | null;
  categoria: string;
  setor_nome: string | null;
  sala_nome: string | null;
  mapa_area_nome: string | null;
  mapa_nome: string | null;
  origem: string;
  contexto_json: Record<string, Record<string, string | number | null>> | null;
  assunto: string | null;
  mensagem: string | null;
  status: Status;
  created_at: string;
};

type PaginatedResponse = {
  items: Manifestacao[];
  paginacao: { pagina: number; por_pagina: number; total: number };
};

const statusLabel: Record<Status, string> = {
  NOVA: "Novo",
  EM_ANALISE: "Em análise",
  RESOLVIDA: "Resolvido",
  ARQUIVADA: "Descartado",
};

const statusClass: Record<Status, string> = {
  NOVA: "bg-amber-100 text-amber-800 border-amber-200",
  EM_ANALISE: "bg-blue-100 text-blue-800 border-blue-200",
  RESOLVIDA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ARQUIVADA: "bg-slate-100 text-slate-700 border-slate-200",
};

const categoryLabel: Record<string, string> = {
  IDEIA: "Ideia",
  MELHORIA: "Melhoria",
  PROBLEMA: "Problema",
  AVISO: "Aviso",
  HORARIO_INCORRETO: "Horário incorreto",
  SALA_LOCAL_INCORRETO: "Sala ou local incorreto",
  SALA_INDISPONIVEL: "Sala indisponível",
  MUDANCA_NAO_ATUALIZADA: "Mudança não atualizada",
  CONFLITO_HORARIO: "Conflito de horário",
  LOCALIZACAO_INCORRETA: "Localização incorreta",
  INFORMACAO_INCORRETA: "Outra informação incorreta",
};

const profileLabel: Record<string, string> = {
  ALUNO: "Aluno",
  DOCENTE: "Docente",
  RESPONSAVEL: "Responsável",
  COMUNIDADE: "Comunidade",
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

export default function OuvidoriaAdminSection() {
  const [items, setItems] = useState<Manifestacao[]>([]);
  const [statusFilter, setStatusFilter] = useState("TODAS");
  const [categoryFilter, setCategoryFilter] = useState("TODAS");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginatedResponse["paginacao"]>({ pagina: 1, por_pagina: 100, total: 0 });
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "TODAS") params.set("status", statusFilter);
      if (categoryFilter !== "TODAS") params.set("categoria", categoryFilter);
      params.set("page", String(page));
      const data = await apiFetch<PaginatedResponse>(`/api/relatos?${params}`);
      setItems(data.items);
      setPagination(data.paginacao);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar relatos.");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, page, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (id: number, status: Status) => {
    setUpdatingId(id);
    try {
      await apiFetch(`/api/relatos/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item));
      toast.success("Status atualizado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar status.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-heading font-bold">Relatos</h2>
          <p className="text-sm text-muted-foreground">Acompanhe problemas apontados no portal da instituição.</p>
        </div>
        <Button variant="outline" onClick={load} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </Button>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-heading font-bold">Problemas relatados</h3>
            <p className="text-xs text-muted-foreground">{items.length} registro(s) no filtro atual</p>
          </div>
          <div className="flex flex-wrap gap-2"><Select value={categoryFilter} onValueChange={(value) => { setCategoryFilter(value); setPage(1); }}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas as categorias</SelectItem>
              {Object.entries(categoryLabel).filter(([value]) => !["IDEIA", "MELHORIA", "PROBLEMA", "AVISO"].includes(value)).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
          </Select><Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas</SelectItem>
              <SelectItem value="NOVA">Novas</SelectItem>
              <SelectItem value="EM_ANALISE">Em análise</SelectItem>
              <SelectItem value="RESOLVIDA">Resolvidas</SelectItem>
              <SelectItem value="ARQUIVADA">Descartados</SelectItem>
            </SelectContent>
          </Select></div>
        </div>
        {error && <p className="p-4 text-sm text-destructive">{error}</p>}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Relato</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={5} className="text-center py-8">Carregando...</TableCell></TableRow>}
              {!loading && !items.length && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum relato encontrado.</TableCell></TableRow>}
              {items.map((item) => (
                <TableRow key={item.id} className="align-top">
                  <TableCell className="min-w-[320px]">
                    <p className="font-medium">{item.assunto || categoryLabel[item.categoria] || item.categoria}</p>
                    {item.mensagem && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{item.mensagem}</p>}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {item.contexto_json?.horario ? `${item.contexto_json.horario.turma} · ${item.contexto_json.horario.dia} · ${item.contexto_json.horario.disciplina}`
                        : item.mapa_area_nome ? `${item.mapa_nome}: ${item.mapa_area_nome}`
                          : item.sala_nome || item.setor_nome || "Sem contexto específico"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{item.nome || "Não identificado"}</p>
                    <p className="text-xs text-muted-foreground">{item.perfil ? profileLabel[item.perfil] || item.perfil : "Perfil não informado"}</p>
                    <p className="text-xs text-muted-foreground">{item.origem}</p>
                  </TableCell>
                  <TableCell>{categoryLabel[item.categoria] || item.categoria}</TableCell>
                  <TableCell>{formatDate(item.created_at)}</TableCell>
                  <TableCell>
                    <div className="space-y-2 min-w-[150px]">
                      <Badge className={statusClass[item.status]}>{statusLabel[item.status]}</Badge>
                      <Select value={item.status} onValueChange={(value) => updateStatus(item.id, value as Status)} disabled={updatingId === item.id}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NOVA">Novo</SelectItem>
                          <SelectItem value="EM_ANALISE">Em análise</SelectItem>
                          <SelectItem value="RESOLVIDA">Resolvido</SelectItem>
                          <SelectItem value="ARQUIVADA">Descartado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
          </Table>
        </div>
        {pagination.total > pagination.por_pagina && (
          <div className="flex items-center justify-between gap-3 border-t p-4 text-sm">
            <span>Página {pagination.pagina} de {Math.ceil(pagination.total / pagination.por_pagina)}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page * pagination.por_pagina >= pagination.total || loading} onClick={() => setPage((value) => value + 1)}>Próxima</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
