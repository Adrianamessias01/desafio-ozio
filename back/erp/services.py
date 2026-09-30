"""
Interface pública do ERP.

O CRM só conversa com o ERP por aqui: monta um `OrderRequest` e recebe um
`OrderReceipt`. A implementação é escolhida pela configuração `ERP_GATEWAY`:

- `HttpErpGateway`: cliente HTTP do serviço ERP (container `erp` no docker-compose),
  com timeout e novas tentativas. É o que roda na aplicação.
- `LocalErpGateway`: a lógica do ERP em si, gravando no banco. É usada pelo próprio
  serviço ERP para atender as requisições, e pelos testes do CRM.

Contrato de qualquer implementação:
- `create_order` é idempotente pela `idempotency_key`: repetir a chamada devolve
  o mesmo pedido, com `created=False`. Por isso é seguro tentar de novo.
- Indisponibilidade é sinalizada com `ErpUnavailable`.
- `is_available` responde se o ERP está no ar, para a interface avisar o usuário.
"""

import json
import logging
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol

from django.conf import settings
from django.db import IntegrityError, connection, transaction
from django.utils.module_loading import import_string

from core.exceptions import DomainError

from .models import Order, OrderItem

logger = logging.getLogger(__name__)


class ErpUnavailable(DomainError):
    status_code = 503
    code = "erp_unavailable"
    default_message = (
        "O ERP não respondeu e o pedido não foi criado. Nenhuma alteração foi feita; "
        "tente novamente em instantes."
    )


class ErpRejected(DomainError):
    """O ERP respondeu, mas recusou o pedido (erro 4xx). Tentar de novo não resolve."""

    status_code = 502
    code = "erp_rejected"
    default_message = "O ERP recusou o pedido."


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

    def is_available(self) -> bool: ...


class LocalErpGateway:
    """ERP simulado, gravando no próprio banco da aplicação."""

    def is_available(self) -> bool:
        return not settings.ERP_SIMULATE_FAILURE

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


class HttpErpGateway:
    """
    Cliente HTTP do serviço ERP.

    Falhas de rede, timeout e respostas 5xx são repetidas (ERP_RETRIES vezes, com espera
    crescente): como o pedido é idempotente pela chave, repetir nunca duplica. Esgotadas
    as tentativas, levanta ErpUnavailable. Respostas 4xx viram ErpRejected, sem repetir.
    """

    def __init__(self):
        self.base_url = settings.ERP_BASE_URL.rstrip("/")
        self.api_key = settings.ERP_API_KEY
        self.timeout = settings.ERP_TIMEOUT
        self.retries = settings.ERP_RETRIES

    def is_available(self) -> bool:
        try:
            self._send("GET", "/health/", timeout=min(self.timeout, 2))
        except (ErpUnavailable, ErpRejected):
            return False
        return True

    def create_order(self, request: OrderRequest) -> OrderReceipt:
        payload = {
            "idempotency_key": request.idempotency_key,
            "customer_name": request.customer_name,
            "customer_document": request.customer_document,
            "items": [
                {
                    "description": item.description,
                    "quantity": item.quantity,
                    "unit_price": str(item.unit_price),
                }
                for item in request.items
            ],
        }
        for attempt in range(self.retries + 1):
            try:
                data = self._send("POST", "/orders/", payload)
                return OrderReceipt(
                    number=data["number"], total=Decimal(data["total"]), created=data["created"]
                )
            except ErpUnavailable:
                if attempt == self.retries:
                    raise
                logger.warning(
                    "ERP indisponível (tentativa %s de %s) para %s",
                    attempt + 1,
                    self.retries + 1,
                    request.idempotency_key,
                )
                time.sleep(0.2 * 2**attempt)
        raise ErpUnavailable()  # inalcançável; mantém o tipo de retorno explícito

    def _send(self, method: str, path: str, body: dict | None = None, *, timeout=None) -> dict:
        http_request = urllib.request.Request(
            f"{self.base_url}{path}",
            method=method,
            data=json.dumps(body).encode() if body is not None else None,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "X-ERP-Key": self.api_key,
            },
        )
        try:
            with urllib.request.urlopen(http_request, timeout=timeout or self.timeout) as response:
                return json.loads(response.read() or b"{}")
        except urllib.error.HTTPError as error:
            if error.code >= 500:
                raise ErpUnavailable() from error
            detail = _error_detail(error)
            raise ErpRejected(f"O ERP recusou o pedido: {detail}" if detail else None) from error
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            raise ErpUnavailable() from error


def _error_detail(error: urllib.error.HTTPError) -> str:
    try:
        return str(json.loads(error.read()).get("detail", ""))
    except (ValueError, AttributeError):
        return ""


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
