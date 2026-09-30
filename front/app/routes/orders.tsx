import { ReceiptIcon, WalletIcon } from "~/components/icons";
import { PageError } from "~/components/page-error";
import { Stat } from "~/components/stat";
import { SortHeader, readSort } from "~/components/sort-header";
import { apiFor, loadOrThrow } from "~/lib/api.server";
import { dateTime, money, taxId } from "~/lib/format";
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
  return { orders, sort };
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PageError error={error} title="Pedidos indisponíveis" />;
}

export default function Orders({ loaderData }: Route.ComponentProps) {
  const { orders, sort } = loaderData;
  const total = orders.reduce((sum, order) => sum + Number(order.total), 0);

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
      </div>

      <div className="table-wrap">
        {orders.length === 0 ? (
          <div className="empty">
            Nenhum pedido ainda. Converta uma oportunidade ganha para gerar o primeiro.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <SortHeader field="number" label="Número" current={sort} />
                <SortHeader field="customer_name" label="Cliente" current={sort} />
                <th>Itens</th>
                <SortHeader field="status" label="Situação" current={sort} />
                <SortHeader field="created_at" label="Criado em" current={sort} firstDir="desc" />
                <SortHeader field="total" label="Total" current={sort} firstDir="desc" className="num" />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="mono">{order.number}</td>
                  <td>
                    {order.customer_name}
                    <br />
                    <span className="mono muted">{taxId(order.customer_document)}</span>
                  </td>
                  <td>
                    <ul className="item-list">
                      {order.items.map((item) => (
                        <li key={item.id}>
                          {item.quantity} × {item.description}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td>
                    <span className="pill pill-ok">{order.status_label}</span>
                  </td>
                  <td className="mono">{dateTime(order.created_at)}</td>
                  <td className="num mono">{money(order.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
