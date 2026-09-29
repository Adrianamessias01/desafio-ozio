from decimal import Decimal

from django.db import IntegrityError
from django.test import TestCase

from erp.models import Order, OrderItem


class OrderModelTests(TestCase):
    def make_order(self, **overrides):
        data = {
            "number": "PED-000001",
            "idempotency_key": "crm-opportunity:1",
            "customer_name": "ACME Ltda",
            "customer_document": "12345678000199",
            "total": Decimal("1500.00"),
        }
        data.update(overrides)
        return Order.objects.create(**data)

    def test_new_order_is_open(self):
        self.assertEqual(self.make_order().status, Order.Status.OPEN)

    def test_idempotency_key_is_unique(self):
        self.make_order()
        with self.assertRaises(IntegrityError):
            self.make_order(number="PED-000002")

    def test_number_is_unique(self):
        self.make_order()
        with self.assertRaises(IntegrityError):
            self.make_order(idempotency_key="crm-opportunity:2")

    def test_database_rejects_negative_total(self):
        with self.assertRaises(IntegrityError):
            self.make_order(total=Decimal("-1"))

    def test_item_line_total(self):
        order = self.make_order()
        item = OrderItem.objects.create(
            order=order, description="Licença", quantity=3, unit_price=Decimal("500.00")
        )

        self.assertEqual(item.line_total, Decimal("1500.00"))

    def test_database_rejects_zero_quantity(self):
        order = self.make_order()
        with self.assertRaises(IntegrityError):
            OrderItem.objects.create(
                order=order, description="Licença", quantity=0, unit_price=Decimal("1")
            )
