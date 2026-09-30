// Fuso fixo: servidor e navegador precisam gerar o mesmo texto para a hidratação bater.
const TIME_ZONE = "America/Sao_Paulo";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compact = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function money(value: string | number) {
  return currency.format(Number(value));
}

export function moneyShort(value: number) {
  if (value >= 1_000_000) return `R$ ${compact.format(value / 1_000_000)} mi`;
  if (value >= 1_000) return `R$ ${compact.format(value / 1_000)} mil`;
  return money(value);
}

/** Data sem hora da API ("2026-10-30"), formatada sem passar por Date para não mudar de dia. */
export function date(iso: string | null) {
  if (!iso) return "—";
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export function dateTime(iso: string | null) {
  return iso ? dateTimeFmt.format(new Date(iso)) : "—";
}

export function taxId(digits: string) {
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return digits;
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

const isoDateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });

/** Hoje no fuso de São Paulo, no formato da API ("2026-09-30"). */
export function todayISO() {
  return isoDateFmt.format(new Date());
}

/**
 * Matiz (0–359) derivado do nome: o mesmo cliente tem sempre a mesma cor de avatar,
 * no servidor e no navegador.
 */
export function hueFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

/** Aceita "1.500,50", "1500,50" ou "1500.50" e devolve "1500.50". */
export function parseAmount(input: string) {
  const value = input.trim().replace(/\s|R\$/g, "");
  return value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value;
}
