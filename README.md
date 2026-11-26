# IP Intelligence

**Understand Every IP. Explore Every Network.**

A production-quality IP intelligence and network lookup platform. Enter any public
IPv4 or IPv6 address to explore its approximate geolocation, ISP, ASN, network
range, RDAP registration, DNS diagnostics and available security indicators —
or open the page and instantly see your own public IP, Whoer-style, in a modern
cybersecurity dashboard.

Every result comes from a real provider or a real diagnostic. Fields a provider
does not supply are shown as **Not Available** — never invented.

## Features

- **Automatic My-IP detection** on page load, with one-click analysis
- **IP lookup** for IPv4 and IPv6 with strict validation and clear error messages
- **Private/reserved IP handling** — classified and explained locally, never geolocated
- **Geolocation dashboard** — country, region, city, coordinates, timezone, continent
- **Interactive Leaflet/OpenStreetMap map** with an honest approximation radius
- **ISP & network data** — ISP, organization, ASN, CIDR range
- **Security indicators** — VPN / proxy / Tor / hosting signals when providers report
  them, plus optional AbuseIPDB abuse scoring
- **Network diagnostics** — reverse DNS (PTR), RDAP/WHOIS, ASN registry lookup,
  DNS-over-HTTPS record queries (A, AAAA, MX, NS, TXT, CNAME, SOA), DNS reachability
- **Browser & leak signals** — timezone match check and a real WebRTC candidate check
- **Tools page** — IPv4/IPv6 validators, DNS, reverse DNS, ASN, RDAP & IP-range tools
- **Lookup history** in `localStorage` (no account, no server storage)
- **Shareable URLs** (`?ip=8.8.8.8`), copy-to-clipboard, toasts, skeleton loaders
- **Dark/light mode**, fully responsive, glassmorphism + neon cybersecurity theme

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 3, Lucide icons |
| Map | Leaflet + OpenStreetMap |
| Validation | Zod (server), shared pure-TS IP utilities |
| Backend | Next.js API Routes (Node.js runtime) |

## Data providers

| Purpose | Provider | Key required |
|---|---|---|
| Primary IP geolocation | [ipapi.co](https://ipapi.co/) | No (free tier) |
| Fallback + security/connection enrichment | [ipwho.is](https://ipwho.is/) | No (free tier) |
| WHOIS / RDAP | [rdap.org](https://rdap.org/) → authoritative RIR | No |
| DNS / reverse DNS | [Cloudflare DNS-over-HTTPS](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/) | No |
| Abuse scoring (optional) | [AbuseIPDB](https://www.abuseipdb.com/api.html) | Yes — free tier |
| Hostname/org enrichment (optional) | [ipinfo.io](https://ipinfo.io/) | Yes — free tier |

The server normalizes provider responses into one schema, caches results for
5 minutes, rate-limits clients (60 requests/minute), and only ever contacts the
fixed provider hosts above — user input is validated and never used as a URL
(SSRF-safe). Private, loopback, link-local and reserved targets are classified
locally and never probed.

## Getting started

Requirements: Node.js 18.18+ (Node 20/22 recommended).

```bash
npm install
npm run dev
```

Open http://localhost:3000.

### Optional API keys

```bash
cp .env.example .env.local
# then edit .env.local
```

- `ABUSEIPDB_API_KEY` — enables abuse score and report counts. Free key:
  https://www.abuseipdb.com/register
- `IPINFO_TOKEN` — enables hostname/organization enrichment. Token:
  https://ipinfo.io/signup

The application runs with all free-tier features when neither key is set.

### Production build

```bash
npm run build
npm start
```

## Deploying to Vercel

1. Push this project to a Git repository (GitHub/GitLab/Bitbucket).
2. In [Vercel](https://vercel.com/new), import the repository. The framework
   preset **Next.js** is detected automatically; no build settings need changing.
3. (Optional) In **Settings → Environment Variables**, add `ABUSEIPDB_API_KEY`
   and/or `IPINFO_TOKEN`.
4. Deploy. Visitor-IP detection works automatically in production because
   Vercel forwards the real client IP.

Alternatively, with the Vercel CLI:

```bash
npm i -g vercel
vercel --prod
```

## Project structure

```
ip-intelligence/
├── app/
│   ├── api/
│   │   ├── lookup/route.ts   # IP lookup (primary + fallback providers)
│   │   ├── myip/route.ts     # visitor public-IP detection
│   │   ├── dns/route.ts      # DNS + reverse DNS via Cloudflare DoH
│   │   ├── rdap/route.ts     # WHOIS/RDAP via rdap.org
│   │   └── asn/route.ts      # ASN registry lookup via RDAP
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx              # dashboard, results, tools, history, about
├── components/
│   └── MapView.tsx           # Leaflet + OpenStreetMap (client-only)
├── lib/
│   ├── ip.ts                 # validation & classification (client + server)
│   └── providers.ts          # provider normalization, cache, rate limiting
├── .env.example
├── next.config.mjs
├── package.json
├── postcss.config.mjs
├── tailwind.config.js
└── tsconfig.json
```

## API reference

All endpoints return `{ ok: true, data: ... }` or `{ error: string }`.

| Endpoint | Description |
|---|---|
| `GET /api/myip` | Detect and analyze the visitor's public IP |
| `GET /api/lookup?ip=8.8.8.8` | Full intelligence report for an IP |
| `GET /api/dns?name=example.com&type=A` | DNS records (`A AAAA MX NS TXT CNAME SOA`) |
| `GET /api/dns?name=8.8.8.8&type=PTR` | Reverse DNS for an IP |
| `GET /api/rdap?ip=8.8.8.8` | RDAP registration & network range |
| `GET /api/asn?asn=AS15169` | Autonomous-system registry record |

## Privacy & limitations

- IP geolocation is **approximate** (city/region level) and can be wrong. It must
  never be presented as a person's exact address or live location.
- Security indicators are only as complete as the providers behind them. Absence
  of a VPN/proxy signal is not proof of safety, and an IP is never labelled
  malicious without supporting threat-intelligence data.
- Browsers cannot send ICMP ping or scan ports; reachability is therefore tested
  via real DNS resolution and labelled as such.
- No accounts, no tracking. History is stored only in the visitor's browser.

## License

MIT — use, modify and deploy freely. Map data © OpenStreetMap contributors.
