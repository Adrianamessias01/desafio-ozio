import { useEffect, useState } from "react";
import { Form, Link, NavLink, Outlet, useLocation, useNavigation, useSearchParams } from "react-router";

import { BoardIcon, BuildingIcon, ReceiptIcon, SearchIcon, TrendIcon } from "~/components/icons";
import { api } from "~/lib/api.server";
import { initials } from "~/lib/format";
import type { Route } from "./+types/shell";

export async function loader() {
  // O nome na barra superior é opcional: se a API falhar, as páginas mostram o erro.
  const me = await api.me().catch(() => null);
  return { me };
}

export function shouldRevalidate() {
  return false;
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
          {me && (
            <div className="topbar-user">
              <span className="avatar" aria-hidden="true">
                {initials(me.name)}
              </span>
              <div>
                {me.name}
                <small>Vendedor(a)</small>
              </div>
            </div>
          )}
        </header>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
