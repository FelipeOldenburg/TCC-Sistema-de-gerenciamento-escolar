import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import cimolLogo from "@/assets/cimol-logo.png";

interface LoginFormProps {
  onLoginSuccess?: (username: string) => void;
}

const LoginForm = ({ onLoginSuccess }: LoginFormProps) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Credenciais pré-definidas
    const ADMIN_USER = "admin";
    const ADMIN_PASS = "admin123";

    setTimeout(() => {
      if (username === ADMIN_USER && password === ADMIN_PASS) {
        // Autenticação bem-sucedida
        localStorage.setItem("admin_user", username);
        localStorage.setItem("admin_logged_in", "true");
        
        if (onLoginSuccess) {
          onLoginSuccess(username);
        }
        navigate("/admin");
      } else {
        setError("Usuário ou senha incorretos");
      }
      setIsLoading(false);
    }, 500);
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
            <Label htmlFor="username" className="text-foreground font-medium">
              Usuário
            </Label>
            <Input
              id="username"
              type="text"
              placeholder="Digite seu usuário"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              className="bg-background/50 border-primary/20 text-foreground placeholder:text-muted-foreground/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground font-medium">
              Senha
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="bg-background/50 border-primary/20 text-foreground placeholder:text-muted-foreground/50"
            />
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-semibold py-2 rounded-lg transition-all"
          >
            {isLoading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Credenciais: <br />
            <strong>Usuário:</strong> admin<br />
            <strong>Senha:</strong> admin123
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
