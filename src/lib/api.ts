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

export async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: "same-origin",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(data?.message || "Não foi possível concluir a operação.", response.status);
  }
  return data as T;
}
