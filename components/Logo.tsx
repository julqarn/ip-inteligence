/**
 * IP Intelligence logo mark — a globe network with a radar sweep,
 * recreated as a clean vector from the Canva design.
 */
export default function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="IP Intelligence logo">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#34f5a2" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#04122e" />
      <path d="M32 32 L44.5 20.5 A17 17 0 0 1 49 32 Z" fill="url(#logo-g)" opacity="0.35" />
      <circle cx="32" cy="32" r="17" fill="none" stroke="url(#logo-g)" strokeWidth="2.5" />
      <ellipse cx="32" cy="32" rx="7.5" ry="17" fill="none" stroke="url(#logo-g)" strokeWidth="1.6" opacity="0.85" />
      <line x1="15" y1="32" x2="49" y2="32" stroke="url(#logo-g)" strokeWidth="1.6" opacity="0.85" />
      <line x1="32" y1="15" x2="32" y2="49" stroke="url(#logo-g)" strokeWidth="1.6" opacity="0.85" />
      <line x1="32" y1="32" x2="44.5" y2="20.5" stroke="url(#logo-g)" strokeWidth="2" />
      <line x1="32" y1="32" x2="21" y2="43" stroke="url(#logo-g)" strokeWidth="1.6" opacity="0.85" />
      <circle cx="32" cy="32" r="2.6" fill="url(#logo-g)" />
      <circle cx="32" cy="15" r="2.2" fill="#22d3ee" />
      <circle cx="32" cy="49" r="2.2" fill="#34f5a2" />
      <circle cx="15" cy="32" r="2.2" fill="#22d3ee" />
      <circle cx="49" cy="32" r="2.2" fill="#34f5a2" />
      <circle cx="44.5" cy="20.5" r="2.2" fill="#34f5a2" />
      <circle cx="21" cy="43" r="2.2" fill="#22d3ee" />
    </svg>
  );
}
