# Pionier community songs — Cloudflare Worker

This Worker is the trusted server-side bridge between the public GitHub Pages app and the repository. **Never put the GitHub token in frontend JavaScript.**

## Deploy

1. Create a Cloudflare Worker named `pionier-community-songs`.
2. Paste the contents of `worker.js` into its editor and deploy.
3. In Worker **Settings → Variables and Secrets**, add:
   - Secret `GITHUB_TOKEN`: a fine-grained GitHub token restricted to `ivarkarm-web/ivarkarm-web.github.io`, with **Contents: Read and write** only.
   - Variable `REPO_OWNER` = `ivarkarm-web`
   - Variable `REPO_NAME` = `ivarkarm-web.github.io`
   - Variable `REPO_BRANCH` = `main`
   - Variable `ALLOWED_ORIGIN` = `https://ivarkarm-web.github.io`
4. Copy the deployed Worker URL, ending in `/songs`.
5. In `handpan-app/js/repository-loop-save.js`, replace `PASTE_CLOUDFLARE_WORKER_URL_HERE` with that full URL. Commit the file. The URL is public by design; the GitHub token is not.
6. In Cloudflare, configure an edge rate limit for POST requests to `/songs` (for example, 3 requests per IP per 10 minutes). The in-memory check in the Worker is only best-effort because Workers can run in multiple isolates.
7. Test GET `/songs` (should return `{"songs":[]}` before the first song) and then submit a short test loop from Pionier.

## Behaviour and safeguards

- Public visitors submit a rendered WAV and title/creator name without a GitHub account or token.
- Worker validates WAV headers, caps audio at 16 MB, sanitizes metadata, and uses a repository-scoped secret.
- WAV and JSON metadata are stored in `handpan-app/community-songs/`; the app reads the JSON entries to build the User-Created list.
- Submissions become public immediately. Add Cloudflare Turnstile or a moderation queue before promoting this broadly if spam becomes a problem.
- This static app cannot deploy or configure the Worker secret on your behalf. The frontend becomes live after the Worker URL is configured and committed.
