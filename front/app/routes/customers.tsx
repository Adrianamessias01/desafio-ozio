import { Link, Outlet, useLocation } from "react-router";

import { PageError } from "~/components/page-error";
import { SortHeader, readSort } from "~/components/sort-header";
import { api, loadOrThrow } from "~/lib/api.server";
import { money, taxId } from "~/lib/format";
import type { Route } from "./+types/customers";

const SORTABLE = ["name", "document", "open_count", "won_count", "open_amount"] as const;

export function meta() {
  return [{ title: "Clientes · Pipeline Comercial" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const sort = readSort(new URL(request.url), SORTABLE, { sort: "name", dir: "asc" });
  const ordering = `${sort.dir === "desc" ? "-" : ""}${sort.sort}`;
  const customers = await loadOrThrow(() => api.listCustomers(ordering));
  return { customers, sort };
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PageError error={error} title="Clientes indisponíveis" />;
}

export default function Customers({ loaderData }: Route.ComponentProps) {
  const { customers, sort } = loaderData;
  // Abrir e fechar o cadastro mantém a ordenação escolhida.
  const { search } = useLocation();

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

      <div className="table-wrap">
        {customers.length === 0 ? (
          <div className="empty">Nenhum cliente cadastrado.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <SortHeader field="name" label="Cliente" current={sort} />
                <SortHeader field="document" label="CPF/CNPJ" current={sort} />
                <th>Contato</th>
                <SortHeader field="open_count" label="Em aberto" current={sort} firstDir="desc" className="num" />
                <SortHeader field="won_count" label="Ganhas" current={sort} firstDir="desc" className="num" />
                <SortHeader
                  field="open_amount"
                  label="Valor em aberto"
                  current={sort}
                  firstDir="desc"
                  className="num"
                />
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.name}</td>
                  <td className="mono">{taxId(customer.document)}</td>
                  <td className="muted">{customer.email || customer.phone || "—"}</td>
                  <td className="num mono">{customer.open_count}</td>
                  <td className="num mono">{customer.won_count}</td>
                  <td className="num mono">{money(customer.open_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Outlet />
    </>
  );
}
