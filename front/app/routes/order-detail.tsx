import { Link, isRouteErrorResponse, useLocation } from "react-router";

import { NameAvatar } from "~/components/avatar";
import { Drawer } from "~/components/drawer";
import { apiFor, loadOrThrow } from "~/lib/api.server";
import { dateTime, money, taxId } from "~/lib/format";
import { STATUS_TONE, sourceOpportunityId } from "~/lib/orders";
import type { Route } from "./+types/order-detail";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.order.number ?? "Pedido"} · Pipeline Comercial` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const api = await apiFor(request);
  const order = await loadOrThrow(() => api.getOrder(Number(params.id)));
  return { order };
}

export default function OrderDrawer({ loaderData }: Route.ComponentProps) {
  const { order } = loaderData;
  const { search } = useLocation();
  const opportunityId = sourceOpportunityId(order);

  return (
    <Drawer title={order.number} eyebrow="Pedido no ERP" closeTo={`/orders${search}`}>
      <div className="drawer-body">
        <div className="detail-hero">
          <NameAvatar name={order.customer_name} />
          <div>
            <div className="detail-amount">{money(order.total)}</div>
            <div className="muted">{order.customer_name}</div>
          </div>
          <span className={`pill ${STATUS_TONE[order.status] ?? ""}`} style={{ marginLeft: "auto" }}>
            {order.status_label}
          </span>
        </div>

        <dl>
          <dt>CPF/CNPJ</dt>
          <dd className="mono">{taxId(order.customer_document)}</dd>
          <dt>Criado em</dt>
          <dd>{dateTime(order.created_at)}</dd>
        </dl>

        {/* Origem do pedido: a ligação CRM → ERP que a conversão criou. */}
        {opportunityId && (
          <Link to={`/opportunities/${opportunityId}`} className="origin-card">
            <span>
              <span className="section-label" style={{ margin: 0 }}>
                Origem
              </span>
              <span className="origin-title">Oportunidade #{opportunityId} no pipeline</span>
            </span>
            <span className="link-action" style={{ opacity: 1 }}>
              Ver oportunidade →
            </span>
          </Link>
        )}

        <section>
          <h3 className="section-label">Itens</h3>
          <div className="items-table">
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th className="num">Qtd.</th>
                  <th className="num">Unitário</th>
                  <th className="num">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.description}</td>
                    <td className="num">{item.quantity}</td>
                    <td className="num">{money(item.unit_price)}</td>
                    <td className="num">{money(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Total</td>
                  <td className="num">{money(order.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </div>
    </Drawer>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const message = isRouteErrorResponse(error) && typeof error.data === "string" ? error.data : "";
  return (
    <Drawer title={notFound ? "Pedido não encontrado" : "Não foi possível abrir"} closeTo="/orders">
      <div className="drawer-body">
        <p className="sub">{notFound ? "O endereço pode estar incorreto." : message}</p>
      </div>
    </Drawer>
  );
}
