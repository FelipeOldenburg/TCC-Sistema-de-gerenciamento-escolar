import { Building2, LogOut } from "lucide-react";
import InstituicoesSection from "@/components/admin/InstituicoesSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePlatformController } from "@/controllers/usePlatformController";

const PlatformPage = () => {
  const { user, checkingAuth, username, setUsername, password, setPassword, error, loading, login, logout } = usePlatformController();

  if (checkingAuth) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Verificando acesso...</div>;
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <form onSubmit={login} className="glass-card rounded-2xl p-8 w-full max-w-md space-y-5 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-heading font-bold text-foreground">Gestão da plataforma</h1>
              <p className="text-sm text-muted-foreground">Controle das instituições atendidas</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="platform-user">Usuário</Label>
            <Input id="platform-user" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="platform-password">Senha</Label>
            <Input id="platform-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </div>
          {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          <Button disabled={loading} className="w-full">{loading ? "Entrando..." : "Entrar"}</Button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-heading text-lg font-bold text-foreground">Gestão da plataforma</h1>
              <p className="text-xs text-muted-foreground">{user.nome}</p>
            </div>
          </div>
          <Button variant="ghost" onClick={logout} className="gap-2">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl p-6 md:p-8">
        <InstituicoesSection />
      </div>
    </main>
  );
};

export default PlatformPage;
