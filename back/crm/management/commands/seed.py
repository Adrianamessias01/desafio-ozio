"""
Dados de exemplo para desenvolvimento e demonstração.

Pode ser executado várias vezes: usuários e clientes são reaproveitados, e as
oportunidades só são criadas se o pipeline estiver vazio. As movimentações
passam pela camada de serviço, então respeitam as mesmas regras da API.

Os vendedores entram no sistema com a senha de SEED_PASSWORD (padrão "ozio1234").
"""

from datetime import date
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from crm import services
from crm.models import Customer, Opportunity
from crm.stages import Stage
from erp.services import ErpUnavailable

SELLERS = [
    ("carla", "Carla", "Souza"),
    ("rafael", "Rafael", "Lima"),
    ("marina", "Marina", "Freitas"),
]

CUSTOMERS = [
    ("Metalúrgica Vale do Aço Ltda.", "12345678000190", "compras@valedoaco.com.br"),
    ("Distribuidora Serra Azul S.A.", "23456789000101", "ti@serraazul.com.br"),
    ("Clínica Bem Viver", "34567890000112", "adm@bemviver.med.br"),
    ("Transportes Rota Sul", "45678901000123", "financeiro@rotasul.com.br"),
    ("Supermercados Boa Praça", "56789012000134", "contato@boapraca.com.br"),
    ("Construtora Horizonte", "67890123000145", "obras@horizonte.eng.br"),
]

# título, documento do cliente, valor, vendedor, previsão, caminho de estágios
OPPORTUNITIES = [
    ("Renovação de licenças 2027", "12345678000190", "48000", "carla", "2026-11-15", []),
    ("Implantação módulo fiscal", "45678901000123", "92500", "rafael", "2026-12-01", []),
    ("Integração com e-commerce", "56789012000134", "36900", "carla", "2026-10-30",
     [Stage.QUALIFICATION]),
    ("Treinamento de equipe comercial", "34567890000112", "12800", "marina", "2026-10-20",
     [Stage.QUALIFICATION]),
    ("Expansão para 3 filiais", "23456789000101", "154000", "rafael", "2026-11-05",
     [Stage.QUALIFICATION, Stage.PROPOSAL]),
    ("Suporte premium anual", "67890123000145", "27600", "carla", "2026-10-25",
     [Stage.PROPOSAL]),
    ("Migração de ERP legado", "12345678000190", "210000", "carla", "2026-10-10",
     [Stage.QUALIFICATION, Stage.PROPOSAL, Stage.NEGOTIATION]),
    ("Painel de indicadores de estoque", "56789012000134", "41200", "marina", "2026-10-08",
     [Stage.PROPOSAL, Stage.NEGOTIATION]),
    ("Automação de faturamento", "23456789000101", "68400", "carla", "2026-09-30",
     [Stage.PROPOSAL, Stage.NEGOTIATION, Stage.WON]),
    ("Módulo de compras", "45678901000123", "55000", "rafael", "2026-09-20",
     [Stage.NEGOTIATION, Stage.WON]),
    ("App de força de vendas", "34567890000112", "19900", "marina", "2026-09-10",
     [Stage.QUALIFICATION, Stage.LOST]),
]

# Oportunidade ganha que já sai convertida, para a tela de pedidos não começar vazia.
CONVERTED = "Módulo de compras"


class Command(BaseCommand):
    help = "Cria vendedores, clientes e oportunidades de exemplo."

    @transaction.atomic
    def handle(self, *args, **options):
        users = self._sellers()
        customers = self._customers()

        if Opportunity.objects.exists():
            self.stdout.write("Pipeline já tem oportunidades; nenhuma nova foi criada.")
            return

        for title, document, amount, seller, close_date, path in OPPORTUNITIES:
            owner = users[seller]
            opportunity = services.create_opportunity(
                owner=owner,
                title=title,
                customer=customers[document],
                amount=Decimal(amount),
                expected_close_date=date.fromisoformat(close_date),
            )
            for stage in path:
                services.move_stage(
                    opportunity.pk,
                    target=stage,
                    user=owner,
                    lost_reason="Cliente optou por uma solução interna.",
                )
        self.stdout.write(self.style.SUCCESS(f"{len(OPPORTUNITIES)} oportunidades criadas."))
        self._convert(CONVERTED)

    def _convert(self, title):
        opportunity = Opportunity.objects.get(title=title)
        try:
            result = services.convert_opportunity(opportunity.pk)
        except ErpUnavailable:
            message = "ERP indisponível; nenhuma oportunidade convertida."
            self.stdout.write(self.style.WARNING(message))
            return
        self.stdout.write(f"“{title}” convertida no pedido {result.order_number}.")

    def _sellers(self):
        User = get_user_model()
        users = {}
        for username, first_name, last_name in SELLERS:
            user, created = User.objects.get_or_create(
                username=username, defaults={"first_name": first_name, "last_name": last_name}
            )
            # Define a senha só para quem ainda não tem uma (usuário novo, senha vazia ou
            # desativada): não sobrescreve senhas trocadas depois.
            if created or not user.password or not user.has_usable_password():
                user.set_password(settings.SEED_PASSWORD)
                user.save(update_fields=["password"])
            users[username] = user
        names = ", ".join(users)
        self.stdout.write(f"Vendedores de exemplo: {names} (senha definida por SEED_PASSWORD).")
        return users

    def _customers(self):
        customers = {}
        for name, document, email in CUSTOMERS:
            customer, _ = Customer.objects.get_or_create(
                document=document, defaults={"name": name, "email": email}
            )
            customers[document] = customer
        return customers
