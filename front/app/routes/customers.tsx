import { PageError } from "~/components/page-error";
import { api, loadOrThrow } from "~/lib/api.server";
import { money, taxId } from "~/lib/format";
import type { Route } from "./+types/customers";

export function meta() {
  return [{ title: "Clientes · Pipeline Comercial" }];
}

export async function loader() {
  const customers = await loadOrThrow(() => api.listCustomers());
  return { customers };
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PageError error={error} title="Clientes indisponíveis" />;
}

export default function Customers({ loaderData }: Route.ComponentProps) {
  const { customers } = loaderData;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Clientes</h1>
          <p className="sub">Empresas atendidas e o que cada uma tem no pipeline.</p>
        </div>
      </div>

      <div className="table-wrap">
        {customers.length === 0 ? (
          <div className="empty">Nenhum cliente cadastrado.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>CPF/CNPJ</th>
                <th>Contato</th>
                <th className="num">Em aberto</th>
                <th className="num">Ganhas</th>
                <th className="num">Valor em aberto</th>
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
    </>
  );
}
