# Front-end — Kanban de Oportunidades

Aplicação React com React Router em modo framework, renderizada no servidor (SSR).

## Organização

```
front/
├── app/
│   ├── routes/          Rotas com loaders e actions
│   ├── components/      Componentes de interface (gaveta, avisos, modal)
│   ├── lib/
│   │   ├── api.server.ts  Cliente HTTP da API (só roda no servidor)
│   │   ├── stages.ts      Regras de transição, espelhando o back-end
│   │   └── format.ts      Moeda, datas e CNPJ em pt-BR
│   ├── app.css
│   └── root.tsx
├── package.json
└── vite.config.ts
```

## Renderização e dados

Os dados do pipeline são carregados no servidor pelos `loader` das rotas, de modo que a
primeira resposta já chega com o kanban montado. As alterações (mover um card, criar uma
oportunidade, converter em pedido) passam por `action`.

Erros de carregamento aparecem dentro da página, mantendo o menu lateral. Erros de ação
(regra de transição, ERP fora do ar) aparecem como aviso ou na própria gaveta.

Só o servidor do React Router conversa com a API. O token fica em `API_TOKEN`, no servidor,
e nunca é enviado ao navegador.

### Arrastar e soltar

- Feito com `@dnd-kit/core`, com suporte a mouse, toque (segurar o card) e teclado
  (Espaço pega e solta o card, setas movem, Esc cancela).
- Ao pegar um card, as colunas permitidas ficam destacadas e as proibidas esmaecidas,
  seguindo as mesmas regras de `back/crm/stages.py`.
- **Atualização otimista:** o card aparece no destino assim que é solto, derivado do
  `formData` do fetcher em andamento. Se a API recusar, o card volta sozinho para a coluna
  original e um aviso mostra o motivo.
- Mover para Perdido abre um modal pedindo o motivo da perda.
- Na gaveta de detalhe há também o seletor "Mover para", alternativa ao arrastar.

## Executando

Com Docker, na raiz do repositório: `docker compose up --build`. O front sobe em
`http://localhost:3000`, com recarregamento automático ao editar os arquivos. Ao mudar o
`package.json`, recrie o container com `docker compose up -d --build -V web`.

Sem Docker (Node 20+ e a API rodando em `localhost:8000`):

```bash
npm install

cp .env.example .env           # aponte para a API e informe o token

npm run dev
```

## Build de produção

```bash
npm run build
npm start
```

O `Dockerfile` também tem um estágio `production` com o build pronto.

## Verificações

```bash
npm run typecheck
```

## Variáveis de ambiente

| Variável        | Descrição                                                        |
| --------------- | ---------------------------------------------------------------- |
| `API_BASE_URL`  | URL base da API (ex.: `http://localhost:8000/api`)               |
| `API_TOKEN`     | Token do vendedor padrão, o mesmo `API_TOKEN` do back-end        |
| `WATCH_POLLING` | `true` para o recarregamento automático funcionar em volume Docker no Windows |

## Telas

| Rota                 | Descrição                                          |
| -------------------- | -------------------------------------------------- |
| `/`                  | Kanban do pipeline, com arrastar e soltar. Busca da barra superior (`?q=`), filtro por vendedor (`?owner=`) e por período da previsão de fechamento (`?from=`/`?to=`), todos na URL. Abaixo do quadro, o status do ERP |
| `/opportunities/new` | Cadastro de oportunidade (gaveta sobre o kanban)   |
| `/opportunities/:id` | Detalhe, mudança de estágio, conversão e exclusão  |
| `/customers`         | Clientes com os totais do pipeline, ordenáveis pelo título da coluna (`?sort=` e `?dir=` na URL) |
| `/customers/new`     | Cadastro de cliente (gaveta). Com `?next=opportunity`, volta ao cadastro de oportunidade com o cliente selecionado |
| `/orders`            | Pedidos gerados no ERP, ordenáveis pelo título da coluna (padrão: mais recentes) |

## Conversão em pedido

Na gaveta de detalhe de uma oportunidade em Ganho, o botão "Converter em pedido" chama a
action da rota, que chama `POST /opportunities/{id}/convert/`.

- Durante a chamada o botão mostra "Criando pedido…" e fica desabilitado.
- Se o ERP estiver fora do ar (`503`, código `erp_unavailable`), a mensagem da API aparece
  na própria gaveta e o botão vira "Tentar novamente". Nada muda no kanban.
- Depois da conversão, a gaveta mostra o número do pedido e o card ganha o selo do pedido.
  "Converter novamente" devolve o mesmo pedido, deixando a idempotência visível.
