import { useEffect, useState } from "react";
import { CalendarDays, Edit, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type Evento = {
  id: number;
  titulo: string;
  descricao: string | null;
  data_evento: string;
  hora_evento: string | null;
  local: string | null;
  imagem_url: string | null;
  ativo: boolean;
};

const emptyForm = {
  titulo: "",
  descricao: "",
  data_evento: "",
  hora_evento: "",
  local: "",
  imagem_url: "",
  ativo: true,
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(`${value}T00:00:00`));

export default function EventosAdminSection() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Evento[]>("/api/eventos?incluir_inativos=1");
      setEventos(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar eventos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const reset = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setError("");
  };

  const openNew = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
    setError("");
  };

  const edit = (evento: Evento) => {
    setForm({
      titulo: evento.titulo,
      descricao: evento.descricao || "",
      data_evento: evento.data_evento,
      hora_evento: evento.hora_evento || "",
      local: evento.local || "",
      imagem_url: evento.imagem_url || "",
      ativo: evento.ativo,
    });
    setEditingId(evento.id);
    setShowForm(true);
    setError("");
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch(editingId ? `/api/eventos/${editingId}` : "/api/eventos", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      toast.success(editingId ? "Evento atualizado." : "Evento cadastrado.");
      reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar evento.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (evento: Evento) => {
    if (!window.confirm(`Excluir o evento "${evento.titulo}"?`)) return;
    try {
      await apiFetch(`/api/eventos/${evento.id}`, { method: "DELETE" });
      toast.success("Evento excluído.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir evento.");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-heading font-bold">Eventos</h2>
          <p className="text-sm text-muted-foreground">Cadastre os eventos exibidos no site.</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Novo evento
        </Button>
      </div>

      {showForm && (
        <form onSubmit={save} className="glass-card rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold">{editingId ? "Editar evento" : "Novo evento"}</h3>
            <Button type="button" variant="ghost" size="sm" onClick={reset} className="gap-2">
              <X className="w-4 h-4" /> Cancelar
            </Button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="text-sm font-medium mb-1 block">Título *</label><Input value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} maxLength={140} /></div>
            <div><label className="text-sm font-medium mb-1 block">Local</label><Input value={form.local} onChange={(event) => setForm({ ...form, local: event.target.value })} maxLength={140} /></div>
            <div><label className="text-sm font-medium mb-1 block">Data *</label><Input type="date" value={form.data_evento} onChange={(event) => setForm({ ...form, data_evento: event.target.value })} /></div>
            <div><label className="text-sm font-medium mb-1 block">Horário</label><Input type="time" value={form.hora_evento} onChange={(event) => setForm({ ...form, hora_evento: event.target.value })} /></div>
            <div className="md:col-span-2"><label className="text-sm font-medium mb-1 block">URL da imagem</label><Input value={form.imagem_url} onChange={(event) => setForm({ ...form, imagem_url: event.target.value })} placeholder="https://..." maxLength={500} /></div>
          </div>
          <div><label className="text-sm font-medium mb-1 block">Descrição</label><Textarea value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} rows={3} maxLength={1000} /></div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Switch checked={form.ativo} onCheckedChange={(checked) => setForm({ ...form, ativo: checked })} />
            Publicar no site
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button disabled={saving} className="gap-2"><Save className="w-4 h-4" />{saving ? "Salvando..." : "Salvar evento"}</Button>
        </form>
      )}

      {error && !showForm && <p className="text-sm text-destructive">{error}</p>}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-5 border-b"><h3 className="font-heading font-bold">Eventos cadastrados</h3><p className="text-xs text-muted-foreground">{eventos.length} registros</p></div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Evento</TableHead><TableHead>Data</TableHead><TableHead>Local</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={5} className="text-center py-8">Carregando...</TableCell></TableRow>}
              {!loading && !eventos.length && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum evento cadastrado.</TableCell></TableRow>}
              {eventos.map((evento) => (
                <TableRow key={evento.id}>
                  <TableCell><p className="font-medium flex items-center gap-2"><CalendarDays className="w-4 h-4 text-primary" />{evento.titulo}</p><p className="text-xs text-muted-foreground line-clamp-1">{evento.descricao || "Sem descrição"}</p></TableCell>
                  <TableCell>{formatDate(evento.data_evento)}{evento.hora_evento ? ` às ${evento.hora_evento}` : ""}</TableCell>
                  <TableCell>{evento.local || "—"}</TableCell>
                  <TableCell>{evento.ativo ? <Badge>Publicado</Badge> : <Badge variant="outline">Oculto</Badge>}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => edit(evento)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(evento)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
