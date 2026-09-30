from django.contrib import admin
from django.urls import include, path

from core.views import health, me

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    path("api/me/", me, name="me"),
    path("api/", include("crm.urls")),
    path("api/", include("erp.urls")),
]
