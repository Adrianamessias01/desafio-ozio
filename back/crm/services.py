"""
Regras do pipeline que dependem do estado da oportunidade.

As views só validam o formato da entrada e chamam estas funções. Toda alteração
trava a linha da oportunidade (`select_for_update`), para que uma mudança de
estágio e uma conversão simultâneas não se atropelem.
"""

from dataclasses import dataclass

from django.db import transaction
from django.utils import timezone

from core.exceptions import DomainError
from erp.services import ErpGateway, OrderLine, OrderRequest, get_erp_gateway

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


class OpportunityNotWon(DomainError):
    status_code = 409
    code = "opportunity_not_won"
    default_message = "Só oportunidades em Ganho podem ser convertidas em pedido."


@dataclass(frozen=True)
class ConversionResult:
    opportunity: Opportunity
    order_number: str
    created: bool  # True quando a conversão aconteceu nesta chamada


def convert_opportunity(
    opportunity_id: int, *, gateway: ErpGateway | None = None
) -> ConversionResult:
    """
    Converte uma oportunidade ganha em pedido no ERP.

    - Idempotente: se já foi convertida, devolve o pedido existente sem chamar o ERP.
      A chave enviada ao ERP é fixa por oportunidade, então mesmo uma repetição que
      chegue ao ERP devolve o mesmo pedido.
    - Atômica: pedido e marcação da oportunidade ficam na mesma transação; se o ERP
      falhar, nada é gravado.
    - A trava da linha serializa conversões simultâneas da mesma oportunidade.
    """
    gateway = gateway or get_erp_gateway()
    with transaction.atomic():
        opportunity = (
            Opportunity.objects.select_for_update().select_related("customer").get(pk=opportunity_id)
        )
        if opportunity.is_converted:
            return ConversionResult(opportunity, opportunity.erp_order_number, created=False)
        if opportunity.stage != Stage.WON:
            raise OpportunityNotWon()

        receipt = gateway.create_order(
            OrderRequest(
                idempotency_key=f"crm-opportunity:{opportunity.pk}",
                customer_name=opportunity.customer.name,
                customer_document=opportunity.customer.document,
                items=(
                    OrderLine(
                        description=opportunity.title,
                        quantity=1,
                        unit_price=opportunity.amount,
                    ),
                ),
            )
        )
        opportunity.erp_order_number = receipt.number
        opportunity.converted_at = timezone.now()
        opportunity.save(update_fields=["erp_order_number", "converted_at", "updated_at"])
    return ConversionResult(opportunity, receipt.number, created=True)


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
