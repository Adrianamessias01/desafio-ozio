from django.db import DatabaseError, connection
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def health(request):
    """Verificação de saúde usada pelo docker-compose e por monitoramento."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except DatabaseError:
        return Response(
            {"status": "unavailable", "database": "down"},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return Response({"status": "ok", "database": "up"})


@api_view(["GET"])
def me(request):
    """Usuário dono do token; o front-end usa para mostrar quem está operando."""
    user = request.user
    return Response(
        {"id": user.id, "username": user.username, "name": user.get_full_name() or user.username}
    )
