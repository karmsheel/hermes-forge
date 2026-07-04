# Forge theme JSON schema (4.7)

User-installable themes use the same shape as Hermes Desktop `DesktopTheme` / Forge `ForgeSkin`.

## Minimal example

```json
{
  "name": "ocean-glow",
  "label": "Ocean Glow",
  "description": "Cool blues on warm neutrals",
  "colors": {
    "background": "#f8faff",
    "foreground": "#17171a",
    "primary": "#0053fd"
  },
  "darkColors": {
    "background": "#0d1117",
    "foreground": "#e8edf5",
    "primary": "#6b8fe8"
  }
}
```

## Required fields

| Field | Type | Notes |
|-------|------|-------|
| `label` | string | Shown in the skin picker (falls back to `name`) |
| `colors.background` | string | Light-mode page background |
| `colors.foreground` | string | Light-mode text |
| `colors.primary` | string | Accent / CTA color |

## Optional fields

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Slug (`a-z`, digits, hyphens). Auto-generated from `label` if omitted |
| `description` | string | Tooltip in Settings |
| `darkColors` | object | Same keys as `colors`; if omitted, light palette is used in dark mode |
| Other `colors.*` keys | string | See `lib/themes/types.ts` — missing slots are derived via `normalizeSkinColors` |

## Rules

- `name` must not collide with built-in skins (`forge`, `nous`, `midnight`, `ember`, `mono`, `cyberpunk`, `slate`).
- Wrap as `{ "theme": { ... } }` is also accepted.
- Stored in `localStorage` under `hermes-forge-user-themes-v1` with precomputed boot vars for flashless reload.

## Install surfaces

- Settings → Skin → **Install custom theme…** (paste or upload `.json`)

See `lib/themes/validate.ts` for the authoritative parser.