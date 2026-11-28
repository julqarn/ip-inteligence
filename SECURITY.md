# Security Policy

## Reporting a vulnerability

If you find a security issue in IP Intelligence, please report it privately instead of opening a public issue.

- Open a private security advisory through GitHub: **Security → Advisories → Report a vulnerability** on this repository.
- Include a clear description, steps to reproduce, and the potential impact.

Please do not publicly disclose the issue until it has been addressed.

## Scope

Security reports are especially welcome for:

- Server-side request forgery (SSRF) or input-validation bypasses in the API routes
- Exposure of API keys or other secrets
- Rate-limit or cache abuse that affects availability
- Privacy leaks in the web or mobile clients

## Design notes

- The backend only contacts fixed provider hosts and validates all IP/domain input before use.
- Optional provider API keys are read from server-side environment variables and are never sent to the browser.
- Lookup history is stored only in the visitor's browser or device.
