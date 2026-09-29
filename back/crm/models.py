from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator, RegexValidator
from django.db import models
from django.db.models import Q

from core.models import TimeStampedModel

from .stages import Stage

document_validator = RegexValidator(
    regex=r"^(\d{11}|\d{14})$",
    message="Informe apenas os dígitos do CPF (11) ou do CNPJ (14).",
)


class Customer(TimeStampedModel):
    name = models.CharField("nome", max_length=200)
    document = models.CharField(
        "CPF/CNPJ", max_length=14, unique=True, validators=[document_validator]
    )
    email = models.EmailField("e-mail", blank=True)
    phone = models.CharField("telefone", max_length=20, blank=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "cliente"
        verbose_name_plural = "clientes"

    def __str__(self):
        return self.name


class Opportunity(TimeStampedModel):
    title = models.CharField("título", max_length=200)
    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="opportunities",
        verbose_name="cliente",
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="opportunities",
        verbose_name="responsável",
    )
    amount = models.DecimalField(
        "valor",
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    stage = models.CharField(
        "estágio", max_length=20, choices=Stage.choices, default=Stage.LEAD, db_index=True
    )
    expected_close_date = models.DateField("previsão de fechamento", null=True, blank=True)
    lost_reason = models.TextField("motivo da perda", blank=True)

    # Referência ao pedido criado no ERP. O CRM guarda apenas o identificador
    # externo; não há chave estrangeira para as tabelas do ERP.
    erp_order_number = models.CharField(
        "pedido no ERP", max_length=30, unique=True, null=True, blank=True, editable=False
    )
    converted_at = models.DateTimeField("convertida em", null=True, blank=True, editable=False)

    class Meta:
        ordering = ["-updated_at"]
        verbose_name = "oportunidade"
        verbose_name_plural = "oportunidades"
        indexes = [models.Index(fields=["owner", "stage"])]
        constraints = [
            models.CheckConstraint(
                condition=Q(amount__gt=0),
                name="crm_opportunity_amount_positive",
            ),
            models.CheckConstraint(
                condition=Q(erp_order_number__isnull=True) | Q(stage=Stage.WON),
                name="crm_opportunity_converted_only_when_won",
            ),
            models.CheckConstraint(
                condition=(
                    Q(erp_order_number__isnull=True, converted_at__isnull=True)
                    | Q(erp_order_number__isnull=False, converted_at__isnull=False)
                ),
                name="crm_opportunity_conversion_fields_together",
            ),
        ]

    def __str__(self):
        return self.title

    @property
    def is_converted(self) -> bool:
        return self.erp_order_number is not None


class OpportunityStageChange(models.Model):
    """Trilha de auditoria de cada movimentação no pipeline."""

    opportunity = models.ForeignKey(
        Opportunity,
        on_delete=models.CASCADE,
        related_name="stage_changes",
        verbose_name="oportunidade",
    )
    from_stage = models.CharField("de", max_length=20, choices=Stage.choices, blank=True)
    to_stage = models.CharField("para", max_length=20, choices=Stage.choices)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="+",
        verbose_name="alterado por",
    )
    changed_at = models.DateTimeField("alterado em", auto_now_add=True)

    class Meta:
        ordering = ["changed_at"]
        verbose_name = "mudança de estágio"
        verbose_name_plural = "mudanças de estágio"

    def __str__(self):
        return f"{self.opportunity_id}: {self.from_stage or '—'} → {self.to_stage}"
