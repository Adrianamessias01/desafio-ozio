from django.test import TestCase
from django.urls import reverse


class ApiDocsTests(TestCase):
    def test_schema_is_public_and_lists_main_routes(self):
        response = self.client.get(reverse("schema"), HTTP_ACCEPT="application/json")

        self.assertEqual(response.status_code, 200)
        paths = response.json()["paths"]
        for route in (
            "/api/opportunities/{id}/convert/",
            "/api/opportunities/{id}/stage/",
            "/api/auth/login/",
            "/api/orders/",
        ):
            with self.subTest(route=route):
                self.assertIn(route, paths)

    def test_swagger_page_is_public(self):
        self.assertEqual(self.client.get(reverse("docs")).status_code, 200)
