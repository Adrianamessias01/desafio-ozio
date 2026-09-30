from django.urls import path

from . import api_views

# Montado em /erp-api/ (config/urls.py). Só responde no serviço ERP (ERP_SERVE_API).
urlpatterns = [
    path("health/", api_views.health, name="erp-api-health"),
    path("orders/", api_views.create_order, name="erp-api-orders"),
]
