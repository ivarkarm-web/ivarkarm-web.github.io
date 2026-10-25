# Pionier Quality Scorecard

**Last updated:** 2026-10-25  
**Build under audit:** `APP_VERSION 167` / `pionier-v167`  
**Scope:** `handpan-app/`, its test/CI surface, and the proposed release-readiness branch.

This scorecard reports measurements and verification state only. A subjective readiness score is intentionally withheld until CI, device testing, and sample-rights checks are complete.

## Measured facts

| Metric | Measurement | Method / scope |
|---|---:|---|
| Consolidated CSS source | 327,836 bytes | Sum of the four source CSS files from GitHub file metadata; raw, not minified |
| `!important` declarations | 3,029 occurrences | Source text count across the four consolidated CSS files |
| CSS delivery budget | 250,000 bytes | Proposed hard ceiling for the minified Vite CSS bundle; pending successful CI measurement |
| JavaScript bundle bytes | Not measured | Vite app build must pass before reporting a number |
| iOS Safari checks | Pending | Real iPhone/iPad checklist not signed |
| Android Chrome checks | Pending | Real Android device checklist not signed |
| VoiceOver / TalkBack | Pending | Assistive technology not exercised on devices |
| Sample commercial rights | Pending | Not established by automated tests |

## Release gates

- [ ] CI green on the exact release commit, including Vite build and CSS budget.
- [ ] Looper toolbar visually verified on a real phone; update the test only after confirming the layout.
- [ ] AudioWorklet-unavailable behavior tested in a browser without AudioWorklet.
- [ ] iOS Safari checklist signed for the exact shipping `APP_VERSION`.
- [ ] Android Chrome quick pass completed.
- [ ] VoiceOver / TalkBack main flows reviewed.
- [ ] Sample rights verified for any commercial claims.

## Scoring policy

No numeric reliability, UX, accessibility, performance, or production-readiness scores are published here until the corresponding measurements and release gates above have evidence. CI passing alone does not establish real-device readiness.
