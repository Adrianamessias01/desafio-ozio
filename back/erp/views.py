from rest_framework import viewsets

from .models import Order
from .serializers import OrderSerializer


class OrderViewSet(viewsets.ReadOnlyModelViewSet):
    """Pedidos gerados no ERP. Somente leitura: pedidos nascem pela conversão no CRM."""

    queryset = Order.objects.prefetch_related("items")
    serializer_class = OrderSerializer
