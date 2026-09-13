---
name: Telemetry Dispatch Station
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#bcc9cd'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#869397'
  outline-variant: '#3d494c'
  surface-tint: '#4cd7f6'
  primary: '#4cd7f6'
  on-primary: '#003640'
  primary-container: '#06b6d4'
  on-primary-container: '#00424f'
  inverse-primary: '#00687a'
  secondary: '#c0c1ff'
  on-secondary: '#1000a9'
  secondary-container: '#3131c0'
  on-secondary-container: '#b0b2ff'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#1bbd85'
  on-tertiary-container: '#00452e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#acedff'
  primary-fixed-dim: '#4cd7f6'
  on-primary-fixed: '#001f26'
  on-primary-fixed-variant: '#004e5c'
  secondary-fixed: '#e1e0ff'
  secondary-fixed-dim: '#c0c1ff'
  on-secondary-fixed: '#07006c'
  on-secondary-fixed-variant: '#2f2ebe'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-code:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: -0.02em
  label-code-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
    letterSpacing: 0em
  label-ui:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style
The design system targets homelab operators, sysadmins, and automation engineers managing self-hosted messaging gateways, notification pipelines, and critical contact rotas. 

The emotional tone evokes control, reliability, and surgical precision: zero decorative noise, instant system visibility, low cognitive friction during high-frequency dispatch tasks, and structural density. 

The visual style combines **Corporate / Technical Modern** with **Engineered Minimalism**:
- Strict grid boundaries, structural wire-thin dividers, and monospaced diagnostic accents.
- Highly visible, state-driven signaling: glowing sub-pixel status indicators, clear schedule state badges, and explicit cron validation visual feedback.
- Content density calibrated for wide console screens and multi-monitor homelab setups, with quick access to quick-edit actions, audit logs, and message payloads.
- Localized strictly in pt-BR (`Agendamentos`, `Destinatários`, `Disparos Ativos`, `Rotas & Canais`).

## Colors
The palette leverages a technical control-room hierarchy tuned for dark slate default environments, with symmetric clarity in light mode.

- **Primary (`#06b6d4` - Cyan):** Applied to active navigation targets, focus rings, primary triggers, and active data streams.
- **Secondary (`#6366f1` - Indigo):** Reserved for API keys, queue workers, gateway channel configuration, and webhook tokens.
- **Tertiary / Active (`#10b981` - Emerald):** Operational pulse, scheduled crons, active dispatch pipelines, and healthy workers.
- **Warning / Paused (`#f59e0b` - Amber):** Paused queues, rate-limiting throttle warnings, and invalid cron draft specs.
- **Destructive / Failure (`#f43f5e` - Rose):** Failed delivery attempts, dead-letter queues, unreachable endpoints.
- **Neutral / Slate (`#0f172a` base):** Deep blue-slate surfaces with layered hierarchy (`#020617` canvas background, `#0f172a` surface containers, `#1e293b` card fills, and `#334155` border strokes).

## Typography
Typographic discipline pairs the hyper-legible neutrality of Inter for interface interaction and reading hierarchy with the clinical precision of JetBrains Mono for machine tokens.

- **JetBrains Mono usage:** Strictly required for Brazilian phone formats (`+55 (11) 98765-4321`), UTC/Horário de Brasília timestamps (`2025-03-30 14:00:00 -03`), UUIDs, cron expressions (`*/15 * * * *`), and payload JSON previews.
- **Inter usage:** Structural shell navigation, modal forms, operational warnings, status descriptions, and table headers.
- **Casing and Tracking:** All uppercase telemetry tags (`STATUS`, `CANAL`, `RETENTIVA`) leverage `label-ui` with subtle letter spacing (+0.04em) for compact data scans.

## Layout & Spacing
The layout follows a high-utility fluid grid system structured for data density and spatial conservation.

- **Grid Architecture:** 
  - Mobile (<768px): 4-column layout, compact outer margin (`margin`: 1rem), single-column collapsed card flows.
  - Tablet (768px–1199px): 8-column layout, collapsible sidebar, 1.5rem margin.
  - Desktop (≥1200px): 12-column layout, fixed navigation rail (width: 240px or 64px compact), fixed inspector panel on drawer activations, with 1.5rem gutters.
- **Spacing Principle:** Compact 4px/8px incremental rhythm (`space-xs` = 4px, `space-sm` = 8px, `space-md` = 12px, `space-lg` = 20px, `space-xl` = 32px).
- **Density Rules:** Table row heights locked to 40px for standard density and 32px for condensed telemetry views. Card padding maintains `space-md` internally to prevent unnecessary expansion.

## Elevation & Depth
Depth is created through surface contrast and structural borders rather than blur-heavy drop shadows, ensuring performant rendering and technical clarity.

- **Tonal Layers:**
  - `Surface-0 (Canvas)`: `#020617` (Deepest backdrop).
  - `Surface-1 (Containers/Sidebars)`: `#0b0f19` with a subtle hairline edge (`#1e293b`).
  - `Surface-2 (Cards/Data Rows)`: `#111827` hovering to `#1f2937`.
  - `Surface-3 (Popovers/Modals/Dropdowns)`: `#1e293b` with high-contrast perimeter (`#334155`).
- **Borders & Outlines:** Low-contrast ghost borders (`1px solid rgba(148, 163, 184, 0.12)`) establish all structural edges. Shadows are reserved solely for overlays: `0 10px 25px -5px rgba(0, 0, 0, 0.6)`.
- **Active State Glow:** Focused form inputs and running tasks use an inset or subtle perimeter glow: `0 0 0 1px #06b6d4, 0 0 12px -2px rgba(6, 182, 212, 0.4)`.

## Shapes
The design system uses deliberate, semi-sharp geometry (`roundedness: 1`).

- Core UI elements (buttons, inputs, notification pills, code chips) use a crisp `4px` corner radius (`0.25rem`), reinforcing an industrial console aesthetic.
- Modal dialogs, side drawers, and primary cards use `8px` (`0.5rem`).
- Full rounded pills (`9999px`) are strictly forbidden except for live visual telemetry dots (pulsing status rings).

## Components

### Buttons
- **Primary:** Background cyan (`#06b6d4`), text slate-950 (`#020617`), weight 600, border radius 4px. Hover brings brightness up (`#22d3ee`).
- **Secondary:** Surface slate-800 (`#1e293b`), border slate-700 (`#334155`), text slate-200.
- **Destructive/Danger:** Translucent rose fill (`rgba(244, 63, 94, 0.1)`), rose border (`#f43f5e`), text rose-400.
- **Sizes:** Compact padding (e.g., `6px 12px` for normal, `4px 8px` for micro/table actions).

### Chips & Telemetry Badges
- Used for status labels (`Agendado`, `Pendente`, `Falha`, `Executando`).
- Height: 20px. Font: `JetBrains Mono` 11px uppercase.
- Structural layout: Dot indicator (6px circle) on the left + status label. 
  - *Active:* `#10b981` indicator, green tint background (`rgba(16, 185, 129, 0.1)`).
  - *Paused:* `#f59e0b` indicator, amber tint background.
  - *Error:* `#f43f5e` indicator, rose tint background.

### Input Fields & Selects
- Background `#0b0f19`, border `1px solid #334155`, text `#f8fafc`.
- Monospace mode available for cron scheduling inputs, regex filters, phone numbers, and webhook paths.
- Active focus state: cyan hairline border (`#06b6d4`) with subtle outer aura.
- Help text and error messages placed strictly below inputs with `body-sm`.

### Data Tables & Lists
- Fixed-width column headers with sorting markers, text in `label-ui` uppercase slate-400.
- Alternating or bordered rows with `1px solid #1e293b`.
- Row hover transitions instantly to background `#1e293b` (cursor pointer for selectable rows).
- Quick inline actions (e.g., trigger now, toggle pause, inspect payload) revealed on hover or right-pinned.

### Cards & Metrics (Homelab Stats)
- Metric cards display total contacts, scheduled queue count, failed webhooks, and gateway latency.
- Value set in `headline-lg` Inter semi-bold; label set in `label-ui` slate-400 above value.
- Bottom card divider houses miniature sparkline or `JetBrains Mono` health metric (`p99: 42ms`).

### Cron & Schedule Builder
- Specialized component pairing standard natural language presets (`A cada hora`, `Diário às 03:00`) with a synchronized raw cron string input (`0 3 * * *`).
- Inline validator badge indicates next 3 execution timestamps in local time (pt-BR).