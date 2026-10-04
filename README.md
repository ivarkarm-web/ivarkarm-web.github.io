# Ivar Karm – Resonance

> Street performer, improviser, and handpan artist. Creating moments where sound and life converge across Berlin, Athens, and Europe.

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or 20+ recommended)
- npm (comes with Node.js)

### Installation
```bash
git clone https://github.com/ivarkarm-web/ivarkarm-web.github.io.git
cd ivarkarm-web.github.io
npm install
```

### Development
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

### Production Build
```bash
npm run build
npm run preview
```

---

## Architecture (Professional Maintainability)

The interactive canvas experience has been fully modularized into clean, single-responsibility modules under `js/`. Scripts load in dependency order via deferred tags.

```
js/
├── utilities.js   # Pure helpers: PRNG, noise (fbm/hash2), biome, Poisson, wind, edge alpha, haptics
├── content.js     # World data: resonant stones, sectionPositions, veg builders, stars, horizon, BG assets, ground height fns
├── audio.js       # ResonanceAudio – Web Audio physical model of the handpan + ambient soundscapes
├── physics.js     # Ball state, gravity/friction constants, dash, keys, camera state, gameStarted
├── scenes.js      # All canvas drawing (botanical models, layers, particles, landmarks, stars, atmosphere) + update(dt)
├── ui.js          # Modality system, multi-touch, music/video drawers, rabbit-hole archive, navigation
├── engine.js      # Reserved for future pure engine entry (currently thin orchestration lives in script.js)
└── (script.js)    # Thin engine core: canvas setup/resize, draw() orchestration, main requestAnimationFrame loop
```

### Load order (index.html)
1. utilities  
2. content  
3. audio  
4. physics  
5. scenes  
6. ui  
7. engine  
8. script.js (engine loop)

### Design principles applied
- **Single responsibility** – each file owns one clear concern.
- **Sequential deferred loading** – zero build step required for GitHub Pages; globals remain for inter-module communication while the API surface is documented.
- **No behaviour change** – the live experience is identical; only structure changed.
- **Future-ready** – easy path to native ES modules (`type="module"` + explicit exports) or Vite integration once state is further encapsulated.

### Extending the world
- Add a new narrative stone → `content.js` (`resonantStones`)
- Change physics feel → `physics.js` constants
- New botanical type → `scenes.js` (draw* function) + veg weights in `content.js`
- New UI control → `ui.js`

---

## 🌐 Deploying to GitHub Pages

Pre-configured with relative paths (`base: './'`) and GitHub Actions.

Push to `main` to deploy.

---

## License
See repository for details.
