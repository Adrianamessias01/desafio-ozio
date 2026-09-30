from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import CustomerViewSet, OpportunityViewSet, sellers

router = SimpleRouter()
router.register("opportunities", OpportunityViewSet, basename="opportunity")
router.register("customers", CustomerViewSet, basename="customer")

urlpatterns = [
    path("sellers/", sellers, name="sellers"),
    *router.urls,
]
