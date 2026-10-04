# Ivar Karm – Resonance

> Street performer, improviser, and handpan artist.  
> Creating moments where sound and life converge across Berlin, Athens, and Europe.

Interactive acoustic journey + digital monograph.

## Quick start

```bash
git clone https://github.com/ivarkarm-web/ivarkarm-web.github.io.git
cd ivarkarm-web.github.io
npm install
npm run dev
```

Open http://localhost:3000

Production is static GitHub Pages — push to `main` deploys.

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — module map, load order, state, audio reactivity
- [PERFORMANCE.md](./PERFORMANCE.md) — performance modes, RAF behaviour, authoring tips
- [CONTENT.md](./CONTENT.md) — how to edit narrative, stones, music, vegetation

## Engineering highlights

- Modular vanilla JS (no runtime framework required)
- Automatic performance modes (`high` / `balanced` / `low`) from device capability
- Visibility-aware render loop
- Subtle audio-reactive starfield (handpan “breathing”)
- Mobile-first touch modality + reduced-motion support
- Semantic HTML + JSON-LD + Open Graph for SEO
- Lightweight non-blocking analytics queue

## License

See repository.

## Test matrix (minimum)

| Platform | Conditions |
|----------|------------|
| Desktop Chrome / Firefox / Safari | mouse, keyboard, high-DPI |
| iOS Safari | portrait, landscape, touch, reduced-motion |
| Android Chrome | mid-range and low-end, Save-Data if available |
| All | slow network, tab backgrounded, audio mute toggle |

Verify: navigation, canvas journey, music drawer, rabbit-hole, tip QR, no console errors.
