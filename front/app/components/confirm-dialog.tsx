import { useEffect, useRef, type ReactNode } from "react";

/** Confirmação para ações que não têm volta, como excluir. */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Foco em "Cancelar": Enter por engano não apaga nada.
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <>
      <button type="button" className="scrim modal-scrim" aria-label="Fechar" tabIndex={-1} onClick={onCancel} />
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <h3 id="confirm-title">{title}</h3>
        <div className="sub">{children}</div>
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button ref={cancelRef} type="button" className="btn" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="btn btn-danger" disabled={busy} onClick={onConfirm}>
            {busy ? "Excluindo…" : confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
