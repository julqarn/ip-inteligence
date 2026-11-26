<div align="center">

# 🛰️ IP Intelligence

### Understand Every IP. Explore Every Network.

A modern, real-time IP lookup and network diagnostics platform — instant public-IP detection, geolocation, ISP/ASN intelligence, RDAP registration, DNS tools, and honest security signals in one polished cybersecurity dashboard.

<br />

![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet-OpenStreetMap-199900?style=for-the-badge&logo=leaflet&logoColor=white)

<br />

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjulqarn%2Fip-inteligence)

**[Features](#-features) · [Quick Start](#-quick-start) · [API](#-api-reference) · [Providers](#-data-providers) · [Deploy](#-deploy-to-vercel) · [Privacy](#-privacy--honesty)**

</div>

---

## ✨ Why IP Intelligence?

Most IP checkers stop at “your IP is …”. **IP Intelligence** goes further: it explains what the internet can see about a connection — where it appears to be, who operates it, how it is registered, what DNS says about it, and which security signals are actually available.

> **Honest by design:** every result comes from a real provider or a real diagnostic. If a provider does not supply a field, the UI shows **Not Available** instead of inventing data.

## 🚀 Features

| Area | What it does |
|---|---|
| ⚡ **Instant My-IP detection** | Shows your public IP, country, city, ISP and ASN as soon as the page loads |
| 🌐 **IPv4 + IPv6 connectivity** | Detects each family separately and reports “Not detected” honestly when unavailable |
| 🔎 **IPv4 + IPv6 lookup** | Strict validation, clear errors, shareable `?ip=` URLs |
| ⚖️ **IP comparison** | Two addresses side by side with differences highlighted |
| 🛡️ **Privacy & Leak Tests** | WebRTC, DNS resolver diagnostics, IPv6, VPN/proxy indicators, timezone consistency |
| 📊 **Privacy Score** | Transparent 0–100 weighted score; inconclusive tests are excluded, never scored as zero |
| 🧬 **Browser Fingerprint Lab** | Canvas, WebGL, audio, hardware, screen and permission signals — measured locally only |
| 🗺️ **Approximate map** | Leaflet + OpenStreetMap marker with an honest location radius |
| 🌍 **Geolocation** | Country, region, city, postal code, coordinates, continent, timezone, UTC offset |
| 🏢 **ISP & ASN intelligence** | ISP, organization, ASN, ASN organization, network range / CIDR |
| 🛡️ **Security indicators** | VPN, proxy, Tor and hosting signals when providers report them; optional AbuseIPDB scoring |
| 🧭 **Network diagnostics** | Reverse DNS, RDAP/WHOIS, ASN registry lookup, DNS-over-HTTPS records, DNS reachability |
| 🧬 **Browser leak signals** | Browser timezone comparison and a real WebRTC candidate check |
| 🧰 **Tools page** | IPv4/IPv6 validators, DNS lookup, reverse DNS, ASN lookup, RDAP and IP-range tools |
| 🕘 **Local history** | Recent lookups saved in `localStorage` — no account, no server copy |
| 🎨 **Modern UI** | Dark/light mode, glassmorphism, neon accents, skeleton loaders, toasts, responsive layout |

## 🧩 Phase 1–3 Modules

### Phase 1 — Advanced IP Intelligence Dashboard
Automatic IPv4/IPv6 detection with copy + refresh, comprehensive lookup (basic info, geolocation with country flag, ISP/ASN/network range, security indicators), Leaflet/OpenStreetMap map, two-IP comparison with highlighted differences, and localStorage history.

### Phase 2 — Privacy & Leak Test
WebRTC ICE-candidate inspection (mDNS candidates are reported as masks, never as IPs), a browser-triggered DNS resolver diagnostic, IPv4/IPv6 connectivity, VPN/proxy/Tor/hosting indicators labelled Detected / Not Detected / Unknown / Inconclusive, and IP-vs-browser timezone/language consistency. Each test card shows status, result, explanation, technical details, and a recommendation.

The DNS diagnostic uses the EDNS test endpoint at `edns.ip-api.com`: when the browser resolves that hostname, the authoritative server reports which recursive resolver actually asked. A browser cannot observe all system DNS traffic, so this measures the resolver path for normal browser lookups. A self-hosted authoritative DNS endpoint would be required for multi-resolver authoritative logging.

### Phase 3 — Browser Fingerprint Lab
Browser, screen, and hardware signals plus local Canvas, WebGL, and AudioContext fingerprint demonstrations and a Permissions API overview. All fingerprint tests run in the visitor's browser and are never transmitted. No microphone, camera, or precise location is ever activated.

### Privacy Score
Overall = weighted average of measured test scores (WebRTC ×3, DNS ×3, VPN/Proxy ×2, Consistency ×2, Fingerprint ×2, IPv6 ×1). Missing or inconclusive tests are excluded from the average. A visible public IP alone is neutral — it is how the internet routes replies back. A high score summarizes measured signals; it does not guarantee anonymity or security.

## 🧠 How it works

```mermaid
flowchart LR
  A[Visitor] --> B[Next.js dashboard]
  B --> C[/api/myip]
  B --> D[/api/lookup]
  B --> E[/api/dns]
  B --> F[/api/rdap]
  B --> G[/api/asn]
  D --> H[ipapi.co]
  D --> I[ipwho.is]
  E --> J[Cloudflare DNS-over-HTTPS]
  F --> K[RDAP registries]
  G --> K
  D -. optional .-> L[AbuseIPDB]
  D -. optional .-> M[ipinfo.io]
```

The backend normalizes provider responses into one clean schema, caches results for 5 minutes, rate-limits clients, and only contacts fixed provider hosts. User input is validated before use and is never treated as an arbitrary URL.

## ⚡ Quick Start

Requirements: **Node.js 18.18+** — Node 20 or 22 recommended.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production build:

```bash
npm run build
npm start
```

Type-check:

```bash
npm run typecheck
```

## 🔐 Environment Variables

The app works with free providers out of the box. Optional keys unlock extra enrichment and threat-intelligence data.

```bash
cp .env.example .env.local
```

| Variable | Required | Purpose |
|---|---:|---|
| `ABUSEIPDB_API_KEY` | No | Enables abuse score, report counts and blacklist-style reputation data |
| `IPINFO_TOKEN` | No | Enables extra hostname / organization enrichment |

Get keys:

- AbuseIPDB: https://www.abuseipdb.com/register
- ipinfo.io: https://ipinfo.io/signup

API keys stay on the server and are never exposed to the browser.

## 🔌 API Reference

All endpoints return JSON in one of these shapes:

```json
{ "ok": true, "data": { "...": "..." } }
```

```json
{ "error": "Human-readable error message" }
```

| Endpoint | Description |
|---|---|
| `GET /api/myip` | Detect and analyze the visitor’s public IP |
| `GET /api/lookup?ip=8.8.8.8` | Full intelligence report for an IP address |
| `GET /api/dns?name=example.com&type=A` | DNS records: `A`, `AAAA`, `MX`, `NS`, `TXT`, `CNAME`, `SOA` |
| `GET /api/dns?name=8.8.8.8&type=PTR` | Reverse DNS for an IP address |
| `GET /api/rdap?ip=8.8.8.8` | RDAP registration and network range |
| `GET /api/asn?asn=AS15169` | Autonomous-system registry record |

Example:

```bash
curl "http://localhost:3000/api/lookup?ip=8.8.8.8"
```

Abbreviated response:

```json
{
  "ok": true,
  "data": {
    "ip": "8.8.8.8",
    "version": 4,
    "ipType": "Public",
    "country": "United States",
    "city": "Mountain View",
    "asn": "AS15169",
    "asnOrg": "Google LLC",
    "timezone": "America/Los_Angeles",
    "provider": "ipapi.co + ipwho.is"
  }
}
```

## 📡 Data Providers

| Purpose | Provider | API key |
|---|---|---:|
| Primary IP geolocation | [ipapi.co](https://ipapi.co/) | No |
| Fallback + security enrichment | [ipwho.is](https://ipwho.is/) | No |
| WHOIS / RDAP | [rdap.org](https://rdap.org/) → authoritative RIR | No |
| DNS / reverse DNS | [Cloudflare DNS-over-HTTPS](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/) | No |
| Abuse scoring | [AbuseIPDB](https://www.abuseipdb.com/api.html) | Optional |
| Hostname / org enrichment | [ipinfo.io](https://ipinfo.io/) | Optional |

## 🛡️ Privacy & Honesty

- **IP geolocation is approximate.** It usually points to a city or region, not a street address, and it can be wrong.
- **Private and reserved IPs are explained, not geolocated.** They have no public ISP, ASN or location data.
- **No fake security verdicts.** An IP is never labelled malicious without supporting threat-intelligence data.
- **No port scanning.** Browsers cannot send ICMP ping or scan ports, so reachability is tested through real DNS resolution and labelled clearly.
- **No accounts or tracking.** Lookup history stays in the visitor’s browser.
- **SSRF-conscious backend.** The server only calls fixed provider hosts with validated IP/domain inputs.

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 App Router |
| UI | React 19, Tailwind CSS 3, Lucide icons |
| Language | TypeScript |
| Map | Leaflet + OpenStreetMap |
| Validation | Zod + shared IP utilities |
| Backend | Next.js API Routes on the Node.js runtime |

## 🗂️ Project Structure

```text
ip-intelligence/
├── app/
│   ├── api/
│   │   ├── lookup/route.ts   # IP lookup: primary + fallback providers
│   │   ├── myip/route.ts     # visitor public-IP detection
│   │   ├── dns/route.ts      # DNS + reverse DNS via Cloudflare DoH
│   │   ├── rdap/route.ts     # WHOIS/RDAP via rdap.org
│   │   └── asn/route.ts      # ASN registry lookup via RDAP
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx              # dashboard, results, tools, history, about
├── components/
│   ├── CompareIps.tsx        # two-IP side-by-side comparison
│   ├── FingerprintLab.tsx    # Browser Fingerprint Lab (client-only)
│   ├── MapView.tsx           # Leaflet + OpenStreetMap, client-only
│   └── PrivacyTests.tsx      # Privacy & Leak Tests + score UI
├── lib/
│   ├── browserTests.ts       # WebRTC/DNS/connectivity/fingerprint helpers
│   ├── ip.ts                 # validation & classification
│   ├── privacy.ts            # privacy test evaluation + score engine
│   └── providers.ts          # provider normalization, cache, rate limiting
├── .env.example
├── next.config.mjs
├── package.json
├── postcss.config.mjs
├── tailwind.config.js
└── tsconfig.json
```

## 🚢 Deploy to Vercel

Use the deploy button above, or import the repository manually:

1. Open [Vercel New Project](https://vercel.com/new).
2. Import `julqarn/ip-inteligence`.
3. Keep the detected **Next.js** preset.
4. Optionally add `ABUSEIPDB_API_KEY` and/or `IPINFO_TOKEN` in **Settings → Environment Variables**.
5. Deploy.

Visitor-IP detection works automatically in production because Vercel forwards the real client IP to the app.

CLI deployment:

```bash
npm i -g vercel
vercel --prod
```

## 🧪 Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Start the production server |
| `npm run typecheck` | Run TypeScript checks |
| `npm run lint` | Run Next.js lint checks |

## 🧪 Testing Report

Verified locally against the production build:

- TypeScript typecheck and Next.js production build pass.
- IPv4 lookup: `8.8.8.8` → AS15169, reverse DNS `dns.google`, United States.
- IPv6 lookup: `2606:4700:4700::1111` → AS13335, United States.
- Invalid input `999.1.1.1` → HTTP 400.
- Private `192.168.1.1` → local RFC1918 classification, no external lookup.
- DNS A, RDAP, and ASN endpoints return live data.
- Homepage renders the Compare, Privacy, and Fingerprint navigation.

Browser-only tests (WebRTC, canvas, WebGL, audio, permissions) are implemented with standard web APIs and graceful unsupported-state handling; their results depend on the visitor's browser and cannot be meaningfully asserted from a server-side test.

Features requiring additional keys or infrastructure:

- AbuseIPDB abuse scoring: requires `ABUSEIPDB_API_KEY` (free tier).
- ipinfo hostname/org enrichment: requires `IPINFO_TOKEN` (free tier).
- Authoritative multi-resolver DNS leak logging: requires a self-hosted authoritative DNS test domain/endpoint; the built-in EDNS diagnostic covers the common single-resolver path.

## 🤝 Contributing

Issues and pull requests are welcome. Please keep changes aligned with the project’s core rule: **real data only — never fabricate lookup results, locations, or security verdicts.**

Good first contributions:

- Add a new provider behind the existing normalized schema
- Improve diagnostics while keeping browser limitations explicit
- Polish accessibility, keyboard navigation, or mobile layout
- Add tests for IP classification and provider normalization

## 📄 License

MIT — use, modify and deploy freely.

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.

---

<div align="center">

**IP Intelligence** — built for curious humans, network nerds, and anyone who wants to know what the internet sees.

</div>
