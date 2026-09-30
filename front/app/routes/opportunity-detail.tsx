import { useState } from "react";
import { Link, isRouteErrorResponse, useFetcher } from "react-router";

import { Drawer } from "~/components/drawer";
import { actionError, api, loadOrThrow } from "~/lib/api.server";
import { date, dateTime, money, taxId } from "~/lib/format";
import { STAGE_LABEL, allowedTargets, moveKey } from "~/lib/stages";
import type { OpportunityDetail, StageKey } from "~/lib/types";
import type { Route } from "./+types/opportunity-detail";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.opportunity.title ?? "Oportunidade"} · Pipeline Comercial` }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const opportunity = await loadOrThrow(() => api.getOpportunity(Number(params.id)));
  return { opportunity };
}

/** Conversão em pedido. Erros (ERP fora do ar, fora de Ganho) voltam como dado para a tela. */
export async function action({ params }: Route.ActionArgs) {
  try {
    const result = await api.convert(Number(params.id));
    return { ok: true as const, orderNumber: result.order_number, created: result.created };
  } catch (error) {
    return actionError(error);
  }
}

export default function OpportunityDrawer({ loaderData }: Route.ComponentProps) {
  const o = loaderData.opportunity;

  return (
    <Drawer title={o.title} eyebrow={`Oportunidade #${o.id}`}>
      <div className="drawer-body">
        <dl>
          <dt>Cliente</dt>
          <dd>
            {o.customer.name}
            <br />
            <span className="mono muted">{taxId(o.customer.document)}</span>
          </dd>
          <dt>Valor</dt>
          <dd className="mono">{money(o.amount)}</dd>
          <dt>Responsável</dt>
          <dd>{o.owner.name}</dd>
          <dt>Previsão</dt>
          <dd>{date(o.expected_close_date)}</dd>
          <dt>Estágio</dt>
          <dd>
            <span className="pill">
              <span className="dot" style={{ "--c": `var(--st-${o.stage})` } as React.CSSProperties} />
              {o.stage_label}
            </span>
          </dd>
          {o.lost_reason && (
            <>
              <dt>Motivo da perda</dt>
              <dd>{o.lost_reason}</dd>
            </>
          )}
        </dl>

        <MoveStage key={`${o.id}-${o.stage}`} o={o} />

        <section>
          <h3 className="section-label">Pedido no ERP</h3>
          <OrderStatus o={o} />
        </section>

        <section>
          <h3 className="section-label">Histórico</h3>
          <ol className="timeline">
            {o.stage_changes.map((change, index) => (
              <li key={index}>
                <time dateTime={change.changed_at}>{dateTime(change.changed_at)}</time>
                <span>
                  {change.from_stage
                    ? `${STAGE_LABEL[change.from_stage]} → ${STAGE_LABEL[change.to_stage]}`
                    : `Criada em ${STAGE_LABEL[change.to_stage]}`}
                  {change.changed_by && <span className="muted"> · {change.changed_by.name}</span>}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Drawer>
  );
}

/** Alternativa ao arrastar e soltar, útil no celular e pelo teclado. */
function MoveStage({ o }: { o: OpportunityDetail }) {
  const targets = allowedTargets(o);
  const fetcher = useFetcher({ key: moveKey(o.id) });
  const [target, setTarget] = useState<StageKey | "">(targets[0] ?? "");
  const busy = fetcher.state !== "idle";

  if (targets.length === 0) return null;

  return (
    <section>
      <h3 className="section-label">Mover para</h3>
      <fetcher.Form method="post" action="/" className="form" preventScrollReset>
        <input type="hidden" name="intent" value="move" />
        <input type="hidden" name="id" value={o.id} />
        <div className="row">
          <select
            name="stage"
            className="select"
            aria-label="Novo estágio"
            value={target}
            onChange={(event) => setTarget(event.target.value as StageKey)}
          >
            {targets.map((stage) => (
              <option key={stage} value={stage}>
                {STAGE_LABEL[stage]}
              </option>
            ))}
          </select>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? "Movendo…" : "Mover"}
          </button>
        </div>
        {target === "lost" && (
          <div className="field">
            <label htmlFor="detail-lost-reason">Motivo da perda</label>
            <textarea id="detail-lost-reason" name="lost_reason" rows={2} required />
          </div>
        )}
      </fetcher.Form>
    </section>
  );
}

function OrderStatus({ o }: { o: OpportunityDetail }) {
  const fetcher = useFetcher<typeof action>({ key: `convert-${o.id}` });
  const converting = fetcher.state !== "idle";
  const result = fetcher.data;

  if (o.is_converted) {
    return (
      <div className="box">
        <div className="alert alert-ok" role="status">
          Convertida em {dateTime(o.converted_at)} no pedido{" "}
          <strong className="mono">{o.erp_order_number}</strong>.
        </div>
        {result?.ok && !result.created && (
          <p>O pedido já existia e foi devolvido. Nenhum pedido novo foi criado.</p>
        )}
        <p>A oportunidade está congelada e não muda mais de estágio.</p>
        <div className="row">
          <Link to="/orders" className="btn">
            Ver pedidos
          </Link>
          {/* Demonstra a idempotência: converter de novo devolve o mesmo pedido. */}
          <fetcher.Form method="post" preventScrollReset>
            <button type="submit" className="btn" disabled={converting}>
              {converting ? "Consultando…" : "Converter novamente"}
            </button>
          </fetcher.Form>
        </div>
      </div>
    );
  }

  if (o.stage !== "won") {
    return (
      <div className="box">
        <p>
          A conversão em pedido fica disponível quando a oportunidade estiver em <strong>Ganho</strong>.
        </p>
      </div>
    );
  }

  const failed = result && !result.ok ? result : null;
  return (
    <div className="box">
      <p>Gera um pedido no ERP com os dados do cliente e o valor da oportunidade.</p>
      {failed && (
        <div className="alert alert-error" role="alert">
          {failed.error}
        </div>
      )}
      <fetcher.Form method="post" preventScrollReset>
        <button type="submit" className="btn btn-primary" disabled={converting}>
          {converting
            ? "Criando pedido…"
            : failed?.code === "erp_unavailable"
              ? "Tentar novamente"
              : "Converter em pedido"}
        </button>
      </fetcher.Form>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const message = isRouteErrorResponse(error) && typeof error.data === "string" ? error.data : "";
  return (
    <Drawer title={notFound ? "Oportunidade não encontrada" : "Não foi possível abrir"}>
      <div className="drawer-body">
        <p className="sub">
          {notFound ? "Ela pode ter sido removida ou o endereço está incorreto." : message}
        </p>
      </div>
    </Drawer>
  );
}
