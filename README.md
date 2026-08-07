# when-again

*"When was my appointment again?"*

A free, open-source appointment reminder for small service providers and
their clients — a hairdresser's paper notebook, upgraded, with **no server,
no accounts, and no fees**.

## How it works

- The provider keeps their schedule and client visit history in an
  installable web app (PWA) — all data stays on their phone.
- When they book your next appointment, their phone shows a **QR code**
  (or sends a link via any messenger). You scan it, and the appointment
  lands on your phone — with one tap to add it to your calendar, which
  reminds you natively.
- The appointment data travels inside the link itself (URL fragment).
  No server ever sees it. The hosting serves only the app's code.

## Status

Early design phase. The founding spec lives in
[`docs/specs/2026-08-07-when-again-design.md`](docs/specs/2026-08-07-when-again-design.md).
Work is tracked as epics in the project's GitHub issues and project board.

## Principles

- **Free for everyone, by construction.** Static hosting only; there is no
  infrastructure to pay for, so there is nothing to charge for.
- **Local-first.** Your data lives on your device. Backup is a file you own.
- **No tracking.** No analytics, no accounts, no network calls after load.

## AI transparency

This project is developed in the open with substantial AI assistance
([Claude Code](https://claude.com/claude-code)). The design spec, code, and
documentation are largely AI-generated under human direction and review.
AI-assisted commits carry a "Generated with Claude Code" attribution.

## License

[MIT](LICENSE)
