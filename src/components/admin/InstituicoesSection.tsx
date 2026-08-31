import { type FormEvent, useEffect, useState } from "react";
import { Building2, Edit, Plus, Save, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Instituicao = {
  id: number;
  slug: string;
  nome: string;
  nome_admin: string;
  nome_sistema: string;
  subtitulo_admin: string;
  logo_url: string | null;
  cor_primaria_hsl: string;
  cor_acento_hsl: string;
  cor_header_hsl: string;
  cor_nav_hsl: string;
  cor_nav_ativa_hsl: string;
  ativo: boolean;
  total_usuarios: number;
  total_salas: number;
  total_importacoes: number;
};

type InstituicaoForm = {
  slug: string;
  nome: string;
  nome_admin: string;
  nome_sistema: string;
  subtitulo_admin: string;
  logo_url: string;
  cor_primaria_hsl: string;
  cor_acento_hsl: string;
  cor_header_hsl: string;
  cor_nav_hsl: string;
  cor_nav_ativa_hsl: string;
  ativo: boolean;
};

type ColorKey =
  | "cor_primaria_hsl"
  | "cor_acento_hsl"
  | "cor_header_hsl"
  | "cor_nav_hsl"
  | "cor_nav_ativa_hsl";

const emptyForm: InstituicaoForm = {
  slug: "",
  nome: "",
  nome_admin: "",
  nome_sistema: "Sistema de Gestão Escolar",
  subtitulo_admin: "Painel Administrativo",
  logo_url: "",
  cor_primaria_hsl: "228 65% 48%",
  cor_acento_hsl: "45 100% 51%",
  cor_header_hsl: "228 62% 32%",
  cor_nav_hsl: "228 62% 42%",
  cor_nav_ativa_hsl: "228 50% 52%",
  ativo: true,
};

const colorFields: { key: ColorKey; label: string }[] = [
  { key: "cor_primaria_hsl", label: "Primária" },
  { key: "cor_acento_hsl", label: "Destaque" },
  { key: "cor_header_hsl", label: "Cabeçalho" },
  { key: "cor_nav_hsl", label: "Navegação" },
  { key: "cor_nav_ativa_hsl", label: "Navegação ativa" },
];

const hslRegex = /^(\d{1,3}(?:\.\d+)?)\s+(\d{1,3}(?:\.\d+)?)%\s+(\d{1,3}(?:\.\d+)?)%$/;

const componentToHex = (value: number) =>
  Math.round(value * 255)
    .toString(16)
    .padStart(2, "0");

const hslToHex = (value: string) => {
  const match = value.match(hslRegex);
  if (!match) return "#1f5dcc";
  const h = (Number(match[1]) % 360) / 360;
  const s = Math.min(100, Math.max(0, Number(match[2]))) / 100;
  const l = Math.min(100, Math.max(0, Number(match[3]))) / 100;

  if (s === 0) return `#${componentToHex(l)}${componentToHex(l)}${componentToHex(l)}`;

  const hueToRgb = (p: number, q: number, tValue: number) => {
    let t = tValue;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return `#${componentToHex(hueToRgb(p, q, h + 1 / 3))}${componentToHex(hueToRgb(p, q, h))}${componentToHex(hueToRgb(p, q, h - 1 / 3))}`;
};

const hexToHsl = (hex: string) => {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return emptyForm.cor_primaria_hsl;
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }

  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

const toForm = (instituicao: Instituicao): InstituicaoForm => ({
  slug: instituicao.slug,
  nome: instituicao.nome,
  nome_admin: instituicao.nome_admin,
  nome_sistema: instituicao.nome_sistema,
  subtitulo_admin: instituicao.subtitulo_admin,
  logo_url: instituicao.logo_url || "",
  cor_primaria_hsl: instituicao.cor_primaria_hsl,
  cor_acento_hsl: instituicao.cor_acento_hsl,
  cor_header_hsl: instituicao.cor_header_hsl,
  cor_nav_hsl: instituicao.cor_nav_hsl,
  cor_nav_ativa_hsl: instituicao.cor_nav_ativa_hsl,
  ativo: instituicao.ativo,
});

export default function InstituicoesSection() {
  const [instituicoes, setInstituicoes] = useState<Instituicao[]>([]);
  const [form, setForm] = useState<InstituicaoForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setInstituicoes(await apiFetch<Instituicao[]>("/api/instituicoes"));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar instituições.");
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

  const edit = (instituicao: Instituicao) => {
    setForm(toForm(instituicao));
    setEditingId(instituicao.id);
    setShowForm(true);
    setError("");
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch(editingId ? `/api/instituicoes/${editingId}` : "/api/instituicoes", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      toast.success(editingId ? "Instituição atualizada." : "Instituição cadastrada.");
      reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar instituição.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">Instituições</h2>
          <p className="text-sm text-muted-foreground">Controle as escolas vinculadas ao serviço.</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nova instituição
        </Button>
      </div>

      {showForm && (
        <form onSubmit={save} className="glass-card rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-heading font-bold">{editingId ? "Editar instituição" : "Nova instituição"}</h3>
            <Button type="button" variant="ghost" size="sm" onClick={reset} className="gap-2">
              <X className="h-4 w-4" /> Cancelar
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Nome *</label>
              <Input value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} maxLength={120} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Slug *</label>
              <Input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} maxLength={60} placeholder="exemplo-escola" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Nome no painel *</label>
              <Input value={form.nome_admin} onChange={(event) => setForm({ ...form, nome_admin: event.target.value })} maxLength={120} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Nome do sistema *</label>
              <Input value={form.nome_sistema} onChange={(event) => setForm({ ...form, nome_sistema: event.target.value })} maxLength={160} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Subtítulo do painel *</label>
              <Input value={form.subtitulo_admin} onChange={(event) => setForm({ ...form, subtitulo_admin: event.target.value })} maxLength={160} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">URL do logo</label>
              <Input value={form.logo_url} onChange={(event) => setForm({ ...form, logo_url: event.target.value })} maxLength={500} placeholder="https://..." />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {colorFields.map((field) => (
              <div key={field.key}>
                <label className="text-sm font-medium mb-1 block">{field.label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={hslToHex(String(form[field.key]))}
                    onChange={(event) => setForm({ ...form, [field.key]: hexToHsl(event.target.value) })}
                    className="h-10 w-12 rounded-md border border-input bg-background p-1"
                  />
                  <Input
                    value={String(form[field.key])}
                    onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                    className="text-xs"
                  />
                </div>
              </div>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={form.ativo} onCheckedChange={(checked) => setForm({ ...form, ativo: checked === true })} />
            Instituição ativa
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button disabled={saving} className="gap-2">
            <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar instituição"}
          </Button>
        </form>
      )}

      {error && !showForm && <p className="text-sm text-destructive">{error}</p>}

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-5 border-b">
          <h3 className="font-heading font-bold">Instituições cadastradas</h3>
          <p className="text-xs text-muted-foreground">{instituicoes.length} registros</p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instituição</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dados</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Carregando...</TableCell>
                </TableRow>
              )}
              {!loading && !instituicoes.length && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Nenhuma instituição cadastrada.</TableCell>
                </TableRow>
              )}
              {instituicoes.map((instituicao) => (
                <TableRow key={instituicao.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        {instituicao.logo_url ? (
                          <img src={instituicao.logo_url} alt={instituicao.nome} className="h-full w-full rounded-lg object-contain" />
                        ) : (
                          <Building2 className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{instituicao.nome}</p>
                        <p className="text-xs text-muted-foreground">{instituicao.nome_sistema}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{instituicao.slug}</TableCell>
                  <TableCell>
                    <Badge className={instituicao.ativo ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-slate-100 text-slate-700 border-slate-200"}>
                      {instituicao.ativo ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {instituicao.total_usuarios} usuários · {instituicao.total_salas} salas · {instituicao.total_importacoes} importações
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button variant="ghost" size="icon" onClick={() => edit(instituicao)} title="Editar">
                        <Edit className="h-4 w-4" />
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
