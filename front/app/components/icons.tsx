// Ícones de traço, herdando a cor do texto (classe .icon no CSS).

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden="true">
      {children}
    </svg>
  );
}

export function BoardIcon() {
  return (
    <Svg>
      <rect x="3" y="4" width="5" height="16" rx="1.5" />
      <rect x="10" y="4" width="5" height="10" rx="1.5" />
      <rect x="17" y="4" width="4" height="13" rx="1.5" />
    </Svg>
  );
}

export function BuildingIcon() {
  return (
    <Svg>
      <path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" />
      <path d="M14 10h5a1 1 0 0 1 1 1v10" />
      <path d="M3 21h18M8 8h2M8 12h2M8 16h2" />
    </Svg>
  );
}

export function ReceiptIcon() {
  return (
    <Svg>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </Svg>
  );
}

export function TrendIcon() {
  return (
    <Svg>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </Svg>
  );
}

export function SearchIcon() {
  return (
    <Svg>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </Svg>
  );
}

export function CalendarIcon() {
  return (
    <Svg>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Svg>
  );
}

export function WalletIcon() {
  return (
    <Svg>
      <path d="M4 7a2 2 0 0 1 2-2h12v4" />
      <rect x="3" y="9" width="18" height="11" rx="2" />
      <path d="M16 14.5h2" />
    </Svg>
  );
}

export function TrophyIcon() {
  return (
    <Svg>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M16 6h3a2 2 0 0 1-2 4h-1M8 6H5a2 2 0 0 0 2 4h1M12 13v4M8 21h8M10 17h4" />
    </Svg>
  );
}

export function ClockIcon() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  );
}

export function CheckCircleIcon() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </Svg>
  );
}
