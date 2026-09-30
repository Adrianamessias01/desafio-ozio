import { redirect } from "react-router";

import { logout } from "~/lib/api.server";
import { destroySession, getSession } from "~/lib/session.server";
import type { Route } from "./+types/logout";

// Rota sem tela. POST: botão "Sair" (revoga o token na API). GET: sessão expirada,
// quando a API recusou o token; só limpa o cookie.

export async function action({ request }: Route.ActionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const token = session.get("token");
  if (token) await logout(token);
  return redirect("/login", { headers: { "Set-Cookie": await destroySession(session) } });
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const expired = new URL(request.url).searchParams.get("expired") === "1";
  return redirect(expired ? "/login?expired=1" : "/login", {
    headers: { "Set-Cookie": await destroySession(session) },
  });
}
