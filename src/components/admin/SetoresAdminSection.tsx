import { useEffect, useState } from "react";
import { Edit, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type Setor = {
  id: number;
  nome: string;
  descricao: string;
  responsavel: string | null;
  localizacao: string | null;
  contato: string | null;
  horario_atendimento: string | null;
  icone: string;
  cor: string;
  ativo: boolean;
};

const emptyForm = {
  nome: "",
  descricao: "",
  responsavel: "",
  localizacao: "",
  contato: "",
  horario_atendimento: "",
  icone: "building",
  cor: "blue",
  ativo: true,
};

const iconOptions = [
  ["building", "Prédio"],
  ["graduation", "Coordenação"],
  ["book", "Biblioteca"],
  ["flask", "Laboratório"],
  ["wrench", "Oficina"],
  ["coffee", "Cantina"],
  ["shield", "Portaria"],
  ["monitor", "Informática"],
  ["users", "Atendimento"],
] as const;

const colorOptions = [
  ["blue", "Azul"],
  ["violet", "Violeta"],
  ["amber", "Amarelo"],
  ["emerald", "Verde"],
  ["slate", "Cinza"],
  ["orange", "Laranja"],
  ["indigo", "Índigo"],
  ["cyan", "Ciano"],
  ["rose", "Rosa"],
] as const;

export default function SetoresAdminSection() {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Setor[]>("/api/setores?incluir_inativos=1");
      setSetores(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar setores.");
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

  const edit = (setor: Setor) => {
    setForm({
      nome: setor.nome,
      descricao: setor.descricao,
      responsavel: setor.responsavel || "",
      localizacao: setor.localizacao || "",
      contato: setor.contato || "",
      horario_atendimento: setor.horario_atendimento || "",
      icone: setor.icone,
      cor: setor.cor,
      ativo: setor.ativo,
    });
    setEditingId(setor.id);
    setShowForm(true);
    setError("");
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch(editingId ? `/api/setores/${editingId}` : "/api/setores", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      toast.success(editingId ? "Setor atualizado." : "Setor cadastrado.");
      reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar setor.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (setor: Setor) => {
    if (!window.confirm(`Excluir o setor "${setor.nome}"?`)) return;
    try {
      await apiFetch(`/api/setores/${setor.id}`, { method: "DELETE" });
      toast.success("Setor excluído.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir setor.");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-heading font-bold">Setores</h2>
          <p className="text-sm text-muted-foreground">Gerencie os setores exibidos no site e usados pela ouvidoria.</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Novo setor
        </Button>
      </div>

      {showForm && (
        <form onSubmit={save} className="glass-card rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold">{editingId ? "Editar setor" : "Novo setor"}</h3>
            <Button type="button" variant="ghost" size="sm" onClick={reset} className="gap-2">
              <X className="w-4 h-4" /> Cancelar
            </Button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="text-sm font-medium mb-1 block">Nome *</label><Input value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} maxLength={120} /></div>
            <div><label className="text-sm font-medium mb-1 block">Responsável</label><Input value={form.responsavel} onChange={(event) => setForm({ ...form, responsavel: event.target.value })} maxLength={120} /></div>
            <div><label className="text-sm font-medium mb-1 block">Localização</label><Input value={form.localizacao} onChange={(event) => setForm({ ...form, localizacao: event.target.value })} maxLength={160} /></div>
            <div><label className="text-sm font-medium mb-1 block">Contato</label><Input value={form.contato} onChange={(event) => setForm({ ...form, contato: event.target.value })} maxLength={160} /></div>
            <div><label className="text-sm font-medium mb-1 block">Atendimento</label><Input value={form.horario_atendimento} onChange={(event) => setForm({ ...form, horario_atendimento: event.target.value })} maxLength={160} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Ícone</label>
                <select value={form.icone} onChange={(event) => setForm({ ...form, icone: event.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {iconOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Cor</label>
                <select value={form.cor} onChange={(event) => setForm({ ...form, cor: event.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {colorOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div><label className="text-sm font-medium mb-1 block">Descrição *</label><Textarea value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} rows={3} maxLength={255} /></div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Switch checked={form.ativo} onCheckedChange={(checked) => setForm({ ...form, ativo: checked })} />
            Publicar no site
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button disabled={saving} className="gap-2"><Save className="w-4 h-4" />{saving ? "Salvando..." : "Salvar setor"}</Button>
        </form>
      )}

      {error && !showForm && <p className="text-sm text-destructive">{error}</p>}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-5 border-b"><h3 className="font-heading font-bold">Setores cadastrados</h3><p className="text-xs text-muted-foreground">{setores.length} registros</p></div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Setor</TableHead><TableHead>Local</TableHead><TableHead>Atendimento</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={5} className="text-center py-8">Carregando...</TableCell></TableRow>}
              {!loading && !setores.length && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum setor cadastrado.</TableCell></TableRow>}
              {setores.map((setor) => (
                <TableRow key={setor.id}>
                  <TableCell><p className="font-medium">{setor.nome}</p><p className="text-xs text-muted-foreground max-w-sm truncate">{setor.descricao}</p></TableCell>
                  <TableCell>{setor.localizacao || "—"}</TableCell>
                  <TableCell>{setor.horario_atendimento || "—"}</TableCell>
                  <TableCell>{setor.ativo ? <Badge>Publicado</Badge> : <Badge variant="outline">Oculto</Badge>}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => edit(setor)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(setor)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
