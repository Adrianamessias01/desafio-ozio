import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigation } from "react-router";

import { BoardIcon } from "~/components/icons";
import { api } from "~/lib/api.server";
import { initials } from "~/lib/format";
import type { Route } from "./+types/shell";

export async function loader() {
  // O nome no rodapé do menu é opcional: se a API falhar, as páginas mostram o erro.
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

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const onPipeline = location.pathname === "/" || location.pathname.startsWith("/opportunities");

  return (
    <div className={menuOpen ? "app menu-open" : "app"}>
      {navigation.state === "loading" && <div className="progress" aria-hidden="true" />}
      <aside className="sidebar" aria-label="Menu principal">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            O
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
        </nav>
        {me && (
          <div className="sidebar-foot">
            <div className="user">
              <span className="avatar">{initials(me.name)}</span>
              <div>
                {me.name}
                <small>Vendedor(a)</small>
              </div>
            </div>
          </div>
        )}
      </aside>
      <button
        type="button"
        className="sidebar-scrim"
        aria-label="Fechar menu"
        onClick={() => setMenuOpen(false)}
      />
      <div style={{ minWidth: 0 }}>
        <div className="mobilebar">
          <button
            type="button"
            className="menu-btn"
            aria-label="Abrir menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            ☰
          </button>
          <Link to="/" className="brand" style={{ padding: 0 }}>
            <span className="brand-mark" aria-hidden="true">
              O
            </span>
            Pipeline Comercial
          </Link>
        </div>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
