import { Form, redirect, useNavigation, useSearchParams } from "react-router";

import { Drawer } from "~/components/drawer";
import { Field } from "~/components/field";
import { actionError, api } from "~/lib/api.server";
import type { Route } from "./+types/customer-new";

export function meta() {
  return [{ title: "Novo cliente · Pipeline Comercial" }];
}

// Vindo do cadastro de oportunidade (?next=opportunity), volta para ele com o cliente escolhido.
export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const values = {
    name: String(form.get("name") ?? "").trim(),
    document: String(form.get("document") ?? "").trim(),
    email: String(form.get("email") ?? "").trim(),
    phone: String(form.get("phone") ?? "").trim(),
  };

  try {
    const customer = await api.createCustomer(values);
    const next = new URL(request.url).searchParams.get("next");
    return redirect(
      next === "opportunity" ? `/opportunities/new?customer=${customer.id}` : "/customers",
    );
  } catch (error) {
    return actionError(error, { values });
  }
}

export default function NewCustomer({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const [params] = useSearchParams();
  const fromOpportunity = params.get("next") === "opportunity";
  const saving = navigation.state === "submitting";
  const fields: Record<string, string> = actionData?.fields ?? {};
  const values: Partial<Record<string, string>> = actionData?.values ?? {};
  const generalError = actionData && Object.keys(fields).length === 0 ? actionData.error : null;

  return (
    <Drawer
      title="Novo cliente"
      closeTo={fromOpportunity ? "/opportunities/new" : "/customers"}
      footer={
        <button type="submit" form="new-customer" className="btn btn-primary" disabled={saving}>
          {saving ? "Salvando…" : fromOpportunity ? "Salvar e voltar à oportunidade" : "Cadastrar cliente"}
        </button>
      }
    >
      <Form method="post" id="new-customer" className="drawer-body form" preventScrollReset>
        {generalError && (
          <div className="alert alert-error" role="alert">
            {generalError}
          </div>
        )}
        <Field label="Nome ou razão social" name="name" error={fields.name}>
          <input
            id="name"
            name="name"
            required
            maxLength={200}
            placeholder="Ex.: Construtora Horizonte Ltda."
            defaultValue={values.name}
            aria-invalid={fields.name ? true : undefined}
          />
        </Field>
        <Field
          label="CPF ou CNPJ"
          name="document"
          error={fields.document}
          hint={<span className="sub">Pode digitar com ou sem pontuação.</span>}
        >
          <input
            id="document"
            name="document"
            required
            inputMode="numeric"
            maxLength={18}
            placeholder="00.000.000/0000-00"
            defaultValue={values.document}
            aria-invalid={fields.document ? true : undefined}
          />
        </Field>
        <Field label="E-mail" name="email" error={fields.email}>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="contato@empresa.com.br"
            defaultValue={values.email}
            aria-invalid={fields.email ? true : undefined}
          />
        </Field>
        <Field label="Telefone" name="phone" error={fields.phone}>
          <input
            id="phone"
            name="phone"
            type="tel"
            maxLength={20}
            placeholder="(11) 99999-0000"
            defaultValue={values.phone}
            aria-invalid={fields.phone ? true : undefined}
          />
        </Field>
      </Form>
    </Drawer>
  );
}
