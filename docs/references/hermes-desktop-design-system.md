# Hermes Desktop Design System — extracted from the source repo

Source of truth: `https://github.com/nousresearch/hermes-agent`, branch `main`, package `apps/desktop`.  
Primary files used: `DESIGN.md`, `src/styles.css`, `src/themes/*`.

---

## 1. Core principles

1. **Flat, not boxed.** No card-in-card. Group with whitespace + a single hairline, not nested rounded cards.
2. **Borderless + shadow for elevation.** Overlays float on `shadow-nous` + `--stroke-nous` hairline.
3. **One primitive per concern.** Single `Button`, `SearchField`, `SegmentedControl`, `ListRow`, `Loader`, `ErrorState`, `LogView`, etc. Call sites pass variant/size, not `className` overrides.
4. **Tokens over literals.** Every color, radius, and elevation comes from CSS custom properties. No raw hex, `bg-white`, or hardcoded shadows in components.
5. **Style lives in the primitive.** Variants own padding, radius, chrome, color.

---

## 2. Token architecture

Colors live in two layers:

- **Seed tokens** — named `--theme-{slot}-seed`, ex: `--theme-foreground`, `--theme-primary`, `--theme-background-seed`
- **Applied tokens** — derived via `color-mix()`, ex: `--ui-bg-chrome`, `--dt-background`, `--dt-card`, `--dt-sidebar-bg`

### Light mode

```css
:root {
  --theme-foreground: #17171a;
  --theme-primary: #0053fd;
  --theme-secondary: color-mix(in srgb, #0053fd 7%, #ffffff);
  --theme-accent-soft: color-mix(in srgb, #0053fd 10%, #ffffff);
  --theme-midground: #0053fd;
  --theme-warm: #cf806d;
  --theme-background-seed: #f8faff;
  --theme-sidebar-seed: #f3f7ff;
  --theme-card-seed: #ffffff;
  --theme-elevated-seed: #ffffff;
  --theme-bubble-seed: color-mix(in srgb, #0053fd 6%, #ffffff);
  --theme-neutral-chrome: #f3f3f3;
  --theme-neutral-sidebar: #f3f3f3;
  --theme-neutral-card: #fcfcfc;
  --theme-mix-chrome: 92%;
  --theme-mix-sidebar: 100%;
  --theme-mix-card: 22%;
  --theme-mix-elevated: 28%;
  --theme-mix-bubble: 0%;
  --theme-fill-primary-accent-mix: 16%;
  --theme-fill-secondary-accent-mix: 11%;
  --theme-fill-tertiary-accent-mix: 8%;
  --theme-fill-quaternary-accent-mix: 5%;
  --theme-fill-quinary-accent-mix: 3%;
  --theme-stroke-primary-accent-mix: 24%;
  --theme-stroke-secondary-accent-mix: 16%;
  --theme-stroke-tertiary-accent-mix: 10%;
  --theme-stroke-quaternary-accent-mix: 6%;
  --theme-row-hover-accent-mix: 4%;
  --theme-row-active-accent-mix: 8%;
  --theme-control-hover-accent-mix: 6%;
  --theme-control-active-accent-mix: 8%;

  /* Surface tokens */
  --ui-bg-chrome: color-mix(in srgb, var(--theme-background-seed) var(--theme-mix-chrome), var(--theme-neutral-chrome));
  --ui-bg-sidebar: color-mix(in srgb, var(--theme-sidebar-seed) var(--theme-mix-sidebar), var(--theme-neutral-sidebar));
  --ui-bg-editor: color-mix(in srgb, var(--theme-card-seed) var(--theme-mix-card), var(--theme-neutral-card));
  --ui-bg-elevated: color-mix(in srgb, var(--theme-elevated-seed) var(--theme-mix-elevated), var(--theme-neutral-card));
  --ui-bg-card: color-mix(in srgb, var(--ui-accent) 4%, color-mix(in srgb, var(--ui-base) 4%, transparent));
  --ui-bg-input: #fcfcfc;
  --ui-bg-primary: color-mix(in srgb, var(--ui-accent) var(--theme-fill-primary-accent-mix), color-mix(in srgb, var(--ui-base) 10%, transparent));
  --ui-bg-secondary: color-mix(in srgb, var(--ui-accent) var(--theme-fill-secondary-accent-mix), color-mix(in srgb, var(--ui-base) 7%, transparent));
  --ui-bg-tertiary: color-mix(in srgb, var(--ui-accent) var(--theme-fill-tertiary-accent-mix), color-mix(in srgb, var(--ui-base) 5%, transparent));
  --ui-bg-quaternary: color-mix(in srgb, var(--ui-accent) var(--theme-fill-quaternary-accent-mix), color-mix(in srgb, var(--ui-base) 4%, transparent));
  --ui-bg-quinary: color-mix(in srgb, var(--ui-accent) var(--theme-fill-quinary-accent-mix), color-mix(in srgb, var(--ui-base) 3%, transparent));
  --ui-row-hover-background: color-mix(in srgb, var(--ui-accent) var(--theme-row-hover-accent-mix), color-mix(in srgb, var(--ui-base) 3%, transparent));
  --ui-row-active-background: color-mix(in srgb, var(--ui-accent) var(--theme-row-active-accent-mix), color-mix(in srgb, var(--ui-base) 5%, transparent));
  --ui-control-hover-background: color-mix(in srgb, var(--ui-accent) var(--theme-control-hover-accent-mix), color-mix(in srgb, var(--ui-base) 4%, transparent));
  --ui-control-active-background: color-mix(in srgb, var(--ui-accent) var(--theme-control-active-accent-mix), color-mix(in srgb, var(--ui-base) 5%, transparent));

  /* Text tokens */
  --ui-text-primary: color-mix(in srgb, var(--ui-base) 94%, transparent);
  --ui-text-secondary: color-mix(in srgb, var(--ui-base) 74%, transparent);
  --ui-text-tertiary: color-mix(in srgb, var(--ui-base) 54%, transparent);
  --ui-text-quaternary: color-mix(in srgb, var(--ui-base) 36%, transparent);

  /* Stroke tokens */
  --ui-stroke-primary: color-mix(in srgb, var(--ui-accent) var(--theme-stroke-primary-accent-mix), color-mix(in srgb, var(--ui-base) 10%, transparent));
  --ui-stroke-secondary: color-mix(in srgb, var(--ui-accent) var(--theme-stroke-secondary-accent-mix), color-mix(in srgb, var(--ui-base) 7%, transparent));
  --ui-stroke-tertiary: color-mix(in srgb, var(--ui-accent) var(--theme-stroke-tertiary-accent-mix), color-mix(in srgb, var(--ui-base) 5%, transparent));
  --ui-stroke-quaternary: color-mix(in srgb, var(--ui-accent) var(--theme-stroke-quaternary-accent-mix), color-mix(in srgb, var(--ui-base) 3%, transparent));

  /* Shadows */
  --shadow-nous:
    0 0.125rem 0.25rem -0.125rem color-mix(in srgb, #000 7%, transparent),
    0 0.5rem 0.75rem -0.375rem color-mix(in srgb, #000 6%, transparent),
    0 1.25rem 1.75rem -0.875rem color-mix(in srgb, #000 6%, transparent),
    0 2.25rem 3rem -1.75rem color-mix(in srgb, #000 0%, transparent);

  --radius: 0.75rem;
  --radius-scalar: 0.6;

  /* Component sizing */
  --composer-width: 48.75rem;
  --composer-control-size: 1.5rem;
  --composer-ring-strength: 1;
  --composer-input-min-height: 1.625rem;
  --composer-input-max-height: 9.375rem;
  --sidebar-width: 14.8125rem;
}
```

### Dark mode overrides

```css
:root.dark {
  --theme-mix-chrome: 74%;
  --theme-mix-card: 38%;
  --theme-mix-elevated: 46%;
  --theme-mix-bubble: 46%;
  --theme-neutral-chrome: #0d0d0e;
  --theme-neutral-sidebar: #0a0a0b;
  --theme-neutral-card: #161618;
  --sidebar-edge-border: color-mix(in srgb, var(--ui-base) 12%, transparent);
  --composer-ring-strength: 1.3;
  --dt-input-border: 4%;
  --dt-input-inset: inset 0 1px 1px color-mix(in srgb, #000 38%, transparent);
  --dt-destructive: #c0473a;
  --ui-red: #e75e78;
  --ui-green: #55a583;
  --ui-cyan: #6f9ba6;
  --ui-inline-code-background: color-mix(in srgb, #ffffff 7%, transparent);
  --ui-inline-code-foreground: color-mix(in srgb, #ffffff 88%, transparent);
  --ui-selection-background: color-mix(in srgb, #ffd24a 38%, transparent);
  --dock-glow-scale: 1;
}
```

---

## 3. Typography

### Sans stack (default)

```css
--dt-font-sans:
  "Segoe WPC", "Segoe UI", -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif,
  "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", emoji;
```

### Mono stack

```css
--dt-font-mono:
  "JetBrains Mono", "Cascadia Code", "SF Mono", ui-monospace, Menlo, Consolas, monospace,
  "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", emoji;
```

### Per-theme overrides

| Theme | Display override | Mono override |
| --- | --- | --- |
| Nous | `Segoe WPC ... sans-serif` | `"Courier Prime", JetBrains Mono ...` |
| Midnight | `Segoe WPC ... sans-serif` | `JetBrains Mono ...` |
| Ember | `Segoe WPC ... sans-serif` | `"IBM Plex Mono", JetBrains Mono ...` |
| Mono | `Segoe WPC ... sans-serif` | `"Courier New", Courier, monospace, ...` as both sans and mono |
| Cyberpunk | `Segoe WPC ... sans-serif` | `"Courier New", Courier, monospace, ...` as both sans and mono |
| Slate | `Segoe WPC ... sans-serif` | `"JetBrains Mono", ...` |

Bundled webfonts: `JetBrains Mono` WOFF2 and local `Collapse-Bold.woff2`.

---

## 4. Built-in themes (source palette)

Default is **Nous**.

| Name | Light background | Light foreground | Light primary | Surface/neutral |
| --- | --- | --- | --- | --- |
| Nous | `#F8FAFF` | `#17171A` | `#0053FD` | `#FFFFFF` card, `#F3F7FF` sidebar |
| Midnight | `#08081c` | `#ddd6ff` | `#ddd6ff` | `#0d0d28` card, `#06061a` sidebar |
| Ember | `#160800` | `#ffd8b0` | `#ffd8b0` | `#1e0e04` card, `#100600` sidebar |
| Mono | `#0e0e0e` | `#eaeaea` | `#eaeaea` | `#141414` card, `#0a0a0a` sidebar |
| Cyberpunk | `#000a00` | `#00ff41` | `#00ff41` | `#001200` card, `#000600` sidebar |
| Slate | `#0d1117` | `#c9d1d9` | `#c9d1d9` | `#161b22` card, `#090d13` sidebar |

Only Nous ships a hand-tuned dark palette. For others, the app synthesizes light variants from dark seeds using deterministic `color-mix()` math.

---

## 5. Radius system

All radii derive from `--radius-scalar`:

```css
--radius-xs: calc(var(--radius-scalar) * 0.125rem);
--radius-sm: calc(var(--radius-scalar) * 0.5rem);
--radius-md: calc(var(--radius-scalar) * 0.625rem);
--radius-lg: calc(var(--radius-scalar) * 0.75rem);
--radius-xl: calc(var(--radius-scalar) * 1rem);
--radius-2xl: calc(var(--radius-scalar) * 1.5rem);
--radius-3xl: calc(var(--radius-scalar) * 2rem);
--radius-4xl: calc(var(--radius-scalar) * 2.5rem);
```

Default `--radius` is `0.75rem`. Change `--radius-scalar` to scale the whole system.

---

## 6. Elevation tokens

```css
--shadow-xs: 0 0.0625rem 0.125rem color-mix(in srgb, #000 5%, transparent);
--shadow-sm:
  0 0 0 0.0625rem color-mix(in srgb, var(--dt-foreground) 6%, transparent),
  0 0.125rem 0.5rem color-mix(in srgb, #000 4%, transparent);
--shadow-md:
  0 0 0 0.0625rem color-mix(in srgb, var(--dt-foreground) 8%, transparent),
  0 0.25rem 1rem color-mix(in srgb, #000 8%, transparent),
  0 1rem 2rem -1.5rem color-mix(in srgb, #000 18%, transparent);

--shadow-nous:
  0 0.125rem 0.25rem -0.125rem color-mix(in srgb, #000 7%, transparent),
  0 0.5rem 0.75rem -0.375rem color-mix(in srgb, #000 6%, transparent),
  0 1.25rem 1.75rem -0.875rem color-mix(in srgb, #000 6%, transparent),
  0 2.25rem 3rem -1.75rem color-mix(in srgb, #000 0%, transparent);

--shadow-lg:
  inset 0 0.0625rem 0 color-mix(in srgb, #fff 28%, transparent),
  0 0 0 0.0625rem color-mix(in srgb, var(--dt-foreground) 8%, transparent),
  0 0.75rem 2rem color-mix(in srgb, #000 12%, transparent);

--shadow-composer: 0 0.0625rem 0.125rem color-mix(in srgb, #000 5%, transparent);

--stroke-nous: color-mix(in srgb, currentColor 3%, transparent);
```

---

## 7. Component primitives

| Primitive | Role | Key contract |
| --- | --- | --- |
| `Button` | single action control | variants: `default | destructive | secondary | outline | ghost | link | text | textStrong`; sizes: `default | xs | sm | lg | inline | icon*` |
| `Input / Textarea / SelectTrigger` | text entry | shared `controlVariants`; hover/active/selected via surface tokens |
| `SearchField` | search input | borderless at rest, underline on focus/floating |
| `SegmentedControl` | small exclusive set | replaces radio/pill rows |
| `Switch` | boolean | size `xs`, bare, aria-labeled |
| `ListRow` | settings label/desc/action row | flush left, no per-row indentation |
| `Loader` | loading state | lemniscate-bloom; never literal “Loading…” text |
| `ErrorState` | errors | canonical icon, no bg chip |
| `LogView` | raw logs | no bg, hairline border, tight pad, small mono |
| `EmptyState` / `EmptyPanel` | empty state | don’t roll your own |

Icon set: **Codicons only**. No mixed icon libraries inline.

---

## 8. Layout rules

- Gutters from `PAGE_INSET_X` / `PAGE_INSET_NEG_X` constants; no hardcoded inline `px-` on pages.
- Overlays use `shadow-nous` + `border-(--stroke-nous)`.
- Master/detail via `OverlaySplitLayout` + `OverlaySidebar` / `OverlayMain`.
- No dividers between list rows unless necessary; when needed, single `--ui-stroke-tertiary` hairline.

---

## 9. Motion

- ~100ms transition on controls; respect `prefers-reduced-motion` beyond fades.
- Exits stagger inner elements first, outer surface fades last so details never fight containment.

---

## 10. Theme engine behavior

- Three exposure controls: `ThemeProvider`, saved `skinName` + `mode`, per-profile persistence.
- Dark is automatic; actual first paint uses flashless boot-time token injection via module + localStorage.
- Boot-time background causality: `window.localStorage.setItem('hermes-boot-background', chromeBg)` + `'hermes-boot-color-scheme'`.
- Nowrite replaces per-page copy; only variant + size drive chrome at call sites.

---

## 11. Replication checklist

When building your own project from this extract:

- [ ] Seed CSS custom properties on `:root` and a `.dark` mode block.
- [ ] Use `color-mix(in srgb, ...)` for texture; avoid hardcoded rgba fills.
- [ ] Expose `--theme-*-seed` tokens plus derived `--ui-*` tokens.
- [ ] Provide light/dark/sys mode toggle with CSS overrides.
- [ ] Use `--radius-scalar` + generated radius scale.
- [ ] Use `shadow-nous` + `--stroke-nous` for overlays.
- [ ] Strip decorative gradients unless functional.
- [ ] Use the single-font-family priority stack defined here.
- [ ] Respect `flat, primitives, tokens` posture in all added components.
- [ ] Keep read-only accessibility hookups: `Esc` closes, `cursor-pointer` on control primitives, focus ring preserved at global layer.
