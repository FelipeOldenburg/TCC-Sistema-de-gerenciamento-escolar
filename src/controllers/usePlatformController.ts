import { type FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type PlatformUser = {
  id: number;
  nome: string;
  usuario: string;
};

export const usePlatformController = () => {
  const [user, setUser] = useState<PlatformUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Gestão da plataforma";
    apiFetch<{ user: PlatformUser }>("/api/plataforma/auth/me")
      .then((response) => setUser(response.user))
      .catch(() => setUser(null))
      .finally(() => setCheckingAuth(false));
  }, []);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await apiFetch<{ user: PlatformUser }>("/api/plataforma/auth/login", {
        method: "POST",
        body: JSON.stringify({ usuario: username, senha: password }),
      });
      setUser(response.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await apiFetch("/api/plataforma/auth/logout", { method: "POST", body: JSON.stringify({}) }).catch(() => null);
    setUser(null);
  };

  return {
    user,
    checkingAuth,
    username,
    setUsername,
    password,
    setPassword,
    error,
    loading,
    login,
    logout,
  };
};
