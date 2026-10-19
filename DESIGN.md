# Implemented design

## Overview

Piste is a dense training room for intermediate and advanced foil fencers. The established dark arena, neutral panels, red/green fencer identities and gold primary action remain intact. Home places the product, Start learning and Fence a bout before the 3D demonstration. Technique pages put playback and coaching side by side on desktop and in reading order on narrow screens.

The source of truth is `web/src/app/global.css`, `web/src/ui/ui.module.css`, `web/src/app/App.module.css`, and `web/src/modes/Home.module.css`. The revision corrects shrink behavior and scoring-label contrast without replacing this system.

## Colors

Components reference the semantic properties in `global.css`:

| Token | Value | Use |
| --- | --- | --- |
| `--color-bg` | `#111317` | Page, inputs and dark foreground on solid accent fills |
| `--color-surface` | `#171a1f` | Header and panels |
| `--color-surface-raised` | `#1d2027` | Buttons, mode cards and inactive lamps |
| `--color-surface-hover` | `#252932` | Hover/selected surfaces |
| `--color-border` | `#343a46` | Structural and selected control boundaries |
| `--color-text` | `#eef0f3` | Primary text |
| `--color-text-secondary` | `#a3abb8` | Supporting content and inactive labels |
| `--color-left` / `--color-left-text` | `#e5484d` / `#ff8589` | Red fencer lamps and readable identity text |
| `--color-right` / `--color-right-text` | `#30a46c` / `#5bd697` | Green fencer lamps and readable identity text |
| `--color-accent` / `--color-accent-text` | `#f0b429` / `#ffd98a` | Filled primary action and links/active coaching |
| `--color-on-accent` | `#111317` | Text on gold, lit red and lit green fills |
| `--color-focus` | `#8fb0ff` | Keyboard outline |

The white lamp uses `#f4f4f4` with `#111` foreground. Stage background is `#15171c`. Only the dark theme exists. Rendered 13px lit lamp labels measured 4.751:1 (red) and 5.890:1 (green) after the revision; these figures apply to those pairs, not every color in a 3D scene. Lamp text and optional shape icons supplement hue.

## Typography

The family is `system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`; no fonts are downloaded. The six CSS size tokens are 13, 15, 17, 20, 26 and 34px at the default 16px root: `--fs-xs`, `--fs-sm`, `--fs-md`, `--fs-lg`, `--fs-xl`, `--fs-2xl`. Body and normal controls use 15px; input text uses 17px; page headings use 26px; section headings 20px. Home uses 34px on desktop and 26px below 480px.

The accepted source requests weights 400, 600, 650, 700 and 750. Buttons use 600, cards/active coaching 650, headings the browser's bold weight, and the brand 750. System font availability determines the exact rendered face/weight. There are no packaged font files. Body line-height is 1.5; headings use 1.15 and balanced wrapping. Paragraphs use pretty wrapping. Leads have a 62ch maximum, Home supporting text 46ch. Only the Home title tightens spacing to -0.02em. Dense captions and segmented controls use 13px.

## Layout

Spacing tokens are 4, 8, 12, 16, 24, 32 and 48px (`--space-1` through `--space-7`). `.page` is at most 1240px wide with 16px padding and 24px group gaps. `.panel` uses 16px padding, 12px internal gaps and start alignment. `.row` wraps at 8px gaps. Shared grid/flex children explicitly allow `min-width: 0`; segmented controls cap at 100% and wrap their buttons rather than expanding the page.

`.split` has one flexible column until 960px, then a 1.6:1 split with a 320px minimum coaching column. The library auto-fills 220px cards. Home mode cards auto-fill at 210px; its hero becomes a 1:1.4 split at 900px. Header navigation becomes a separate wrapping row below 720px, with 36px-tall links and 13px labels. The desktop header uses 40px links. The footer remains in normal flow; the header is sticky.

The training stage is 16:9, at least 220px high, and clips the canvas within rounded corners. The Home stage is 16:10, changing to 16:11 below 480px. Touch gestures orbit the scene; HTML playback controls remain outside it. At 320, 390 and 1440px, rendered Home, Lunge and Disengage fit the viewport with all four speed buttons contained. Route-level checks also found no horizontal document overflow in library, counters, fencing setup, drills, settings, lab and bench at those widths. Expanded Human Tempo pads and Build It remain in the same shared layout.

## Elevation & Depth

Tonal surfaces group content. Buttons use 1px borders; selected cards/controls use gold boundaries. Selected segmented buttons have an inset 1px accent line. Glows are reserved for illuminated scoring lamps. `--shadow-raised` defines layered dark shadows but is not a reason to add shadows to every panel. The arena uses its own 3D lighting and shadows. The pass-device interstitial covers the viewport at z-index 20; header is 10 and the visible skip link is 30.

## Shapes

Radius tokens are 8px for controls, 12px for cards, and 16px for panels/stages. Chips and badges use pill radii; category icon wells are 36px square with 10px corners. Progress rings are SVG. Image/stage clipping belongs to those surfaces; no whole-page overflow clipping masks layout defects.

## Components

- `ui/components.tsx`: `Segmented` exposes native buttons with `aria-pressed` inside a named group. Use it for mutually exclusive choices and playback speed. `.seg` wraps at the available width.
- `Transport`: Play/Pause, frame stepping, four speeds, Loop, and a named native range scrubber. Phase/sync markers accompany the timeline. It drives `ui/player.ts`; the scene consumes the same tick.
- `CameraBar`, `OverlayToggles`, `TechniqueCard`, `Lamps`, `RefereeCall` and `PhraseTimeline`: reuse these instead of drawing separate mode-specific controls. Lamps announce a scoring-box label. Why? exposes the referee explanation.
- `.btn` / `.primary` / `.small` / `.iconBtn` in `ui.module.css`: normal buttons are at least 44px tall; compact variants and segmented buttons are 36px. Hover changes surface tone, active press scales to 0.96, disabled dims to 55%. Primary gold fill uses dark text.
- `modes/Drills.tsx`: Build It uses an ordered list, individual action buttons, native reorder/remove controls and a separate Submit sequence button. Selected cards are disabled in the available list; submission locks the answer and presents feedback with Next round. Empty selection explains what to do next.
- `modes/Fencing.tsx`: live `TempoPad` sections are named for each fencer. Human mode shows both and a Keyboard fencer selector. Every pad has shortcuts plus a disclosure for all legal action choices; unavailable actions are disabled. Halt phrase ends the exchange explicitly.

The global `:focus-visible` indicator is a 2px blue solid outline, offset 2px. The skip link becomes visible on focus; navigation uses anchors, actions buttons, and settings native labelled inputs. Browser verification saw the focused Start learning ring. No custom font or icon package is required; category/brand marks are inline SVG. Library has clear-filter/empty states; unknown technique IDs have a library recovery link. Reduced-motion CSS shortens transitions; Settings also controls camera easing and cuts. Stage playback still provides its visible pause control.

## Do's and Don'ts

- Start another mode with `.page`, `.panel`, `.row` and `.split`; retain shrinkable children and wrapping controls.
- Use the existing six type tokens, spacing tokens and semantic colors. Red/green identify physical fencers; gold emphasizes the primary action and current instruction.
- Keep control labels in normal case. Put keyboard/touch directions beside the controls.
- Keep scene data, coaching, lamps and replay on the same simulation result. Only verified contact may imply a touch.
- Preserve keyboard names, focus visibility and native input behavior when extending the pads or sequence builder.
- Recheck the export under a static subpath and at 320/390/1440px. Device-native Safari, screen-reader behavior, native zoom and performance need their own validation; a screenshot cannot establish them.

Design guidance attribution: Better Interface by Jakub Krehel (MIT), and documentation guidance adapted from Paul Bakaus's Impeccable (Apache-2.0). See `docs/design-guidance-licenses.txt` for retained licenses.

This document was cross-checked against the final production source and rendered Home, Learn (including the corrected full lunge), Build It and focus states; broader verification limits remain in `VALIDATION.md`.
