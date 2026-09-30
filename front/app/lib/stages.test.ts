import { describe, expect, it } from "vitest";

import { OPEN_STAGES, STAGES, allowedTargets, blockReason, canMove, isOverdue } from "./stages";
import type { StageKey } from "./types";

const open = (stage: StageKey) => ({ stage, is_converted: false });

// Mesmas regras de back/crm/stages.py: o front só orienta o arrastar, mas não pode divergir.
describe("regras de transição", () => {
  it("estágios abertos circulam livremente entre si", () => {
    for (const from of OPEN_STAGES) {
      for (const to of OPEN_STAGES.filter((s) => s !== from)) {
        expect(canMove(open(from), to)).toBe(true);
      }
    }
  });

  it("só Negociação chega a Ganho", () => {
    const sources = STAGES.map((s) => s.key).filter((s) => canMove(open(s), "won"));
    expect(sources).toEqual(["negotiation"]);
  });

  it("qualquer estágio aberto pode ir para Perdido, e Perdido só reabre como Lead", () => {
    for (const stage of OPEN_STAGES) expect(canMove(open(stage), "lost")).toBe(true);
    expect(allowedTargets(open("lost"))).toEqual(["lead"]);
  });

  it("Ganho só volta para Negociação, e convertida não se move", () => {
    expect(allowedTargets(open("won"))).toEqual(["negotiation"]);
    expect(allowedTargets({ stage: "won", is_converted: true })).toEqual([]);
  });

  it("explica o motivo do bloqueio", () => {
    expect(blockReason(open("proposal"), "won")).toMatch(/a partir de Negociação/);
    expect(blockReason(open("lost"), "proposal")).toMatch(/reaberta como Lead/);
    expect(blockReason({ stage: "won", is_converted: true }, "negotiation")).toMatch(/convertida/);
  });
});

describe("oportunidade atrasada", () => {
  const today = "2026-09-30";

  it("aberta com previsão vencida está atrasada", () => {
    expect(isOverdue({ stage: "proposal", expected_close_date: "2026-09-29" }, today)).toBe(true);
  });

  it("previsão de hoje, sem data ou encerrada não está atrasada", () => {
    expect(isOverdue({ stage: "proposal", expected_close_date: today }, today)).toBe(false);
    expect(isOverdue({ stage: "lead", expected_close_date: null }, today)).toBe(false);
    expect(isOverdue({ stage: "won", expected_close_date: "2026-01-01" }, today)).toBe(false);
    expect(isOverdue({ stage: "lost", expected_close_date: "2026-01-01" }, today)).toBe(false);
  });
});
