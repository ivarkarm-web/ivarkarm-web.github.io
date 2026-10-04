# Content Editing Guide

## Narrative sections

Primary copy lives in `index.html` inside the `.rh-section` blocks (Home, About, Story, Manifesto, Improv Sessions, Partners, Contact, Road Notes).

Edit the HTML directly. Keep headings semantic (`h2`/`h3`) for SEO and accessibility.

## World coordinates & stones

`js/content.js` → `resonantStones`, `sectionPositions`, `audioOrbs`.

Each stone has `x`, `title`, `meta`, `text`, `noteIdx`. Changing `x` moves the discovery point on the journey.

## Music tracks

Session tracks are referenced from archive.org URLs in `js/ui.js` (musicPlayer) and in the rabbit-hole HTML.
To add a track:

1. Upload to a stable host (or archive.org).
2. Add an entry to the `musicPlayer` track list in `js/ui.js`.
3. Optionally add a preview/download row in the rabbit-hole section of `index.html`.

## Vegetation

Weights and density live in the `buildVegSet` calls inside `js/content.js`.
New botanical types require a matching `draw*` function in `js/scenes.js`.

## Social / tip links

Tip: `busk.co/84950` (QR + button in Contact / Road Notes).
Update the URL in both the HTML and any hard-coded references.

## Open Graph image

`og-cover.svg` is the social sharing image (1200×630 viewBox).
Replace with a photographic PNG if desired and update the meta tags in `index.html`.
