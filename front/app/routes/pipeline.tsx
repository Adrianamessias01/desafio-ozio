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
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Link, Outlet, useFetcher, useFetchers, useLocation, useSubmit } from "react-router";

import {
  BuildingIcon,
  CalendarIcon,
  ClockIcon,
  ReceiptIcon,
  TrophyIcon,
  WalletIcon,
} from "~/components/icons";
import { LostReasonDialog } from "~/components/lost-reason-dialog";
import { PageError } from "~/components/page-error";
import { Stat } from "~/components/stat";
import { useToast } from "~/components/toast";
import { ApiError, actionError, api, loadOrThrow } from "~/lib/api.server";
import { date, initials, money, moneyShort } from "~/lib/format";
import { OPEN_STAGES, STAGES, blockReason, canMove, isStage, moveKey } from "~/lib/stages";
import type { Opportunity, StageKey } from "~/lib/types";
import type { Route } from "./+types/pipeline";

export function meta() {
  return [{ title: "Pipeline · Pipeline Comercial" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const search = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const opportunities = await loadOrThrow(() => api.listOpportunities(search));
  return { opportunities, search };
}

/** Movimentação de estágio vinda do kanban (e da gaveta de detalhe). */
export async function action({ request }: Route.ActionArgs) {
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

  const sum = (items: Opportunity[]) => items.reduce((total, o) => total + Number(o.amount), 0);
  const open = opportunities.filter((o) => OPEN_STAGES.includes(o.stage));
  const won = opportunities.filter((o) => o.stage === "won");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pipeline de oportunidades</h1>
          <p className="sub">Arraste os cards entre as colunas para mudar o estágio.</p>
        </div>
        <Link to={`/opportunities/new${search}`} preventScrollReset className="btn btn-primary">
          + Nova oportunidade
        </Link>
      </div>

      {loaderData.search && (
        <p className="search-note" role="status">
          {opportunities.length} resultado(s) para “{loaderData.search}”.
          <Link to="/" className="btn">
            Limpar busca
          </Link>
        </p>
      )}

      <div className="stats">
        <Stat label="Em aberto" value={money(sum(open))} icon={<WalletIcon />} tone="var(--accent)" />
        <Stat label="Ganho" value={money(sum(won))} icon={<TrophyIcon />} tone="var(--st-won)" />
        <Stat
          label="Aguardando pedido"
          value={String(won.filter((o) => !o.is_converted).length)}
          icon={<ClockIcon />}
          tone="var(--st-negotiation)"
        />
        <Stat
          label="Pedidos no ERP"
          value={String(won.filter((o) => o.is_converted).length)}
          icon={<ReceiptIcon />}
          tone="var(--st-proposal)"
        />
      </div>

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
    </>
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
        <span className="dot" />
        <span className="col-name">{stage.label}</span>
        <span className="col-count">{items.length}</span>
        <span className="col-sum">{moneyShort(total)}</span>
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

function CardBody({ o }: { o: Opportunity }) {
  let badge = null;
  if (o.stage === "won") {
    badge = o.is_converted ? (
      <span className="pill pill-ok">
        Pedido <span className="mono">{o.erp_order_number}</span>
      </span>
    ) : (
      <span className="pill pill-accent">Pronto para converter</span>
    );
  } else if (o.stage === "lost") {
    badge = <span className="pill pill-danger">Perdida</span>;
  }

  return (
    <>
      <span className="card-top">
        <span className="card-icon">
          <BuildingIcon />
        </span>
        <span className="card-heading">
          <span className="card-title">{o.title}</span>
          <span className="card-amount">{money(o.amount)}</span>
        </span>
      </span>
      <span className="card-customer">{o.customer.name}</span>
      {badge}
      <span className="card-foot">
        <span className="card-owner">
          <span className="card-owner-initials" aria-hidden="true">
            {initials(o.owner.name)}
          </span>
          {o.owner.name.split(" ")[0]}
        </span>
        {o.expected_close_date && (
          <span className="card-date" title="Previsão de fechamento">
            <CalendarIcon />
            {date(o.expected_close_date)}
          </span>
        )}
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
