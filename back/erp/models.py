"""
Modelos do ERP simulado.

O ERP é tratado como um sistema externo: não conhece os modelos do CRM.
Os dados do cliente são copiados para o pedido (snapshot) e a origem é
identificada pela `idempotency_key`, que também impede pedidos duplicados.
"""

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q

from core.models import TimeStampedModel


class Order(TimeStampedModel):
    class Status(models.TextChoices):
        OPEN = "open", "Aberto"
        INVOICED = "invoiced", "Faturado"
        CANCELLED = "cancelled", "Cancelado"

    number = models.CharField("número", max_length=30, unique=True)
    idempotency_key = models.CharField("chave de idempotência", max_length=100, unique=True)
    customer_name = models.CharField("cliente", max_length=200)
    customer_document = models.CharField("CPF/CNPJ do cliente", max_length=14)
    status = models.CharField(
        "situação", max_length=20, choices=Status.choices, default=Status.OPEN
    )
    total = models.DecimalField(
        "total", max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal("0"))]
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "pedido"
        verbose_name_plural = "pedidos"
        constraints = [
            models.CheckConstraint(condition=Q(total__gte=0), name="erp_order_total_non_negative"),
        ]

    def __str__(self):
        return self.number


class OrderItem(models.Model):
    order = models.ForeignKey(
        Order, on_delete=models.CASCADE, related_name="items", verbose_name="pedido"
    )
    description = models.CharField("descrição", max_length=200)
    quantity = models.PositiveIntegerField("quantidade", validators=[MinValueValidator(1)])
    unit_price = models.DecimalField(
        "preço unitário",
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))],
    )

    class Meta:
        verbose_name = "item do pedido"
        verbose_name_plural = "itens do pedido"
        constraints = [
            models.CheckConstraint(condition=Q(quantity__gt=0), name="erp_item_quantity_positive"),
            models.CheckConstraint(
                condition=Q(unit_price__gte=0), name="erp_item_unit_price_non_negative"
            ),
        ]

    def __str__(self):
        return f"{self.quantity} × {self.description}"

    @property
    def line_total(self) -> Decimal:
        return self.unit_price * self.quantity
