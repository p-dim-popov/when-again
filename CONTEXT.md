# when-again

Ubiquitous language for the appointment-reminder PWA. A glossary only — no
implementation details. See `CLAUDE.md` for conventions and architecture.

## Language

**Provider**:
The person who keeps a schedule and hands appointments to clients (e.g. a
hairdresser). Owns the data on their own phone.
_Avoid_: salon owner, business, merchant

**Client**:
The person who receives an appointment from a provider and wants a reminder.
_Avoid_: customer, visitor

**Mode**:
Which of the two roles the app currently serves on this device: provider or
client. Chosen on the welcome screen, changeable in Settings, never locked.
_Avoid_: role, account type

**Welcome screen**:
The first-run screen shown while no mode is chosen. It welcomes the person,
says what the app is, and offers the mode choice.
_Avoid_: first-run chooser, mode chooser, onboarding
