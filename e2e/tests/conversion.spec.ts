import { expect, test } from "@playwright/test";

import { apiAs, login, unique } from "./helpers";

// Cria um pedido de verdade no ERP (e a oportunidade convertida não pode ser excluída):
// rode contra um banco de teste, como no CI.
test("oportunidade ganha vira pedido, sem duplicar, e o pedido aponta a origem", async ({
  page,
  request,
}) => {
  const title = unique("Conversão");
  const { id } = await (await apiAs(request)).createOpportunity(title, ["negotiation", "won"]);
  await login(page);

  await page.goto(`/opportunities/${id}`);
  await page.getByRole("button", { name: "Converter em pedido" }).click();

  const success = page.locator(".alert-ok");
  await expect(success).toContainText(/no pedido PED-\d{6}/);
  const number = (await success.textContent())!.match(/PED-\d{6}/)![0];

  // Idempotência visível: converter de novo devolve o mesmo pedido.
  await page.getByRole("button", { name: "Converter novamente" }).click();
  await expect(page.getByText("O pedido já existia e foi devolvido")).toBeVisible();

  // Convertida fica congelada: sem opção de mover nem excluir.
  await expect(page.getByLabel("Novo estágio")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Excluir oportunidade" })).toHaveCount(0);

  // O pedido aparece uma única vez e leva de volta à oportunidade.
  await page.goto("/orders");
  await page.getByLabel("Filtrar pedidos").fill(number);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("link", { name: number }).click();
  await expect(page.locator(".origin-title")).toHaveText(`Oportunidade #${id} no pipeline`);
  await page.getByRole("link", { name: /Ver oportunidade/ }).click();
  await expect(page.locator("#drawer-title")).toHaveText(title);
});

test("conversão fora de Ganho não é oferecida", async ({ page, request }) => {
  const api = await apiAs(request);
  const { id } = await api.createOpportunity(unique("Sem conversão"), ["negotiation"]);
  await login(page);

  await page.goto(`/opportunities/${id}`);
  await expect(page.getByText("disponível quando a oportunidade estiver em")).toBeVisible();
  await expect(page.getByRole("button", { name: "Converter em pedido" })).toHaveCount(0);

  await api.deleteOpportunity(id);
});
