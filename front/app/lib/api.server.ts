import { data, redirect } from "react-router";

import { getToken, redirectToLogin } from "./session.server";
import type {
  ConversionResult,
  Customer,
  CustomerSummary,
  Opportunity,
  OpportunityDetail,
  Order,
  StageKey,
  UserSummary,
} from "./types";

// Só roda no servidor (sufixo .server): o token do usuário nunca chega ao navegador.
const BASE_URL = (process.env.API_BASE_URL ?? "http://localhost:8000/api").replace(/\/$/, "");

export interface PipelineFilters {
  search?: string;
  customer?: string;
  owner?: string;
  closeFrom?: string;
  closeTo?: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

async function request<T>(
  token: string | null,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Token ${token}` } : {}),
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(
      503,
      "Não foi possível conectar à API. Verifique se o back-end está rodando.",
      "api_unreachable",
    );
  }

  // Token revogado ou expirado: encerra a sessão e volta para o login.
  if (response.status === 401 && token) throw redirect("/logout?expired=1");

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw toApiError(response.status, payload);
  return payload as T;
}
function toApiError(status: number, payload: unknown): ApiError {
  if (payload && typeof payload === "object") {
    const body = payload as Record<string, unknown>;
    if (typeof body.detail === "string") {
      return new ApiError(status, body.detail, typeof body.code === "string" ? body.code : undefined);
    }
    // Erros de validação do DRF: { campo: ["mensagem", ...] }
    const fields: Record<string, string> = {};
    for (const [field, messages] of Object.entries(body)) {
      fields[field] = Array.isArray(messages) ? String(messages[0]) : String(messages);
    }
    return new ApiError(status, "Revise os campos destacados.", "validation_error", fields);
  }
  return new ApiError(status, `A API respondeu com erro ${status}.`);
}

/**
 * Para loaders: converte ApiError em resposta HTTP lançada, que chega ao ErrorBoundary
 * com status e mensagem (erros comuns têm a mensagem ocultada em produção).
 */
export async function loadOrThrow<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof ApiError) throw data(error.message, { status: error.status });
    throw error;
  }
}

/** Para actions: devolve o erro da API como dado, para a tela exibir sem trocar de página. */
export function actionError<Extra extends object = {}>(error: unknown, extra?: Extra) {
  if (!(error instanceof ApiError)) throw error;
  return data(
    {
      ok: false as const,
      error: error.message,
      code: error.code,
      fields: error.fields,
      ...(extra as Extra),
    },
    { status: error.status },
  );
}

/** Login: troca usuário e senha pelo token da API. */
export function login(username: string, password: string) {
  return request<{ token: string; user: UserSummary }>(null, "/auth/login/", {
    method: "POST",
    body: { username, password },
  });
}

/** Revoga o token na API. Falhas são ignoradas: a sessão local é apagada de qualquer jeito. */
export async function logout(token: string) {
  await request<null>(token, "/auth/logout/", { method: "POST" }).catch(() => undefined);
}

/**
 * Cliente da API com o token do usuário logado. Sem sessão, redireciona para o login.
 * Use em todo loader e action que fale com a API.
 */
export async function apiFor(request: Request) {
  const token = await getToken(request);
  if (!token) redirectToLogin(request);
  return createApi(token);
}

export type Api = ReturnType<typeof createApi>;

function createApi(token: string) {
  return {
    me: () => request<UserSummary>(token, "/me/"),

    /** Filtros opcionais: texto (título ou cliente), vendedor e período da previsão de fechamento. */
    listOpportunities: (filters: PipelineFilters = {}) => {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.customer) params.set("customer", filters.customer);
      if (filters.owner) params.set("owner", filters.owner);
      if (filters.closeFrom) params.set("close_from", filters.closeFrom);
      if (filters.closeTo) params.set("close_to", filters.closeTo);
      const query = params.toString();
      return request<Opportunity[]>(token, `/opportunities/${query ? `?${query}` : ""}`);
    },

    sellers: () => request<UserSummary[]>(token, "/sellers/"),

    erpStatus: () => request<{ available: boolean }>(token, "/erp/status/"),

    getOpportunity: (id: number) => request<OpportunityDetail>(token, `/opportunities/${id}/`),

    createOpportunity: (body: {
      title: string;
      customer_id: number;
      amount: string;
      expected_close_date: string | null;
    }) => request<Opportunity>(token, "/opportunities/", { method: "POST", body }),

    moveStage: (id: number, stage: StageKey, lostReason = "") =>
      request<OpportunityDetail>(token, `/opportunities/${id}/stage/`, {
        method: "PATCH",
        body: { stage, lost_reason: lostReason },
      }),

    deleteOpportunity: (id: number) =>
      request<null>(token, `/opportunities/${id}/`, { method: "DELETE" }),

    convert: (id: number) =>
      request<ConversionResult>(token, `/opportunities/${id}/convert/`, { method: "POST" }),

    /** `ordering`: campo da API, com "-" na frente para decrescente (ex.: "-open_amount"). */
    listCustomers: (ordering = "name") =>
      request<CustomerSummary[]>(token, `/customers/?ordering=${encodeURIComponent(ordering)}`),

    createCustomer: (body: { name: string; document: string; email: string; phone: string }) =>
      request<Customer>(token, "/customers/", { method: "POST", body }),

    /** `ordering`: campo da API, com "-" na frente para decrescente (ex.: "-created_at"). */
    listOrders: (ordering = "-created_at") =>
      request<Order[]>(token, `/orders/?ordering=${encodeURIComponent(ordering)}`),
  };
}
