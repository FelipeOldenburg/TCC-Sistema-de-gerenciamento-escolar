export type UserRole = "ADMIN" | "CPD";

export type SessionUser = {
  id: number;
  instituicao_id: number;
  instituicao_slug: string;
  nome: string;
  usuario: string;
  papel: UserRole;
  gerencia_instituicoes: boolean;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  availableAt?: string;

  constructor(message: string, status: number, details: { code?: string; availableAt?: string } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = details.code;
    this.availableAt = details.availableAt;
  }
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "";
export const INSTITUTION_SLUG_STORAGE_KEY = "design-compass.institutionSlug";

const normalizeInstitutionSlug = (value: string | null) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 60);

export const selectedInstitutionSlug = () => {
  if (typeof window === "undefined") return "";
  const urlSlug = normalizeInstitutionSlug(new URLSearchParams(window.location.search).get("instituicao"));
  if (urlSlug) {
    window.localStorage.setItem(INSTITUTION_SLUG_STORAGE_KEY, urlSlug);
    return urlSlug;
  }
  return normalizeInstitutionSlug(window.localStorage.getItem(INSTITUTION_SLUG_STORAGE_KEY));
};

export const apiUrl = (url: string) => {
  if (!apiBaseUrl || /^https?:\/\//i.test(url)) return url;
  return `${apiBaseUrl}${url.startsWith("/") ? url : `/${url}`}`;
};

export async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (
    !headers.has("x-institution-slug") &&
    url.startsWith("/api/") &&
    !url.startsWith("/api/plataforma/") &&
    !url.startsWith("/api/instituicoes")
  ) {
    const slug = selectedInstitutionSlug();
    if (slug) headers.set("x-institution-slug", slug);
  }

  const response = await fetch(apiUrl(url), {
    ...init,
    headers,
    credentials: apiBaseUrl ? "include" : "same-origin",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(data?.message || "Não foi possível concluir a operação.", response.status, {
      code: data?.error,
      availableAt: data?.availableAt,
    });
  }
  return data as T;
}
