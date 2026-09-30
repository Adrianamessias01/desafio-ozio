from io import StringIO

from django.contrib.auth import authenticate, get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings

from crm.models import Customer, Opportunity
from crm.stages import Stage
from erp.models import Order


@override_settings(SEED_PASSWORD="senha-seed")
class SeedCommandTests(TestCase):
    def seed(self):
        call_command("seed", stdout=StringIO())

    def test_fresh_database_gets_sellers_who_can_log_in(self):
        self.seed()

        for username in ("carla", "rafael", "marina"):
            with self.subTest(username=username):
                self.assertIsNotNone(authenticate(username=username, password="senha-seed"))

    def test_creates_pipeline_with_one_converted_opportunity(self):
        self.seed()

        self.assertEqual(Customer.objects.count(), 6)
        self.assertEqual(Opportunity.objects.count(), 11)
        converted = Opportunity.objects.get(erp_order_number__isnull=False)
        self.assertEqual(converted.stage, Stage.WON)
        self.assertEqual(Order.objects.get().number, converted.erp_order_number)

    def test_running_twice_does_not_duplicate_nor_reset_passwords(self):
        self.seed()
        carla = get_user_model().objects.get(username="carla")
        carla.set_password("trocada")
        carla.save()

        self.seed()

        self.assertEqual(Opportunity.objects.count(), 11)
        self.assertEqual(Order.objects.count(), 1)
        self.assertIsNotNone(authenticate(username="carla", password="trocada"))
