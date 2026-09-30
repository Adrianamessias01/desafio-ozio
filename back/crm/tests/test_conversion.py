import threading
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TransactionTestCase, override_settings
from django.urls import reverse
from rest_framework import status

from crm import services
from crm.models import Customer, Opportunity
from crm.stages import Stage
from crm.tests.test_api import ApiTestCase
from erp.models import Order
from erp.services import ErpUnavailable, LocalErpGateway


class FailsAfterCreatingOrder(LocalErpGateway):
    """ERP que grava o pedido e só então falha: prova que a transação desfaz tudo."""

    def create_order(self, request):
        super().create_order(request)
        raise ErpUnavailable()


class ConvertApiTests(ApiTestCase):
    def convert(self, opportunity):
        return self.client.post(reverse("opportunity-convert", args=[opportunity.pk]))

    def test_converts_won_opportunity_into_order(self):
        opportunity = self.make_opportunity(stage=Stage.WON, amount=Decimal("2500.00"))

        response = self.convert(opportunity)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertTrue(response.data["created"])
        order = Order.objects.get()
        self.assertEqual(response.data["order_number"], order.number)
        self.assertEqual(response.data["opportunity"]["erp_order_number"], order.number)
        self.assertTrue(response.data["opportunity"]["is_converted"])
        self.assertEqual(order.idempotency_key, f"crm-opportunity:{opportunity.pk}")
        self.assertEqual(order.customer_name, "ACME Ltda")
        self.assertEqual(order.total, Decimal("2500.00"))
        [item] = order.items.all()
        self.assertEqual((item.description, item.quantity), (opportunity.title, 1))

    def test_rejects_opportunity_outside_won(self):
        for stage in (Stage.LEAD, Stage.NEGOTIATION, Stage.LOST):
            with self.subTest(stage=stage):
                opportunity = self.make_opportunity(stage=stage, lost_reason="x")

                response = self.convert(opportunity)

                self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
                self.assertEqual(response.data["code"], "opportunity_not_won")
        self.assertFalse(Order.objects.exists())

    def test_second_conversion_returns_same_order(self):
        opportunity = self.make_opportunity(stage=Stage.WON)

        first = self.convert(opportunity)
        second = self.convert(opportunity)

        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertFalse(second.data["created"])
        self.assertEqual(first.data["order_number"], second.data["order_number"])
        self.assertEqual(Order.objects.count(), 1)

    @override_settings(ERP_SIMULATE_FAILURE=True)
    def test_erp_failure_returns_handled_error_and_changes_nothing(self):
        opportunity = self.make_opportunity(stage=Stage.WON)

        response = self.convert(opportunity)

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data["code"], "erp_unavailable")
        self.assertIn("tente novamente", response.data["detail"])
        opportunity.refresh_from_db()
        self.assertFalse(opportunity.is_converted)
        self.assertEqual(opportunity.stage, Stage.WON)

    def test_retry_after_erp_failure_succeeds(self):
        opportunity = self.make_opportunity(stage=Stage.WON)
        with override_settings(ERP_SIMULATE_FAILURE=True):
            self.convert(opportunity)

        response = self.convert(opportunity)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Order.objects.count(), 1)

    def test_converted_opportunity_cannot_leave_won(self):
        opportunity = self.make_opportunity(stage=Stage.WON)
        self.convert(opportunity)

        response = self.move(opportunity, Stage.NEGOTIATION)

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["code"], "opportunity_frozen")


class ConvertServiceTests(ApiTestCase):
    def test_erp_failure_after_order_insert_rolls_everything_back(self):
        opportunity = self.make_opportunity(stage=Stage.WON)

        with self.assertRaises(ErpUnavailable):
            services.convert_opportunity(opportunity.pk, gateway=FailsAfterCreatingOrder())

        self.assertFalse(Order.objects.exists())
        opportunity.refresh_from_db()
        self.assertIsNone(opportunity.erp_order_number)
        self.assertIsNone(opportunity.converted_at)

    def test_links_order_already_existing_in_erp(self):
        # Ex.: o ERP criou o pedido, mas a resposta se perdeu antes do CRM gravar.
        opportunity = self.make_opportunity(stage=Stage.WON)
        Order.objects.create(
            number="PED-999999",
            idempotency_key=f"crm-opportunity:{opportunity.pk}",
            customer_name="ACME Ltda",
            customer_document="12345678000199",
            total=Decimal("1500.00"),
        )

        result = services.convert_opportunity(opportunity.pk)

        self.assertEqual(result.order_number, "PED-999999")
        self.assertEqual(Order.objects.count(), 1)

    def test_converted_opportunity_does_not_call_erp_again(self):
        opportunity = self.make_opportunity(stage=Stage.WON)
        services.convert_opportunity(opportunity.pk)

        with override_settings(ERP_SIMULATE_FAILURE=True):
            result = services.convert_opportunity(opportunity.pk)

        self.assertFalse(result.created)


class ConcurrentConversionTests(TransactionTestCase):
    """Duas conversões ao mesmo tempo, em conexões diferentes, geram um único pedido."""

    def test_simultaneous_conversions_create_a_single_order(self):
        owner = get_user_model().objects.create_user(username="carla")
        customer = Customer.objects.create(name="ACME Ltda", document="12345678000199")
        opportunity = Opportunity.objects.create(
            title="Licenças", customer=customer, owner=owner,
            amount=Decimal("1500.00"), stage=Stage.WON,
        )
        barrier = threading.Barrier(2)
        results, errors = [], []

        def convert():
            try:
                barrier.wait()
                results.append(services.convert_opportunity(opportunity.pk))
            except Exception as exc:  # noqa: BLE001 - o teste relata qualquer erro
                errors.append(exc)
            finally:
                connection.close()

        threads = [threading.Thread(target=convert) for _ in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        self.assertEqual(errors, [])
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual({r.order_number for r in results}, {Order.objects.get().number})
        self.assertEqual(sorted(r.created for r in results), [False, True])
