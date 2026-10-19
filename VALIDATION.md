# Revision validation

Date: 2026-10-19. Scope: the nine reopened high-severity findings and three advisory findings. All twelve reproduced and received targeted fixes; exact IDs and responses are in `.imd-responses.json`. The accepted application and visual direction were retained.

## Build and test results

The build prompt was successfully downloaded from the supplied raw GitHub URL before editing, and all 100 canonical Section 6 IDs were printed. Root tooling missing from the supplied tree was restored around the existing `web/src/` source. Dependencies and caches were kept in an isolated temporary mirror, outside the submission; commands below ran against copies of the delivered root configuration and source. The resulting `dist/`, root lockfile and generated technique reference were copied back. No dependency directories or archives are delivered.

| Command | Actual result |
| --- | --- |
| `npm ci` | Passed; 283 development/runtime packages installed in the temporary mirror |
| `npm run build` | Passed, Vite 5.4.21; 659 modules; `dist/index.html`, local assets, favicon and social image produced |
| `npm test` | 6 suites, **226 tests passed**, zero failures; final full run took 6.75 s |
| `npm run typecheck` | Passed, strict TypeScript, `tsc --noEmit` |
| `npm run validate:data` | Passed: exactly 100 canonical IDs, content, reciprocal counters, resolved prerequisites/partners, clips, arm-before-foot markers, and 6,000 sampled poses |
| `npm run lint` | Exit 0: no errors; 3 inherited unused-disable warnings in Bench, Drills and Learn |
| `npm run docs` | Passed; generated root `TECHNIQUES.md` from all 100 technique records |
| `npm run check:browser` | All 11 Chromium production interaction groups passed under a local `/preview/` subpath; results below |
| Pinned `taste.mjs --out test/scratch/taste` | Completed on the production export: **14/16** checks passed; two retained observations explained below |

The data validator samples knees, weapon elbow, forearm twist and finite joint/blade coordinates. It does not infer every anatomical rotation from positions or certify every entry in the joint-limit reference.

Test breakdown: 45 engine regression tests, 32 referee event scenarios, 11 incremental Tempo tests, 16 counter/Build It tests, 101 all-demonstration/determinism tests, and 21 lunge/coaching tests. The all-demonstration suite checks actual contact geometry, ≤60° impact, sustained load, ≤2 cm intended-point agreement and scoring/referee agreement for contacts that occur. Determinism is checked with uncached scripted rebuilds, not only by retrieving the same cached object.

## Reproductions and fixes

| Finding | Baseline reproduction | Implemented correction and recheck |
| --- | --- | --- |
| Phone overflow | Chromium Home 320→332px; Lunge and Disengage 390→425px | `web/src/ui/ui.module.css:71`, `:105`, Home's grid children: allow shrinking, constrain/wrap segmented controls. All nine Home/Lunge/Disengage combinations at 320/390/1440 now have document width equal to viewport; every speed button is contained. |
| Rejected hit awarded | Original BL14, 2.00m left-hander: scorer left, red false/green true, only right registered at 56 | `web/src/sim/phrase.ts:679`: replace intention hit events with registered, lockout-filtered events for referee and timeline. `referee/row.ts:175` gives actual rule-10 single-light reasoning. Controlled rejected-left-contact regression awards only right. |
| Separated parry blades | Default PA01/02/04 at tick 45: minimum sampled axis gaps 0.197386/0.461654/0.477224m | `web/src/sim/geometry.ts:96`, `sim/phrase.ts:460`: reachable IK for both blades, common point verified before success. Current gaps are approximately zero. All 20 parries in 5 height/handedness configurations verify each blade within 1mm of the recorded point and both arms reachable. The same point appears in the parry event and blade-zone overlay (`ui/Stage.tsx:325`). |
| Tempo input lost | Chromium D hides pad; immediate Q stays in resolving slice. Source substitutes Club for Human. | `web/src/sim/tempo.ts:101`, `modes/Fencing.tsx:314`: incremental 120 Hz clock, press-time input records, separate foot/blade channels, live pads, difficulty-based reaction deadlines and Human controls. Unit tests cover each NPC range/exact deadline. Chromium accepted advance, parry and retreat during the same advance, saved timestamps and replayed them. |
| Build It not assembled | Original branch presents four complete sentence answers and uses `demoFor(good.id)` | `web/src/modes/Drills.tsx:159`, `:236`, `modes/buildSequence.ts:35`: individual cards, ordered state, reorder/remove, submit-only grading; play selected preparation and finish versus stated partner. Chromium selected finish first, moved Advance earlier, submitted, received Correct and a red lamp; 390px layout contained. Wrong choices execute their actual actions in unit tests. |
| Reliable counters fail | Headless original FW04/PA01 and AT06/PA03: scorer left, wrong-line notes | `web/src/modes/demo.ts:119`: contextual line/measure/timing setup and prerequisite parry/riposte slices, with setup captions. Both reported pairs now have verified green parries/ripostes and scorer right. Tests also cover low-out counters, short-lunge/direct-riposte, full counter-riposte chain and unlisted wrong-line pairs. |
| Bent rear leg | Original FW04 tick48: rear flex 39.512292°, front knee/ankle x mismatch 56.796mm; FW13 tick77 repeats | `web/src/anim/poses.ts:88`, `anim/clips.ts:54`: solve pelvis position/height against existing rig IK; full position at heel landing. Lunge and advance-lunge across 1.55/1.78/2.00m and both handedness values have rear knee <1°, front x/z mismatch <1mm, 3D shin tilt <0.2°, rear foot flat and lean ≤15°. |
| Low circle catches high thrust | Original `parryOutcome(AT02, PA11/PA12)` returns parried despite high-out versus low endings | `web/src/sim/phrase.ts:144`: require the ending line for straight attacks. Both now return wrongLine; unlisted AT02/PA11 remains a valid original attack, while disengage/doublé deception rules stay separately tested. |
| One-foot end penalty | Original end-line tick52: rear heel -7.12m, front heel -6.65m, penalty awarded | `web/src/sim/geometry.ts:149`, `sim/phrase.ts:581`: both full heel/toe extents must clear the same end. Reported setup has no penalty. Repeated retreats penalize at the first actual crossing (141); preceding tick 140 still has a foot on piste. Both end directions are tested. |
| Dérobement opposite coaching | Original rendered tactical text instructs forte-on-faible control | `web/src/data/techniques.ts:470`: derobe-specific instruction teaches finger evasion while maintaining the straight threatening arm. Chromium and content regression verify it. |
| Coaching step too early | Original Sixte tick36 highlights “Riposte from where the parry ends” before contact45 | `web/src/modes/coaching.ts:9`, `Learn.tsx:129`: authored phases/markers plus whole-demo events define cue ranges. Chromium sees a parry instruction at36 and riposte at actual start51. Direct-riposte cues retain the prerequisite parry. |
| Lamp text contrast | Rendered original Left: white, 13px, background rgb(229,72,77); 3.914:1. Green white pair: 3.157:1 | `web/src/ui/ui.module.css:283`, `:289`: use the existing dark on-accent token. Rendered labels measure red **4.751:1**, green **5.890:1** at 13px. Optional shape labels inherit the corrected foreground. |

The lunge correction changes the geometry of the reported BL14 configuration: it now legitimately registers both left/right contacts at ticks 54/56 and awards the established left line. It would be incorrect to force right to win when both contacts are now physically valid. The rejected-contact regression deliberately removes the claimed left contact's animated IK and confirms that right alone wins under rule 10, regardless of the surviving intention-level claim.

Additional parameter checks passed 72 correct Build It sequences (six partner parries × two available reliable finishes × three heights × two hands), and 18 reported counter examples across three heights and both hands. These are scoped matrices, not every possible graph edge or relative fencer configuration.

## Production browser interactions

The delivered browser runner serves `dist/` under `/preview/`, owns and closes its server/browser, and writes disposable evidence only to `test/scratch/browser/`. No persistent preview server is required. Playwright Chromium ran against the actual static export, with remote requests blocked.

- Home, Lunge and Disengage at 320/390/1440: exact document widths matched; scene, scrubber and all four speeds stayed contained. The fresh 390px first screen shows Piste, the training description, Start learning and Fence a bout above the scene.
- Learn: paused/scrubbed Sixte at 36/45/51; checked the synchronized instruction, corrected Dérobement note, mark learned/rating persistence after reload, French-name search, empty state and Clear filters.
- Counter Explorer: FW04/PA01 and AT06/PA03 finish with green lamps and the appropriate defender call, without wrong-line explanations. Measured both lit label foreground/background pairs.
- Build It: selected a finishing card before Advance, confirmed the round remained ungraded, reordered Advance first, submitted, scrubbed to the end, observed red and Correct, and checked containment at 390px. Separate isolated validation also checked Next round and locked submitted controls.
- Tempo: D→Q→A inputs remain accepted with the pad visible; timestamp gaps are below one advance's 36 ticks. Saved inputs replay. Human exposes both pads; a left action, right action and right-keyboard action produce exactly those three human records, with no generated NPC. Expanded All legal actions selects fit at 390px.
- Focus: keyboard navigation reaches Start learning with a visible computed 2px solid focus outline; the focused state was captured and inspected. Native buttons/labels are used in the revised interactions.
- Reduced motion: rendered the 390px Home with the preference enabled. This verifies rendering and CSS preference handling, not every 3D animation state.
- No console/page errors, missing local resources or remote runtime requests occurred in the consolidated production flows. Supplemental route-level checks covered library, counters, fence setup, drills, settings, lab and bench at 320/390/1440 with no horizontal document overflow.

## Better Interface review

The pinned workflow and all six domain cores were read before corrections. The review uses the accepted training-room direction rather than introducing a new design system. Source findings, browser measurements and coverage are distinguished below.

| Domain | Coverage and result | Limitation |
| --- | --- | --- |
| Accessibility | Native action buttons, labelled pads/selects, ordered sequence, `aria-pressed`, selected coaching step, visible keyboard focus, 36–44px controls, reduced-motion CSS. Corrected lit labels. | No screen-reader session, forced-colors session or physical touch device. No claim of complete accessibility compliance. |
| Layout | Shared shrink/wrap fix at `ui.module.css:71`/`:105`; real width and button-box checks; mobile and desktop screenshots inspected. First screen action remains visible. | Native 200% browser zoom and RTL mirroring not performed. Product is English with French technique terminology. |
| Writing | Corrected derobe coaching at `techniques.ts:470`; explicit sequence instructions, Submit and reorder actions; accurate live Tempo/Human wording and single-light explanation. | No professional fencing-coach editorial certification. |
| Typography | Six implemented size tokens, system font, readable wrapped coaching and action labels. Existing type hierarchy retained. | Five requested weights exceed the probe's three-weight house bar; this is the accepted source's existing hierarchy. System font faces are platform-dependent. |
| Colors | Semantic palette reused; actual red/green 13px lit pairs measured and repaired to 4.751/5.890:1. Probe's measured Home text passes. | This does not measure every 3D material, translucent overlay or possible focused background. Only the required dark theme exists. |
| UI | Live Tempo controls, sequence edit/submit states, disabled submitted cards, replay, empty search state, native focus and existing hover/active behavior reviewed. No new animation system or decoration introduced. | No 10%-speed browser Animations-panel audit of every state; reference-hardware GPU performance not measured. |

Final `DESIGN.md` records the actual colors, six sizes, weights, spacing, radii, component sources, shrink behavior and responsive breakpoints after the fixes. Design attribution/licenses are retained in `docs/design-guidance-licenses.txt`.

The pinned production probe passes render, layout, targets, contrast, casing, tracking, type sizes, glyphs, slogans, repetition, copy budget, chrome, motion and share metadata. Its two remaining reports were reviewed:

1. **Eyebrows:** `web/src/app/App.tsx:18` supplies the normal Home navigation link. The probe mistakes it for a kicker because it appears above the first heading at 390px. The screenshot confirms a conventional navigation row, not an editorial label. No change.
2. **Type faces/weights:** `web/src/app/App.module.css:22`, `ui/ui.module.css:32`/`:210` and the inherited heading defaults request 400/600/650/700/750. This measurement is real, but the request says to leave accepted work outside the findings alone. The hierarchy is readable in the rendered screens; no weight redesign was made.

## Limits and remaining observations

WebKit installation succeeded, but launch failed because host libraries (including GTK4, GStreamer and related rendering libraries) are missing. WebKit/Safari behavior was not tested and is not marked passed. Chromium viewport emulation does not establish physical iPhone behavior. No reference-machine 60fps benchmark, native browser zoom, screen reader or every-mode keyboard-only walk was completed.

The counter graph contains contextual and conditional relationships. The revision validates the reported pairs and prerequisite sequences, not every reliability tag under arbitrary timing/measure. The unchanged default demo scripts for FW14, FW24, AT07, AT16, RR07 and RR08 currently produce no left light at their default setup; AT17 deliberately stops short, and CT01's default demonstration lights the partner. Those setups were not reauthored as part of these findings. The all-100 test asserts that contacts actually claimed/registered are true, and must not be read as proving every offensive default demonstration scores.

No local evidence establishes FIE certification or replacement of a coach. The existing in-app training-visualization note remains visible. Hosting/publication is outside this delivery; `dist/` is the complete static artifact.

## Submission integrity

The delivered files total approximately 1.95 MB before compression, below the 8 MiB submission budget. The byte audit excludes only machine/input metadata and the disposable `test/scratch/` directory. No ignore file was added or changed. No dependency/cache directories, registry mirrors, dependency archives, symlinks or submodules are included. Old generated chunks were removed before copying the final export.

The root lockfile matches both dependency maps in `package.json`. `dist/index.html` has title, description, favicon and Open Graph title/image metadata, and its script/style/favicon references are local relative paths. All referenced files exist; the complete export matches the last successful build byte for byte. `TECHNIQUES.md` was generated from the same final data. All 12 response IDs are unique valid finding IDs with nonempty details.
