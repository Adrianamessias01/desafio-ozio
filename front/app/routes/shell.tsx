import { useEffect, useRef, useState } from "react";
import { Form, Link, NavLink, Outlet, useLocation, useNavigation, useSearchParams } from "react-router";

import {
  BoardIcon,
  BuildingIcon,
  ChevronIcon,
  LogoutIcon,
  ReceiptIcon,
  SearchIcon,
  TrendIcon,
} from "~/components/icons";
import { apiFor } from "~/lib/api.server";
import { initials } from "~/lib/format";
import type { Route } from "./+types/shell";

export async function loader({ request }: Route.LoaderArgs) {
  // Sem sessão, apiFor redireciona para o login: toda a área interna passa por aqui.
  const api = await apiFor(request);
  // Se a API estiver fora, as páginas mostram o erro; o menu só fica sem o nome.
  const me = await api.me().catch((error) => {
    if (error instanceof Response) throw error; // redirecionamento (sessão expirada)
    return null;
  });
  return { me };
}

// O usuário não muda durante a sessão; trocar de conta passa por /login e remonta o layout.
export function shouldRevalidate() {
  return false;
}

/** Avatar com menu: mostra quem está logado e o botão Sair. */
function UserMenu({ name, username }: { name: string | null; username: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="topbar-user"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="avatar" aria-hidden="true">
          {name ? initials(name) : "?"}
        </span>
        <span className="topbar-user-text">
          {name ?? "Minha conta"}
          <small>Vendedor(a)</small>
        </span>
        <ChevronIcon />
      </button>
      {open && (
        <div className="user-dropdown" role="menu">
          {username && (
            <div className="user-dropdown-head">
              <strong>{name}</strong>
              <span>@{username}</span>
            </div>
          )}
          <Form method="post" action="/logout">
            <button type="submit" role="menuitem" className="user-dropdown-item">
              <LogoutIcon />
              Sair
            </button>
          </Form>
        </div>
      )}
    </div>
  );
}

export default function Shell({ loaderData }: Route.ComponentProps) {
  const { me } = loaderData;
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigation = useNavigation();
  const [params] = useSearchParams();

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const onPipeline = location.pathname === "/" || location.pathname.startsWith("/opportunities");

  return (
    <div className={menuOpen ? "app menu-open" : "app"}>
      {navigation.state === "loading" && <div className="progress" aria-hidden="true" />}
      <aside className="sidebar" aria-label="Menu principal">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            <TrendIcon />
          </span>
          Pipeline Comercial
        </Link>
        <nav className="nav-group" aria-label="CRM">
          <div className="nav-label">CRM</div>
          {/* Link comum: o pipeline também fica ativo com a gaveta aberta em /opportunities/... */}
          <Link to="/" className="nav-item" aria-current={onPipeline ? "page" : undefined}>
            <BoardIcon />
            Pipeline
          </Link>
          <NavLink to="/customers" className="nav-item">
            <BuildingIcon />
            Clientes
          </NavLink>
        </nav>
        <nav className="nav-group" aria-label="ERP">
          <div className="nav-label">ERP</div>
          <NavLink to="/orders" className="nav-item">
            <ReceiptIcon />
            Pedidos
          </NavLink>
        </nav>
      </aside>
      <button
        type="button"
        className="sidebar-scrim"
        aria-label="Fechar menu"
        onClick={() => setMenuOpen(false)}
      />
      <div style={{ minWidth: 0 }}>
        <header className="topbar">
          <button
            type="button"
            className="menu-btn"
            aria-label="Abrir menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            ☰
          </button>
          {/* Busca por título ou cliente; o resultado aparece no kanban. */}
          <Form method="get" action="/" role="search" className="search">
            <SearchIcon />
            <input
              key={params.get("q") ?? ""}
              type="search"
              name="q"
              placeholder="Buscar oportunidade ou cliente…"
              aria-label="Buscar oportunidade ou cliente"
              defaultValue={onPipeline ? (params.get("q") ?? "") : ""}
            />
          </Form>
          <UserMenu name={me?.name ?? null} username={me?.username ?? null} />
        </header>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
