# Contributing to IP Intelligence

Thanks for your interest in contributing. Issues, bug reports, documentation improvements, and pull requests are welcome.

## Core rule

**Real data only.** Never fabricate lookup results, locations, detection verdicts, or provider data. When information is unavailable, show **Not Available**, **Unknown**, or **Inconclusive** — never guess.

## Getting started

1. Fork the repository and create a branch from `main`.
2. Install dependencies: `npm install`
3. Run the dev server: `npm run dev`
4. Make your change and verify it:
   - `npm run typecheck`
   - `npm run build`
   - For the Flutter app in `mobile/`: `flutter analyze` and `flutter test`

## Pull requests

- Keep changes focused and describe what changed and why.
- Do not commit API keys or secrets. Optional provider keys belong in `.env.local` (see `.env.example`).
- Keep the backend SSRF-safe: only call fixed provider hosts with validated input.
- Never label an IP malicious without supporting threat-intelligence data.
- Hosting/datacenter classification alone must never be presented as VPN or proxy use.

## Reporting bugs

Please include the IP address or input you tested (if safe to share), the expected result, the actual result, and your browser or device. For security issues, see [SECURITY.md](SECURITY.md).
