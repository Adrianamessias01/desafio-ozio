import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test("filtra clientes e abre o pipeline só com as oportunidades do cliente", async ({ page }) => {
  await login(page);
  await page.goto("/customers");

  await page.getByLabel("Filtrar clientes").fill("Metalúrgica");
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(1);

  await rows.getByRole("link", { name: "Ver no pipeline →" }).click();
  await expect(page).toHaveURL(/\?customer=\d+/);
  await expect(page.locator(".search-note")).toContainText("do cliente Metalúrgica");
  for (const card of await page.locator(".card").all()) {
    await expect(card).toContainText("Metalúrgica");
  }
});
