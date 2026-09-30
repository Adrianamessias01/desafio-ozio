import { describe, expect, it } from "vitest";

import { itemsSummary, sourceOpportunityId } from "./orders";

describe("pedidos", () => {
  it("lê a oportunidade de origem da chave enviada ao ERP", () => {
    expect(sourceOpportunityId({ idempotency_key: "crm-opportunity:42" })).toBe(42);
    expect(sourceOpportunityId({ idempotency_key: "outro-sistema:42" })).toBeNull();
  });

  it("resume os itens", () => {
    const item = (description: string, quantity: number) => ({
      id: 1,
      description,
      quantity,
      unit_price: "1.00",
      line_total: "1.00",
    });
    expect(itemsSummary({ items: [item("Licença", 1)] })).toBe("Licença");
    expect(itemsSummary({ items: [item("Licença", 2), item("Suporte", 3)] })).toBe(
      "Licença e mais 1 (5 un.)",
    );
  });
});
