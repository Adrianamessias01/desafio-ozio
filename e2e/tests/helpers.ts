import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const API = process.env.API_URL ?? "http://localhost:8000/api";
export const USER = { username: "carla", password: "ozio1234" };

export async function login(page: Page, user = USER) {
  await page.goto("/login");
  await page.getByLabel("Usuário").fill(user.username);
  await page.getByLabel("Senha").fill(user.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** Cliente da API autenticado, para preparar dados sem passar pela interface. */
export async function apiAs(request: APIRequestContext) {
  const response = await request.post(`${API}/auth/login/`, { data: USER });
  const { token } = await response.json();
  const headers = { Authorization: `Token ${token}` };
  return {
    async createOpportunity(title: string, stages: string[] = []) {
      const customers = await (await request.get(`${API}/customers/`, { headers })).json();
      const created = await (
        await request.post(`${API}/opportunities/`, {
          headers,
          data: { title, customer_id: customers[0].id, amount: "12345.00" },
        })
      ).json();
      for (const stage of stages) {
        await request.patch(`${API}/opportunities/${created.id}/stage/`, { headers, data: { stage } });
      }
      return created as { id: number; title: string };
    },
    async deleteOpportunity(id: number) {
      await request.delete(`${API}/opportunities/${id}/`, { headers });
    },
  };
}

/** Título único por execução, para os testes não colidirem com dados existentes. */
export const unique = (label: string) => `[e2e] ${label} ${Date.now().toString(36)}`;
