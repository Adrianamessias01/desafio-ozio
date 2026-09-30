from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from erp.models import Order
from erp.services import (
    ErpUnavailable,
    LocalErpGateway,
    OrderLine,
    OrderRequest,
    get_erp_gateway,
)


def make_request(key="crm-opportunity:1"):
    return OrderRequest(
        idempotency_key=key,
        customer_name="ACME Ltda",
        customer_document="12345678000199",
        items=(
            OrderLine(description="Licença", quantity=3, unit_price=Decimal("500.00")),
            OrderLine(description="Implantação", quantity=1, unit_price=Decimal("250.00")),
        ),
    )


class LocalErpGatewayTests(TestCase):
    def setUp(self):
        self.gateway = LocalErpGateway()

    def test_creates_order_with_items_and_total(self):
        receipt = self.gateway.create_order(make_request())

        self.assertTrue(receipt.created)
        self.assertEqual(receipt.total, Decimal("1750.00"))
        order = Order.objects.get(number=receipt.number)
        self.assertEqual(order.items.count(), 2)
        self.assertRegex(order.number, r"^PED-\d{6}$")

    def test_same_idempotency_key_returns_existing_order(self):
        first = self.gateway.create_order(make_request())
        second = self.gateway.create_order(make_request())

        self.assertFalse(second.created)
        self.assertEqual(first.number, second.number)
        self.assertEqual(Order.objects.count(), 1)

    def test_different_keys_get_different_numbers(self):
        first = self.gateway.create_order(make_request("crm-opportunity:1"))
        second = self.gateway.create_order(make_request("crm-opportunity:2"))

        self.assertNotEqual(first.number, second.number)

    @override_settings(ERP_SIMULATE_FAILURE=True)
    def test_simulated_failure_raises_and_creates_nothing(self):
        with self.assertRaises(ErpUnavailable):
            self.gateway.create_order(make_request())

        self.assertFalse(Order.objects.exists())

    def test_gateway_comes_from_settings(self):
        self.assertIsInstance(get_erp_gateway(), LocalErpGateway)


class OrderApiTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(get_user_model().objects.create_user(username="carla"))

    def test_lists_orders_with_items(self):
        LocalErpGateway().create_order(make_request())

        response = self.client.get(reverse("order-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        [order] = response.data
        self.assertEqual(order["total"], "1750.00")
        self.assertEqual(order["status_label"], "Aberto")
        self.assertEqual(len(order["items"]), 2)

    def test_lists_most_recent_first_by_default(self):
        LocalErpGateway().create_order(make_request("crm-opportunity:1"))
        LocalErpGateway().create_order(make_request("crm-opportunity:2"))

        response = self.client.get(reverse("order-list"))

        keys = [o["idempotency_key"] for o in response.data]
        self.assertEqual(keys, ["crm-opportunity:2", "crm-opportunity:1"])

    def test_lists_by_requested_field(self):
        gateway = LocalErpGateway()
        gateway.create_order(make_request("crm-opportunity:1"))
        gateway.create_order(
            OrderRequest(
                idempotency_key="crm-opportunity:2",
                customer_name="Beta",
                customer_document="98765432000110",
                items=(OrderLine(description="Extra", quantity=1, unit_price=Decimal("10.00")),),
            )
        )

        response = self.client.get(reverse("order-list"), {"ordering": "total"})

        self.assertEqual([o["total"] for o in response.data], ["10.00", "1750.00"])

    def test_rejects_unknown_ordering(self):
        response = self.client.get(reverse("order-list"), {"ordering": "items"})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("ordering", response.data)

    def test_erp_status_reports_availability(self):
        self.assertEqual(self.client.get(reverse("erp-status")).data, {"available": True})
        with override_settings(ERP_SIMULATE_FAILURE=True):
            self.assertEqual(self.client.get(reverse("erp-status")).data, {"available": False})

    def test_orders_are_read_only(self):
        response = self.client.post(reverse("order-list"), {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
