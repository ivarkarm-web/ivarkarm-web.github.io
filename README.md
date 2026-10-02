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
