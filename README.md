# Piste: 3D foil fencing trainer

An offline training room for 100 foil techniques, their counters, and right of way. Learn includes 3D playback, frame stepping, four slow-motion speeds, camera presets, coaching, overlays and device-local progress. Counter Explorer supplies contextual attack/counter demonstrations. Fencing offers blind Phrase choices or live Tempo inputs against a person or four NPC levels. Four drills include an ordered Build It sequence builder.

## Install, develop, preview and rebuild

Use Node 20+ and run commands from the repository root:

```sh
npm ci
npm run dev
```

```sh
npm run build
npm run preview
```

`dist/index.html` and the complete `dist/assets/` directory are the ready-to-serve static export. Keep the favicon and social image alongside them. Vite uses `base: './'`; routing uses hashes, so hosting under a gateway subpath requires no route rewrites. The application needs no server, credentials, fonts from a CDN, wallet, or runtime internet access. Build dependencies and browser-test downloads are development tools and are not part of the export.

The accepted application source remains in `web/src/`. Root `package.json`, `index.html`, `vite.config.ts` and `tsconfig.json` provide the root install/build contract without relocating that source. Use the root commands above.

## Controls

- Learn: play/pause, frame back/forward, 0.1×/0.25×/0.5×/1×, looping and the timeline. Drag to orbit; use camera presets or overlays to inspect contact. Mark a technique learned and rate it from 1–5.
- Phrase Mode: select footwork, blade action, or both, choose reaction timing, then lock in. Human hot-seat hides the first selection behind a pass-device screen.
- Tempo Mode: A/D retreat/advance; Space lunge; Shift+Space flèche; Q/E/Z/C quarte/sixte/septime/octave; hold R for the corresponding circular parry; 1–9 use the configured quick slots. Keys can be changed in Settings. The touch pads stay live during motion; expand All legal actions to combine any currently legal footwork and blade choice.
- Human Tempo: both fencers have their own live pad. Keyboard fencer selects which person the shortcuts control. No NPC runs in Human mode.
- Build It: select individual preparation and finishing cards, reorder or remove them, then Submit sequence. The stage plays the submitted sequence against the described partner, including incorrect choices.
- After a phrase: inspect the scoring box and Why?, scrub the action tracks, save it, or replay it from the Phrase Library. Tempo saves retain input timestamps.

Progress, settings and saved phrases belong to this browser's local storage. They are not shared with another person or synchronized across devices. Reset progress removes that browser's records.

## Architecture

```text
root index.html + Vite (relative assets, hash routes)
                     |
web/src/app -------- React mode shell -------- store (Zustand/localStorage)
                     |
data/techniques -> anim/clips -> rig/skeleton + IK
                     |                 |
sim/phrase (blind slices)     sim/tempo (live 120 Hz inputs)
                     |                 |
                 actual geometry + scoring box
                             |
                     referee/row + explain
                             |
                 PhraseResult -> Player -> 3D Stage + HUD
```

Simulation runs at 120 Hz, independently of the renderer. Intention and deception rules propose events; contact-frame IK makes physical contacts; hit detection checks the animated target, direction, sustained load and 300 ms lockout. Only registered scoring-box contacts become referee hit events. Successful parries carry the shared, physically verified blade contact point used by the event timeline and blade-zone overlay.

`referee/row.ts` walks priority events for attacks, preparation, established line, successful blade actions, parries, ripostes, renewals and counterattacks. It then decides from the registered lamps, including the single-valid-light rule and the off-target-priority exception. Both entire feet must clear the same end boundary for a penalty.

Tempo uses the same authored clips, geometry, parry resolver, legality and referee. It advances incrementally, timestamps accepted actions at their press tick, and leaves footwork moving when a blade action starts. NPC responses begin after their sampled difficulty-specific reaction delay. Timestamped inputs replay deterministically.

## Data and extensions

Edit `web/src/data/techniques.ts` for coaching, simulation specifications, clip references and counter links. IDs are the canonical FW/PA/AT/BL/RR/CT IDs. Counter reciprocity is built from `counteredBy`; every link must resolve. Add authored footwork in `web/src/anim/clips.ts` and weapon poses in `web/src/anim/poses.ts` when an action needs a new clip. `modes/demo.ts` supplies its tactical setup; `counterScenario()` supplies contextual counter setups. Run the data validator and tests after changes, then regenerate `TECHNIQUES.md` with `npm run docs`.

The supplied catalogue is fixed at 100 techniques: extending that count also requires an intentional change to the canonical-ID validator and its coverage. New scoring behaviors need geometry and referee regression cases, rather than only text changes.

## Validation

```sh
npm test
npm run typecheck
npm run validate:data
npm run lint
npm run docs
npm run build
npx playwright install chromium
npm run check:browser
```

The revision passed **226 tests in six suites**, strict typecheck, data validation for all 100 IDs and 6,000 sampled poses, and production build. Lint exited successfully with three inherited unused-disable warnings. Chromium passed the production interaction checks, including nine mobile/desktop playback width cases, contextual counters, learned progress, real-time Tempo, Human control, saved replay, keyboard focus and offline resources. A separate Build It browser check passed selection, reorder, submit, playback and 390px containment.

The pinned design probe passed 14/16 checks. Its two remaining reports are the Home navigation link being mistaken for a heading kicker and the accepted five-weight typography hierarchy; the revision preserves that design. [VALIDATION.md](VALIDATION.md) records reproduction evidence, six-domain design coverage, exact scope and limitations. [.imd-responses.json](.imd-responses.json) answers all 12 reviewer findings. [DESIGN.md](DESIGN.md) describes the implemented visual system.

WebKit was downloaded but could not launch because the machine lacks its host libraries. Physical-device Safari, screen-reader use, native browser zoom and reference-hardware 60 fps performance were not verified. The checks are regression evidence, not a certification of fencing instruction or every possible tactical matchup; the app retains its coach-replacement notice.
