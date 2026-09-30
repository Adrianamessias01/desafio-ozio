import { Form, Link, redirect, useNavigation } from "react-router";

import { Drawer } from "~/components/drawer";
import { Field } from "~/components/field";
import { actionError, api, loadOrThrow } from "~/lib/api.server";
import { parseAmount } from "~/lib/format";
import type { Route } from "./+types/opportunity-new";

export function meta() {
  return [{ title: "Nova oportunidade · Pipeline Comercial" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const customers = await loadOrThrow(() => api.listCustomers());
  // ?customer=<id> vem do cadastro de cliente feito a partir deste formulário.
  const selectedCustomer = new URL(request.url).searchParams.get("customer") ?? "";
  return { customers, selectedCustomer };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const values = {
    title: String(form.get("title") ?? "").trim(),
    customer_id: String(form.get("customer_id") ?? ""),
    amount: String(form.get("amount") ?? ""),
    expected_close_date: String(form.get("expected_close_date") ?? ""),
  };

  try {
    const created = await api.createOpportunity({
      title: values.title,
      customer_id: Number(values.customer_id),
      amount: parseAmount(values.amount),
      expected_close_date: values.expected_close_date || null,
    });
    return redirect(`/opportunities/${created.id}`);
  } catch (error) {
    return actionError(error, { values });
  }
}

export default function NewOpportunity({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const saving = navigation.state === "submitting";
  const fields: Record<string, string> = actionData?.fields ?? {};
  const values: Partial<Record<string, string>> = actionData?.values ?? {};
  const generalError = actionData && Object.keys(fields).length === 0 ? actionData.error : null;

  return (
    <Drawer
      title="Nova oportunidade"
      footer={
        <button type="submit" form="new-opportunity" className="btn btn-primary" disabled={saving}>
          {saving ? "Criando…" : "Criar oportunidade"}
        </button>
      }
    >
      <Form method="post" id="new-opportunity" className="drawer-body form" preventScrollReset>
        {generalError && (
          <div className="alert alert-error" role="alert">
            {generalError}
          </div>
        )}
        <Field label="Título" name="title" error={fields.title}>
          <input
            id="title"
            name="title"
            required
            maxLength={200}
            placeholder="Ex.: Renovação de contrato 2027"
            defaultValue={values.title}
            aria-invalid={fields.title ? true : undefined}
          />
        </Field>
        <Field
          label="Cliente"
          name="customer_id"
          error={fields.customer_id}
          hint={
            <span className="sub">
              Não está na lista?{" "}
              <Link to="/customers/new?next=opportunity">Cadastrar novo cliente</Link>
            </span>
          }
        >
          <select
            key={loaderData.selectedCustomer}
            id="customer_id"
            name="customer_id"
            required
            defaultValue={values.customer_id ?? loaderData.selectedCustomer}
            aria-invalid={fields.customer_id ? true : undefined}
          >
            <option value="" disabled>
              Selecione o cliente
            </option>
            {loaderData.customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Valor (R$)" name="amount" error={fields.amount}>
          <input
            id="amount"
            name="amount"
            required
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={values.amount}
            aria-invalid={fields.amount ? true : undefined}
          />
        </Field>
        <Field label="Previsão de fechamento" name="expected_close_date" error={fields.expected_close_date}>
          <input
            id="expected_close_date"
            name="expected_close_date"
            type="date"
            defaultValue={values.expected_close_date}
          />
        </Field>
        <p className="sub">A oportunidade entra no pipeline como Lead, com você como responsável.</p>
      </Form>
    </Drawer>
  );
}
