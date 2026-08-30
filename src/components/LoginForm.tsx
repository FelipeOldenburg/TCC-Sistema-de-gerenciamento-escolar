import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { useInstitutionBrand } from "@/lib/institution";

interface LoginFormProps {
  onLoginSuccess?: (username: string) => void;
}

const testLogins = [
  { role: "ADMIN", username: "admin", password: "admin123" },
  { role: "CPD", username: "cpd", password: "cpd123" },
];

const LoginForm = ({ onLoginSuccess }: LoginFormProps) => {
  const brand = useInstitutionBrand();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState("");
  const navigate = useNavigate();
  const showTestLogins = import.meta.env.VITE_SHOW_TEST_LOGINS === "true";

  const copyValue = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(""), 2000);
    } catch {
      setError("Não foi possível copiar.");
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ usuario: username, senha: password }),
      });
      onLoginSuccess?.(username);
      navigate("/admin");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Não foi possível entrar.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center p-4">
      <div className="glass-card rounded-3xl p-8 w-full max-w-md space-y-6 shadow-2xl">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-accent/20 p-1 ring-2 ring-accent/30">
            <img src={brand.logo} alt={brand.name} className="w-full h-full object-contain" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-heading font-bold text-foreground">{brand.name}</h1>
            <p className="text-sm text-muted-foreground">{brand.adminSubtitle}</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-foreground font-medium">Usuário</Label>
            <Input
              id="username"
              type="text"
              autoComplete="username"
              placeholder="Digite seu usuário"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={isLoading}
              required
              className="bg-background/50 border-primary/20 text-foreground placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground font-medium">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Digite sua senha"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isLoading}
              required
              className="bg-background/50 border-primary/20 text-foreground placeholder:text-muted-foreground/50"
            />
          </div>
          {error && <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-lg">{error}</div>}
          <Button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-semibold py-2 rounded-lg transition-all">
            {isLoading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
        {showTestLogins ? <div className="border-t border-primary/10 pt-4">
          <p className="text-xs font-semibold text-foreground">Logins de teste</p>
          <div className="mt-2 space-y-2 text-xs text-muted-foreground">
            {testLogins.map((login) => (
              <div key={login.username} className="grid grid-cols-[52px_1fr] gap-x-2 gap-y-0.5">
                <span className="font-semibold text-foreground">{login.role}</span>
                <span className="flex items-center gap-1.5">
                  Usuario:
                  <button
                    type="button"
                    onClick={() => copyValue(login.username, `${login.username}-usuario`)}
                    className="inline-flex items-center gap-1 rounded border border-primary/15 bg-background/60 px-1.5 py-0.5 text-foreground transition hover:bg-primary/10"
                    aria-label={`Copiar usuario ${login.username}`}
                  >
                    <code>{login.username}</code>
                    {copiedKey === `${login.username}-usuario` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </button>
                </span>
                <span />
                <span className="flex items-center gap-1.5">
                  Senha:
                  <button
                    type="button"
                    onClick={() => copyValue(login.password, `${login.username}-senha`)}
                    className="inline-flex min-w-0 items-center gap-1 rounded border border-primary/15 bg-background/60 px-1.5 py-0.5 text-foreground transition hover:bg-primary/10"
                    aria-label={`Copiar senha de ${login.username}`}
                  >
                    <code className="break-all">{login.password}</code>
                    {copiedKey === `${login.username}-senha` ? <Check className="h-3 w-3 shrink-0" /> : <Copy className="h-3 w-3 shrink-0" />}
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div> : <p className="text-center text-xs text-muted-foreground">
          Use as credenciais fornecidas pela administração ou pelo CPD.
        </p>}
      </div>
    </div>
  );
};

export default LoginForm;
