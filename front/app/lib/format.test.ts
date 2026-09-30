import { describe, expect, it } from "vitest";

import { date, hueFor, initials, money, moneyShort, parseAmount, relativeTime, taxId } from "./format";

// O Intl usa espaço não separável entre "R$" e o número.
const plain = (text: string) => text.replace(/ /g, " ");

describe("formatação", () => {
  it("moeda em reais", () => {
    expect(plain(money("1500.5"))).toBe("R$ 1.500,50");
    expect(plain(moneyShort(210_000))).toBe("R$ 210 mil");
    expect(plain(moneyShort(1_250_000))).toBe("R$ 1,3 mi");
  });

  it("data da API sem mudar de dia por fuso", () => {
    expect(date("2026-10-01")).toBe("01/10/2026");
    expect(date(null)).toBe("—");
  });

  it("CPF e CNPJ", () => {
    expect(taxId("12345678000190")).toBe("12.345.678/0001-90");
    expect(taxId("12345678909")).toBe("123.456.789-09");
  });

  it("valor digitado em formato brasileiro ou americano", () => {
    expect(parseAmount("1.234,56")).toBe("1234.56");
    expect(parseAmount("R$ 1500,00")).toBe("1500.00");
    expect(parseAmount("1500.00")).toBe("1500.00");
  });

  it("iniciais e cor estável por nome", () => {
    expect(initials("Metalúrgica Vale do Aço")).toBe("MV");
    expect(hueFor("Clínica Bem Viver")).toBe(hueFor("Clínica Bem Viver"));
    expect(hueFor("A")).not.toBe(hueFor("B"));
  });

  it("tempo relativo", () => {
    const now = new Date("2026-09-30T12:00:00Z").getTime();
    expect(relativeTime("2026-09-30T11:59:40Z", now)).toBe("agora há pouco");
    expect(relativeTime("2026-09-30T11:45:00Z", now)).toBe("há 15 min");
    expect(relativeTime("2026-09-30T09:00:00Z", now)).toBe("há 3 h");
    expect(relativeTime("2026-09-29T09:00:00Z", now)).toBe("ontem");
    expect(relativeTime("2026-09-20T12:00:00Z", now)).toBe("20/09/2026");
  });
});
