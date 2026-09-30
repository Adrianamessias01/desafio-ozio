import type { Order } from "./types";

// O CRM envia ao ERP a chave "crm-opportunity:<id>" (back/crm/services.py). O ERP a trata
// como texto opaco; é o CRM que sabe ler a oportunidade de origem a partir dela.
const SOURCE_KEY = /^crm-opportunity:(\d+)$/;

export function sourceOpportunityId(order: Pick<Order, "idempotency_key">) {
  const match = SOURCE_KEY.exec(order.idempotency_key);
  return match ? Number(match[1]) : null;
}

export const STATUS_TONE: Record<string, string> = {
  open: "status-open",
  invoiced: "status-invoiced",
  cancelled: "status-cancelled",
};

export function itemsSummary(order: Pick<Order, "items">) {
  const count = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const first = order.items[0]?.description ?? "";
  if (order.items.length <= 1) return first;
  return `${first} e mais ${order.items.length - 1} (${count} un.)`;
}
