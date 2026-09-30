from django.contrib import admin
from django.urls import include, path

from core import auth_views
from core.views import health, me

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    path("api/auth/login/", auth_views.login, name="login"),
    path("api/auth/logout/", auth_views.logout, name="logout"),
    path("api/me/", me, name="me"),
    path("api/", include("crm.urls")),
    path("api/", include("erp.urls")),
]
