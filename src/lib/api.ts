export class ApiError extends Error {
  readonly status: number;
  readonly hint?: string;
  readonly code?: string;

  constructor(
    message: string,
    status: number,
    options?: {
      hint?: string;
      code?: string;
    },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.hint = options?.hint;
    this.code = options?.code;
  }
}

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "");
const normalizePath = (value: string) => (value.startsWith("/") ? value : `/${value}`);
const API_BASE = normalizeBaseUrl((import.meta as any).env?.VITE_API_BASE_URL || "");

const friendlyStatusMessage = (status: number) => {
  if (status === 400) return "Dados inválidos enviados para a API";
  if (status === 401) return "Sessão inválida ou expirada";
  if (status === 403) return "Você não tem permissão para esta ação";
  if (status === 404) return "Recurso não encontrado na API";
  if (status === 409) return "Conflito ao processar a solicitação";
  if (status === 502) return "Falha ao comunicar com serviço externo";
  if (status >= 500) return "Erro interno no servidor";
  return `Erro ${status} na requisição`;
};

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const hasBody = init.body !== undefined && init.body !== null;
  const response = await fetch(`${API_BASE}${normalizePath(path)}`, {
    ...init,
    headers: hasBody
      ? {
          "Content-Type": "application/json",
          ...(init.headers || {}),
        }
      : init.headers,
    credentials: "include",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const payload = data as Record<string, unknown>;
    const message = String(payload.error || friendlyStatusMessage(response.status));
    const hint = payload.hint ? String(payload.hint) : undefined;
    const code = payload.code ? String(payload.code) : undefined;
    throw new ApiError(message, response.status, { hint, code });
  }

  return data as T;
}
