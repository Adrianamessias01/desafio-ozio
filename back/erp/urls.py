from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import OrderViewSet, erp_status

router = SimpleRouter()
router.register("orders", OrderViewSet, basename="order")

urlpatterns = [
    path("erp/status/", erp_status, name="erp-status"),
    *router.urls,
]
