import { type FormEvent, useEffect, useState } from "react";
import { Building2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { hslToHex, hexToHsl } from "@/lib/colors";
import { setInstitutionBrand, type InstitutionResponse } from "@/lib/institution";

type BrandForm = {
  nome_admin: string;
  nome_sistema: string;
  subtitulo_admin: string;
  logo_url: string;
  cor_primaria_hsl: string;
  cor_acento_hsl: string;
  cor_header_hsl: string;
  cor_nav_hsl: string;
  cor_nav_ativa_hsl: string;
};

const emptyForm: BrandForm = {
  nome_admin: "",
  nome_sistema: "",
  subtitulo_admin: "",
  logo_url: "",
  cor_primaria_hsl: "220 9% 46%",
  cor_acento_hsl: "215 16% 47%",
  cor_header_hsl: "222 10% 24%",
  cor_nav_hsl: "220 9% 32%",
  cor_nav_ativa_hsl: "220 8% 42%",
};

const colorFields: { key: keyof Pick<BrandForm, "cor_primaria_hsl" | "cor_acento_hsl" | "cor_header_hsl" | "cor_nav_hsl" | "cor_nav_ativa_hsl">; label: string }[] = [
  { key: "cor_primaria_hsl", label: "Primária" },
  { key: "cor_acento_hsl", label: "Destaque" },
  { key: "cor_header_hsl", label: "Cabeçalho" },
  { key: "cor_nav_hsl", label: "Navegação" },
  { key: "cor_nav_ativa_hsl", label: "Navegação ativa" },
];

const toForm = (brand: InstitutionResponse): BrandForm => ({
  nome_admin: brand.adminName,
  nome_sistema: brand.systemName,
  subtitulo_admin: brand.adminSubtitle,
  logo_url: brand.logoUrl || "",
  cor_primaria_hsl: brand.colors.primary,
  cor_acento_hsl: brand.colors.accent,
  cor_header_hsl: brand.colors.header,
  cor_nav_hsl: brand.colors.nav,
  cor_nav_ativa_hsl: brand.colors.navActive,
});

const InstitutionIdentitySection = () => {
  const [form, setForm] = useState<BrandForm>(emptyForm);
  const [institutionName, setInstitutionName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<InstitutionResponse>("/api/instituicao")
      .then((brand) => {
        setInstitutionName(brand.name);
        setForm(toForm(brand));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar identidade."))
      .finally(() => setLoading(false));
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const brand = await apiFetch<InstitutionResponse>("/api/instituicao", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setInstitutionBrand(brand);
      setInstitutionName(brand.name);
      setForm(toForm(brand));
      toast.success("Identidade atualizada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar identidade.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Carregando identidade...</div>;
  }

  return (
    <form onSubmit={save} className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-heading font-bold text-foreground">Identidade da instituição</h2>
        <p className="text-sm text-muted-foreground">{institutionName}</p>
      </div>

      <div className="glass-card rounded-2xl p-6 space-y-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-border bg-background p-2">
            {form.logo_url ? (
              <img src={form.logo_url} alt={institutionName} className="h-full w-full object-contain" />
            ) : (
              <Building2 className="h-9 w-9 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-sm font-medium">URL do símbolo</label>
            <Input value={form.logo_url} onChange={(event) => setForm({ ...form, logo_url: event.target.value })} maxLength={500} placeholder="https://..." />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Nome no painel *</label>
            <Input required value={form.nome_admin} onChange={(event) => setForm({ ...form, nome_admin: event.target.value })} maxLength={120} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Nome do sistema *</label>
            <Input required value={form.nome_sistema} onChange={(event) => setForm({ ...form, nome_sistema: event.target.value })} maxLength={160} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Subtítulo do painel *</label>
            <Input required value={form.subtitulo_admin} onChange={(event) => setForm({ ...form, subtitulo_admin: event.target.value })} maxLength={160} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {colorFields.map((field) => (
            <div key={field.key}>
              <label className="mb-1 block text-sm font-medium">{field.label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={hslToHex(form[field.key])}
                  onChange={(event) => setForm({ ...form, [field.key]: hexToHsl(event.target.value, form[field.key]) })}
                  className="h-10 w-12 rounded-md border border-input bg-background p-1"
                />
                <Input value={form[field.key]} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} className="text-xs" />
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button disabled={saving} className="gap-2">
          <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar identidade"}
        </Button>
      </div>
    </form>
  );
};

export default InstitutionIdentitySection;
