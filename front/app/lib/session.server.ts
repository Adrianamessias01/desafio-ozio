import { createCookieSessionStorage, redirect } from "react-router";

// O token da API fica num cookie httpOnly assinado: o JavaScript do navegador não o lê,
// e só o servidor do React Router o envia para a API.
const { getSession, commitSession, destroySession } = createCookieSessionStorage<{
  token: string;
}>({
  cookie: {
    name: "__session",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    secrets: [process.env.SESSION_SECRET ?? "dev-only-session-secret"],
    maxAge: 60 * 60 * 12, // 12 horas
  },
});

export { commitSession, destroySession, getSession };

export async function getToken(request: Request) {
  const session = await getSession(request.headers.get("Cookie"));
  return session.get("token") ?? null;
}

/** Endereço para voltar depois do login, aceitando só caminhos internos. */
export function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

/** Sem sessão: manda para o login lembrando a página que a pessoa tentou abrir. */
export function redirectToLogin(request: Request): never {
  const url = new URL(request.url);
  const next = url.pathname + url.search;
  throw redirect(next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`);
}
