import { Form, data, redirect, useNavigation, useSearchParams } from "react-router";

import { TrendIcon } from "~/components/icons";
import { ApiError, login } from "~/lib/api.server";
import { commitSession, getSession, safeNext } from "~/lib/session.server";
import type { Route } from "./+types/login";

export function meta() {
  return [{ title: "Entrar · Pipeline Comercial" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  if (session.get("token")) throw redirect("/");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const next = safeNext(new URL(request.url).searchParams.get("next"));

  if (!username || !password) {
    return data({ error: "Informe usuário e senha.", username }, { status: 400 });
  }

  try {
    const { token } = await login(username, password);
    const session = await getSession(request.headers.get("Cookie"));
    session.set("token", token);
    return redirect(next, { headers: { "Set-Cookie": await commitSession(session) } });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return data({ error: error.message, username }, { status: error.status });
  }
}

export default function Login({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const [params] = useSearchParams();
  const busy = navigation.state !== "idle";
  const expired = params.get("expired") === "1";

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-mark" aria-hidden="true">
            <TrendIcon />
          </span>
          Pipeline Comercial
        </div>
        <h1>Entrar</h1>
        <p className="sub">Acesse o pipeline com a sua conta de vendedor.</p>

        {expired && !actionData && (
          <div className="alert alert-info" role="status">
            Sua sessão terminou. Entre novamente para continuar.
          </div>
        )}
        {actionData?.error && (
          <div className="alert alert-error" role="alert">
            {actionData.error}
          </div>
        )}

        <Form method="post" className="form" replace>
          <div className="field">
            <label htmlFor="username">Usuário</label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              required
              autoFocus
              defaultValue={actionData?.username}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <button type="submit" className="btn btn-primary login-submit" disabled={busy}>
            {busy ? "Entrando…" : "Entrar"}
          </button>
        </Form>

        <div className="login-hint">
          <strong>Contas de demonstração</strong>
          <span>
            <code>carla</code>, <code>rafael</code> ou <code>marina</code>, senha <code>ozio1234</code>
          </span>
        </div>
      </div>
    </main>
  );
}
