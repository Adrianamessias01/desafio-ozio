import io
import json
import urllib.error
from decimal import Decimal
from unittest import mock

from django.test import LiveServerTestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from erp.models import Order
from erp.services import (
    ErpRejected,
    ErpUnavailable,
    HttpErpGateway,
    OrderLine,
    OrderRequest,
)


def make_request(key="crm-opportunity:1"):
    return OrderRequest(
        idempotency_key=key,
        customer_name="ACME Ltda",
        customer_document="12345678000199",
        items=(OrderLine(description="Licença", quantity=2, unit_price=Decimal("750.00")),),
    )


PAYLOAD = {
    "idempotency_key": "crm-opportunity:1",
    "customer_name": "ACME Ltda",
    "customer_document": "12345678000199",
    "items": [{"description": "Licença", "quantity": 2, "unit_price": "750.00"}],
}


@override_settings(ERP_SERVE_API=True, ERP_API_KEY="chave-teste")
class ErpServiceApiTests(APITestCase):
    """A API que o serviço ERP expõe em /erp-api/."""

    def post(self, payload=PAYLOAD, key="chave-teste"):
        return self.client.post(
            reverse("erp-api-orders"), payload, format="json", HTTP_X_ERP_KEY=key
        )

    def test_creates_order_and_repeats_idempotently(self):
        first = self.post()
        second = self.post()

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data["number"], second.data["number"])
        self.assertEqual(first.data["total"], "1500.00")
        self.assertEqual(Order.objects.count(), 1)

    def test_rejects_wrong_key(self):
        self.assertEqual(self.post(key="errada").status_code, status.HTTP_401_UNAUTHORIZED)

    def test_rejects_invalid_payload(self):
        response = self.post({**PAYLOAD, "items": []})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Order.objects.exists())

    @override_settings(ERP_SIMULATE_FAILURE=True)
    def test_simulated_outage_answers_503(self):
        self.assertEqual(self.post().status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(
            self.client.get(reverse("erp-api-health"), HTTP_X_ERP_KEY="chave-teste").status_code,
            status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    @override_settings(ERP_SERVE_API=False)
    def test_api_only_answers_on_erp_service(self):
        self.assertEqual(self.post().status_code, status.HTTP_404_NOT_FOUND)


def fake_response(data, code=200):
    response = mock.MagicMock()
    response.read.return_value = json.dumps(data).encode()
    response.__enter__.return_value = response
    response.status = code
    return response


def http_error(code, detail=""):
    body = io.BytesIO(json.dumps({"detail": detail}).encode())
    return urllib.error.HTTPError("http://erp", code, "erro", {}, body)


@override_settings(ERP_BASE_URL="http://erp/erp-api", ERP_API_KEY="k", ERP_RETRIES=2)
@mock.patch("erp.services.time.sleep")
@mock.patch("erp.services.urllib.request.urlopen")
class HttpErpGatewayTests(APITestCase):
    """Cliente HTTP do lado do CRM: timeout, novas tentativas e tradução de erros."""

    receipt = {"number": "PED-000010", "total": "1500.00", "created": True}

    def test_sends_order_and_reads_receipt(self, urlopen, _sleep):
        urlopen.return_value = fake_response(self.receipt)

        receipt = HttpErpGateway().create_order(make_request())

        self.assertEqual(
            (receipt.number, receipt.total, receipt.created),
            ("PED-000010", Decimal("1500.00"), True),
        )
        sent = urlopen.call_args.args[0]
        self.assertEqual(sent.full_url, "http://erp/erp-api/orders/")
        self.assertEqual(sent.get_header("X-erp-key"), "k")
        self.assertEqual(json.loads(sent.data)["idempotency_key"], "crm-opportunity:1")

    def test_retries_network_failures_with_the_same_key(self, urlopen, sleep):
        urlopen.side_effect = [
            urllib.error.URLError("conexão recusada"),
            TimeoutError(),
            fake_response(self.receipt),
        ]

        receipt = HttpErpGateway().create_order(make_request())

        self.assertEqual(receipt.number, "PED-000010")
        self.assertEqual(urlopen.call_count, 3)
        self.assertEqual(sleep.call_count, 2)
        keys = {json.loads(call.args[0].data)["idempotency_key"] for call in urlopen.call_args_list}
        self.assertEqual(keys, {"crm-opportunity:1"})

    def test_gives_up_after_retries(self, urlopen, _sleep):
        urlopen.side_effect = urllib.error.URLError("fora do ar")

        with self.assertRaises(ErpUnavailable):
            HttpErpGateway().create_order(make_request())

        self.assertEqual(urlopen.call_count, 3)

    def test_retries_5xx(self, urlopen, _sleep):
        urlopen.side_effect = [http_error(503), fake_response(self.receipt)]

        self.assertEqual(HttpErpGateway().create_order(make_request()).number, "PED-000010")

    def test_4xx_is_rejection_without_retry(self, urlopen, _sleep):
        urlopen.side_effect = http_error(400, "itens inválidos")

        with self.assertRaisesMessage(ErpRejected, "itens inválidos"):
            HttpErpGateway().create_order(make_request())

        self.assertEqual(urlopen.call_count, 1)

    def test_is_available_checks_health(self, urlopen, _sleep):
        urlopen.return_value = fake_response({"status": "ok"})
        self.assertTrue(HttpErpGateway().is_available())

        urlopen.side_effect = urllib.error.URLError("fora do ar")
        self.assertFalse(HttpErpGateway().is_available())


@override_settings(ERP_SERVE_API=True, ERP_API_KEY="chave-teste", ERP_RETRIES=0)
class HttpErpRoundTripTests(LiveServerTestCase):
    """CRM e ERP conversando por HTTP de verdade, com um servidor rodando no teste."""

    def gateway(self):
        with override_settings(ERP_BASE_URL=f"{self.live_server_url}/erp-api"):
            return HttpErpGateway()

    def test_creates_order_over_http_idempotently(self):
        first = self.gateway().create_order(make_request())
        second = self.gateway().create_order(make_request())

        self.assertTrue(first.created)
        self.assertFalse(second.created)
        self.assertEqual(first.number, second.number)
        self.assertEqual(Order.objects.get().total, Decimal("1500.00"))
        self.assertTrue(self.gateway().is_available())
