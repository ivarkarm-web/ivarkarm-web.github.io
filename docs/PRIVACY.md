# Pionier — Privacy and local data

**Canonical production URL:** https://ivarkarm-web.github.io/handpan-app/
**Support:** Instagram [@ivar.karm](https://www.instagram.com/ivar.karm/) · **Optional voluntary support:** https://busk.co/84950/tip

This document describes Pionier’s local-first data behavior as supported by the current implementation and existing in-app/documentation statements. It is not a legal guarantee and does not promise absolute privacy or security.

## Core commitments (as implemented/documented)

- **No Pionier account is required** to use the app.
- **No advertising.**
- **No subscription.**
- **No analytics or tracking** are stated to be used by the app (consistent with the in-app storage notice).

## Local storage and processing

Pionier is designed to work with data stored and processed locally in your browser/device, subject to browser behavior and the actual implementation:

- **Local storage:** may store app preferences/settings on this device (for example instrument, settings, or pattern-related preferences), as supported by the implementation.
- **Cache Storage / browser cache:** the service worker and browser may cache app resources to help Pionier load faster and, after a prior successful online load, may help the app shell open offline (device/browser dependent).
- **IndexedDB:** saved library content (such as looper compositions/recordings managed by My Library) is stored locally in the browser’s database on this device, as supported by the implementation.

Audio playback and synthesis run in the browser (Web Audio). Processing and storage described above are local to the device/browser unless explicitly stated otherwise.

## User-created local content

- **Not uploaded to a Pionier account or remote profile:** based on current implementation and documentation, user-created recordings/library content are kept locally on the device and are not uploaded to a Pionier account or remote profile by the app.
- **Exports:** if you choose to export a WAV (or other file), that export is created for you to save/share using your device/browser; handling after export is outside Pionier’s control.

## Clearing data, persistence, and browser eviction

- **Clearing browser/site data** may reset preferences, remove cached resources, and/or remove saved library data (including recordings).
- **Browser storage is best-effort:** browsers/operating systems may limit, evict, or fail to persist stored data (including IndexedDB/Cache Storage) due to storage pressure, settings, private modes, or platform policies. Persistence is not guaranteed.
- **Recommendation:** export important recordings (e.g. WAV backups) to keep durable copies outside the browser.

## External services and streams (distinguished from Pionier’s own storage)

- Pionier’s own preferences, cache, and library data described above are stored locally by the browser as noted. **External websites, streams, or services** are separate from Pionier’s local storage and processing.
- Any externally hosted/streamed material (where applicable) is delivered by its source provider under that provider’s behavior/terms and is **not** the same as Pionier’s bundled app shell or local library storage. The app’s current documentation states that externally streamed content (such as Bedroom Sessions, where referenced) is not bundled in the Pionier app repository/service-worker shell.
- Opening external links (e.g. support or voluntary tip links) is subject to those third-party sites.

## Limitations

This document reflects current, implementation-supported behavior and existing notices. It does not cover every possible browser/device configuration, does not guarantee data retention, offline availability, or security, and should be read together with [RELEASE-NOTES-1.0.0.md](./RELEASE-NOTES-1.0.0.md) (known limitations) and in-app notices.
