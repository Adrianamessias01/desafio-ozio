import { useEffect, useRef, useState } from "react";

/** Pede o motivo da perda antes de mover uma oportunidade para Perdido. */
export function LostReasonDialog({
  title,
  onConfirm,
  onCancel,
}: {
  title: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  function confirm() {
    if (!reason.trim()) {
      setError("Informe o motivo da perda.");
      inputRef.current?.focus();
      return;
    }
    onConfirm(reason.trim());
  }

  return (
    <>
      <button type="button" className="scrim modal-scrim" aria-label="Cancelar" onClick={onCancel} />
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="lost-title">
        <h3 id="lost-title">Marcar como perdida</h3>
        <p className="sub">{title}</p>
        <div className="field">
          <label htmlFor="lost-reason">Motivo da perda</label>
          <textarea
            id="lost-reason"
            ref={inputRef}
            rows={3}
            placeholder="Ex.: preço acima do orçamento do cliente"
            value={reason}
            aria-invalid={error ? true : undefined}
            onChange={(event) => {
              setReason(event.target.value);
              setError("");
            }}
          />
          {error && <span className="field-error">{error}</span>}
        </div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={confirm}>
            Marcar como perdida
          </button>
        </div>
      </div>
    </>
  );
}
