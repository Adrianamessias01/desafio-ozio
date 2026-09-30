import { useEffect, useRef, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";

/** Painel lateral sobre o kanban. Fechar volta para o pipeline ("/"). */
export function Drawer({
  title,
  eyebrow,
  children,
  footer,
}: {
  title: string;
  eyebrow?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const navigate = useNavigate();
  const closeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector(".modal")) {
        navigate("/", { preventScrollReset: true });
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <>
      <Link to="/" preventScrollReset className="scrim" aria-label="Fechar" tabIndex={-1} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className="drawer-head">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2 id="drawer-title">{title}</h2>
          </div>
          <Link ref={closeRef} to="/" preventScrollReset className="icon-btn" aria-label="Fechar">
            ×
          </Link>
        </div>
        {children}
        {footer && <div className="drawer-foot">{footer}</div>}
      </aside>
    </>
  );
}
