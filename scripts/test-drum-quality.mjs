#!/usr/bin/env node
/**
 * OfflineAudioContext drum quality test (stage 2, drum-quality).
 * Renders every kit×voice (+ OH choke) via shared drum-voices module.
 * Checks: peak < -1 dBFS, no silent, no runaway, no click at end/choke.
 * Reports peak + RMS(100ms) per kit/voice and checks normalization targets (±2 dB).
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

const TARGETS = { kick:-3, snare:-5, clap:-6, ch:-10, oh:-9, lowtom:-4, hightom:-4.5, rim:-9 };
const TARGET_TOL_DB = 2.0; // report/fail if peak farther than this (stage 2 normalization)

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

function analyze(samples, sampleRate, onsetSec = 0.02) {
  let peak = 0, sum2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]); if (a > peak) peak = a; sum2 += samples[i] * samples[i];
  }
  const rmsAll = Math.sqrt(sum2 / Math.max(1, samples.length));
  // RMS over first 100ms post-onset
  const w0 = Math.max(0, Math.floor(onsetSec * sampleRate));
  const w1 = Math.min(samples.length, w0 + Math.floor(0.1 * sampleRate));
  let w2 = 0; for (let i = w0; i < w1; i++) w2 += samples[i] * samples[i];
  const rms100 = Math.sqrt(w2 / Math.max(1, w1 - w0));
  // end discontinuity/click
  const tailStart = Math.max(0, samples.length - Math.floor(sampleRate * 0.12));
  let maxJump = 0, prev = tailStart > 0 ? samples[tailStart - 1] : 0;
  for (let i = tailStart; i < samples.length; i++) { const s = samples[i]; const j = Math.abs(s - prev); if (j > maxJump) maxJump = j; prev = s; }
  const endStart = Math.max(0, samples.length - Math.floor(sampleRate * 0.01));
  let endPeak = 0; for (let i = endStart; i < samples.length; i++) { const a = Math.abs(samples[i]); if (a > endPeak) endPeak = a; }
  return { peak, rmsAll, rms100, maxJump, endPeak };
}
const db = (x) => 20 * Math.log10(Math.max(1e-9, x));
const fmt = (x) => `${db(x).toFixed(1)}`;

async function main() {
  const server = http.createServer(serveFile);
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', () => resolve()).on('error', reject));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}/`;
  const exe = chromium.executablePath();
  const launchOpts = { headless: true };
  if (exe) launchOpts.executablePath = exe;
  let browser;
  try { browser = await chromium.launch(launchOpts); }
  catch (e) { console.error('PLAYWRIGHT_LAUNCH_FAILED:', e.message); server.close(); process.exit(2); }
  try {
    const page = await browser.newPage();
    page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
    page.on('pageerror', (e) => console.error('[pageerror]', e.message));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(async () => {
      const SR = 44100;
      const mod = await import('./js/drum-voices.js?v=1');
      const { DRUM_VOICES, DRUM_KIT_LIST, KITS, createDrumEngine } = mod;
      const renderVoice = async (kitId, row) => {
        const kit = KITS[kitId];
        const p = kit[DRUM_VOICES[row]] || {};
        const dur = Math.max(0.06, ((p.dur || p.noiseDur || p.bodyDur || 0.2)));
        const lenSec = Math.min(3.0, Math.max(0.55, dur + 0.30));
        const len = Math.ceil(SR * lenSec);
        const off = new OfflineAudioContext(1, len, SR);
        const eng = createDrumEngine();
        eng.triggerDrum(off, { row, when: 0.02, vel: 1, kit, tune: 0.5, decay: 0.5, drive: 0, space: 0, dest: off.destination, tapSend: null });
        const buf = await off.startRendering();
        return Array.from(buf.getChannelData(0));
      };
      const renderChoke = async (kitId) => {
        const kit = KITS[kitId];
        const ohDur = Math.max(0.06, (kit.oh && kit.oh.dur) || 0.3);
        const len = Math.ceil(SR * Math.min(2.5, Math.max(0.6, ohDur + 0.3)));
        const off = new OfflineAudioContext(1, len, SR);
        const eng = createDrumEngine();
        eng.triggerDrum(off, { row: 4, when: 0.02, vel: 1, kit, tune: 0.5, decay: 0.5, drive: 0, space: 0, dest: off.destination, tapSend: null });
        eng.triggerDrum(off, { row: 3, when: 0.09, vel: 1, kit, tune: 0.5, decay: 0.5, drive: 0, space: 0, dest: off.destination, tapSend: null });
        const buf = await off.startRendering();
        return Array.from(buf.getChannelData(0));
      };
      const out = { voices: [], chokes: [], errors: [] };
      for (const k of DRUM_KIT_LIST) {
        for (let row = 0; row < DRUM_VOICES.length; row++) {
          try { out.voices.push({ kit: k.id, voice: DRUM_VOICES[row], samples: await renderVoice(k.id, row) }); }
          catch (e) { out.errors.push(`${k.id}/${DRUM_VOICES[row]}: ${e && e.message}`); }
        }
        try { out.chokes.push({ kit: k.id, samples: await renderChoke(k.id) }); }
        catch (e) { out.errors.push(`${k.id}/choke: ${e && e.message}`); }
      }
      return out;
    });

    const failures = [];
    const levels = [];
    const MINUS1DB = 0.8912509381337456;
    const MAX_JUMP = 0.35, MAX_END = 0.02, MIN_AUDIBLE = 0.001;
    for (const e of (result.errors || [])) failures.push(`render error: ${e}`);
    for (const v of result.voices) {
      const a = analyze(v.samples, 44100, 0.02);
      levels.push({ kit: v.kit, voice: v.voice, peakDb: db(a.peak), rmsDb: db(a.rms100) });
      if (a.peak > MINUS1DB) failures.push(`${v.kit}/${v.voice}: peak ${fmt(a.peak)} dBFS > -1`);
      if (a.peak < MIN_AUDIBLE) failures.push(`${v.kit}/${v.voice}: silent ${a.peak.toExponential(2)}`);
      if (!Number.isFinite(a.peak) || a.peak > 10) failures.push(`${v.kit}/${v.voice}: runaway`);
      if (a.maxJump > MAX_JUMP) failures.push(`${v.kit}/${v.voice}: discontinuity ${a.maxJump.toFixed(3)}`);
      if (a.endPeak > MAX_END) failures.push(`${v.kit}/${v.voice}: not settled ${a.endPeak.toFixed(5)}`);
      const tgt = TARGETS[v.voice];
      if (tgt != null && Math.abs(db(a.peak) - tgt) > TARGET_TOL_DB) {
        failures.push(`${v.kit}/${v.voice}: peak ${fmt(a.peak)} dB vs target ${tgt} dB (>${TARGET_TOL_DB}dB)`);
      }
    }
    for (const c of result.chokes) {
      const a = analyze(c.samples, 44100, 0.02);
      if (a.peak > MINUS1DB) failures.push(`${c.kit}/choke: peak ${fmt(a.peak)} dBFS > -1`);
      if (!Number.isFinite(a.peak) || a.peak > 10) failures.push(`${c.kit}/choke: runaway`);
      if (a.maxJump > MAX_JUMP) failures.push(`${c.kit}/choke: discontinuity ${a.maxJump.toFixed(3)}`);
      if (a.endPeak > MAX_END) failures.push(`${c.kit}/choke: not settled ${a.endPeak.toFixed(5)}`);
    }

    console.log('DRUM QUALITY (stage 2, v214) — peak dBFS / RMS-100ms dB @ vel 1 (target):');
    const kits = ['classic','deep','punchy','lofi','industrial','tribal'];
    for (const voice of ['kick','snare','clap','ch','oh','lowtom','hightom','rim']) {
      const tgt = TARGETS[voice];
      const cells = kits.map(k => { const l = levels.find(x=>x.kit===k&&x.voice===voice); return l?`${l.peakDb.toFixed(1)}/${l.rmsDb.toFixed(1)}`:'-'; });
      console.log(`  ${voice.padEnd(8)} tgt ${String(tgt).padStart(5)} | ${cells.join('  ')}`);
    }
    console.log('JSONLEVELS:'+JSON.stringify(levels));
    console.log(`Rendered: ${result.voices.length} voices + ${result.chokes.length} chokes. Failures: ${failures.length}`);
    if (failures.length) { for (const f of failures) console.error('FAIL:', f); process.exit(1); }
    console.log('OK: no clicks, peak < -1 dBFS, no silent/runaway, all within target tolerance.');
  } finally { await browser.close().catch(()=>{}); server.close(); }
}
main().catch((e) => { console.error(e); process.exit(2); });
