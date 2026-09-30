import { hueFor, initials } from "~/lib/format";

/** Iniciais do nome num círculo com cor fixa por nome (clientes, empresas). */
export function NameAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      className={`name-avatar name-avatar-${size}`}
      style={{ "--hue": hueFor(name) } as React.CSSProperties}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
