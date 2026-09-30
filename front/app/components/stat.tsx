import type { ReactNode } from "react";

/** Indicador com ícone colorido. `tone` é uma cor CSS (ex.: "var(--st-won)"). */
export function Stat({
  label,
  value,
  icon,
  tone = "var(--accent)",
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: string;
}) {
  return (
    <div className="stat" style={{ "--tone": tone } as React.CSSProperties}>
      <div className="stat-icon">{icon}</div>
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
      </div>
    </div>
  );
}
