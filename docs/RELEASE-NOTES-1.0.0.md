# Pionier 1.0.0 — Release notes (proposed)

**Status:** Proposed draft for a future 1.0.0 release. **This does not state that 1.0.0 has been released or published.** Final release remains subject to completion of required version/cache transition, deployment, live verification, and unresolved release gates.

## What Pionier is

Pionier is a browser-based, touch-responsive musical instrument for playing and creating with resonant, procedurally synthesized sounds. It is designed for local-first play and creation in the browser (subject to actual implementation and documented behavior).

- **Canonical production URL:** https://ivarkarm-web.github.io/handpan-app/
- **Support:** Instagram [@ivar.karm](https://www.instagram.com/ivar.karm/)
- **Optional voluntary support:** https://busk.co/84950/tip (tip link; voluntary)

## Product commitments

- **Free to use.**
- **No advertising.**
- **No subscription.**
- **No account requirement.**
- **No analytics or tracking** (as stated by the app’s current storage/privacy notice and implementation).
- **Local-first storage and processing,** subject to actual implementation and existing privacy documentation (see [PRIVACY.md](./PRIVACY.md)).

## Shipped features (existing)

- **Synthesized handpan experience:** playable handpan voice generated locally with the Web Audio API (no shipped handpan note-sample pack).
- **Instruments and scales:** selectable instrument voices, musical scales, base/root note selection, and note-count options as provided in the app.
- **TonePad / sequence:** a pattern/sequencing surface for building backing parts alongside live play.
- **Seven-layer looper:** record and layer loops (up to seven layers), synchronized to the first recorded layer.
- **Effects and ambience:** built-in effects controls and procedurally generated nature ambience beds.
- **My Library and WAV export:** save compositions locally on the device (browser storage/IndexedDB), reopen/play recordings, rename/delete items, and export WAV backups.
- **Offline/PWA capabilities (qualified):** installable web app with a service worker and cached app shell intended to support loading after a prior online visit; install/offline behavior depends on browser/device and requires device verification.

## Known limitations

- **Android physical-device testing not completed:** Android has **not** been physically tested or passed for this release baseline. The owner accepts this as a documented launch limitation; it must not be described as tested, verified, or passed.
- **iOS/device verification incomplete:** real-device iOS Safari hard-gate sign-off is **not** complete. Existing iPhone evidence includes owner-reported results (not all independently verified) with unrecorded device/OS/browser/date details for some sessions; unresolved checklist items remain.
- **PWA/offline, My Library, and WAV (device):** manual offline/PWA behavior, browser storage persistence/eviction, My Library save/reload, and WAV export/reopen in an external player require real-device verification and are not fully evidenced.
- **Looper project editing:** saved looper projects do not yet reopen for layer editing. Export a WAV backup to keep a durable copy outside the browser.
- **Browser storage is best-effort:** preferences, cached resources, and saved library data are stored locally in the browser and may be removed if site/browser data is cleared or reclaimed by the browser/OS.
- **Accessibility/performance on devices:** automated checks do not substitute for device/runtime verification (including assistive technology and longer-session behavior).

## Privacy and data

See [PRIVACY.md](./PRIVACY.md) for local storage, cache, IndexedDB, and external-content distinctions. Pionier does not require an account for local use.

## Audio and licensing

Audio-rights and provenance information is recorded in [AUDIO-LICENSES.md](./AUDIO-LICENSES.md), including an owner declaration of rights (not independent legal verification).

## Rollback

A proposed (not yet tested) rollback procedure is documented in [ROLLBACK.md](./ROLLBACK.md).
