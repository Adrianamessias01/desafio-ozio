# Back-end — API do Pipeline Comercial e serviço ERP

Django + Django REST Framework, com PostgreSQL. O mesmo código roda em dois serviços do
docker-compose: **api** (o CRM, porta 8000) e **erp** (o ERP, porta 8001).

## Organização

```
back/
├── config/          Configuração do projeto Django
├── core/            Base compartilhada: login/logout, health check, erros de domínio, .env
├── crm/             Oportunidades, clientes, estágios e conversão em pedido
├── erp/             Pedidos: contrato ErpGateway, cliente HTTP e API do serviço ERP
├── requirements.txt
└── manage.py
```

A separação entre `crm` e `erp` é intencional: o CRM não manipula as tabelas de pedido,
apenas chama o contrato `ErpGateway`. Não existe chave estrangeira entre os dois contextos:
a oportunidade guarda só o número do pedido (`erp_order_number`), e o pedido guarda uma
cópia dos dados do cliente e uma `idempotency_key` única, que impede pedidos duplicados no
nível do banco.

## Executando

Na raiz do repositório: `docker compose up --build`. Comandos úteis:

```bash
docker compose exec api python manage.py test        # testes
docker compose exec api ruff check .                 # lint
docker compose exec api python manage.py createsuperuser
```

Documentação interativa da API (Swagger): http://localhost:8000/api/docs/.

Sem Docker (Python 3.12 e PostgreSQL local), com o ERP local no mesmo processo:

```bash
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env           # ajuste as credenciais do PostgreSQL
python manage.py migrate
python manage.py seed          # dados de exemplo
python manage.py runserver
```

## O serviço ERP

| Lado | Arquivo | Papel |
| --- | --- | --- |
| Contrato | `erp/services.py` → `ErpGateway` | `create_order` idempotente pela chave e `is_available` |
| Cliente (CRM) | `erp/services.py` → `HttpErpGateway` | Chama o ERP por HTTP com timeout; repete falhas de rede e 5xx com espera crescente (seguro pela chave); 4xx vira `ErpRejected` |
| Servidor (ERP) | `erp/api_views.py` | `POST /erp-api/orders/` e `GET /erp-api/health/`, protegidos por `X-ERP-Key`; só respondem com `ERP_SERVE_API=True` |
| Lógica do ERP | `erp/services.py` → `LocalErpGateway` | Grava pedido e itens numa transação; numeração por sequence do PostgreSQL |

Os testes do CRM usam o `LocalErpGateway`, rápido e isolado. O cliente HTTP tem testes
próprios (tentativas, timeout, 4xx/5xx) e um teste de ida e volta com servidor HTTP real
(`erp/tests/test_http.py`).

## Regras de negócio

Ficam em `crm/services.py`, não nas views. Cada alteração trava a linha da oportunidade com
`select_for_update`, e toda mudança de estágio grava um registro de auditoria em
`OpportunityStageChange`.

## Testes

Rodam contra PostgreSQL, porque as regras de integridade (check constraints, `unique`,
`select_for_update`) dependem do banco real.

| Arquivo | O que cobre |
| --- | --- |
| `crm/tests/test_models.py` | Constraints do banco e tabela de transições |
| `crm/tests/test_api.py` | Rotas do CRM, regras de estágio, congelamento, filtros, clientes, exclusão |
| `crm/tests/test_conversion.py` | Conversão: pré-condição, idempotência, rollback, concorrência com duas threads |
| `erp/tests/test_services.py` | Gateway local idempotente, falha simulada, rotas de pedidos e status |
| `erp/tests/test_http.py` | API do serviço ERP, cliente HTTP e ida e volta HTTP real |
| `core/tests/` | Login, logout, limite de tentativas, Swagger, leitura do `.env` |

## Variáveis de ambiente

| Variável | Descrição |
| --- | --- |
| `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `DATABASE_URL` | Configuração do Django |
| `SEED_PASSWORD` | Senha dos vendedores de exemplo criados pelo `seed` (padrão `ozio1234`) |
| `LOGIN_RATE` | Limite de tentativas de login por IP (padrão `10/min`) |
| `ERP_GATEWAY` | Implementação usada pelo CRM (`erp.services.HttpErpGateway` no compose) |
| `ERP_BASE_URL`, `ERP_API_KEY` | Endereço e chave do serviço ERP |
| `ERP_TIMEOUT`, `ERP_RETRIES` | Timeout em segundos e número de novas tentativas |
| `ERP_SERVE_API` | `True` no container do ERP: liga a API `/erp-api/` |
| `ERP_SIMULATE_FAILURE`, `ERP_SIMULATE_LATENCY_MS` | Simulam ERP indisponível e lento |

Com `DEBUG` desligado, os cookies passam a exigir HTTPS e os cabeçalhos de segurança são
ativados; confira com `python manage.py check --deploy`.
