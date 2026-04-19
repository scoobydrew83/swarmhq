# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.x.x   | Yes       |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Email security reports to: scoobydrew83@gmail.com

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested mitigations

You will receive a response within 7 days. We aim to release a fix within 30 days of confirmation.

## Security Design

swarmhq is designed with these security properties:

- **Secrets never in config.json** — passwords and auth keys are stored in a separate `.env` file
- **Localhost-only UI server** — the dashboard binds to `127.0.0.1` only, never on public interfaces
- **Session token authentication** — every UI request requires a per-session token issued at startup
- **Redaction utilities** — sensitive values can be masked in CLI output for safe log sharing
- **No telemetry** — swarmhq does not phone home or collect usage data
