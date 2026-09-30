from rest_framework import viewsets
from rest_framework.exceptions import ValidationError

from .models import Order
from .serializers import OrderSerializer


class OrderViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Pedidos gerados no ERP. Somente leitura: pedidos nascem pela conversão no CRM.

    Ordenação: ?ordering=campo ou -campo (decrescente), com campo entre number,
    customer_name, status, created_at e total. Padrão: -created_at (mais recentes).
    """

    ORDERING_FIELDS = {"number", "customer_name", "status", "created_at", "total"}
    serializer_class = OrderSerializer

    def get_queryset(self):
        ordering = self.request.query_params.get("ordering", "-created_at")
        if ordering.removeprefix("-") not in self.ORDERING_FIELDS:
            raise ValidationError({"ordering": f"Ordenação inválida: {ordering}."})
        # O número desempata, para a ordem ser estável entre valores iguais.
        return Order.objects.prefetch_related("items").order_by(ordering, "number")
