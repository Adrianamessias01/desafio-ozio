"""
Regras do pipeline que dependem do estado da oportunidade.

As views só validam o formato da entrada e chamam estas funções. Toda alteração
trava a linha da oportunidade (`select_for_update`), para que uma mudança de
estágio e uma conversão simultâneas não se atropelem.
"""

from django.db import transaction

from core.exceptions import DomainError

from .models import Opportunity, OpportunityStageChange
from .stages import Stage, can_transition


class OpportunityFrozen(DomainError):
    status_code = 409
    code = "opportunity_frozen"
    default_message = "A oportunidade já foi convertida em pedido e não pode mais ser alterada."


class InvalidStageTransition(DomainError):
    status_code = 409
    code = "invalid_stage_transition"


class LostReasonRequired(DomainError):
    code = "lost_reason_required"
    default_message = "Informe o motivo da perda."


def create_opportunity(*, owner, **data) -> Opportunity:
    with transaction.atomic():
        opportunity = Opportunity.objects.create(owner=owner, stage=Stage.LEAD, **data)
        OpportunityStageChange.objects.create(
            opportunity=opportunity, from_stage="", to_stage=Stage.LEAD, changed_by=owner
        )
    return opportunity


def update_opportunity(opportunity_id: int, **data) -> Opportunity:
    with transaction.atomic():
        opportunity = Opportunity.objects.select_for_update().get(pk=opportunity_id)
        if opportunity.is_converted:
            raise OpportunityFrozen()
        for field, value in data.items():
            setattr(opportunity, field, value)
        opportunity.save()
    return opportunity


def move_stage(opportunity_id: int, *, target: str, user, lost_reason: str = "") -> Opportunity:
    with transaction.atomic():
        opportunity = Opportunity.objects.select_for_update().get(pk=opportunity_id)
        current = opportunity.stage

        if opportunity.is_converted:
            raise OpportunityFrozen()
        if target == current:
            return opportunity
        if not can_transition(current, target):
            raise InvalidStageTransition(_transition_message(current, target))

        if target == Stage.LOST:
            reason = lost_reason.strip()
            if not reason:
                raise LostReasonRequired()
            opportunity.lost_reason = reason
        elif current == Stage.LOST:
            opportunity.lost_reason = ""

        opportunity.stage = target
        opportunity.save(update_fields=["stage", "lost_reason", "updated_at"])
        OpportunityStageChange.objects.create(
            opportunity=opportunity, from_stage=current, to_stage=target, changed_by=user
        )
    return opportunity


def _transition_message(current: str, target: str) -> str:
    if target == Stage.WON:
        return "Só é possível marcar como Ganho a partir de Negociação."
    if current == Stage.LOST:
        return "Uma oportunidade perdida só pode ser reaberta como Lead."
    if current == Stage.WON:
        return "Uma oportunidade ganha só pode voltar para Negociação."
    return f"Não é possível mover de {Stage(current).label} para {Stage(target).label}."
