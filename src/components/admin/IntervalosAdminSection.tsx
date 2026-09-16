import { useCallback, useEffect, useState } from "react";
import { Clock, Pencil, Plus, Power } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Group = { id: number; tipo: "CURSO" | "ANO" | "SERIE" | "TURMA" | "NIVEL"; nome: string };
type Interval = { id: number; nome: string; hora_inicio: string; hora_fim: string; ativo: boolean; grupos: Group[] };

const typeLabel: Record<Group["tipo"], string> = {
  CURSO: "Curso", ANO: "Ano", SERIE: "Série", TURMA: "Turma", NIVEL: "Nível",
};

export default function IntervalosAdminSection() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [items, setItems] = useState<Interval[]>([]);
  const [editing, setEditing] = useState<Interval | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [active, setActive] = useState(true);
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [groupData, intervalData] = await Promise.all([
        apiFetch<Group[]>("/api/grupos-academicos"),
        apiFetch<Interval[]>("/api/intervalos?incluir_inativos=1"),
      ]);
      setGroups(groupData);
      setItems(intervalData);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os intervalos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openForm = (interval?: Interval) => {
    setEditing(interval || null);
    setName(interval?.nome || "");
    setStart(interval?.hora_inicio || "");
    setEnd(interval?.hora_fim || "");
    setActive(interval?.ativo ?? true);
    setSelectedGroups(interval?.grupos.map((group) => group.id) || []);
    setError("");
    setDialogOpen(true);
  };

  const save = async () => {
    if (!name.trim() || !start || !end || !selectedGroups.length) {
      setError("Preencha nome, horários e selecione ao menos um grupo.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch(editing ? `/api/intervalos/${editing.id}` : "/api/intervalos", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify({ nome: name, hora_inicio: start, hora_fim: end, ativo: active, grupo_ids: selectedGroups }),
      });
      setDialogOpen(false);
      toast.success(editing ? "Intervalo atualizado." : "Intervalo criado.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o intervalo.");
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (interval: Interval) => {
    try {
      await apiFetch(`/api/intervalos/${interval.id}`, { method: "DELETE" });
      setItems((current) => current.map((item) => item.id === interval.id ? { ...item, ativo: false } : item));
      toast.success("Intervalo desativado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível desativar o intervalo.");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading font-bold">Intervalos</h2>
          <p className="text-sm text-muted-foreground">Configure recreios por grupos acadêmicos importados.</p>
        </div>
        <Button onClick={() => openForm()} disabled={!groups.length}><Plus className="mr-2 h-4 w-4" /> Novo intervalo</Button>
      </div>
      {error && !dialogOpen && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!loading && !groups.length && <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">Importe um horário do URÂNIA para disponibilizar grupos acadêmicos.</div>}
      <div className="glass-card overflow-hidden rounded-2xl">
        <Table>
          <TableHeader><TableRow><TableHead>Intervalo</TableHead><TableHead>Horário</TableHead><TableHead>Grupos</TableHead><TableHead>Status</TableHead><TableHead><span className="sr-only">Ações</span></TableHead></TableRow></TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={5} className="py-8 text-center">Carregando...</TableCell></TableRow>}
            {!loading && !items.length && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nenhum intervalo configurado.</TableCell></TableRow>}
            {items.map((interval) => (
              <TableRow key={interval.id}>
                <TableCell className="font-medium">{interval.nome}</TableCell>
                <TableCell>{interval.hora_inicio}–{interval.hora_fim}</TableCell>
                <TableCell className="max-w-sm text-sm">{interval.grupos.map((group) => `${typeLabel[group.tipo]} ${group.nome}`).join(", ")}</TableCell>
                <TableCell>{interval.ativo ? "Ativo" : "Inativo"}</TableCell>
                <TableCell><div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" aria-label={`Editar ${interval.nome}`} onClick={() => openForm(interval)}><Pencil className="h-4 w-4" /></Button>
                  {interval.ativo && <Button variant="ghost" size="icon" aria-label={`Desativar ${interval.nome}`} onClick={() => deactivate(interval)}><Power className="h-4 w-4 text-destructive" /></Button>}
                </div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Editar intervalo" : "Novo intervalo"}</DialogTitle><DialogDescription>O intervalo será exibido somente às turmas relacionadas aos grupos selecionados.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><label htmlFor="interval-name" className="text-sm font-medium">Nome</label><Input id="interval-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Recreio da manhã" maxLength={120} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="interval-start" className="text-sm font-medium">Início</label><Input id="interval-start" type="time" value={start} onChange={(event) => setStart(event.target.value)} /></div>
              <div><label htmlFor="interval-end" className="text-sm font-medium">Fim</label><Input id="interval-end" type="time" value={end} onChange={(event) => setEnd(event.target.value)} /></div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Grupos acadêmicos</p>
              <div className="grid max-h-64 gap-2 overflow-y-auto rounded-xl border p-3 sm:grid-cols-2">
                {groups.map((group) => (
                  <label key={group.id} className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-muted">
                    <Checkbox checked={selectedGroups.includes(group.id)} onCheckedChange={(checked) => setSelectedGroups((current) => checked ? [...current, group.id] : current.filter((id) => id !== group.id))} />
                    <span><span className="text-xs text-muted-foreground">{typeLabel[group.tipo]}</span> {group.nome}</span>
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center justify-between rounded-xl border p-3"><span className="text-sm font-medium">Ativo</span><Switch checked={active} onCheckedChange={setActive} /></label>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button><Button onClick={save} disabled={saving}><Clock className="mr-2 h-4 w-4" />{saving ? "Salvando..." : "Salvar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
