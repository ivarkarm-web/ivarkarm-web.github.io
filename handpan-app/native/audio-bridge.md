# Native audio bridge (CoreAudio / AAudio)

The playable surface is a **canvas + pointer X/Y map**, not Flutter / React Native widgets.

Browsers cannot call CoreAudio or AAudio directly. For App Store / Play builds:

## Architecture

```
┌─────────────────────────────────────────────┐
│  Canvas instrument (this web UI)            │
│  Multi-zone vector touch → {midi,vel,radial}│
└─────────────────┬───────────────────────────┘
                  │ postMessage / JS bridge
┌─────────────────▼───────────────────────────┐
│  Native shell (Swift or Kotlin — not RN)    │
│  iOS: AVAudioEngine + AudioUnit (CoreAudio) │
│  Android: AAudio / Oboe low-latency stream  │
│  Same NoteSampleBank mapping, native decode │
└─────────────────────────────────────────────┘
```

## Message contract

```json
{
  "type": "strike",
  "midi": 50,
  "vel": 0.72,
  "radial": 0.41,
  "angleRad": 1.12,
  "whenMs": 0
}
```

```json
{ "type": "damp", "midi": 50 }
```

```json
{ "type": "transpose", "rootIndex": 2, "octaveOffset": 0, "scaleId": "celtic-minor" }
```

## iOS (Swift sketch)

- Embed `WKWebView` for the existing canvas UI only.
- Implement `strike` in an `AVAudioEngine` player node graph with 3-layer EQ matching `NoteSampleBank.zoneWeights`.
- Schedule buffers on the audio render thread; do not trigger from the main run loop if latency matters.

## Android (Kotlin + Oboe/AAudio)

- `WebView` for UI; `JavascriptInterface` receives strike vectors.
- Oboe stream in low-latency exclusive mode; mix layered PCM from assets (`sounds/notes/*`).

## Why not Flutter / React Native

Those frameworks sit between touch and audio with their own gesture arenas and UI threads. This instrument needs **continuous elliptical distance from pad centers** and **sub-10ms audio scheduling**, which is cleaner with:

1. one canvas surface, and  
2. a thin native audio engine, not a cross-platform widget tree.
