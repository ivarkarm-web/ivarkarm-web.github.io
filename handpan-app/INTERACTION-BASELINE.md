# Pionier interaction baseline and regression checklist

## Baseline captured

- Baseline branch: `main`
- Baseline head observed: `eb1230d32eaa1889dde57d0b85a60a3bba1fa8bc` ("Refresh touch response build")
- Runtime engine currently pinned by `pionier-app.js`: `3984a53f1bdd04e93a9b4a8abf86a504fe78bf5f`
- Baseline surface module query: `v=95`
- Baseline app entry query: `pionier-app.js?v=111`
- Baseline files inspected: `index.html`, `pionier-app.js`, `js/pionier-surface.js`, `js/gesture.js`, `js/instrument.js`, `js/instruments/handpan.js`, `js/pad-layout.js`, `js/note-sample-bank.js`

Important: the local `pionier-app.js` is a loader/patcher, not the engine source that initially handles pointer events. It fetches the pinned engine, rewrites imports, applies source patches, and imports a Blob. The runtime baseline therefore consists of the pinned engine plus the local patches and the exact versions of imported modules.

## Regression fixes in this branch

1. A note is indexed by pad, while touches are indexed by pointer. Releasing one pointer previously called `noteOff(padIndex)` even when another pointer still held that same pad. The runtime patch now checks other active pointers before releasing the pad.
2. The surface hit test now prioritizes a point inside a visible pad over a neighboring pad's expanded touch halo. Expanded hit zones remain as a fallback when the point is not inside any visible pad.
3. The two pointer-release patch anchors are now required. If the pinned engine changes and the safety patches cannot be applied, boot fails explicitly instead of silently shipping the old interaction behavior.
4. The app logs the pinned engine and module version identifiers to make the loaded baseline easier to diagnose.
5. The app-entry and surface-module query versions were incremented so browsers request the changed modules.

## Manual acceptance checklist

Run on a desktop browser and at least one real mobile device. Record browser/device and pass/fail; do not mark untested items as passed.

### Strike accuracy
- [ ] Strike the center of every visible pad 20 times; each strike triggers only its intended note.
- [ ] Strike near the edge of each pad 10 times; no neighboring pad wins while the point is inside the visible pad.
- [ ] Strike in gaps between pads; the forgiving fallback feels usable without frequent wrong-note triggers.
- [ ] Repeat quickly on one pad at approximately 5, 8, and 10 strikes per second; no unexplained missing strikes.
- [ ] Alternate rapidly between adjacent pads and then opposite pads; each strike maps to the intended note.
- [ ] Repeat with 9, 10, 11, 12, and 13 notes.

### Pointer ownership and release
- [ ] Hold two different pads with two fingers; release either finger and the other note remains held.
- [ ] Hold the same pad with two fingers; releasing the first pointer does not silence the pad while the second remains down.
- [ ] Slide one finger from a pad to another while a second finger holds the first pad; the second finger's note is not released.
- [ ] Cancel a touch, interrupt pointer capture, and move a finger off the canvas; no note remains stuck.
- [ ] Rapidly tap the same pad repeatedly; no stale held state or stuck glow remains.

### Audio and lifecycle
- [ ] First touch resumes audio on browsers that require a user gesture.
- [ ] Play multiple notes together with effects enabled; no obvious crackles, large latency spikes, or runaway volume.
- [ ] Switch away from and back to Handpan; no stuck notes or silent instrument.
- [ ] Background track and looper do not create duplicate note triggers.
- [ ] Return from a backgrounded tab; audio resumes on the next permitted user interaction.

### Boot and regression
- [ ] Console shows the expected pinned engine, surface version, and handpan version.
- [ ] No missing required patch anchor, module import, or uncaught runtime errors.
- [ ] Scale, root, octave, voice, 9–13 note count, lessons, looper, and background player still initialize.
- [ ] Check portrait and landscape layouts at 320px, 375px, 430px, and desktop width.
- [ ] Re-run the full checklist after any engine or hit-test change.

## Scope guard

This stabilization pass intentionally does not redesign the mandala, particles, layout, colors, or control drawer. Visual work resumes only after the interaction checklist is passing on actual devices.
