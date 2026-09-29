from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.test import SimpleTestCase, TestCase
from django.utils import timezone

from crm.models import Customer, Opportunity
from crm.stages import ALLOWED_TRANSITIONS, OPEN_STAGES, Stage, can_transition


class OpportunityFactoryMixin:
    @classmethod
    def setUpTestData(cls):
        cls.owner = get_user_model().objects.create_user(username="vendedor", password="x")
        cls.customer = Customer.objects.create(name="ACME Ltda", document="12345678000199")

    def make_opportunity(self, **overrides):
        data = {
            "title": "Licenças anuais",
            "customer": self.customer,
            "owner": self.owner,
            "amount": Decimal("1500.00"),
        }
        data.update(overrides)
        return Opportunity.objects.create(**data)


class CustomerModelTests(TestCase):
    def test_document_accepts_cpf_and_cnpj_digits(self):
        for document in ("12345678901", "12345678000199"):
            Customer(name="Cliente", document=document).full_clean()

    def test_document_rejects_formatted_or_wrong_length_values(self):
        for document in ("123.456.789-01", "1234", "12345678000199X"):
            with self.subTest(document=document), self.assertRaises(ValidationError):
                Customer(name="Cliente", document=document).full_clean()

    def test_document_is_unique(self):
        Customer.objects.create(name="A", document="12345678901")
        with self.assertRaises(IntegrityError):
            Customer.objects.create(name="B", document="12345678901")


class OpportunityModelTests(OpportunityFactoryMixin, TestCase):
    def test_new_opportunity_starts_as_lead_and_not_converted(self):
        opportunity = self.make_opportunity()

        self.assertEqual(opportunity.stage, Stage.LEAD)
        self.assertFalse(opportunity.is_converted)

    def test_database_rejects_non_positive_amount(self):
        with self.assertRaises(IntegrityError):
            self.make_opportunity(amount=Decimal("0"))

    def test_database_rejects_erp_reference_outside_won_stage(self):
        with self.assertRaises(IntegrityError):
            self.make_opportunity(
                stage=Stage.NEGOTIATION,
                erp_order_number="PED-000001",
                converted_at=timezone.now(),
            )

    def test_database_requires_conversion_fields_together(self):
        with self.assertRaises(IntegrityError):
            self.make_opportunity(stage=Stage.WON, erp_order_number="PED-000001")

    def test_won_opportunity_with_erp_reference_is_converted(self):
        opportunity = self.make_opportunity(
            stage=Stage.WON, erp_order_number="PED-000001", converted_at=timezone.now()
        )

        self.assertTrue(opportunity.is_converted)


class StageTransitionTests(SimpleTestCase):
    def test_every_stage_has_transition_rules(self):
        self.assertEqual(set(ALLOWED_TRANSITIONS), set(Stage.values))

    def test_open_stages_move_freely_between_each_other(self):
        for current in OPEN_STAGES:
            for target in OPEN_STAGES - {current}:
                with self.subTest(current=current, target=target):
                    self.assertTrue(can_transition(current, target))

    def test_only_negotiation_reaches_won(self):
        sources = {stage for stage in Stage.values if can_transition(stage, Stage.WON)}

        self.assertEqual(sources, {Stage.NEGOTIATION})

    def test_any_open_stage_can_be_lost(self):
        for stage in OPEN_STAGES:
            with self.subTest(stage=stage):
                self.assertTrue(can_transition(stage, Stage.LOST))

    def test_lost_can_only_be_reopened_as_lead(self):
        self.assertEqual(ALLOWED_TRANSITIONS[Stage.LOST], {Stage.LEAD})

    def test_same_stage_is_not_a_transition(self):
        for stage in Stage.values:
            with self.subTest(stage=stage):
                self.assertFalse(can_transition(stage, stage))
