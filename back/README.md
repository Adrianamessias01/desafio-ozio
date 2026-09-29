# Back-end — API do Pipeline Comercial

API REST em Django + Django REST Framework, com PostgreSQL.

## Organização

```
back/
├── config/          Configuração do projeto Django
├── core/            Base compartilhada (modelo com timestamps, health check)
├── crm/             Oportunidades, clientes e estágios do pipeline
├── erp/             Pedidos — tratado como sistema externo
├── requirements.txt
└── manage.py
```

A separação entre `crm` e `erp` é intencional: o CRM não manipula as tabelas de pedido
diretamente, apenas chama a camada de serviço do ERP. Isso mantém a fronteira explícita
e permite substituir o ERP simulado por um sistema real sem tocar nas regras do pipeline.

Por isso não existe chave estrangeira entre os dois contextos. A oportunidade guarda
apenas o número do pedido (`erp_order_number`), e o pedido guarda uma cópia dos dados do
cliente e uma `idempotency_key` única, que impede pedidos duplicados no nível do banco.

## Executando com Docker (recomendado)

Na raiz do repositório:

```bash
docker compose up --build
docker compose exec api python manage.py createsuperuser
```

Comandos úteis:

```bash
docker compose exec api python manage.py test        # testes
docker compose exec api ruff check .                 # lint
docker compose exec api python manage.py makemigrations
```

## Executando localmente

```bash
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt

cp .env.example .env           # ajuste as credenciais do PostgreSQL

python manage.py migrate
python manage.py seed          # dados de exemplo
python manage.py runserver
```

API disponível em `http://localhost:8000/api/`.

## Testes

```bash
python manage.py test
```

Os testes rodam contra PostgreSQL, porque as regras de integridade (check constraints,
`unique`, `select_for_update`) dependem do banco real.

Cobertura prioritária:

- transição de estágios da oportunidade
- bloqueio de conversão fora do estágio `Ganho`
- idempotência da conversão
- rollback quando o ERP falha

## Variáveis de ambiente

| Variável        | Descrição                                   |
| --------------- | ------------------------------------------- |
| `SECRET_KEY`    | Chave secreta do Django                     |
| `DEBUG`         | `True` em desenvolvimento                   |
| `ALLOWED_HOSTS` | Hosts aceitos, separados por vírgula        |
| `DATABASE_URL`  | String de conexão do PostgreSQL             |
| `API_TOKEN`     | Token do vendedor padrão, usado pelo front-end; o `seed` o registra |
| `ERP_GATEWAY`   | Implementação do ERP (padrão: `erp.services.LocalErpGateway`) |
| `ERP_SIMULATE_FAILURE` | `True` faz o ERP simulado responder como indisponível |

## Fronteira com o ERP

O CRM fala com o ERP apenas por `erp/services.py`: monta um `OrderRequest` e recebe um
`OrderReceipt`. Qualquer implementação de `ErpGateway` precisa ser idempotente pela
`idempotency_key` e sinalizar indisponibilidade com `ErpUnavailable`. A numeração dos
pedidos (`PED-000001`) vem de uma sequence do PostgreSQL, sem colisão em conversões
simultâneas.

## Regras de negócio

Ficam em `crm/services.py`, não nas views. Cada alteração trava a linha da oportunidade
com `select_for_update`, e toda mudança de estágio grava um registro de auditoria em
`OpportunityStageChange`.
