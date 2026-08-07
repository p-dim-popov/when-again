# when-again

_"When was my appointment again?"_

when-again is a free, open-source appointment reminder for small service
providers and their clients. It replaces the paper notebook of a hairdresser
or any other provider. It has no server, no accounts, and no fees.

## How it works

- The provider keeps the schedule and the client visit history in an
  installable web app (PWA). All data stays on the provider's phone.
- When the provider books your next appointment, their phone shows a QR
  code. The provider can also send a link in any messenger. You scan the
  code, and the appointment lands on your phone. One tap adds it to your
  calendar, and the calendar reminds you.
- The appointment data travels inside the link itself (the URL fragment).
  No server sees the data. The hosting serves only the app code.

## Status

The app shell is live at
[p-dim-popov.github.io/when-again](https://p-dim-popov.github.io/when-again/).
The founding spec is
[`docs/specs/2026-08-07-when-again-design.md`](docs/specs/2026-08-07-when-again-design.md).
The GitHub issues and the project board track the work as epics.

## Principles

- **Free for everyone, by construction.** The app uses static hosting only.
  There is no infrastructure to pay for, so there is nothing to charge for.
- **Local-first.** Your data lives on your device. The backup is a file
  that you own.
- **No tracking.** No analytics, no accounts, no network calls after the
  app loads.

## AI transparency

We develop this project in the open with substantial AI help
([Claude Code](https://claude.com/claude-code)). AI generates most of the
spec, code, and documentation, under human direction and review.
AI-assisted commits carry a "Generated with Claude Code" attribution.

## License

[MIT](LICENSE)
