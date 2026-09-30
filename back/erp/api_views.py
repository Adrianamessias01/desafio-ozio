"""
API HTTP do serviço ERP (container `erp`, porta 8001).

É o "outro sistema" com que o CRM conversa. Só responde quando ERP_SERVE_API está
ligado (no container do ERP) e exige o header X-ERP-Key. Para demonstração, pode
simular latência (ERP_SIMULATE_LATENCY_MS) e indisponibilidade (ERP_SIMULATE_FAILURE).
"""

import hmac
import time

from django.conf import settings
from django.http import Http404
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .services import LocalErpGateway, OrderLine, OrderRequest


class OrderLineInput(serializers.Serializer):
    description = serializers.CharField(max_length=200)
    quantity = serializers.IntegerField(min_value=1)
    unit_price = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=0)


class OrderInput(serializers.Serializer):
    idempotency_key = serializers.CharField(max_length=100)
    customer_name = serializers.CharField(max_length=200)
    customer_document = serializers.CharField(max_length=14)
    items = OrderLineInput(many=True, allow_empty=False)


def _guard(request) -> Response | None:
    """Recusa quando o serviço não é o ERP, quando a chave não confere ou em falha simulada."""
    if not settings.ERP_SERVE_API:
        raise Http404
    key = request.headers.get("X-ERP-Key", "")
    if settings.ERP_API_KEY and not hmac.compare_digest(key, settings.ERP_API_KEY):
        return Response({"detail": "Chave do ERP inválida."}, status=status.HTTP_401_UNAUTHORIZED)
    if settings.ERP_SIMULATE_LATENCY_MS:
        time.sleep(settings.ERP_SIMULATE_LATENCY_MS / 1000)
    if settings.ERP_SIMULATE_FAILURE:
        return Response(
            {"detail": "ERP em manutenção (falha simulada)."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return None


@extend_schema(exclude=True)
@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def health(request):
    if refusal := _guard(request):
        return refusal
    return Response({"status": "ok"})


@extend_schema(exclude=True)
@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def create_order(request):
    if refusal := _guard(request):
        return refusal
    payload = OrderInput(data=request.data)
    payload.is_valid(raise_exception=True)
    data = payload.validated_data

    receipt = LocalErpGateway().create_order(
        OrderRequest(
            idempotency_key=data["idempotency_key"],
            customer_name=data["customer_name"],
            customer_document=data["customer_document"],
            items=tuple(OrderLine(**item) for item in data["items"]),
        )
    )
    return Response(
        {"number": receipt.number, "total": str(receipt.total), "created": receipt.created},
        status=status.HTTP_201_CREATED if receipt.created else status.HTTP_200_OK,
    )
