from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from crm.models import Customer, Opportunity, OpportunityStageChange
from crm.stages import Stage


class ApiTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user(
            username="carla", first_name="Carla", last_name="Souza"
        )
        cls.customer = Customer.objects.create(name="ACME Ltda", document="12345678000199")

    def setUp(self):
        self.client.force_authenticate(self.user)

    def make_opportunity(self, **overrides):
        data = {
            "title": "Licenças anuais",
            "customer": self.customer,
            "owner": self.user,
            "amount": Decimal("1500.00"),
        }
        data.update(overrides)
        return Opportunity.objects.create(**data)

    def move(self, opportunity, stage, **extra):
        url = reverse("opportunity-stage", args=[opportunity.pk])
        return self.client.patch(url, {"stage": stage, **extra}, format="json")


class AuthenticationTests(ApiTestCase):
    def test_api_requires_authentication(self):
        self.client.force_authenticate(None)

        response = self.client.get(reverse("opportunity-list"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_returns_token_owner(self):
        response = self.client.get(reverse("me"))

        self.assertEqual(
            response.data, {"id": self.user.pk, "username": "carla", "name": "Carla Souza"}
        )

    def test_health_check_is_public(self):
        self.client.force_authenticate(None)

        self.assertEqual(self.client.get(reverse("health")).status_code, status.HTTP_200_OK)


class OpportunityCrudTests(ApiTestCase):
    def test_create_starts_as_lead_owned_by_current_user(self):
        response = self.client.post(
            reverse("opportunity-list"),
            {"title": "Novo contrato", "customer_id": self.customer.pk, "amount": "2500.00"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["stage"], Stage.LEAD)
        self.assertEqual(response.data["owner"]["name"], "Carla Souza")
        self.assertEqual(response.data["customer"]["name"], "ACME Ltda")
        opportunity = Opportunity.objects.get(pk=response.data["id"])
        self.assertEqual(opportunity.stage_changes.get().to_stage, Stage.LEAD)

    def test_create_ignores_stage_in_payload(self):
        response = self.client.post(
            reverse("opportunity-list"),
            {
                "title": "Atalho",
                "customer_id": self.customer.pk,
                "amount": "100.00",
                "stage": Stage.WON,
            },
            format="json",
        )

        self.assertEqual(response.data["stage"], Stage.LEAD)

    def test_create_rejects_non_positive_amount(self):
        response = self.client.post(
            reverse("opportunity-list"),
            {"title": "Grátis", "customer_id": self.customer.pk, "amount": "0"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["amount"], ["Informe um valor maior que zero."])

    def test_list_filters_by_stage(self):
        self.make_opportunity(title="Lead")
        self.make_opportunity(title="Proposta", stage=Stage.PROPOSAL)

        response = self.client.get(reverse("opportunity-list"), {"stage": Stage.PROPOSAL})

        self.assertEqual([o["title"] for o in response.data], ["Proposta"])

    def test_list_rejects_unknown_stage_filter(self):
        response = self.client.get(reverse("opportunity-list"), {"stage": "xyz"})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_detail_includes_stage_history(self):
        opportunity = self.make_opportunity(stage=Stage.NEGOTIATION)
        self.move(opportunity, Stage.WON)

        response = self.client.get(reverse("opportunity-detail", args=[opportunity.pk]))

        self.assertEqual(
            [(c["from_stage"], c["to_stage"]) for c in response.data["stage_changes"]],
            [(Stage.NEGOTIATION, Stage.WON)],
        )

    def test_update_changes_editable_fields(self):
        opportunity = self.make_opportunity()

        response = self.client.patch(
            reverse("opportunity-detail", args=[opportunity.pk]),
            {"title": "Licenças 2027", "amount": "1800.00"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        opportunity.refresh_from_db()
        self.assertEqual(opportunity.title, "Licenças 2027")
        self.assertEqual(opportunity.amount, Decimal("1800.00"))

    def test_converted_opportunity_cannot_be_edited(self):
        opportunity = self.make_opportunity(
            stage=Stage.WON, erp_order_number="PED-000001", converted_at=timezone.now()
        )

        response = self.client.patch(
            reverse("opportunity-detail", args=[opportunity.pk]),
            {"amount": "1.00"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["code"], "opportunity_frozen")

    def test_delete_removes_opportunity_and_history(self):
        opportunity = self.make_opportunity(stage=Stage.NEGOTIATION)
        self.move(opportunity, Stage.WON)

        response = self.client.delete(reverse("opportunity-detail", args=[opportunity.pk]))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Opportunity.objects.filter(pk=opportunity.pk).exists())
        self.assertFalse(OpportunityStageChange.objects.exists())

    def test_converted_opportunity_cannot_be_deleted(self):
        opportunity = self.make_opportunity(
            stage=Stage.WON, erp_order_number="PED-000001", converted_at=timezone.now()
        )

        response = self.client.delete(reverse("opportunity-detail", args=[opportunity.pk]))

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["code"], "opportunity_frozen")
        self.assertTrue(Opportunity.objects.filter(pk=opportunity.pk).exists())


class StageMoveTests(ApiTestCase):
    def test_moves_between_open_stages_and_records_history(self):
        opportunity = self.make_opportunity()

        response = self.move(opportunity, Stage.PROPOSAL)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["stage"], Stage.PROPOSAL)
        change = OpportunityStageChange.objects.get(opportunity=opportunity)
        self.assertEqual((change.from_stage, change.to_stage), (Stage.LEAD, Stage.PROPOSAL))
        self.assertEqual(change.changed_by, self.user)

    def test_won_only_from_negotiation(self):
        opportunity = self.make_opportunity(stage=Stage.PROPOSAL)

        response = self.move(opportunity, Stage.WON)

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["code"], "invalid_stage_transition")
        opportunity.refresh_from_db()
        self.assertEqual(opportunity.stage, Stage.PROPOSAL)

    def test_lost_requires_reason(self):
        opportunity = self.make_opportunity()

        response = self.move(opportunity, Stage.LOST, lost_reason="  ")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "lost_reason_required")

    def test_lost_stores_reason_and_reopening_clears_it(self):
        opportunity = self.make_opportunity()

        self.move(opportunity, Stage.LOST, lost_reason="Preço")
        opportunity.refresh_from_db()
        self.assertEqual(opportunity.lost_reason, "Preço")

        self.move(opportunity, Stage.LEAD)
        opportunity.refresh_from_db()
        self.assertEqual((opportunity.stage, opportunity.lost_reason), (Stage.LEAD, ""))

    def test_lost_can_only_reopen_as_lead(self):
        opportunity = self.make_opportunity(stage=Stage.LOST, lost_reason="Preço")

        response = self.move(opportunity, Stage.NEGOTIATION)

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_won_can_go_back_to_negotiation_before_conversion(self):
        opportunity = self.make_opportunity(stage=Stage.WON)

        response = self.move(opportunity, Stage.NEGOTIATION)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_converted_opportunity_is_frozen(self):
        opportunity = self.make_opportunity(
            stage=Stage.WON, erp_order_number="PED-000001", converted_at=timezone.now()
        )

        response = self.move(opportunity, Stage.NEGOTIATION)

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["code"], "opportunity_frozen")

    def test_moving_to_current_stage_is_a_no_op(self):
        opportunity = self.make_opportunity()

        response = self.move(opportunity, Stage.LEAD)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(OpportunityStageChange.objects.exists())

    def test_rejects_unknown_stage(self):
        opportunity = self.make_opportunity()

        response = self.move(opportunity, "archived")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("stage", response.data)


class CustomerApiTests(ApiTestCase):
    def test_list_includes_pipeline_totals(self):
        self.make_opportunity(amount=Decimal("100.00"))
        self.make_opportunity(amount=Decimal("250.00"), stage=Stage.PROPOSAL)
        self.make_opportunity(amount=Decimal("999.00"), stage=Stage.WON)
        self.make_opportunity(amount=Decimal("50.00"), stage=Stage.LOST)
        Customer.objects.create(name="Sem oportunidades", document="98765432000110")

        response = self.client.get(reverse("customer-list"))

        totals = {
            c["name"]: (c["open_count"], c["won_count"], c["open_amount"]) for c in response.data
        }
        self.assertEqual(totals["ACME Ltda"], (2, 1, "350.00"))
        self.assertEqual(totals["Sem oportunidades"], (0, 0, "0.00"))

    def create(self, **data):
        payload = {"name": "Nova Empresa", "document": "11.222.333/0001-81", **data}
        return self.client.post(reverse("customer-list"), payload, format="json")

    def test_create_stores_document_digits_only(self):
        response = self.create(email="contato@nova.com.br")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["document"], "11222333000181")
        self.assertTrue(Customer.objects.filter(document="11222333000181").exists())

    def test_create_accepts_cpf(self):
        response = self.create(document="123.456.789-09")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["document"], "12345678909")

    def test_create_rejects_duplicate_document(self):
        response = self.create(document="12.345.678/0001-99")  # mesmo do cliente ACME

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["document"], ["Já existe um cliente com este CPF/CNPJ."])

    def test_create_rejects_wrong_length(self):
        response = self.create(document="123")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("document", response.data)

    def test_create_requires_name(self):
        response = self.create(name="")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("name", response.data)

    def test_list_is_sorted_by_name(self):
        Customer.objects.create(name="Zeta", document="98765432000110")
        Customer.objects.create(name="Beta", document="98765432000121")

        response = self.client.get(reverse("customer-list"))

        self.assertEqual([c["name"] for c in response.data], ["ACME Ltda", "Beta", "Zeta"])

    def test_list_orders_by_requested_field(self):
        beta = Customer.objects.create(name="Beta", document="98765432000121")
        Customer.objects.create(name="Zeta", document="98765432000110")
        self.make_opportunity(amount=Decimal("100.00"))
        self.make_opportunity(customer=beta, amount=Decimal("900.00"))

        response = self.client.get(reverse("customer-list"), {"ordering": "-open_amount"})

        # Beta 900, ACME 100, Zeta 0.
        self.assertEqual([c["name"] for c in response.data], ["Beta", "ACME Ltda", "Zeta"])

    def test_list_rejects_unknown_ordering(self):
        response = self.client.get(reverse("customer-list"), {"ordering": "email"})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("ordering", response.data)
