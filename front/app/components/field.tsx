import type { ReactNode } from "react";

/** Rótulo, controle e mensagem de erro. O `name` precisa ser o `id` do controle. */
export function Field({
  label,
  name,
  error,
  hint,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {children}
      {error ? <span className="field-error">{error}</span> : hint}
    </div>
  );
}
