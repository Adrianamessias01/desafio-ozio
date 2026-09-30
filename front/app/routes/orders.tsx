import { PageError } from "~/components/page-error";
import { api, loadOrThrow } from "~/lib/api.server";
import { dateTime, money, taxId } from "~/lib/format";
import type { Route } from "./+types/orders";

export function meta() {
  return [{ title: "Pedidos · Pipeline Comercial" }];
}

export async function loader() {
  const orders = await loadOrThrow(() => api.listOrders());
  return { orders };
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PageError error={error} title="Pedidos indisponíveis" />;
}

export default function Orders({ loaderData }: Route.ComponentProps) {
  const { orders } = loaderData;
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
        <div className="stat">
          <div className="stat-label">Pedidos</div>
          <div className="stat-value">{orders.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Valor total</div>
          <div className="stat-value">{money(total)}</div>
        </div>
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
                <th>Número</th>
                <th>Cliente</th>
                <th>Itens</th>
                <th>Situação</th>
                <th>Criado em</th>
                <th className="num">Total</th>
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
