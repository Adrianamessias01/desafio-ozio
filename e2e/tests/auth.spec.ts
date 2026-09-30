import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test("página interna sem sessão manda para o login e volta depois", async ({ page }) => {
  await page.goto("/orders");
  await expect(page).toHaveURL(/\/login\?next=%2Forders/);

  await page.getByLabel("Usuário").fill("carla");
  await page.getByLabel("Senha").fill("ozio1234");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/orders$/);
  await expect(page.getByRole("heading", { name: "Pedidos" })).toBeVisible();
});

test("senha errada mostra mensagem", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Usuário").fill("carla");
  await page.getByLabel("Senha").fill("errada");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByRole("alert")).toHaveText("Usuário ou senha incorretos.");
});

test("token fica fora do navegador e Sair encerra a sessão", async ({ page, context }) => {
  await login(page);

  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === "__session")?.httpOnly).toBe(true);

  await page.getByRole("button", { name: /Carla Souza/ }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});
