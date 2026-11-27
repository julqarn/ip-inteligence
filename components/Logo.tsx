/**
 * IP Intelligence logo mark — a minimal globe magnifying glass with a
 * single satellite orbit arc.
 */
export default function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="IP Intelligence minimal logo">
      <defs>
        <linearGradient id="logo-g-min" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#34f5a2" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#04122e" />
      <path d="M12 40 A26 26 0 0 1 50 14" fill="none" stroke="url(#logo-g-min)" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
      <circle cx="50" cy="14" r="3" fill="#22d3ee" />
      <line x1="40" y1="41" x2="50" y2="51" stroke="#34f5a2" strokeWidth="6" strokeLinecap="round" />
      <circle cx="29" cy="30" r="15" fill="none" stroke="url(#logo-g-min)" strokeWidth="4" />
      <ellipse cx="29" cy="30" rx="6" ry="15" fill="none" stroke="url(#logo-g-min)" strokeWidth="2" opacity="0.85" />
      <line x1="14" y1="30" x2="44" y2="30" stroke="url(#logo-g-min)" strokeWidth="2" opacity="0.85" />
      <circle cx="29" cy="30" r="2" fill="#34f5a2" />
    </svg>
  );
}
