import { useEffect, useState } from "react";
import { Edit, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Bloco = {
  id: number;
  nome: string;
  descricao: string | null;
  total_salas: number;
};

const emptyForm = { nome: "", descricao: "" };

export default function BlocosSection() {
  const [blocos, setBlocos] = useState<Bloco[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setBlocos(await apiFetch<Bloco[]>("/api/blocos"));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar blocos.");
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
    setError("");
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.nome.trim()) {
      setError("Informe o nome do bloco.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiFetch(editingId ? `/api/blocos/${editingId}` : "/api/blocos", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      toast.success(editingId ? "Bloco atualizado." : "Bloco cadastrado.");
      reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar bloco.");
    } finally {
      setSaving(false);
    }
  };

  const edit = (bloco: Bloco) => {
    setEditingId(bloco.id);
    setForm({ nome: bloco.nome, descricao: bloco.descricao || "" });
    setError("");
  };

  const remove = async (bloco: Bloco) => {
    if (!window.confirm(`Excluir o bloco “${bloco.nome}”?`)) return;
    try {
      await apiFetch(`/api/blocos/${bloco.id}`, { method: "DELETE" });
      toast.success("Bloco excluído.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir bloco.");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-heading font-bold text-foreground">Blocos</h2>
        <p className="text-sm text-muted-foreground">Cadastre os blocos antes de adicionar suas salas.</p>
      </div>

      <form onSubmit={save} className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-heading font-bold">{editingId ? "Editar bloco" : "Novo bloco"}</h3>
          {editingId && (
            <Button type="button" variant="ghost" size="sm" onClick={reset} className="gap-2">
              <X className="w-4 h-4" /> Cancelar
            </Button>
          )}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Nome *</label>
            <Input
              value={form.nome}
              onChange={(event) => setForm({ ...form, nome: event.target.value })}
              placeholder="Ex.: Bloco A"
              maxLength={120}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Descrição</label>
            <Textarea
              value={form.descricao}
              onChange={(event) => setForm({ ...form, descricao: event.target.value })}
              placeholder="Localização e características do bloco"
              rows={2}
            />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button disabled={saving} className="gap-2">
          {editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar bloco"}
        </Button>
      </form>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-5 border-b">
          <h3 className="font-heading font-bold">Blocos cadastrados</h3>
          <p className="text-xs text-muted-foreground">{blocos.length} registros</p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Salas</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={4} className="text-center py-8">Carregando...</TableCell></TableRow>}
              {!loading && !blocos.length && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum bloco cadastrado.</TableCell></TableRow>}
              {blocos.map((bloco) => (
                <TableRow key={bloco.id}>
                  <TableCell className="font-medium">{bloco.nome}</TableCell>
                  <TableCell className="max-w-md text-muted-foreground">{bloco.descricao || "—"}</TableCell>
                  <TableCell>{bloco.total_salas}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => edit(bloco)} title="Editar">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(bloco)} title="Excluir">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
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
