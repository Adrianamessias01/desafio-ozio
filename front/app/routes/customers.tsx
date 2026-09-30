import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router";

import { NameAvatar } from "~/components/avatar";
import { BuildingIcon, SearchIcon, TrendIcon, TrophyIcon, WalletIcon } from "~/components/icons";
import { PageError } from "~/components/page-error";
import { SortHeader, readSort } from "~/components/sort-header";
import { Stat } from "~/components/stat";
import { apiFor, loadOrThrow } from "~/lib/api.server";
import { money, taxId } from "~/lib/format";
import type { CustomerSummary } from "~/lib/types";
import type { Route } from "./+types/customers";

const SORTABLE = ["name", "document", "open_count", "won_count", "open_amount"] as const;

export function meta() {
  return [{ title: "Clientes · Pipeline Comercial" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const api = await apiFor(request);
  const sort = readSort(new URL(request.url), SORTABLE, { sort: "name", dir: "asc" });
  const ordering = `${sort.dir === "desc" ? "-" : ""}${sort.sort}`;
  const customers = await loadOrThrow(() => api.listCustomers(ordering));
  return { customers, sort };
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PageError error={error} title="Clientes indisponíveis" />;
}

/** Busca local: a lista é pequena e já vem inteira, então filtrar no navegador é instantâneo. */
function matches(customer: CustomerSummary, term: string) {
  const text = term.trim().toLowerCase();
  if (!text) return true;
  const digits = text.replace(/\D/g, "");
  return (
    customer.name.toLowerCase().includes(text) ||
    customer.email.toLowerCase().includes(text) ||
    (digits.length > 0 && customer.document.includes(digits))
  );
}

export default function Customers({ loaderData }: Route.ComponentProps) {
  const { customers, sort } = loaderData;
  // Abrir e fechar o cadastro mantém a ordenação escolhida.
  const { search } = useLocation();
  const [term, setTerm] = useState("");

  const visible = customers.filter((customer) => matches(customer, term));
  const openTotal = customers.reduce((sum, c) => sum + Number(c.open_amount), 0);
  const maxOpen = Math.max(...customers.map((c) => Number(c.open_amount)), 1);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Clientes</h1>
          <p className="sub">Empresas atendidas e o que cada uma tem no pipeline.</p>
        </div>
        <Link to={`/customers/new${search}`} preventScrollReset className="btn btn-primary">
          + Novo cliente
        </Link>
      </div>

      <div className="stats">
        <Stat label="Clientes" value={String(customers.length)} icon={<BuildingIcon />} />
        <Stat
          label="Com negócios em aberto"
          value={String(customers.filter((c) => c.open_count > 0).length)}
          icon={<TrendIcon />}
          tone="var(--st-qualification)"
        />
        <Stat label="Valor em aberto" value={money(openTotal)} icon={<WalletIcon />} tone="var(--st-proposal)" />
        <Stat
          label="Com negócios ganhos"
          value={String(customers.filter((c) => c.won_count > 0).length)}
          icon={<TrophyIcon />}
          tone="var(--st-won)"
        />
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <label className="table-search">
            <SearchIcon />
            <span className="sr-only">Filtrar clientes</span>
            <input
              id="customer-filter"
              type="search"
              placeholder="Filtrar por nome, CNPJ ou e-mail…"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
            />
          </label>
          <span className="muted table-count">
            {visible.length === customers.length
              ? `${customers.length} cliente(s)`
              : `${visible.length} de ${customers.length} cliente(s)`}
          </span>
        </div>

        <div className="table-scroll">
          {customers.length === 0 ? (
            <div className="empty">Nenhum cliente cadastrado ainda. Use “+ Novo cliente” para começar.</div>
          ) : visible.length === 0 ? (
            <div className="empty">Nenhum cliente encontrado para “{term}”.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <SortHeader field="name" label="Cliente" current={sort} />
                  <SortHeader field="document" label="CPF/CNPJ" current={sort} />
                  <SortHeader field="open_count" label="Em aberto" current={sort} firstDir="desc" className="num" />
                  <SortHeader field="won_count" label="Ganhas" current={sort} firstDir="desc" className="num" />
                  <SortHeader field="open_amount" label="Valor em aberto" current={sort} firstDir="desc" />
                  <th>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((customer, index) => {
                  const share = Number(customer.open_amount) / maxOpen;
                  return (
                    <tr key={customer.id} className="row-in" style={{ "--i": index } as React.CSSProperties}>
                      <td>
                        <span className="entity">
                          <NameAvatar name={customer.name} size="sm" />
                          <span className="entity-text">
                            <span className="entity-name">{customer.name}</span>
                            <span className="entity-sub">{customer.email || customer.phone || "Sem contato"}</span>
                          </span>
                        </span>
                      </td>
                      <td className="mono muted">{taxId(customer.document)}</td>
                      <td className="num">
                        <span className="count-badge" data-zero={customer.open_count === 0 || undefined}>
                          {customer.open_count}
                        </span>
                      </td>
                      <td className="num">
                        <span className="count-badge count-badge-ok" data-zero={customer.won_count === 0 || undefined}>
                          {customer.won_count}
                        </span>
                      </td>
                      <td>
                        <span className="value-cell">
                          <span className="value-amount">{money(customer.open_amount)}</span>
                          <span className="value-bar" aria-hidden="true">
                            <span style={{ width: `${Math.round(share * 100)}%` }} />
                          </span>
                        </span>
                      </td>
                      <td className="row-action">
                        <Link to={`/?customer=${customer.id}`} className="link-action">
                          Ver no pipeline →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <Outlet />
    </>
  );
}
