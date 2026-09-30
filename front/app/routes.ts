import { type RouteConfig, layout, route } from "@react-router/dev/routes";

export default [
  layout("routes/shell.tsx", [
    // Cadastro e detalhe abrem como gaveta sobre o kanban, com URL própria.
    route("/", "routes/pipeline.tsx", [
      route("opportunities/new", "routes/opportunity-new.tsx"),
      route("opportunities/:id", "routes/opportunity-detail.tsx"),
    ]),
    route("customers", "routes/customers.tsx", [route("new", "routes/customer-new.tsx")]),
    route("orders", "routes/orders.tsx"),
  ]),
] satisfies RouteConfig;
