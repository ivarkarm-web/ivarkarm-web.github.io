# Pionier Quality Scorecard

**Last updated:** 2026-10-26  
**Build under audit:** `APP_VERSION 168` / `pionier-v168`  
**Scope:** `handpan-app/`, its test/CI surface, and the release-readiness branch.

This scorecard reports measurements and verification state. A subjective readiness score is withheld until CI, device testing, and sample-rights checks are complete.

## Measured facts

| Metric | Measurement | Method / scope |
|---|---:|---|
| Consolidated CSS source | 327,782 bytes | Sum of the four linked stylesheets on `main` (raw UTF-8, not minified) |
| Optimized linked CSS (CI) | **246,589 bytes** | PurgeCSS + esbuild minify in workspace (`npm run optimize:handpan-css`); 24.8% smaller than source |
| CSS delivery budget | 250,000 bytes | Hard CI ceiling for the four linked stylesheets after optimize |
| CSS headroom | **3,411 bytes** under budget | Next feature risk: very little margin; target ideally under 200 KB after further source prune |
| `!important` declarations | ~3,036 (prior branch count) | Source text count across consolidated CSS; pruning still open |
| JavaScript bundle bytes | Not measured this pass | Vite app build must pass before reporting a number |
| iOS Safari checks | Pending | Real iPhone/iPad checklist not signed for v168 |
| Android Chrome checks | Pending | Real Android device checklist not signed |
| VoiceOver / TalkBack | Pending | Assistive technology not exercised on devices in this session |
| Sample commercial rights | Pending | Not established by automated tests |

## Release gates

- [ ] CI green on the exact release commit, including CSS budget under 250,000 bytes (ideally moving toward under 200 KB).
- [ ] Looper toolbar visually verified on a real phone.
- [ ] AudioWorklet-unavailable behavior tested where Worklet is missing.
- [ ] iOS Safari checklist signed for shipping `APP_VERSION` 168.
- [ ] Android Chrome quick pass completed.
- [ ] VoiceOver / TalkBack main flows reviewed (play surface, scale/instrument, looper, sequence if unhidden).
- [ ] Sample rights verified for any commercial claims.
- [ ] Multitrack step sequencer (grid) real-device timing, level, and a11y pass before product unhide.

## Scoring policy

No numeric reliability, UX, accessibility, performance, or production-readiness scores are published here until the corresponding measurements and release gates above have evidence. CI passing alone does not establish real-device readiness.

## Change log

- **2026-10-26 (v168):** APP_VERSION / cache aligned to 168; scorecard records optimized CSS **246,589 / 250,000** bytes and thin headroom; Learn-mode product claims removed from audit narrative; VoiceOver and sequencer device gates listed explicitly.
- **2026-10-25 (v167 readiness branch):** Measured-only scorecard; withheld subjective scores; CSS budget gate proposed.
