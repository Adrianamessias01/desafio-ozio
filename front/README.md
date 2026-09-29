# Front-end — Kanban de Oportunidades

Aplicação React com React Router em modo framework, renderizada no servidor (SSR).

## Organização

```
front/
├── app/
│   ├── routes/          Rotas com loaders e actions
│   ├── components/      Componentes de interface
│   ├── services/        Cliente HTTP da API
│   └── root.tsx
├── package.json
└── vite.config.ts
```

## Renderização

Os dados do pipeline são carregados no servidor pelos `loader` das rotas, de modo que a
primeira resposta já chega com o kanban montado. As alterações — mover um card entre
estágios, criar uma oportunidade, converter em pedido — passam por `action`, com
atualização otimista da interface enquanto a requisição está em andamento.

## Executando

```bash
npm install

cp .env.example .env           # aponte para a API do back-end

npm run dev
```

Aplicação em `http://localhost:3000`.

## Build de produção

```bash
npm run build
npm start
```

## Variáveis de ambiente

| Variável       | Descrição                                |
| -------------- | ---------------------------------------- |
| `API_BASE_URL` | URL base da API (ex.: `http://localhost:8000/api`) |

## Telas

| Rota                 | Descrição                                         |
| -------------------- | ------------------------------------------------- |
| `/`                  | Kanban do pipeline, com arrastar e soltar          |
| `/opportunities/new` | Cadastro de oportunidade                           |
| `/opportunities/:id` | Detalhe da oportunidade e conversão em pedido      |
| `/orders`            | Pedidos gerados no ERP                             |
