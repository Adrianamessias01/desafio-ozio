"""
Estágios do pipeline e as transições permitidas entre eles.

Regras de negócio:
- Estágios abertos (Lead, Qualificação, Proposta, Negociação) circulam livremente
  entre si, para o vendedor corrigir o card no kanban.
- Só se chega a Ganho a partir de Negociação.
- Qualquer estágio aberto pode ir para Perdido.
- Perdido pode ser reaberto, voltando para Lead.
- Ganho pode voltar para Negociação enquanto não houver pedido no ERP; depois da
  conversão a oportunidade fica congelada (essa checagem mora na camada de serviço,
  pois depende do estado da oportunidade, não só do estágio).
"""

from django.db import models


class Stage(models.TextChoices):
    LEAD = "lead", "Lead"
    QUALIFICATION = "qualification", "Qualificação"
    PROPOSAL = "proposal", "Proposta"
    NEGOTIATION = "negotiation", "Negociação"
    WON = "won", "Ganho"
    LOST = "lost", "Perdido"


OPEN_STAGES = frozenset({Stage.LEAD, Stage.QUALIFICATION, Stage.PROPOSAL, Stage.NEGOTIATION})

ALLOWED_TRANSITIONS: dict[str, frozenset[str]] = {
    Stage.LEAD: frozenset({Stage.QUALIFICATION, Stage.PROPOSAL, Stage.NEGOTIATION, Stage.LOST}),
    Stage.QUALIFICATION: frozenset({Stage.LEAD, Stage.PROPOSAL, Stage.NEGOTIATION, Stage.LOST}),
    Stage.PROPOSAL: frozenset({Stage.LEAD, Stage.QUALIFICATION, Stage.NEGOTIATION, Stage.LOST}),
    Stage.NEGOTIATION: frozenset(
        {Stage.LEAD, Stage.QUALIFICATION, Stage.PROPOSAL, Stage.WON, Stage.LOST}
    ),
    Stage.WON: frozenset({Stage.NEGOTIATION}),
    Stage.LOST: frozenset({Stage.LEAD}),
}


def can_transition(current: str, target: str) -> bool:
    return target in ALLOWED_TRANSITIONS.get(current, frozenset())
