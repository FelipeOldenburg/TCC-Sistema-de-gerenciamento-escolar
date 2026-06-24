import { useEffect, useState } from "react";
import { Edit, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Bloco = { id: number; nome: string };
type Sala = {
  id: number;
  nome: string;
  bloco_id: number;
  bloco_nome: string;
  andar: string;
  capacidade: number;
  tipo: string;
  possui_computadores: boolean;
  possui_data_show: boolean;
  possui_internet: boolean;
  possui_ar_condicionado: boolean;
  softwares: string[];
  observacoes: string | null;
};

const emptyForm = {
  bloco_id: "",
  nome: "",
  andar: "",
  capacidade: "",
  tipo: "",
  possui_computadores: false,
  possui_data_show: false,
  possui_internet: false,
  possui_ar_condicionado: false,
  softwares: "",
  observacoes: "",
};

export default function SalasSection() {
  const [blocos, setBlocos] = useState<Bloco[]>([]);
  const [salas, setSalas] = useState<Sala[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [blockData, roomData] = await Promise.all([
        apiFetch<Bloco[]>("/api/blocos"),
        apiFetch<Sala[]>("/api/salas"),
      ]);
      setBlocos(blockData);
      setSalas(roomData);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar salas.");
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
    setForm({ ...emptyForm, bloco_id: blocos[0]?.id ? String(blocos[0].id) : "" });
    setEditingId(null);
    setShowForm(true);
    setError("");
  };

  const edit = (sala: Sala) => {
    setForm({
      bloco_id: String(sala.bloco_id),
      nome: sala.nome,
      andar: sala.andar,
      capacidade: String(sala.capacidade),
      tipo: sala.tipo,
      possui_computadores: sala.possui_computadores,
      possui_data_show: sala.possui_data_show,
      possui_internet: sala.possui_internet,
      possui_ar_condicionado: sala.possui_ar_condicionado,
      softwares: sala.softwares.join(", "),
      observacoes: sala.observacoes || "",
    });
    setEditingId(sala.id);
    setShowForm(true);
    setError("");
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch(editingId ? `/api/salas/${editingId}` : "/api/salas", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify({
          ...form,
          bloco_id: Number(form.bloco_id),
          capacidade: Number(form.capacidade),
          softwares: form.softwares.split(",").map((value) => value.trim()).filter(Boolean),
        }),
      });
      toast.success(editingId ? "Sala atualizada." : "Sala cadastrada.");
      reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar sala.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (sala: Sala) => {
    if (!window.confirm(`Excluir a sala “${sala.nome}”?`)) return;
    try {
      await apiFetch(`/api/salas/${sala.id}`, { method: "DELETE" });
      toast.success("Sala excluída.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir sala.");
    }
  };

  const resourceFields = [
    ["possui_computadores", "Computadores"],
    ["possui_data_show", "Data show"],
    ["possui_internet", "Internet"],
    ["possui_ar_condicionado", "Ar-condicionado"],
  ] as const;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-heading font-bold">Salas</h2>
          <p className="text-sm text-muted-foreground">Gerencie capacidade, tipo e recursos de cada ambiente.</p>
        </div>
        <Button onClick={openNew} disabled={!blocos.length} className="gap-2">
          <Plus className="w-4 h-4" /> Nova sala
        </Button>
      </div>

      {!blocos.length && !loading && (
        <div className="rounded-xl border border-accent/30 bg-accent/10 p-4 text-sm">
          Cadastre ao menos um bloco antes de criar uma sala.
        </div>
      )}

      {showForm && (
        <form onSubmit={save} className="glass-card rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold">{editingId ? "Editar sala" : "Nova sala"}</h3>
            <Button type="button" variant="ghost" size="sm" onClick={reset} className="gap-2">
              <X className="w-4 h-4" /> Cancelar
            </Button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Bloco *</label>
              <select
                value={form.bloco_id}
                onChange={(event) => setForm({ ...form, bloco_id: event.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione</option>
                {blocos.map((bloco) => <option key={bloco.id} value={bloco.id}>{bloco.nome}</option>)}
              </select>
            </div>
            <div><label className="text-sm font-medium mb-1 block">Nome *</label><Input value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} placeholder="Ex.: C 303" /></div>
            <div><label className="text-sm font-medium mb-1 block">Andar *</label><Input value={form.andar} onChange={(event) => setForm({ ...form, andar: event.target.value })} placeholder="Ex.: 3º andar" /></div>
            <div><label className="text-sm font-medium mb-1 block">Capacidade *</label><Input type="number" min={1} value={form.capacidade} onChange={(event) => setForm({ ...form, capacidade: event.target.value })} /></div>
            <div><label className="text-sm font-medium mb-1 block">Tipo *</label><Input value={form.tipo} onChange={(event) => setForm({ ...form, tipo: event.target.value })} placeholder="Sala de aula, laboratório..." /></div>
            <div><label className="text-sm font-medium mb-1 block">Softwares instalados</label><Input value={form.softwares} onChange={(event) => setForm({ ...form, softwares: event.target.value })} placeholder="AutoCAD, VS Code, Blender" /></div>
          </div>
          <div className="flex flex-wrap gap-5">
            {resourceFields.map(([field, label]) => (
              <label key={field} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={form[field]} onCheckedChange={(checked) => setForm({ ...form, [field]: checked === true })} />
                {label}
              </label>
            ))}
          </div>
          <div><label className="text-sm font-medium mb-1 block">Observações</label><Textarea value={form.observacoes} onChange={(event) => setForm({ ...form, observacoes: event.target.value })} rows={3} /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button disabled={saving} className="gap-2"><Save className="w-4 h-4" />{saving ? "Salvando..." : "Salvar sala"}</Button>
        </form>
      )}

      {error && !showForm && <p className="text-sm text-destructive">{error}</p>}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-5 border-b"><h3 className="font-heading font-bold">Salas cadastradas</h3><p className="text-xs text-muted-foreground">{salas.length} registros</p></div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Sala</TableHead><TableHead>Bloco</TableHead><TableHead>Andar</TableHead><TableHead>Tipo</TableHead><TableHead>Capacidade</TableHead><TableHead>Recursos</TableHead><TableHead>Softwares</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={8} className="text-center py-8">Carregando...</TableCell></TableRow>}
              {!loading && !salas.length && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma sala cadastrada.</TableCell></TableRow>}
              {salas.map((sala) => {
                const resources = [sala.possui_computadores && "Computadores", sala.possui_data_show && "Data show", sala.possui_internet && "Internet", sala.possui_ar_condicionado && "Ar"].filter(Boolean);
                return <TableRow key={sala.id}>
                  <TableCell className="font-medium">{sala.nome}</TableCell><TableCell>{sala.bloco_nome}</TableCell><TableCell>{sala.andar}</TableCell><TableCell>{sala.tipo}</TableCell><TableCell>{sala.capacidade}</TableCell><TableCell className="text-xs max-w-48">{resources.join(", ") || "—"}</TableCell><TableCell className="text-xs max-w-48">{sala.softwares.join(", ") || "—"}</TableCell>
                  <TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => edit(sala)}><Edit className="w-4 h-4" /></Button><Button variant="ghost" size="icon" onClick={() => remove(sala)}><Trash2 className="w-4 h-4 text-destructive" /></Button></div></TableCell>
                </TableRow>;
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
