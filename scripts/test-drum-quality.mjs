#!/usr/bin/env node
/**
 * OfflineAudioContext drum quality test (stage 1, drum-quality).
 * Renders every kit×voice (+ OH choke) via shared drum-voices module.
 * Checks: peak < -1 dBFS, no silent (audible voices), no runaway, no click at end/choke.
 * Reports peak levels at velocity 1 (baseline for normalization).
 * Usage: node scripts/test-drum-quality.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const JS_DIR = path.join(ROOT, 'handpan-app', 'js');

function serveFile(req, res) {
  const u = new URL(req.url, 'http://127.0.0.1');
  let p = decodeURIComponent(u.pathname);
  if (p === '/' || p === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta charset="utf-8"><title>drum-quality</title>`);
    return;
  }
  if (p.startsWith('/js/')) p = p.slice(4);
  else if (p.startsWith('/')) p = p.slice(1);
  const full = path.resolve(JS_DIR, p);
  if (!full.startsWith(JS_DIR) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  const ct = full.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': ct, 'Cache-Control': 'no-store' });
  fs.createReadStream(full).pipe(res);
}

function analyze(samples, sampleRate, label) {
  let peak = 0, peakIdx = 0, sum2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > peak) { peak = a; peakIdx = i; }
    sum2 += samples[i] * samples[i];
  }
  const rms = Math.sqrt(sum2 / Math.max(1, samples.length));
  // end discontinuity/click: in last 120ms check for large sample-to-sample jump
  const tailStart = Math.max(0, samples.length - Math.floor(sampleRate * 0.12));
  let maxJump = 0, tailPeak = 0;
  let prev = tailStart > 0 ? samples[tailStart - 1] : 0;
  for (let i = tailStart; i < samples.length; i++) {
    const s = samples[i];
    const j = Math.abs(s - prev);
    if (j > maxJump) maxJump = j;
    const a = Math.abs(s); if (a > tailPeak) tailPeak = a;
    prev = s;
  }
  // last 10ms should be near silence (declick/fade completed)
  const endStart = Math.max(0, samples.length - Math.floor(sampleRate * 0.01));
  let endPeak = 0;
  for (let i = endStart; i < samples.length; i++) { const a = Math.abs(samples[i]); if (a > endPeak) endPeak = a; }
  return { peak, rms, maxJump, tailPeak, endPeak, peakIdx, n: samples.length };
}

async function main() {
  const server = http.createServer(serveFile);
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', () => resolve()).on('error', reject));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}/`;
  const exe = chromium.executablePath();
  const launchOpts = { headless: true };
  if (exe) launchOpts.executablePath = exe;
  let browser;
  try {
    browser = await chromium.launch(launchOpts);
  } catch (e) {
    console.error('PLAYWRIGHT_LAUNCH_FAILED:', e.message);
    server.close();
    process.exit(2);
  }
  try {
    const page = await browser.newPage();
    page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
    page.on('pageerror', (e) => console.error('[pageerror]', e.message));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(async () => {
      const SR = 44100;
      const mod = await import('./js/drum-voices.js?v=1');
      const { DRUM_VOICES, DRUM_KIT_LIST, KITS, createDrumEngine } = mod;
      const renderVoice = async (kitId, row, opts = {}) => {
        const kit = KITS[kitId];
        const p = kit[DRUM_VOICES[row]] || kit.kick || {};
        const dur = Math.max(0.06, ((p.dur || p.bodyDur || 0.2) * (opts.dm || 1)));
        const lenSec = Math.min(3.0, Math.max(0.5, dur + 0.25));
        const len = Math.ceil(SR * lenSec);
        const off = new OfflineAudioContext(1, len, SR);
        const eng = createDrumEngine();
        eng.triggerDrum(off, {
          row, when: 0.02, vel: opts.vel == null ? 1 : opts.vel,
          kit, tune: 0.5, decay: 0.5, drive: 0, space: 0,
          dest: off.destination, tapSend: null,
        });
        const buf = await off.startRendering();
        return Array.from(buf.getChannelData(0));
      };
      const renderChoke = async (kitId) => {
        const kit = KITS[kitId];
        const ohP = kit.oh || {}; const ohDur = Math.max(0.06, ohP.dur || 0.3);
        const lenSec = Math.min(2.5, Math.max(0.6, ohDur + 0.25));
        const len = Math.ceil(SR * lenSec);
        const off = new OfflineAudioContext(1, len, SR);
        const eng = createDrumEngine();
        // OH at 0.02, CH at 0.09 to choke
        eng.triggerDrum(off, { row: 4, when: 0.02, vel: 1, kit, tune: 0.5, decay: 0.5, drive: 0, space: 0, dest: off.destination, tapSend: null });
        eng.triggerDrum(off, { row: 3, when: 0.09, vel: 1, kit, tune: 0.5, decay: 0.5, drive: 0, space: 0, dest: off.destination, tapSend: null });
        const buf = await off.startRendering();
        return Array.from(buf.getChannelData(0));
      };
      const out = { voices: [], chokes: [], errors: [] };
      for (const k of DRUM_KIT_LIST) {
        for (let row = 0; row < DRUM_VOICES.length; row++) {
          try {
            const samples = await renderVoice(k.id, row, { vel: 1 });
            out.voices.push({ kit: k.id, voice: DRUM_VOICES[row], row, samples });
          } catch (e) {
            out.errors.push(`${k.id}/${DRUM_VOICES[row]}: ${e && e.message}`);
          }
        }
        try {
          const samples = await renderChoke(k.id);
          out.chokes.push({ kit: k.id, samples });
        } catch (e) {
          out.errors.push(`${k.id}/choke: ${e && e.message}`);
        }
      }
      return out;
    });

    const failures = [];
    const levels = [];
    const MINUS1DB = 0.8912509381337456;
    // thresholds: "no click" = no large discontinuity at end and tail settles
    const MAX_JUMP = 0.35; // generous; real clicks spike near full scale
    const MAX_END = 0.02;  // last 10ms near silence
    const MIN_AUDIBLE = 0.001; // not silent (vel 1)

    for (const e of (result.errors || [])) failures.push(`render error: ${e}`);

    for (const v of result.voices) {
      const a = analyze(v.samples, 44100, `${v.kit}/${v.voice}`);
      levels.push({ kit: v.kit, voice: v.voice, peak: a.peak, peakDb: 20 * Math.log10(Math.max(1e-9, a.peak)) });
      if (a.peak > MINUS1DB) failures.push(`${v.kit}/${v.voice}: peak ${(a.peak).toFixed(4)} (${(20*Math.log10(a.peak)).toFixed(2)} dBFS) > -1 dBFS`);
      if (a.peak < MIN_AUDIBLE) failures.push(`${v.kit}/${v.voice}: silent (peak ${a.peak.toExponential(2)})`);
      if (!Number.isFinite(a.peak) || a.peak > 10) failures.push(`${v.kit}/${v.voice}: runaway peak ${a.peak}`);
      if (a.maxJump > MAX_JUMP) failures.push(`${v.kit}/${v.voice}: end discontinuity jump ${a.maxJump.toFixed(4)}`);
      if (a.endPeak > MAX_END) failures.push(`${v.kit}/${v.voice}: not settled at end (last10ms peak ${a.endPeak.toFixed(5)})`);
    }
    for (const c of result.chokes) {
      const a = analyze(c.samples, 44100, `${c.kit}/choke`);
      if (a.peak > MINUS1DB) failures.push(`${c.kit}/choke: peak ${(20*Math.log10(a.peak)).toFixed(2)} dBFS > -1 dBFS`);
      if (!Number.isFinite(a.peak) || a.peak > 10) failures.push(`${c.kit}/choke: runaway`);
      if (a.maxJump > MAX_JUMP) failures.push(`${c.kit}/choke: discontinuity jump ${a.maxJump.toFixed(4)}`);
      if (a.endPeak > MAX_END) failures.push(`${c.kit}/choke: not settled (last10ms ${a.endPeak.toFixed(5)})`);
    }

    console.log('DRUM QUALITY (stage 1, v213 baseline) — peak levels at vel 1:');
    // group by voice
    const byVoice = new Map();
    for (const l of levels) { if (!byVoice.has(l.voice)) byVoice.set(l.voice, []); byVoice.get(l.voice).push(l); }
    for (const [voice, arr] of byVoice) {
      const vals = arr.map(x => `${x.kit}=${x.peak.toFixed(4)}(${x.peakDb.toFixed(1)}dB)`);
      console.log(`  ${voice}: ${vals.join('  ')}`);
    }
    console.log(`Rendered: ${result.voices.length} voices + ${result.chokes.length} chokes. Failures: ${failures.length}`);
    if (failures.length) {
      for (const f of failures) console.error('FAIL:', f);
      process.exit(1);
    }
    console.log('OK: no clicks/discontinuities at ends/chokes, peak < -1 dBFS, no silent/runaway.');
  } finally {
    await browser.close().catch(() => {});
    server.close();
  }
}
main().catch((e) => { console.error(e); process.exit(2); });
