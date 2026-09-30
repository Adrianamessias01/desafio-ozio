import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { createContext, useContext, useEffect, useRef, useState, type MouseEvent } from "react";
import { Link, Outlet, useFetcher, useFetchers, useLocation, useSubmit } from "react-router";

import { CalendarIcon, CheckCircleIcon, InfoIcon, UserIcon } from "~/components/icons";
import { NameAvatar } from "~/components/avatar";
import { LostReasonDialog } from "~/components/lost-reason-dialog";
import { PageError } from "~/components/page-error";
import { useToast } from "~/components/toast";
import { ApiError, actionError, apiFor, loadOrThrow } from "~/lib/api.server";
import { date, initials, money, moneyShort, todayISO } from "~/lib/format";
import { STAGES, blockReason, canMove, isOverdue, isStage, moveKey } from "~/lib/stages";
import type { Opportunity, StageKey } from "~/lib/types";
import type { Route } from "./+types/pipeline";

export function meta() {
  return [{ title: "Pipeline · Pipeline Comercial" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const api = await apiFor(request);
  const params = new URL(request.url).searchParams;
  const filters = {
    search: params.get("q")?.trim() ?? "",
    owner: params.get("owner") ?? "",
    closeFrom: params.get("from") ?? "",
    closeTo: params.get("to") ?? "",
  };
  const [opportunities, sellers, erp] = await Promise.all([
    loadOrThrow(() => api.listOpportunities(filters)),
    api.sellers().catch(() => []),
    // Status do ERP é informativo: se a consulta falhar, a faixa mostra "desconhecido".
    api.erpStatus().catch(() => null),
  ]);
  return {
    opportunities,
    sellers,
    erpAvailable: erp?.available ?? null,
    filters,
    today: todayISO(),
  };
}

/** Movimentação de estágio vinda do kanban (e da gaveta de detalhe). */
export async function action({ request }: Route.ActionArgs) {
  const api = await apiFor(request);
  const form = await request.formData();
  const id = Number(form.get("id"));
  const stage = form.get("stage");
  try {
    if (!id || !isStage(stage)) throw new ApiError(400, "Movimentação inválida.");
    await api.moveStage(id, stage, String(form.get("lost_reason") ?? ""));
    return { ok: true as const };
  } catch (error) {
    return actionError(error);
  }
}

export default function Pipeline({ loaderData }: Route.ComponentProps) {
  const toast = useToast();
  const submit = useSubmit();
  // A busca (?q=) acompanha a abertura das gavetas, para o kanban não perder o filtro.
  const { search } = useLocation();
  const fetchers = useFetchers();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [overStage, setOverStage] = useState<StageKey | null>(null);
  const [askLost, setAskLost] = useState<Opportunity | null>(null);
  const justDragged = useRef(false);

  // Atualização otimista: enquanto a requisição não termina, o card já aparece no destino.
  // Se a API recusar, o formData some e o card volta sozinho para a coluna original.
  const pendingStage = new Map<number, StageKey>();
  for (const fetcher of fetchers) {
    const stage = fetcher.formData?.get("stage");
    if (fetcher.formData?.get("intent") === "move" && isStage(stage)) {
      pendingStage.set(Number(fetcher.formData.get("id")), stage);
    }
  }
  const opportunities = loaderData.opportunities.map((o) =>
    pendingStage.has(o.id) ? { ...o, stage: pendingStage.get(o.id)! } : o,
  );
  const active = opportunities.find((o) => o.id === activeId) ?? null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] } }),
  );

  function move(o: Opportunity, stage: StageKey, lostReason = "") {
    submit(
      { intent: "move", id: String(o.id), stage, lost_reason: lostReason },
      { method: "post", action: "/", navigate: false, fetcherKey: moveKey(o.id), preventScrollReset: true },
    );
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(Number(event.active.id));
  }

  function onDragOver(event: DragOverEvent) {
    setOverStage((event.over?.id as StageKey | undefined) ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    setOverStage(null);
    justDragged.current = true;
    setTimeout(() => (justDragged.current = false), 0);

    const o = opportunities.find((item) => item.id === Number(event.active.id));
    const target = event.over?.id as StageKey | undefined;
    if (!o || !target || target === o.stage) return;
    if (!canMove(o, target)) {
      toast(blockReason(o, target), "error");
      return;
    }
    if (target === "lost") setAskLost(o);
    else move(o, target);
  }

  // Um clique logo após soltar o card não deve abrir o detalhe.
  function guardClick(event: MouseEvent) {
    if (justDragged.current) event.preventDefault();
  }

  // Filtros vão para a URL (GET): recarregar ou compartilhar mantém a visão.
  // Campos vazios saem da URL para ela continuar limpa.
  function applyFilters(form: HTMLFormElement) {
    const next = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === "string" && value) next.set(key, value);
    }
    submit(next, { method: "get", action: "/", replace: true, preventScrollReset: true });
  }

  const { filters } = loaderData;
  const filtering = Boolean(filters.search || filters.owner || filters.closeFrom || filters.closeTo);

  return (
    <TodayContext.Provider value={loaderData.today}>
      <div className="page-head">
        <div>
          <h1>Pipeline de oportunidades</h1>
          <p className="sub">Arraste os cards entre as colunas para mudar o estágio.</p>
        </div>
        <form
          className="filters"
          role="search"
          aria-label="Filtros do pipeline"
          onChange={(event) => applyFilters(event.currentTarget)}
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters(event.currentTarget);
          }}
        >
          {filters.search && <input type="hidden" name="q" value={filters.search} />}
          <label className="filter-field">
            <UserIcon />
            <span className="sr-only">Vendedor</span>
            <select name="owner" defaultValue={filters.owner} key={`owner-${filters.owner}`}>
              <option value="">Todos os vendedores</option>
              {loaderData.sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.name}
                </option>
              ))}
            </select>
          </label>
          <div className="filter-field" title="Previsão de fechamento">
            <CalendarIcon />
            <input
              type="date"
              name="from"
              aria-label="Previsão de fechamento a partir de"
              defaultValue={filters.closeFrom}
              key={`from-${filters.closeFrom}`}
            />
            <span aria-hidden="true">–</span>
            <input
              type="date"
              name="to"
              aria-label="Previsão de fechamento até"
              defaultValue={filters.closeTo}
              key={`to-${filters.closeTo}`}
            />
          </div>
        </form>
        <Link to={`/opportunities/new${search}`} preventScrollReset className="btn btn-primary">
          + Nova oportunidade
        </Link>
      </div>

      {filtering && (
        <p className="search-note" role="status">
          {opportunities.length} oportunidade(s)
          {filters.search ? ` para “${filters.search}”` : ""} com os filtros aplicados.
          <Link to="/" className="btn">
            Limpar filtros
          </Link>
        </p>
      )}

      <DndContext
        id="pipeline-board"
        sensors={sensors}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setOverStage(null);
        }}
      >
        <div className="board-wrap">
          <div className="board">
            {STAGES.map((stage) => (
              <Column
                key={stage.key}
                stage={stage}
                items={opportunities.filter((o) => o.stage === stage.key)}
                active={active}
                isOver={overStage === stage.key}
                pending={pendingStage}
                search={search}
                onCardClick={guardClick}
              />
            ))}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {active && <CardContent o={active} className="card overlay" />}
        </DragOverlay>
      </DndContext>

      <div className="erp-banner">
        <InfoIcon />
        <p>
          <strong>Integração com ERP:</strong> quando uma oportunidade chega em Ganho, abra o card
          e use “Converter em pedido” para criar o pedido no ERP.
        </p>
        <ErpStatus available={loaderData.erpAvailable} />
      </div>

      {loaderData.opportunities.map((o) => (
        <MoveErrorWatcher key={o.id} id={o.id} />
      ))}

      {askLost && (
        <LostReasonDialog
          title={askLost.title}
          onCancel={() => setAskLost(null)}
          onConfirm={(reason) => {
            move(askLost, "lost", reason);
            setAskLost(null);
          }}
        />
      )}

      <Outlet />
    </TodayContext.Provider>
  );
}

function ErpStatus({ available }: { available: boolean | null }) {
  const [state, label] =
    available === null
      ? ["unknown", "Status do ERP desconhecido"]
      : available
        ? ["ok", "ERP conectado"]
        : ["down", "ERP indisponível"];
  return (
    <span className="erp-status" data-state={state}>
      <span className="erp-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

function Column({
  stage,
  items,
  active,
  isOver,
  pending,
  search,
  onCardClick,
}: {
  stage: { key: StageKey; label: string };
  items: Opportunity[];
  active: Opportunity | null;
  isOver: boolean;
  pending: Map<number, StageKey>;
  search: string;
  onCardClick: (event: MouseEvent) => void;
}) {
  const { setNodeRef } = useDroppable({ id: stage.key });
  const total = items.reduce((sum, o) => sum + Number(o.amount), 0);

  let drop: "allowed" | "blocked" | undefined;
  if (active && active.stage !== stage.key) drop = canMove(active, stage.key) ? "allowed" : "blocked";

  return (
    <section
      ref={setNodeRef}
      className="col"
      data-drop={drop}
      data-over={isOver || undefined}
      style={{ "--c": `var(--st-${stage.key})` } as React.CSSProperties}
      aria-label={stage.label}
    >
      <div className="col-head">
        <span className="col-name">{stage.label}</span>
        <span className="col-count">{items.length}</span>
        <span className="col-sum" title={`Total da coluna: ${money(total)}`}>
          {moneyShort(total)}
        </span>
      </div>
      <div className="col-body">
        {drop && <div className="col-hint">{drop === "allowed" ? "Soltar aqui" : "Não permitido"}</div>}
        {items.map((o) => (
          <DraggableCard
            key={o.id}
            o={o}
            pending={pending.has(o.id)}
            search={search}
            onClick={onCardClick}
          />
        ))}
        {items.length === 0 && !drop && <div className="col-empty">Nenhuma oportunidade</div>}
      </div>
    </section>
  );
}

function DraggableCard({
  o,
  pending,
  search,
  onClick,
}: {
  o: Opportunity;
  pending: boolean;
  search: string;
  onClick: (event: MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: o.id,
    disabled: o.is_converted || pending,
  });
  // O card é um link para o detalhe; o papel "button" do dnd-kit esconderia isso.
  const { role: _role, ...dragAttributes } = attributes;

  return (
    <Link
      ref={setNodeRef}
      to={`/opportunities/${o.id}${search}`}
      preventScrollReset
      className="card"
      data-dragging={isDragging || undefined}
      data-pending={pending || undefined}
      data-locked={o.is_converted || undefined}
      aria-roledescription={o.is_converted ? undefined : "card arrastável"}
      aria-describedby={dragAttributes["aria-describedby"]}
      tabIndex={0}
      onClick={onClick}
      {...listeners}
    >
      <CardBody o={o} />
    </Link>
  );
}

function CardContent({ o, className }: { o: Opportunity; className: string }) {
  // Fora da coluna (arrastando), a cor do estágio precisa vir do próprio card.
  return (
    <div className={className} style={{ "--c": `var(--st-${o.stage})` } as React.CSSProperties}>
      <CardBody o={o} />
    </div>
  );
}

// Data de hoje calculada no servidor, para servidor e navegador marcarem os mesmos atrasos.
const TodayContext = createContext("");

function CardBody({ o }: { o: Opportunity }) {
  const overdue = isOverdue(o, useContext(TodayContext));

  let status = null;
  if (o.stage === "won") {
    status = o.is_converted ? (
      <span className="card-erp">
        <CheckCircleIcon />
        Pedido <span className="mono">{o.erp_order_number}</span>
      </span>
    ) : (
      <span className="pill pill-accent">Pronto para converter</span>
    );
  } else if (o.stage === "lost" && o.lost_reason) {
    status = (
      <span className="card-reason" title={o.lost_reason}>
        {o.lost_reason}
      </span>
    );
  }

  return (
    <>
      <span className="card-top">
        <NameAvatar name={o.customer.name} size="sm" />
        <span className="card-heading">
          <span className="card-title">{o.title}</span>
          <span className="card-customer">{o.customer.name}</span>
        </span>
      </span>
      {o.expected_close_date && (
        <span
          className="card-date"
          data-overdue={overdue || undefined}
          title={overdue ? "Previsão de fechamento vencida" : "Previsão de fechamento"}
        >
          <CalendarIcon />
          {date(o.expected_close_date)}
          {overdue && <strong>· Atrasada</strong>}
        </span>
      )}
      {status}
      <span className="card-foot">
        <span className="card-amount">{money(o.amount)}</span>
        <span className="card-owner" title={`Responsável: ${o.owner.name}`}>
          {initials(o.owner.name)}
        </span>
      </span>
    </>
  );
}

// Respostas já exibidas, para o aviso não repetir quando o componente remonta.
const shownErrors = new WeakSet<object>();

function MoveErrorWatcher({ id }: { id: number }) {
  const fetcher = useFetcher<typeof action>({ key: moveKey(id) });
  const toast = useToast();

  useEffect(() => {
    const result = fetcher.data;
    if (fetcher.state !== "idle" || !result || result.ok || shownErrors.has(result)) return;
    shownErrors.add(result);
    toast(result.error, "error");
  }, [fetcher.state, fetcher.data, toast]);

  return null;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PageError error={error} title="Pipeline indisponível" />;
}
