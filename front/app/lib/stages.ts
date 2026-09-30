import type { Opportunity, StageKey } from "./types";

// Espelha back/crm/stages.py. O back-end é quem decide; aqui as regras servem para
// orientar o arrastar e soltar antes de chamar a API.

export const STAGES: { key: StageKey; label: string }[] = [
  { key: "lead", label: "Lead" },
  { key: "qualification", label: "Qualificação" },
  { key: "proposal", label: "Proposta" },
  { key: "negotiation", label: "Negociação" },
  { key: "won", label: "Ganho" },
  { key: "lost", label: "Perdido" },
];

export const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.key, s.label])) as Record<
  StageKey,
  string
>;

const ALLOWED: Record<StageKey, StageKey[]> = {
  lead: ["qualification", "proposal", "negotiation", "lost"],
  qualification: ["lead", "proposal", "negotiation", "lost"],
  proposal: ["lead", "qualification", "negotiation", "lost"],
  negotiation: ["lead", "qualification", "proposal", "won", "lost"],
  won: ["negotiation"],
  lost: ["lead"],
};

export const OPEN_STAGES: StageKey[] = ["lead", "qualification", "proposal", "negotiation"];

/** Aberta e com a previsão de fechamento já vencida. `today` no formato "AAAA-MM-DD". */
export function isOverdue(
  o: Pick<Opportunity, "stage" | "expected_close_date">,
  today: string,
) {
  return OPEN_STAGES.includes(o.stage) && !!o.expected_close_date && o.expected_close_date < today;
}

/** Chave do fetcher de movimentação: kanban e gaveta de detalhe compartilham o mesmo estado. */
export const moveKey = (id: number) => `move-${id}`;

export function isStage(value: unknown): value is StageKey {
  return typeof value === "string" && value in ALLOWED;
}

export function allowedTargets(o: Pick<Opportunity, "stage" | "is_converted">): StageKey[] {
  return o.is_converted ? [] : ALLOWED[o.stage];
}

export function canMove(o: Pick<Opportunity, "stage" | "is_converted">, target: StageKey) {
  return allowedTargets(o).includes(target);
}

export function blockReason(o: Pick<Opportunity, "stage" | "is_converted">, target: StageKey) {
  if (o.is_converted) return "Oportunidade já convertida em pedido. Ela não pode mais mudar de estágio.";
  if (target === "won") return "Só é possível marcar como Ganho a partir de Negociação.";
  if (o.stage === "lost") return "Uma oportunidade perdida só pode ser reaberta como Lead.";
  if (o.stage === "won") return "Uma oportunidade ganha só pode voltar para Negociação.";
  return "Movimentação não permitida.";
}
