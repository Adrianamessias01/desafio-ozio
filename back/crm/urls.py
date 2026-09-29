from rest_framework.routers import SimpleRouter

from .views import CustomerViewSet, OpportunityViewSet

router = SimpleRouter()
router.register("opportunities", OpportunityViewSet, basename="opportunity")
router.register("customers", CustomerViewSet, basename="customer")

urlpatterns = router.urls
