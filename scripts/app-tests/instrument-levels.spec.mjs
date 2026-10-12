import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Measurement-only: same note on every registered instrument through
 * OfflineAudioContext. Writes peak, RMS, and approximate decay table.
 * Does not change product levels.
 */
test('measure peak RMS and decay for every instrument', async ({ page }, testInfo) => {
  test.setTimeout(120000);
  await page.goto('/handpan-app/index.html');
  await expect.poll(() => page.evaluate(() => {
    const active = window.PionierCore?.activeInstrument?.();
    return !!active?.audioCtx && !!active?.bus;
  })).toBe(true);

  const table = await page.evaluate(async () => {
    const { InstrumentRegistry } = await import('/handpan-app/js/instrument.js');
    const list = InstrumentRegistry.list();
    const sampleRate = 48000;
    const durationSec = 2.5;
    const noteMidi = 62; // D4-ish shared pitch
    const rows = [];

    function metrics(channelData, sr) {
      let peak = 0;
      let sumSq = 0;
      for (let i = 0; i < channelData.length; i++) {
        const v = channelData[i];
        const a = Math.abs(v);
        if (a > peak) peak = a;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / channelData.length);
      // Decay: time from peak sample to -20 dB relative to peak
      let peakIdx = 0;
      for (let i = 0; i < channelData.length; i++) {
        if (Math.abs(channelData[i]) === peak) { peakIdx = i; break; }
      }
      const threshold = peak * Math.pow(10, -20 / 20);
      let decayIdx = channelData.length - 1;
      for (let i = peakIdx; i < channelData.length; i++) {
        if (Math.abs(channelData[i]) <= threshold) { decayIdx = i; break; }
      }
      const decayMs = ((decayIdx - peakIdx) / sr) * 1000;
      return {
        peak: Number(peak.toFixed(5)),
        rms: Number(rms.toFixed(5)),
        decayMs: Number(decayMs.toFixed(1)),
        peakDb: peak > 0 ? Number((20 * Math.log10(peak)).toFixed(2)) : -Infinity,
        rmsDb: rms > 0 ? Number((20 * Math.log10(rms)).toFixed(2)) : -Infinity
      };
    }

    for (const item of list) {
      const offline = new OfflineAudioContext(1, Math.floor(sampleRate * durationSec), sampleRate);
      const bus = offline.createGain();
      bus.gain.value = 1;
      bus.connect(offline.destination);

      const instrument = InstrumentRegistry.get(item.id);
      if (!instrument) {
        rows.push({ id: item.id, name: item.name, error: 'missing registry entry' });
        continue;
      }

      try {
        await instrument.activate(offline, bus);
        const zones = instrument.getZones?.() || [];
        const zone = zones[0] || { index: 0, radial: 0.35, angleRad: 0, nx: 0.5, ny: 0.5 };
        // Prefer first playable zone index; pitch comes from scale/root inside the instrument.
        instrument.noteOn(
          { velocity: 0.85, pointerId: 1, midi: noteMidi },
          { index: zone.index ?? 0, radial: zone.radial ?? 0.35, angleRad: 0, nx: 0.5, ny: 0.5 }
        );
        // Let sustain instruments ring briefly then damp so OfflineAudioContext can finish.
        if (typeof instrument.noteOff === 'function') {
          // schedule damp at 1.8s via offline time if supported; otherwise damp after start
        }
        const rendered = await offline.startRendering();
        instrument.dampAll?.();
        instrument.deactivate?.();
        const data = rendered.getChannelData(0);
        const m = metrics(data, sampleRate);
        rows.push({
          id: item.id,
          name: item.name,
          ...m,
          samples: data.length,
          sampleRate
        });
      } catch (err) {
        try { instrument.dampAll?.(); instrument.deactivate?.(); } catch (_) {}
        rows.push({ id: item.id, name: item.name, error: String(err && err.message || err) });
      }
    }
    return rows;
  });

  expect(table.length).toBeGreaterThan(0);

  const outDir = path.join('test-results', 'instrument-levels');
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'levels.json');
  fs.writeFileSync(jsonPath, JSON.stringify({ measuredAt: new Date().toISOString(), rows: table }, null, 2));

  const header = ['id', 'name', 'peak', 'rms', 'peakDb', 'rmsDb', 'decayMs', 'error'];
  const lines = [header.join('\t')];
  for (const row of table) {
    lines.push(header.map((k) => (row[k] === undefined ? '' : row[k])).join('\t'));
  }
  const tsvPath = path.join(outDir, 'levels.tsv');
  fs.writeFileSync(tsvPath, lines.join('\n') + '\n');

  await testInfo.attach('levels.json', { path: jsonPath, contentType: 'application/json' });
  await testInfo.attach('levels.tsv', { path: tsvPath, contentType: 'text/tab-separated-values' });

  // Soft sanity: at least one instrument produced non-silent audio
  const anySound = table.some((r) => typeof r.peak === 'number' && r.peak > 0.0001);
  expect(anySound).toBe(true);
});
