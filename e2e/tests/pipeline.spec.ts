import { expect, test, type Page } from "@playwright/test";

import { apiAs, login, unique } from "./helpers";

const column = (page: Page, name: string) => page.locator(`section.col[aria-label="${name}"]`);

/** Arrasta com o mouse, em passos, como uma pessoa faria (o dnd-kit precisa do movimento). */
async function drag(page: Page, title: string, target: string) {
  const card = await page.locator(".card", { hasText: title }).boundingBox();
  const col = await column(page, target).boundingBox();
  if (!card || !col) throw new Error("card ou coluna fora da tela");
  await page.mouse.move(card.x + card.width / 2, card.y + 20);
  await page.mouse.down();
  await page.mouse.move(card.x + card.width / 2 + 20, card.y + 30, { steps: 5 });
  await page.mouse.move(col.x + col.width / 2, col.y + 140, { steps: 15 });
  await page.mouse.up();
}

test.describe("kanban", () => {
  let id: number;
  let title: string;

  test.beforeEach(async ({ page, request }) => {
    title = unique("Arrastar");
    ({ id } = await (await apiAs(request)).createOpportunity(title));
    await login(page);
  });

  test.afterEach(async ({ request }) => {
    await (await apiAs(request)).deleteOpportunity(id);
  });

  test("arrastar para um estágio permitido move o card", async ({ page }) => {
    await drag(page, title, "Proposta");

    await expect(column(page, "Proposta").locator(".card", { hasText: title })).toBeVisible();
    await page.reload();
    await expect(column(page, "Proposta").locator(".card", { hasText: title })).toBeVisible();
  });

  test("arrastar para um estágio proibido explica o motivo e não move", async ({ page }) => {
    await drag(page, title, "Ganho");

    await expect(page.locator(".toast")).toContainText("Só é possível marcar como Ganho a partir de Negociação");
    await expect(column(page, "Lead").locator(".card", { hasText: title })).toBeVisible();
  });

  test("mover para Perdido pede o motivo", async ({ page }) => {
    await drag(page, title, "Perdido");

    const dialog = page.getByRole("dialog", { name: "Marcar como perdida" });
    await dialog.getByLabel("Motivo da perda").fill("Orçamento cancelado");
    await dialog.getByRole("button", { name: "Marcar como perdida" }).click();

    const card = column(page, "Perdido").locator(".card", { hasText: title });
    await expect(card).toContainText("Orçamento cancelado");
  });
});
