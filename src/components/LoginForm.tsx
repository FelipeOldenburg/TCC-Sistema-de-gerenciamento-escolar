import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import cimolLogo from "@/assets/cimol-logo.png";
import { apiFetch } from "@/lib/api";

interface LoginFormProps {
  onLoginSuccess?: (username: string) => void;
}

const testLogins = [
  { role: "ADMIN", username: "admin", password: "admin123" },
  { role: "CPD", username: "cpd", password: "cpd123" },
];
const testLoginsText = testLogins
  .map((login) => `${login.role}\nUsuario: ${login.username}\nSenha: ${login.password}`)
  .join("\n\n");

const LoginForm = ({ onLoginSuccess }: LoginFormProps) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const copyTestLogins = async () => {
    try {
      await navigator.clipboard.writeText(testLoginsText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Não foi possível copiar os acessos.");
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
            <img src={cimolLogo} alt="CIMOL" className="w-full h-full object-contain" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-heading font-bold text-foreground">CIMOL</h1>
            <p className="text-sm text-muted-foreground">Painel Administrativo</p>
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
        <div className="border-t border-primary/10 pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-foreground">Logins de teste</p>
            <Button type="button" variant="outline" size="sm" onClick={copyTestLogins} className="h-8 gap-2 text-xs">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado" : "Copiar acessos"}
            </Button>
          </div>
          <div className="mt-2 space-y-2 text-xs text-muted-foreground">
            {testLogins.map((login) => (
              <div key={login.username} className="grid grid-cols-[52px_1fr] gap-x-2 gap-y-0.5">
                <span className="font-semibold text-foreground">{login.role}</span>
                <span>
                  Usuario: <code className="text-foreground">{login.username}</code>
                </span>
                <span />
                <span>
                  Senha: <code className="text-foreground break-all">{login.password}</code>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
