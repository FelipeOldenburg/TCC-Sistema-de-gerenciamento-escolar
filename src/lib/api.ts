export type UserRole = "ADMIN" | "CPD";

export type SessionUser = {
  id: number;
  nome: string;
  usuario: string;
  papel: UserRole;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "";

export const apiUrl = (url: string) => {
  if (!apiBaseUrl || /^https?:\/\//i.test(url)) return url;
  return `${apiBaseUrl}${url.startsWith("/") ? url : `/${url}`}`;
};

export async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(apiUrl(url), {
    ...init,
    headers,
    credentials: apiBaseUrl ? "include" : "same-origin",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(data?.message || "Não foi possível concluir a operação.", response.status);
  }
  return data as T;
}
