# Ivar Karm – Resonance

> Street performer, improviser, and handpan artist. Creating moments where sound and life converge across Berlin, Athens, and Europe.

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or 20+ recommended)
- npm (comes with Node.js)

### Installation
```bash
# Clone the repository
git clone https://github.com/<your-username>/<your-repo-name>.git
cd <your-repo-name>

# Install dependencies
npm install
```

### Development
Start the local development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build
Build the optimized static assets into the `dist/` directory:
```bash
npm run build
```
Preview the production build locally:
```bash
npm run preview
```

---

## 🌐 Deploying to GitHub Pages

This project is pre-configured with relative asset paths (`base: './'`) and an automated GitHub Actions deployment workflow.

### Option 1: Automatic Deployment via GitHub Actions (Recommended)
1. Push your repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```
2. In your GitHub repository:
   - Go to **Settings** → **Pages**.
   - Under **Build and deployment** → **Source**, select **GitHub Actions**.
3. Every push to `main` (or `master`) will automatically build and deploy the site.

### Option 2: Manual / Custom Host Deployment
Upload the contents of the generated `dist/` folder directly to GitHub Pages (e.g., using `gh-pages` branch), Vercel, Netlify, Cloudflare Pages, or any static hosting provider.

## Architecture & Maintainability

The interactive canvas experience (handpan physics journey) has been modularized for long-term maintainability:

### Current module layout (`js/`)

| Module | Responsibility |
|--------|----------------|
| `utilities.js` | Pure helpers: PRNG (`rand`/`seedRand`), noise (`hash2`/`fbm`), biome mapping, Poisson disk sampling, wind sway, screen-edge alpha, haptic feedback |
| `audio.js` | `ResonanceAudio` – full Web Audio physical model of the handpan (D Celtic Minor / Kurd), ambient soundscapes, mute, rolling noise |
| `script.js` | Remaining engine: canvas/physics/camera, botanical drawing models, scenes, UI modality, rabbit-hole archive, music drawer, main loop |

### Planned further split (next iteration)

- `physics.js` – ball state, gravity, ground height functions, dash, collisions with resonant stones
- `scenes.js` – all `draw*` botanical, starfield, hills, landmarks, particles, atmosphere
- `content.js` – section positions, resonant stones, audio orbs, horizon lights, vegetation data builders
- `ui.js` – UnifiedModalitySystem, multi-touch controls, music/video drawers, rabbit-hole managers
- `engine.js` – canvas resize, camera/zoom, update/draw orchestration, main `requestAnimationFrame` loop

Scripts are loaded in dependency order via deferred tags in `index.html`. Future conversion to native ES modules (`type="module"`) is straightforward once the remaining global state is encapsulated.

