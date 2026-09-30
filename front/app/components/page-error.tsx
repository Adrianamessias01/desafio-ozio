import { isRouteErrorResponse, useLocation } from "react-router";

/** Erro de carregamento dentro da página: o menu lateral continua disponível. */
export function PageError({ error, title }: { error: unknown; title: string }) {
  const location = useLocation();
  const message =
    isRouteErrorResponse(error) && typeof error.data === "string"
      ? error.data
      : "Ocorreu um erro inesperado ao carregar os dados.";

  return (
    <div className="error-page" role="alert">
      <h1>{title}</h1>
      <p className="sub">{message}</p>
      <p>
        <a className="btn" href={location.pathname}>
          Tentar de novo
        </a>
      </p>
    </div>
  );
}
