import { type FormEvent, useEffect, useState } from "react";
import { Building2, Edit, LogIn, Plus, Save, Users, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { hslToHex, hexToHsl } from "@/lib/colors";
import { selectInstitutionSlug } from "@/lib/institution";
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
  admin_nome: string;
  admin_usuario: string;
  admin_senha: string;
  cor_primaria_hsl: string;
  cor_acento_hsl: string;
  cor_header_hsl: string;
  cor_nav_hsl: string;
  cor_nav_ativa_hsl: string;
  ativo: boolean;
};

type UsuarioInstituicao = {
  id: number;
  nome: string;
  usuario: string;
  papel: "ADMIN" | "CPD";
  ativo: boolean;
};

type UsuarioForm = {
  nome: string;
  usuario: string;
  senha: string;
  papel: "ADMIN" | "CPD";
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
  admin_nome: "Administrador da escola",
  admin_usuario: "",
  admin_senha: "",
  cor_primaria_hsl: "220 9% 46%",
  cor_acento_hsl: "215 16% 47%",
  cor_header_hsl: "222 10% 24%",
  cor_nav_hsl: "220 9% 32%",
  cor_nav_ativa_hsl: "220 8% 42%",
  ativo: true,
};

const emptyUserForm: UsuarioForm = {
  nome: "",
  usuario: "",
  senha: "",
  papel: "ADMIN",
  ativo: true,
};

const colorFields: { key: ColorKey; label: string }[] = [
  { key: "cor_primaria_hsl", label: "Primária" },
  { key: "cor_acento_hsl", label: "Destaque" },
  { key: "cor_header_hsl", label: "Cabeçalho" },
  { key: "cor_nav_hsl", label: "Navegação" },
  { key: "cor_nav_ativa_hsl", label: "Navegação ativa" },
];

const toForm = (instituicao: Instituicao): InstituicaoForm => ({
  slug: instituicao.slug,
  nome: instituicao.nome,
  nome_admin: instituicao.nome_admin,
  nome_sistema: instituicao.nome_sistema,
  subtitulo_admin: instituicao.subtitulo_admin,
  logo_url: instituicao.logo_url || "",
  admin_nome: "",
  admin_usuario: "",
  admin_senha: "",
  cor_primaria_hsl: instituicao.cor_primaria_hsl,
  cor_acento_hsl: instituicao.cor_acento_hsl,
  cor_header_hsl: instituicao.cor_header_hsl,
  cor_nav_hsl: instituicao.cor_nav_hsl,
  cor_nav_ativa_hsl: instituicao.cor_nav_ativa_hsl,
  ativo: instituicao.ativo,
});

export default function InstituicoesSection() {
  const navigate = useNavigate();
  const [instituicoes, setInstituicoes] = useState<Instituicao[]>([]);
  const [form, setForm] = useState<InstituicaoForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedInstitution, setSelectedInstitution] = useState<Instituicao | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioInstituicao[]>([]);
  const [userForm, setUserForm] = useState<UsuarioForm>(emptyUserForm);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [userError, setUserError] = useState("");

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

  const enterInstitution = (instituicao: Instituicao) => {
    selectInstitutionSlug(instituicao.slug);
    navigate("/");
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

  const loadUsers = async (instituicao = selectedInstitution) => {
    if (!instituicao) return;
    setLoadingUsers(true);
    try {
      setUsuarios(await apiFetch<UsuarioInstituicao[]>(`/api/instituicoes/${instituicao.id}/usuarios`));
      setUserError("");
    } catch (err) {
      setUserError(err instanceof Error ? err.message : "Erro ao carregar usuários.");
    } finally {
      setLoadingUsers(false);
    }
  };

  const openUsers = async (instituicao: Instituicao) => {
    setSelectedInstitution(instituicao);
    setUsuarios([]);
    setUserForm(emptyUserForm);
    setEditingUserId(null);
    setShowUserForm(false);
    setUserError("");
    await loadUsers(instituicao);
  };

  const resetUser = () => {
    setUserForm(emptyUserForm);
    setEditingUserId(null);
    setShowUserForm(false);
    setUserError("");
  };

  const editUser = (usuario: UsuarioInstituicao) => {
    setUserForm({
      nome: usuario.nome,
      usuario: usuario.usuario,
      senha: "",
      papel: usuario.papel,
      ativo: usuario.ativo,
    });
    setEditingUserId(usuario.id);
    setShowUserForm(true);
    setUserError("");
  };

  const saveUser = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedInstitution) return;
    setSavingUser(true);
    setUserError("");
    try {
      await apiFetch(
        editingUserId
          ? `/api/instituicoes/${selectedInstitution.id}/usuarios/${editingUserId}`
          : `/api/instituicoes/${selectedInstitution.id}/usuarios`,
        {
          method: editingUserId ? "PUT" : "POST",
          body: JSON.stringify(userForm),
        }
      );
      toast.success(editingUserId ? "Usuário atualizado." : "Usuário cadastrado.");
      resetUser();
      await loadUsers(selectedInstitution);
      await load();
    } catch (err) {
      setUserError(err instanceof Error ? err.message : "Erro ao salvar usuário.");
    } finally {
      setSavingUser(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">Instituições</h2>
          <p className="text-sm text-muted-foreground">Controle as escolas vinculadas ao serviço.</p>
        </div>
        <Button
          onClick={() => {
            setForm(emptyForm);
            setEditingId(null);
            setShowForm(true);
          }}
          className="gap-2"
        >
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
              <Input required value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} maxLength={120} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Slug *</label>
              <Input required value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} maxLength={60} placeholder="exemplo-escola" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Nome no painel *</label>
              <Input required value={form.nome_admin} onChange={(event) => setForm({ ...form, nome_admin: event.target.value })} maxLength={120} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Nome do sistema *</label>
              <Input required value={form.nome_sistema} onChange={(event) => setForm({ ...form, nome_sistema: event.target.value })} maxLength={160} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Subtítulo do painel *</label>
              <Input required value={form.subtitulo_admin} onChange={(event) => setForm({ ...form, subtitulo_admin: event.target.value })} maxLength={160} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">URL do logo</label>
              <Input value={form.logo_url} onChange={(event) => setForm({ ...form, logo_url: event.target.value })} maxLength={500} placeholder="https://..." />
            </div>
          </div>

          {!editingId && (
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Nome do admin *</label>
                <Input required value={form.admin_nome} onChange={(event) => setForm({ ...form, admin_nome: event.target.value })} maxLength={120} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Usuário admin *</label>
                <Input required value={form.admin_usuario} onChange={(event) => setForm({ ...form, admin_usuario: event.target.value })} maxLength={60} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Senha inicial *</label>
                <Input required type="password" value={form.admin_senha} onChange={(event) => setForm({ ...form, admin_senha: event.target.value })} minLength={6} />
              </div>
            </div>
          )}

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
            Serviço ativo
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button disabled={saving} className="gap-2">
            <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar instituição"}
          </Button>
        </form>
      )}

      {error && !showForm && <p className="text-sm text-destructive">{error}</p>}

      <div>
        <h3 className="font-heading font-bold">Instituições cadastradas</h3>
        <p className="text-xs text-muted-foreground">{instituicoes.length} registros</p>
      </div>

      {loading && <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>}
      {!loading && !instituicoes.length && <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma instituição cadastrada.</p>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {instituicoes.map((instituicao) => (
          <article key={instituicao.id} className="glass-card rounded-2xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {instituicao.logo_url ? (
                    <img src={instituicao.logo_url} alt={instituicao.nome} className="h-full w-full rounded-lg object-contain" />
                  ) : (
                    <Building2 className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="truncate font-heading font-bold text-foreground">{instituicao.nome}</h4>
                  <p className="truncate font-mono text-xs text-muted-foreground">{instituicao.slug}</p>
                </div>
              </div>
              <Badge className={instituicao.ativo ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-slate-100 text-slate-700 border-slate-200"}>
                {instituicao.ativo ? "Ativo" : "Bloqueado"}
              </Badge>
            </div>

            <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">{instituicao.nome_sistema}</p>

            <div className="grid grid-cols-3 gap-2 border-y border-border py-3 text-center text-xs text-muted-foreground">
              <div>
                <span className="block text-base font-bold text-foreground">{instituicao.total_usuarios}</span>
                Usuários
              </div>
              <div>
                <span className="block text-base font-bold text-foreground">{instituicao.total_salas}</span>
                Salas
              </div>
              <div>
                <span className="block text-base font-bold text-foreground">{instituicao.total_importacoes}</span>
                Importações
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <Button type="button" size="sm" onClick={() => enterInstitution(instituicao)} disabled={!instituicao.ativo} className="gap-2">
                <LogIn className="h-4 w-4" /> Entrar
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => edit(instituicao)} className="gap-2">
                <Edit className="h-4 w-4" /> Gerenciar
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => openUsers(instituicao)} className="gap-2">
                <Users className="h-4 w-4" /> Usuários
              </Button>
            </div>
          </article>
        ))}
      </div>

      {selectedInstitution && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="p-5 border-b flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h3 className="font-heading font-bold">Usuários de {selectedInstitution.nome}</h3>
              <p className="text-xs text-muted-foreground">{usuarios.length} usuários vinculados</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowUserForm(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Novo usuário
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedInstitution(null)} title="Fechar" aria-label="Fechar usuários">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {showUserForm && (
            <form onSubmit={saveUser} className="p-5 border-b space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Nome *</label>
                  <Input value={userForm.nome} onChange={(event) => setUserForm({ ...userForm, nome: event.target.value })} maxLength={120} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Usuário *</label>
                  <Input value={userForm.usuario} onChange={(event) => setUserForm({ ...userForm, usuario: event.target.value })} maxLength={60} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Senha {editingUserId ? "" : "*"}</label>
                  <Input
                    type="password"
                    value={userForm.senha}
                    onChange={(event) => setUserForm({ ...userForm, senha: event.target.value })}
                    placeholder={editingUserId ? "Deixe em branco para manter" : ""}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Papel *</label>
                  <select
                    value={userForm.papel}
                    onChange={(event) => setUserForm({ ...userForm, papel: event.target.value as UsuarioForm["papel"] })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="CPD">CPD</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={userForm.ativo} onCheckedChange={(checked) => setUserForm({ ...userForm, ativo: checked === true })} />
                Usuário ativo
              </label>

              {userError && <p className="text-sm text-destructive">{userError}</p>}
              <div className="flex gap-2">
                <Button disabled={savingUser} className="gap-2">
                  <Save className="h-4 w-4" /> {savingUser ? "Salvando..." : "Salvar usuário"}
                </Button>
                <Button type="button" variant="ghost" onClick={resetUser}>Cancelar</Button>
              </div>
            </form>
          )}

          {userError && !showUserForm && <p className="px-5 pt-4 text-sm text-destructive">{userError}</p>}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingUsers && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Carregando...</TableCell>
                  </TableRow>
                )}
                {!loadingUsers && !usuarios.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Nenhum usuário cadastrado.</TableCell>
                  </TableRow>
                )}
                {usuarios.map((usuario) => (
                  <TableRow key={usuario.id}>
                    <TableCell className="font-medium">{usuario.nome}</TableCell>
                    <TableCell className="font-mono text-xs">{usuario.usuario}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{usuario.papel}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={usuario.ativo ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-slate-100 text-slate-700 border-slate-200"}>
                        {usuario.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button variant="ghost" size="icon" onClick={() => editUser(usuario)} title="Editar usuário" aria-label="Editar usuário">
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
      )}
    </div>
  );
}
