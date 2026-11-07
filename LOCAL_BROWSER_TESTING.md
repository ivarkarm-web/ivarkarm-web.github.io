# Run browser tests locally

Run these commands in Terminal from the project folder:

```sh
cd ~/Desktop/pionier-work
```

Install the project dependencies first if this is a fresh checkout:

```sh
npm install
```

If Playwright reports that a browser executable is missing, install its Chromium browser:

```sh
npx playwright install chromium
```

Run the full browser test suite:

```sh
npx playwright test
```

Run only the TonePad tests in `phase13-tonepad.spec.mjs`:

```sh
npx playwright test phase13-tonepad.spec.mjs
```

Playwright starts the threaded Python server in `scripts/serve-threaded.py` on `127.0.0.1:4173` automatically. Keep that port free; the project config reuses a server already running there. Local runs use one worker because parallel Web Audio specs can saturate older laptops; CI uses two.

## Reading failures

- **Browser executable missing:** run `npx playwright install chromium`, then retry.
- **Python or port error:** make sure Python 3 is installed and nothing else is using port 4173.
- **Assertion or timeout failure:** the test ran but an expected page element or behavior did not appear. Read the failed test name and error in the Terminal output.
- **Failure only inside Codex or another restricted environment:** try the same command from your normal macOS Terminal, where the browser can launch outside that sandbox.

On failure, Playwright retains a trace, screenshot, and video according to the project config; use the trace path printed in the output to inspect the run.
