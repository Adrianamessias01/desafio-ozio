"""
Login e logout por token.

O servidor do front-end (SSR) troca usuário e senha por um token, guarda o token em
cookie httpOnly e o envia no header Authorization. O navegador nunca vê o token.
"""

from django.contrib.auth import authenticate
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from core.exceptions import DomainError


class LoginRateThrottle(AnonRateThrottle):
    """Limita tentativas de login por IP (taxa em settings: DEFAULT_THROTTLE_RATES["login"])."""

    scope = "login"


class InvalidCredentials(DomainError):
    code = "invalid_credentials"
    default_message = "Usuário ou senha incorretos."


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=128, trim_whitespace=False)


class UserSummaryDoc(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    name = serializers.CharField()


def user_summary(user) -> dict:
    return {"id": user.id, "username": user.username, "name": user.get_full_name() or user.username}


@extend_schema(
    tags=["auth"],
    request=LoginSerializer,
    responses=inline_serializer(
        "LoginResponse", {"token": serializers.CharField(), "user": UserSummaryDoc()}
    ),
    auth=[],
)
@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def login(request):
    payload = LoginSerializer(data=request.data)
    payload.is_valid(raise_exception=True)
    user = authenticate(
        request,
        username=payload.validated_data["username"].strip(),
        password=payload.validated_data["password"],
    )
    if user is None:
        raise InvalidCredentials()
    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "user": user_summary(user)})


@extend_schema(tags=["auth"], request=None, responses={204: None})
@api_view(["POST"])
def logout(request):
    """Invalida o token usado na requisição (vale para todas as sessões do usuário)."""
    if isinstance(request.auth, Token):
        request.auth.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
