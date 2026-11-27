/**
 * IP Intelligence logo mark — a globe magnifying glass with an orbiting
 * satellite and signal arcs, recreated as a clean vector from the Canva design.
 */
export default function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="IP Intelligence satellite search logo">
      <defs>
        <linearGradient id="logo-g-sat" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#34f5a2" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#04122e" />
      <path d="M13 26 A13 13 0 0 1 26 13" fill="none" stroke="url(#logo-g-sat)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M17.5 27 A8.5 8.5 0 0 1 27 17.5" fill="none" stroke="url(#logo-g-sat)" strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
      <ellipse cx="32" cy="32" rx="24" ry="8" transform="rotate(-18 32 32)" fill="none" stroke="url(#logo-g-sat)" strokeWidth="2" opacity="0.85" />
      <g transform="translate(49 15) rotate(24)" fill="#22d3ee">
        <rect x="-8" y="-3" width="5" height="6" rx="1" />
        <rect x="-2" y="-3.5" width="6" height="7" rx="1" />
        <rect x="5" y="-3" width="5" height="6" rx="1" />
      </g>
      <line x1="41" y1="42" x2="51" y2="52" stroke="#34f5a2" strokeWidth="6" strokeLinecap="round" />
      <circle cx="30" cy="31" r="15" fill="#04122e" stroke="url(#logo-g-sat)" strokeWidth="3.2" />
      <ellipse cx="30" cy="31" rx="6.5" ry="15" fill="none" stroke="url(#logo-g-sat)" strokeWidth="1.6" opacity="0.9" />
      <line x1="15" y1="31" x2="45" y2="31" stroke="url(#logo-g-sat)" strokeWidth="1.6" opacity="0.9" />
      <line x1="30" y1="16" x2="30" y2="46" stroke="url(#logo-g-sat)" strokeWidth="1.6" opacity="0.9" />
      <path d="M18 24 Q30 29 42 24" fill="none" stroke="url(#logo-g-sat)" strokeWidth="1.5" opacity="0.8" />
      <path d="M18 38 Q30 33 42 38" fill="none" stroke="url(#logo-g-sat)" strokeWidth="1.5" opacity="0.8" />
      <line x1="30" y1="26" x2="23" y2="36" stroke="#34f5a2" strokeWidth="1.8" />
      <line x1="30" y1="26" x2="37" y2="36" stroke="#34f5a2" strokeWidth="1.8" />
      <circle cx="30" cy="26" r="2.5" fill="#34f5a2" />
      <circle cx="23" cy="36" r="2.2" fill="#34f5a2" />
      <circle cx="37" cy="36" r="2.2" fill="#34f5a2" />
    </svg>
  );
}
