# Testing — Ivar Karm Resonance

## Automated smoke test

```bash
node scripts/smoke-test.mjs
```

Checks required files, SEO image, analytics API, critical DOM ids, and that memory shards are not suppressed.

## Manual device checklist

### Desktop
- [ ] Welcome shows “The road is quiet” and **Enter** works
- [ ] Arrow keys / A·D move; Space jumps
- [ ] Speaker mute toggles; no console errors
- [ ] Tip opens, **Close** and Escape work; busk.co opens
- [ ] Improv Sessions cue → drawer → play/pause/next
- [ ] Roll into a stone → memory shard + discovery counter
- [ ] Monograph opens; section jump buttons work
- [ ] Rabbit Hole opens; chapter bar / Chapters menu jumps
- [ ] Partners logos load; links open

- [ ] Easter egg: roll up and left past the Baltic Edge stone to the summit → "Easter egg found!", then "Play Me" fades in
- [ ] Rolling back down hides it; returning replays it
- [ ] Play Me: main music / ambience stop immediately, iris transition, lands on the handpan with sound on first touch/keypress
- [ ] Handpan: Q W E R T Y U I O P A S D each sound; holding a key does not repeat; 3 keys at once make a chord
- [ ] Handpan: each strike ripples from that note's position; "The road" / Esc returns to the road

### Mobile (iOS Safari + Android Chrome)
- [ ] Enter works on first tap
- [ ] Side chevrons + hold-sides roll; double-tap jump
- [ ] Tip Close works with finger
- [ ] Music drawer drag/close works
- [ ] Rabbit Hole scroll + chapter jumps
- [ ] Handpan: 3 fingers at once play a chord; no pinch-zoom, scroll or text selection; landscape layout fits
- [ ] No stuck full-screen black overlay

### Analytics (optional debug)
In the browser console:

```js
window.__ANALYTICS_DEBUG = true
window.IvarAnalytics.getQueue()
```

Expected events while using the site: `page_view`, `enter_experience`, `tip_open`, `music_play`, `discovery`, `rabbit_hole_open`, `monograph_open`.

Privacy: tracking is skipped when **Do Not Track** or **Global Privacy Control** is enabled. No third-party script is loaded unless you set:

```js
window.__ANALYTICS_ENDPOINT = 'https://your-https-endpoint.example/collect'
```

## Production gate

Ship only if:

1. `node scripts/smoke-test.mjs` exits 0  
2. Desktop + one phone checklist pass  
3. No secrets in repo  
4. `og-cover.jpg` loads on the live domain  
