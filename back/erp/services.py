"""
Interface pública do ERP.

O CRM só conversa com o ERP por aqui: monta um `OrderRequest` e recebe um
`OrderReceipt`. A implementação é escolhida pela configuração `ERP_GATEWAY`, de
modo que o ERP simulado (`LocalErpGateway`) possa ser trocado por um cliente
HTTP de um ERP real sem mexer nas regras do pipeline.

Contrato de qualquer implementação:
- `create_order` é idempotente pela `idempotency_key`: repetir a chamada devolve
  o mesmo pedido, com `created=False`.
- Indisponibilidade é sinalizada com `ErpUnavailable`.
"""

from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol

from django.conf import settings
from django.db import IntegrityError, connection, transaction
from django.utils.module_loading import import_string

from core.exceptions import DomainError

from .models import Order, OrderItem


class ErpUnavailable(DomainError):
    status_code = 503
    code = "erp_unavailable"
    default_message = (
        "O ERP não respondeu e o pedido não foi criado. Nenhuma alteração foi feita; "
        "tente novamente em instantes."
    )


@dataclass(frozen=True)
class OrderLine:
    description: str
    quantity: int
    unit_price: Decimal


@dataclass(frozen=True)
class OrderRequest:
    idempotency_key: str
    customer_name: str
    customer_document: str
    items: tuple[OrderLine, ...]


@dataclass(frozen=True)
class OrderReceipt:
    number: str
    total: Decimal
    created: bool


class ErpGateway(Protocol):
    def create_order(self, request: OrderRequest) -> OrderReceipt: ...


class LocalErpGateway:
    """ERP simulado, gravando no próprio banco da aplicação."""

    def create_order(self, request: OrderRequest) -> OrderReceipt:
        if settings.ERP_SIMULATE_FAILURE:
            raise ErpUnavailable()
        if not request.items:
            raise ValueError("Um pedido precisa de pelo menos um item.")

        existing = Order.objects.filter(idempotency_key=request.idempotency_key).first()
        if existing:
            return _receipt(existing, created=False)

        try:
            with transaction.atomic():
                order = Order.objects.create(
                    number=_next_order_number(),
                    idempotency_key=request.idempotency_key,
                    customer_name=request.customer_name,
                    customer_document=request.customer_document,
                    total=sum((i.unit_price * i.quantity for i in request.items), Decimal("0")),
                )
                OrderItem.objects.bulk_create(
                    OrderItem(
                        order=order,
                        description=i.description,
                        quantity=i.quantity,
                        unit_price=i.unit_price,
                    )
                    for i in request.items
                )
        except IntegrityError:
            # Outra requisição criou o pedido com a mesma chave entre a consulta e o insert.
            existing = Order.objects.filter(idempotency_key=request.idempotency_key).first()
            if existing is None:
                raise
            return _receipt(existing, created=False)

        return _receipt(order, created=True)


def get_erp_gateway() -> ErpGateway:
    return import_string(settings.ERP_GATEWAY)()


def _next_order_number() -> str:
    # Sequence do PostgreSQL: numeração sem colisão mesmo com conversões simultâneas.
    with connection.cursor() as cursor:
        cursor.execute("SELECT nextval('erp_order_number_seq')")
        (value,) = cursor.fetchone()
    return f"PED-{value:06d}"


def _receipt(order: Order, *, created: bool) -> OrderReceipt:
    return OrderReceipt(number=order.number, total=order.total, created=created)
