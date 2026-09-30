import { type RouteConfig, layout, route } from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  // Área interna: o layout exige sessão e redireciona para /login sem ela.
  layout("routes/shell.tsx", [
    // Cadastro e detalhe abrem como gaveta sobre o kanban, com URL própria.
    route("/", "routes/pipeline.tsx", [
      route("opportunities/new", "routes/opportunity-new.tsx"),
      route("opportunities/:id", "routes/opportunity-detail.tsx"),
    ]),
    route("customers", "routes/customers.tsx", [route("new", "routes/customer-new.tsx")]),
    route("orders", "routes/orders.tsx", [route(":id", "routes/order-detail.tsx")]),
  ]),
] satisfies RouteConfig;
