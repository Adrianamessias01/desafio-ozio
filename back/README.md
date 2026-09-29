# Back-end — API do Pipeline Comercial

API REST em Django + Django REST Framework, com PostgreSQL.

## Organização

```
back/
├── config/          Configuração do projeto Django
├── crm/             Oportunidades, clientes e estágios do pipeline
├── erp/             Pedidos — tratado como sistema externo
├── requirements.txt
└── manage.py
```

A separação entre `crm` e `erp` é intencional: o CRM não manipula as tabelas de pedido
diretamente, apenas chama a camada de serviço do ERP. Isso mantém a fronteira explícita
e permite substituir o ERP simulado por um sistema real sem tocar nas regras do pipeline.

## Executando

```bash
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt

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

Cobertura prioritária:

- transição de estágios da oportunidade
- bloqueio de conversão fora do estágio `Ganho`
- idempotência da conversão
- rollback quando o ERP falha

## Variáveis de ambiente

| Variável       | Descrição                        |
| -------------- | -------------------------------- |
| `SECRET_KEY`   | Chave secreta do Django          |
| `DEBUG`        | `True` em desenvolvimento        |
| `DATABASE_URL` | String de conexão do PostgreSQL  |
