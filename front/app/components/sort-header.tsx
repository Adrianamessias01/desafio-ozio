import { Link, useSearchParams } from "react-router";

export type SortDir = "asc" | "desc";

/** Lê ?sort= e ?dir= da URL, aceitando só colunas conhecidas. */
export function readSort<T extends string>(
  url: URL,
  allowed: readonly T[],
  fallback: { sort: T; dir: SortDir },
): { sort: T; dir: SortDir } {
  const sort = url.searchParams.get("sort") as T | null;
  const dir = url.searchParams.get("dir");
  if (!sort || !allowed.includes(sort)) return fallback;
  return { sort, dir: dir === "desc" ? "desc" : "asc" };
}

/**
 * Título de coluna que ordena a tabela. O primeiro clique usa `firstDir`
 * (texto: A→Z; números: maior primeiro); clicar de novo inverte.
 */
export function SortHeader({
  field,
  label,
  current,
  firstDir = "asc",
  className,
}: {
  field: string;
  label: string;
  current: { sort: string; dir: SortDir };
  firstDir?: SortDir;
  className?: string;
}) {
  const [params] = useSearchParams();
  const active = current.sort === field;
  const nextDir: SortDir = active ? (current.dir === "asc" ? "desc" : "asc") : firstDir;

  const next = new URLSearchParams(params);
  next.set("sort", field);
  next.set("dir", nextDir);

  return (
    <th
      className={className}
      aria-sort={active ? (current.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <Link to={`?${next}`} preventScrollReset replace className="sort-link" data-active={active || undefined}>
        {label}
        <span className="sort-arrow" aria-hidden="true">
          {active ? (current.dir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </Link>
    </th>
  );
}
