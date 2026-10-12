import { test, expect } from '@playwright/test';

/**
 * Sample envelope: recorded decay is preserved; only short end-fade and
 * damp/re-strike release are applied. Audio is generated in-test (no files).
 */

test('synthetic long sample holds recorded level until end-fade (OfflineAudioContext)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/handpan-app/index.html');
  await expect.poll(() => page.evaluate(() => !!window.PionierCore?.activeInstrument?.()?.audioCtx)).toBe(true);

  const metrics = await page.evaluate(async () => {
    const { NoteSampleBank } = await import('/handpan-app/js/note-sample-bank.js');
    const sr = 48000;
    const durSec = 6;
    const offline = new OfflineAudioContext(1, Math.floor(sr * durSec), sr);
    const bank = new NoteSampleBank(offline, './sounds/notes/');
    const buf = offline.createBuffer(1, Math.floor(sr * durSec), sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      data[i] = Math.sin(2 * Math.PI * 220 * t) * Math.exp(-t / 2.5);
    }
    bank.byMidi.set(60, buf);
    bank.ready = true;
    bank.manifest = { samples: [] };

    bank.play(60, offline.destination, 0, { vel: 0.9, radial: 0.4, angleRad: 0 });
    const rendered = await offline.startRendering();
    const ch = rendered.getChannelData(0);

    function rms(t0, t1) {
      const a = Math.floor(t0 * sr);
      const b = Math.min(ch.length, Math.floor(t1 * sr));
      let s = 0;
      for (let i = a; i < b; i++) s += ch[i] * ch[i];
      return Math.sqrt(s / Math.max(1, b - a));
    }
    const expectedRatio = Math.exp(-4 / 2.5) / Math.exp(-0.2 / 2.5);
    return {
      rmsEarly: rms(0.15, 0.35),
      rmsMid: rms(3.9, 4.1),
      rmsLate: rms(5.7, 5.9),
      expectedRatio,
      duration: buf.duration
    };
  });

  expect(metrics.duration).toBeCloseTo(6, 1);
  expect(metrics.rmsEarly).toBeGreaterThan(0.01);
  const ratio = metrics.rmsMid / metrics.rmsEarly;
  expect(ratio).toBeGreaterThan(metrics.expectedRatio * 0.35);
  expect(ratio).toBeLessThan(metrics.expectedRatio * 2.5);
  expect(metrics.rmsLate).toBeGreaterThan(0);
});

test('noteOff does not stop sample voice; dampAll releases it', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/handpan-app/index.html');
  await expect.poll(() => page.evaluate(() => {
    const inst = window.PionierCore?.activeInstrument?.();
    return !!inst?.audioCtx && !!inst?.bus;
  })).toBe(true);

  const result = await page.evaluate(async () => {
    const inst = window.PionierCore.activeInstrument();
    const ctx = inst.audioCtx;
    const { NoteSampleBank } = await import('/handpan-app/js/note-sample-bank.js');
    const bank = new NoteSampleBank(ctx, './sounds/notes/');
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, Math.floor(sr * 4), sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.sin(2 * Math.PI * 200 * i / sr) * 0.3;
    bank.byMidi.set(62, buf);
    bank.ready = true;
    inst.sampleBank = bank;

    const zone = { index: 0, radial: 0.4, angleRad: 0 };
    if (inst.notes?.[0]) {
      inst.notes[0].midi = 62;
      inst.notes[0].midiExact = 62;
    }
    inst.noteOn({ velocity: 0.8, pointerId: 1 }, zone);
    const afterOn = inst.activeVoices.get(0);
    const kind = afterOn?.kind;
    inst.noteOff(0);
    const afterOff = inst.activeVoices.get(0);
    const stillThere = afterOff === afterOn && afterOff && !afterOff.released;
    inst.dampAll();
    const afterDamp = inst.activeVoices.size;
    return { kind, stillThere, afterDamp };
  });

  if (result.kind === 'sample') {
    expect(result.stillThere).toBe(true);
    expect(result.afterDamp).toBe(0);
  } else {
    expect(result.afterDamp).toBe(0);
  }
});

test('re-strike crossfades previous sample and does not stack two full-level voices', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/handpan-app/index.html');
  await expect.poll(() => page.evaluate(() => !!window.PionierCore?.activeInstrument?.()?.audioCtx)).toBe(true);

  const result = await page.evaluate(async () => {
    const { NoteSampleBank } = await import('/handpan-app/js/note-sample-bank.js');
    const sr = 48000;
    const offline = new OfflineAudioContext(1, Math.floor(sr * 3), sr);
    const bank = new NoteSampleBank(offline, './sounds/notes/');
    const buf = offline.createBuffer(1, Math.floor(sr * 2.5), sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = 0.5;
    bank.byMidi.set(60, buf);
    bank.ready = true;

    const first = bank.play(60, offline.destination, 0, { vel: 0.8, radial: 0.35, angleRad: 0 });
    first.stop(0.5, 0.18);
    bank.play(60, offline.destination, 0.5, { vel: 0.8, radial: 0.35, angleRad: 0 });
    const rendered = await offline.startRendering();
    const ch = rendered.getChannelData(0);

    function peak(t0, t1) {
      let p = 0;
      const a = Math.floor(t0 * sr);
      const b = Math.min(ch.length, Math.floor(t1 * sr));
      for (let i = a; i < b; i++) p = Math.max(p, Math.abs(ch[i]));
      return p;
    }
    return {
      peakEarly: peak(0.05, 0.15),
      peakDuringCross: peak(0.5, 0.65),
      peakAfter: peak(0.9, 1.1)
    };
  });

  expect(result.peakAfter).toBeLessThan(result.peakEarly * 1.85);
  expect(result.peakDuringCross).toBeLessThan(result.peakEarly * 2.2);
});
