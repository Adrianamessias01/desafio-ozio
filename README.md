# Mini Pipeline Comercial com Integração ERP

Desafio técnico — **OZIO Tecnologia** · Desenvolvedor Full Stack Pleno

Aplicação onde vendedores gerenciam oportunidades comerciais em um quadro kanban e
convertem uma oportunidade ganha em um pedido no ERP.

---

## Estrutura do repositório

```
.
├── back/     API REST em Django + Django REST Framework + PostgreSQL
└── front/    Aplicação React com React Router (SSR)
```

Cada pasta tem seu próprio README com instruções de execução.

---

## Stack

| Camada    | Tecnologia                                  |
| --------- | ------------------------------------------- |
| Back-end  | Python, Django, Django REST Framework       |
| Banco     | PostgreSQL                                  |
| Front-end | React, React Router (server-side rendering) |
| API       | RESTful                                     |

---

## Domínio

O sistema é dividido em dois contextos independentes dentro do back-end:

### CRM — pipeline comercial

| Entidade      | Descrição                                                      |
| ------------- | -------------------------------------------------------------- |
| `Customer`    | Cliente / empresa associada à oportunidade                      |
| `Opportunity` | Oportunidade comercial: título, cliente, valor, estágio, dono   |

Estágios do pipeline:

```
Lead → Qualificação → Proposta → Negociação → Ganho
                                            └→ Perdido
```

### ERP — pedidos

| Entidade    | Descrição                                          |
| ----------- | -------------------------------------------------- |
| `Order`     | Pedido gerado a partir de uma oportunidade ganha    |
| `OrderItem` | Itens do pedido                                     |

O ERP é tratado como um serviço à parte: o CRM se comunica com ele por uma interface
explícita, de forma que a origem dos pedidos possa ser trocada por um ERP real sem
alterar as regras do pipeline.

---

## Regra central: conversão em pedido

`POST /api/opportunities/{id}/convert`

A conversão é o ponto crítico da aplicação e respeita as seguintes garantias:

- **Pré-condição** — somente oportunidades no estágio `Ganho` podem ser convertidas.
- **Idempotência** — converter a mesma oportunidade duas vezes não cria dois pedidos;
  a segunda chamada devolve o pedido já existente.
- **Atomicidade** — a criação do pedido e a marcação da oportunidade acontecem na mesma
  transação; qualquer falha no ERP desfaz a operação inteira.
- **Erro visível** — indisponibilidade do ERP retorna um erro tratado, exibido ao
  usuário no front-end.

---

## API

| Método  | Rota                                | Descrição                          |
| ------- | ----------------------------------- | ---------------------------------- |
| `GET`   | `/api/opportunities/`               | Lista oportunidades do pipeline    |
| `POST`  | `/api/opportunities/`               | Cria uma oportunidade              |
| `GET`   | `/api/opportunities/{id}/`          | Detalha uma oportunidade           |
| `PATCH` | `/api/opportunities/{id}/`          | Atualiza uma oportunidade          |
| `PATCH` | `/api/opportunities/{id}/stage/`    | Move a oportunidade de estágio     |
| `POST`  | `/api/opportunities/{id}/convert/`  | Converte em pedido no ERP          |
| `GET`   | `/api/customers/`                   | Lista clientes                     |
| `GET`   | `/api/orders/`                      | Lista pedidos gerados              |

---

## Como executar

Pré-requisitos: Docker e Docker Compose, ou Python 3.12+ e Node 20+ com PostgreSQL local.

```bash
git clone <url-deste-repositorio>
cd desafio-ozio
```

Instruções detalhadas em [`back/README.md`](back/README.md) e [`front/README.md`](front/README.md).

---

## Andamento

- [ ] Estrutura do repositório e ambiente
- [ ] Modelagem e migrations
- [ ] API REST do CRM
- [ ] Módulo ERP e criação de pedidos
- [ ] Regra de conversão com idempotência
- [ ] Front-end com SSR
- [ ] Kanban com drag and drop
- [ ] Conversão pela interface
- [ ] Testes
- [ ] Ajustes visuais e documentação final

---

Desenvolvido por **Adriana Messias**
