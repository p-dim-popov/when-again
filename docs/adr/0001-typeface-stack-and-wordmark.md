# Typeface stack and wordmark

Status: accepted

The app's user-facing identity is the "When Again" wordmark and a two-family
self-hosted font stack: Sofia Sans Condensed (variable) as the display face
and Manrope (variable) as the body face, replacing Lora + IBM Plex Sans. The
technical slug `when-again` stays in identifiers (backup `app` field, DB name,
URLs) and is not user-facing copy.

## Why these families

- **Bulgarian Cyrillic is a first-class requirement.** Sofia Sans ships
  Bulgarian letterforms as its _default_ Cyrillic glyphs (its `locl` feature
  switches _to_ Russian forms, not from them), so the display face needs no
  pipeline or markup support. Manrope is the opposite: Russian-style by
  default with a `BGR` `locl` that survives the Fontsource woff2 build —
  which is why i18n must keep `document.documentElement.lang` in sync with
  the active language. If Russian text is ever rendered, tag it `lang="ru"`
  or Sofia Sans will show Bulgarian forms.
- **Payload.** Latin+Cyrillic woff2 totals: Sofia Sans Condensed ~67 KB +
  Manrope ~39 KB ≈ 106 KB, vs ~184 KB for the previous Lora + IBM Plex Sans
  weights — a net reduction despite gaining full variable weight axes.

## Rejected alternatives

- **Caveat (handwritten accent face):** rejected. ~96 KB for a single
  tagline (handwriting compresses poorly; the variable build is 152 KB), and
  it has no Bulgarian alternates at all — it would render the primary
  market's language in Russian/international letterforms.
- **IBM Plex Mono (code/numbers):** rejected. The only such surfaces are the
  version stamp and aligned digits; `font-variant-numeric: tabular-nums` on
  Manrope plus the system mono stack cover both for zero bytes.

## Consequences

- Fontsource variable packages register family names with a "Variable"
  suffix — tokens must use `'Sofia Sans Condensed Variable'` and
  `'Manrope Variable'` exactly.
- The Tailwind token is `--font-display`/`font-display` (renamed from
  `font-serif` — the display face is not a serif).
- Manrope has no italic; Sofia Sans Condensed italics are a separate file
  set. Neither is loaded — do not use italics without revisiting payload.
