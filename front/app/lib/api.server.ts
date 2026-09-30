import { data } from "react-router";

import type {
  ConversionResult,
  CustomerSummary,
  Opportunity,
  OpportunityDetail,
  Order,
  StageKey,
  UserSummary,
} from "./types";

// Só roda no servidor (sufixo .server): o token nunca chega ao navegador.
const BASE_URL = (process.env.API_BASE_URL ?? "http://localhost:8000/api").replace(/\/$/, "");
const TOKEN = process.env.API_TOKEN ?? "";

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

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(TOKEN ? { Authorization: `Token ${TOKEN}` } : {}),
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

export const api = {
  me: () => request<UserSummary>("/me/"),

  listOpportunities: () => request<Opportunity[]>("/opportunities/"),

  getOpportunity: (id: number) => request<OpportunityDetail>(`/opportunities/${id}/`),

  createOpportunity: (body: {
    title: string;
    customer_id: number;
    amount: string;
    expected_close_date: string | null;
  }) => request<Opportunity>("/opportunities/", { method: "POST", body }),

  moveStage: (id: number, stage: StageKey, lostReason = "") =>
    request<OpportunityDetail>(`/opportunities/${id}/stage/`, {
      method: "PATCH",
      body: { stage, lost_reason: lostReason },
    }),

  deleteOpportunity: (id: number) =>
    request<null>(`/opportunities/${id}/`, { method: "DELETE" }),

  convert: (id: number) =>
    request<ConversionResult>(`/opportunities/${id}/convert/`, { method: "POST" }),

  listCustomers: () => request<CustomerSummary[]>("/customers/"),

  listOrders: () => request<Order[]>("/orders/"),
};
