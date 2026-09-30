from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from core.auth_views import LoginRateThrottle


class AuthTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user(
            username="carla", password="ozio1234", first_name="Carla", last_name="Souza"
        )

    def setUp(self):
        cache.clear()  # contador do limite de tentativas de login

    def login(self, **data):
        payload = {"username": "carla", "password": "ozio1234", **data}
        return self.client.post(reverse("login"), payload, format="json")

    def test_login_returns_token_and_user(self):
        response = self.login()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["token"], Token.objects.get(user=self.user).key)
        self.assertEqual(response.data["user"]["name"], "Carla Souza")

    def test_token_authenticates_requests(self):
        token = self.login().data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")

        self.assertEqual(self.client.get(reverse("me")).data["username"], "carla")

    def test_wrong_password_is_rejected(self):
        response = self.login(password="errada")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "invalid_credentials")
        self.assertFalse(Token.objects.exists())

    def test_missing_fields_are_validation_errors(self):
        response = self.client.post(reverse("login"), {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", response.data)

    def test_logout_revokes_token(self):
        token = self.login().data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")

        response = self.client.post(reverse("logout"))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Token.objects.filter(key=token).exists())
        self.assertEqual(self.client.get(reverse("me")).status_code, status.HTTP_401_UNAUTHORIZED)

    # A taxa é lida quando a classe é importada; o patch simula uma configuração mais baixa.
    @mock.patch.object(LoginRateThrottle, "THROTTLE_RATES", {"login": "3/min"})
    def test_login_attempts_are_rate_limited(self):
        for _ in range(3):
            self.login(password="errada")

        response = self.login()

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_logout_requires_authentication(self):
        self.assertEqual(
            self.client.post(reverse("logout")).status_code, status.HTTP_401_UNAUTHORIZED
        )
