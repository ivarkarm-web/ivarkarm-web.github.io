/**
 * ui-extras.js — screenshot UI interactions:
 * - Filter graph draw + drag handle
 * - Transport bar (record toggle, BPM, metro, volume)
 * - Recording modal open/close
 * - Right-side FX knob activation
 */
(function uiExtras() {
  const canvas = document.getElementById('filterCurveCanvas');
  const handle = document.getElementById('filterHandle');
  const graph = document.getElementById('filterGraph');
  let cutoff = 0.55;
  let resonance = 0.45;
  let filterType = 'lowpass';

  function drawFilterCurve() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 340;
    const h = canvas.clientHeight || 200;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(255,59,48,0.35)');
    grad.addColorStop(1, 'rgba(255,59,48,0.02)');
    ctx.beginPath();
    const peakX = cutoff * w;
    const peakY = (1 - resonance) * h * 0.75 + h * 0.08;
    ctx.moveTo(0, h * 0.7);
    ctx.bezierCurveTo(peakX * 0.4, h * 0.65, peakX * 0.7, peakY, peakX, peakY);
    ctx.bezierCurveTo(peakX + (w - peakX) * 0.25, peakY, peakX + (w - peakX) * 0.5, h * 0.9, w, h);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, h * 0.7);
    ctx.bezierCurveTo(peakX * 0.4, h * 0.65, peakX * 0.7, peakY, peakX, peakY);
    ctx.bezierCurveTo(peakX + (w - peakX) * 0.25, peakY, peakX + (w - peakX) * 0.5, h * 0.9, w, h);
    ctx.strokeStyle = '#ff3b30';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function positionHandle() {
    if (!handle || !graph) return;
    handle.style.left = (cutoff * 100) + '%';
    handle.style.top = ((1 - resonance) * 75 + 8) + '%';
  }

  function bindFilterDrag() {
    if (!handle || !graph) return;
    let dragging = false;
    const onMove = (clientX, clientY) => {
      const rect = graph.getBoundingClientRect();
      cutoff = Math.max(0.05, Math.min(0.95, (clientX - rect.left) / rect.width));
      resonance = Math.max(0.05, Math.min(0.95, 1 - (clientY - rect.top) / rect.height));
      positionHandle();
      drawFilterCurve();
      window.dispatchEvent(new CustomEvent('pionier:filter', { detail: { cutoff, resonance, type: filterType } }));
    };
    const start = (e) => {
      dragging = true;
      const t = e.touches ? e.touches[0] : e;
      onMove(t.clientX, t.clientY);
      e.preventDefault();
    };
    const move = (e) => {
      if (!dragging) return;
      const t = e.touches ? e.touches[0] : e;
      onMove(t.clientX, t.clientY);
    };
    const end = () => { dragging = false; };
    handle.addEventListener('pointerdown', start);
    graph.addEventListener('pointerdown', start);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  document.querySelectorAll('.filter-type').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-type').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      filterType = btn.dataset.type || 'lowpass';
      drawFilterCurve();
      window.dispatchEvent(new CustomEvent('pionier:filter', { detail: { cutoff, resonance, type: filterType } }));
    });
  });

  const recBtn = document.getElementById('transportRecord');
  const timeEl = document.getElementById('transportTime');
  const bpmVal = document.getElementById('bpmValue');
  const metro = document.getElementById('transportMetro');
  const vol = document.getElementById('masterVolume');
  const modal = document.getElementById('recordingModal');
  let recording = false;
  let recStart = 0;
  let timer = null;
  let bpm = 120;

  function fmt(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(' : ');
  }

  function tick() {
    if (!recording) return;
    const elapsed = performance.now() - recStart;
    if (timeEl) timeEl.textContent = fmt(elapsed);
    const left = document.getElementById('recTimeLeft');
    if (left) left.textContent = fmt(elapsed).replace(/ /g, '');
  }

  if (recBtn) {
    recBtn.addEventListener('click', () => {
      recording = !recording;
      recBtn.classList.toggle('is-recording', recording);
      if (recording) {
        recStart = performance.now();
        timer = setInterval(tick, 200);
        if (modal) {
          modal.hidden = false;
          const wc = document.getElementById('waveformCanvas');
          if (wc) {
            const ctx = wc.getContext('2d');
            const w = wc.width, h = wc.height;
            ctx.clearRect(0, 0, w, h);
            ctx.strokeStyle = '#ff3b30';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let x = 0; x < w * 0.4; x++) {
              const y = h / 2 + Math.sin(x * 0.15) * (8 + Math.random() * 18);
              if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            ctx.beginPath();
            for (let x = Math.floor(w * 0.4); x < w; x++) {
              const y = h / 2 + Math.sin(x * 0.12) * (6 + Math.random() * 10);
              if (x === Math.floor(w * 0.4)) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
        }
      } else {
        clearInterval(timer);
        timer = null;
      }
    });
  }

  document.getElementById('recDiscard')?.addEventListener('click', () => {
    recording = false;
    clearInterval(timer);
    recBtn?.classList.remove('is-recording');
    if (modal) modal.hidden = true;
    if (timeEl) timeEl.textContent = '00 : 00 : 00';
  });
  document.getElementById('recShare')?.addEventListener('click', () => {
    if (navigator.share) {
      navigator.share({ title: 'Pionier recording', text: 'Made with Pionier handpan' }).catch(() => {});
    }
    if (modal) modal.hidden = true;
    recording = false;
    clearInterval(timer);
    recBtn?.classList.remove('is-recording');
  });
  document.getElementById('recStop')?.addEventListener('click', () => {
    recording = false;
    clearInterval(timer);
    recBtn?.classList.remove('is-recording');
  });

  document.getElementById('bpmDown')?.addEventListener('click', () => {
    bpm = Math.max(40, bpm - 1);
    if (bpmVal) bpmVal.textContent = String(bpm);
  });
  document.getElementById('bpmUp')?.addEventListener('click', () => {
    bpm = Math.min(240, bpm + 1);
    if (bpmVal) bpmVal.textContent = String(bpm);
  });
  metro?.addEventListener('click', () => {
    const on = metro.getAttribute('aria-pressed') === 'true';
    metro.setAttribute('aria-pressed', on ? 'false' : 'true');
  });
  vol?.addEventListener('input', () => {
    const v = Number(vol.value);
    window.dispatchEvent(new CustomEvent('pionier:master-volume', { detail: { value: v } }));
  });

  document.querySelectorAll('.fx-circle-knob').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.fx-circle-knob').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const fx = btn.dataset.fx;
      if (fx === 'filter') {
        const panel = document.getElementById('fxPanel');
        if (panel) {
          panel.hidden = false;
          const title = document.getElementById('fxPanelTitle');
          if (title) title.textContent = 'Filter';
        }
      }
    });
  });

  positionHandle();
  drawFilterCurve();
  bindFilterDrag();
  window.addEventListener('resize', () => { drawFilterCurve(); positionHandle(); });
})();
