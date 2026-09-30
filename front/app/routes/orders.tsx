import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";

import { NameAvatar } from "~/components/avatar";
import { ClockIcon, ReceiptIcon, SearchIcon, TrendIcon, WalletIcon } from "~/components/icons";
import { PageError } from "~/components/page-error";
import { SortHeader, readSort } from "~/components/sort-header";
import { Stat } from "~/components/stat";
import { apiFor, loadOrThrow } from "~/lib/api.server";
import { dateTime, money, relativeTime, taxId } from "~/lib/format";
import { STATUS_TONE, itemsSummary } from "~/lib/orders";
import type { Order } from "~/lib/types";
import type { Route } from "./+types/orders";

const SORTABLE = ["number", "customer_name", "status", "created_at", "total"] as const;

export function meta() {
  return [{ title: "Pedidos · Pipeline Comercial" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const api = await apiFor(request);
  const sort = readSort(new URL(request.url), SORTABLE, { sort: "created_at", dir: "desc" });
  const ordering = `${sort.dir === "desc" ? "-" : ""}${sort.sort}`;
  const orders = await loadOrThrow(() => api.listOrders(ordering));
  // "Agora" do servidor: textos como "há 2 h" saem iguais no servidor e no navegador.
  return { orders, sort, now: Date.now() };
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PageError error={error} title="Pedidos indisponíveis" />;
}

function matches(order: Order, term: string) {
  const text = term.trim().toLowerCase();
  if (!text) return true;
  const digits = text.replace(/\D/g, "");
  return (
    order.number.toLowerCase().includes(text) ||
    order.customer_name.toLowerCase().includes(text) ||
    (digits.length > 0 && order.customer_document.includes(digits))
  );
}

export default function Orders({ loaderData }: Route.ComponentProps) {
  const { orders, sort, now } = loaderData;
  const { search } = useLocation();
  const navigate = useNavigate();
  const [term, setTerm] = useState("");

  const visible = orders.filter((order) => matches(order, term));
  const total = orders.reduce((sum, order) => sum + Number(order.total), 0);
  const latest = orders.reduce<Order | null>(
    (last, order) => (!last || order.created_at > last.created_at ? order : last),
    null,
  );
  const open = (order: Order) => navigate(`/orders/${order.id}${search}`, { preventScrollReset: true });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pedidos</h1>
          <p className="sub">Pedidos gerados no ERP a partir de oportunidades ganhas.</p>
        </div>
      </div>

      <div className="stats">
        <Stat label="Pedidos" value={String(orders.length)} icon={<ReceiptIcon />} tone="var(--st-proposal)" />
        <Stat label="Valor total" value={money(total)} icon={<WalletIcon />} tone="var(--st-won)" />
        <Stat
          label="Ticket médio"
          value={orders.length ? money(total / orders.length) : "—"}
          icon={<TrendIcon />}
          tone="var(--accent)"
        />
        <Stat
          label="Último pedido"
          value={latest ? relativeTime(latest.created_at, now) : "—"}
          icon={<ClockIcon />}
          tone="var(--st-negotiation)"
        />
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <label className="table-search">
            <SearchIcon />
            <span className="sr-only">Filtrar pedidos</span>
            <input
              id="order-filter"
              type="search"
              placeholder="Filtrar por número, cliente ou CNPJ…"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
            />
          </label>
          <span className="muted table-count">
            {visible.length === orders.length
              ? `${orders.length} pedido(s)`
              : `${visible.length} de ${orders.length} pedido(s)`}
          </span>
        </div>

        <div className="table-scroll">
          {orders.length === 0 ? (
            <div className="empty">
              Nenhum pedido ainda. Converta uma oportunidade ganha no{" "}
              <Link to="/" className="link-action" style={{ opacity: 1 }}>
                pipeline
              </Link>{" "}
              para gerar o primeiro.
            </div>
          ) : visible.length === 0 ? (
            <div className="empty">Nenhum pedido encontrado para “{term}”.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <SortHeader field="number" label="Número" current={sort} />
                  <SortHeader field="customer_name" label="Cliente" current={sort} />
                  <th>Itens</th>
                  <SortHeader field="status" label="Situação" current={sort} />
                  <SortHeader field="created_at" label="Criado" current={sort} firstDir="desc" />
                  <SortHeader field="total" label="Total" current={sort} firstDir="desc" className="num" />
                </tr>
              </thead>
              <tbody>
                {visible.map((order, index) => (
                  // A linha inteira abre o detalhe; o número é o link acessível por teclado.
                  <tr
                    key={order.id}
                    className="row-in row-link"
                    style={{ "--i": index } as React.CSSProperties}
                    onClick={(event) => {
                      if (!(event.target as HTMLElement).closest("a")) open(order);
                    }}
                  >
                    <td>
                      <Link to={`/orders/${order.id}${search}`} preventScrollReset className="order-tag mono">
                        {order.number}
                      </Link>
                    </td>
                    <td>
                      <span className="entity">
                        <NameAvatar name={order.customer_name} size="sm" />
                        <span className="entity-text">
                          <span className="entity-name">{order.customer_name}</span>
                          <span className="entity-sub mono">{taxId(order.customer_document)}</span>
                        </span>
                      </span>
                    </td>
                    <td className="muted items-cell">{itemsSummary(order)}</td>
                    <td>
                      <span className={`pill ${STATUS_TONE[order.status] ?? ""}`}>{order.status_label}</span>
                    </td>
                    <td>
                      <span className="time-cell" title={dateTime(order.created_at)}>
                        {relativeTime(order.created_at, now)}
                      </span>
                    </td>
                    <td className="num">
                      <span className="value-amount">{money(order.total)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <Outlet />
    </>
  );
}
