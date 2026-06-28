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
  perfil: string;
  categoria: string;
  setor_nome: string | null;
  assunto: string;
  mensagem: string;
  status: Status;
  created_at: string;
};

type PaginatedResponse = {
  items: Manifestacao[];
  paginacao: { pagina: number; por_pagina: number; total: number };
};

const statusLabel: Record<Status, string> = {
  NOVA: "Nova",
  EM_ANALISE: "Em análise",
  RESOLVIDA: "Resolvida",
  ARQUIVADA: "Arquivada",
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
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = statusFilter === "TODAS" ? "" : `?status=${statusFilter}`;
      const data = await apiFetch<PaginatedResponse>(`/api/ouvidoria${query}`);
      setItems(data.items);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar ouvidoria.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (id: number, status: Status) => {
    setUpdatingId(id);
    try {
      await apiFetch(`/api/ouvidoria/${id}`, {
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
          <h2 className="text-2xl font-heading font-bold">Ouvidoria</h2>
          <p className="text-sm text-muted-foreground">Acompanhe ideias, melhorias e avisos enviados pela comunidade escolar.</p>
        </div>
        <Button variant="outline" onClick={load} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </Button>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-heading font-bold">Manifestações</h3>
            <p className="text-xs text-muted-foreground">{items.length} registro(s) no filtro atual</p>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas</SelectItem>
              <SelectItem value="NOVA">Novas</SelectItem>
              <SelectItem value="EM_ANALISE">Em análise</SelectItem>
              <SelectItem value="RESOLVIDA">Resolvidas</SelectItem>
              <SelectItem value="ARQUIVADA">Arquivadas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {error && <p className="p-4 text-sm text-destructive">{error}</p>}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Manifestação</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={5} className="text-center py-8">Carregando...</TableCell></TableRow>}
              {!loading && !items.length && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma manifestação encontrada.</TableCell></TableRow>}
              {items.map((item) => (
                <TableRow key={item.id} className="align-top">
                  <TableCell className="min-w-[320px]">
                    <p className="font-medium">{item.assunto}</p>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{item.mensagem}</p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{item.nome || "Não identificado"}</p>
                    <p className="text-xs text-muted-foreground">{profileLabel[item.perfil] || item.perfil}</p>
                    <p className="text-xs text-muted-foreground">{item.setor_nome || "Sem setor"}</p>
                  </TableCell>
                  <TableCell>{categoryLabel[item.categoria] || item.categoria}</TableCell>
                  <TableCell>{formatDate(item.created_at)}</TableCell>
                  <TableCell>
                    <div className="space-y-2 min-w-[150px]">
                      <Badge className={statusClass[item.status]}>{statusLabel[item.status]}</Badge>
                      <Select value={item.status} onValueChange={(value) => updateStatus(item.id, value as Status)} disabled={updatingId === item.id}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NOVA">Nova</SelectItem>
                          <SelectItem value="EM_ANALISE">Em análise</SelectItem>
                          <SelectItem value="RESOLVIDA">Resolvida</SelectItem>
                          <SelectItem value="ARQUIVADA">Arquivada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
