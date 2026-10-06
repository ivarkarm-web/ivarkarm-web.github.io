export default `ld layout always treated it as a bottom constraint, which collapsed
    // the available canvas to ~160px and made the handpan effectively disappear.
    var scalesEl = document.getElementById('hpScales');
    if (scalesEl) {
      var sr = scalesEl.getBoundingClientRect();
      if (sr.height > 0) {
        if (sr.top < H * 0.5) {
          topLimit = Math.max(topLimit, sr.bottom + 14);
        } else {
          bottomLimit = Math.min(bottomLimit, sr.top - 12);
        }
      }
    }

    // Keep the instrument clear of the bottom navigation even when the hint is hidden.
    var modebar = document.querySelector('.app-modebar');
    if (modebar) {
      var mr = modebar.getBoundingClientRect();
      if (mr.height > 0) bottomLimit = Math.min(bottomLimit, mr.top - 12);
    }

    var availH = Math.max(220, bottomLimit - topLimit);
    var widthLimit = W < 700 ? W * 0.88 : W * 0.96;
    var S = Math.min(widthLimit, availH, 900);
    layout.S = S;
    layout.R = S / 2 * 0.985;
    layout.cx = W / 2;
    layout.cy = topLimit + Math.max(0, (availH - S) / 2) + S / 2;
  }

  function buildFields() {
    fields = NOTES.map(function (n, i) {
      var sh = SHAPE[n.kind];
      var a = (n.a || 0) * Math.PI / 180;
      var ux = Math.sin(a), uy = -Math.cos(a);
      var R = layout.R;
      return {
        i: i, cx: layout.cx + ux * sh.dist * R, cy: layout.cy + uy * sh.dist * R,
        ux: ux, uy: uy, rx: sh.rx * R, ry: sh.ry * R,
        rot: Math.atan2(uy, ux), glow: 0, held: 0, hover: 0, guide: 0, guideTarget: 0, guideSuccess: 0
      };
    });
  }

  function fieldDist2(f, px, py, tol) {
    var dx = px - f.cx, dy = py - f.cy;
    var along = dx * f.ux + dy * f.uy;
    var across = dx * (-f.uy) + dy * f.ux;
    var a = along / (f.rx * tol), b = across / (f.ry * tol);
    return a * a + b * b;
  }

  function hitTest(px, py, pointerType) {
    var tol = pointerType === 'touch' ? 1.28 : (pointerType === 'pen' ? 1.12 : 1.0);
    var best = -1, bestD = Infinity;
    for (var i = 0; i < fields.length; i++) {
      var d = fieldDist2(fields[i], px, py, tol);
      if (d <= 1 && d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function ellipsePath(c, cx, cy, rx, ry, rot) {
    c.beginPath(); c.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
  }

  function renderPan() {
    var S = layout.S;
    if (!S || S < 10) return;
    var px = Math.ceil(S * DPR);
    var off = document.createElement('canvas');
    off.width = off.height = px;
    var c = off.getContext('2d');
    c.scale(DPR, DPR);
    var cx = S / 2, cy = S / 2, R = layout.R;

    var shell = c.createRadialGradient(cx - R * 0.28, cy - R * 0.32, R * 0.05, cx, cy, R);
    shell.addColorStop(0, '#2c2d32'); shell.addColorStop(0.5, '#17181b');
    shell.addColorStop(0.86, '#0d0d10'); shell.addColorStop(1, '#070708');
    c.fillStyle = shell; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();

    var seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 46; i++) {
      var rr = R * (0.08 + rnd() * 0.9);
      var st = rnd() * Math.PI * 2, sp = 0.5 + rnd() * 2.2;
      var gold = rnd() < 0.3;
      c.strokeStyle = gold ? 'rgba(201,170,90,' + (0.025 + rnd() * 0.04) + ')' : 'rgba(255,255,255,' + (0.018 + rnd() * 0.04) + ')';
      c.lineWidth = 0.5 + rnd() * 0.7;
      c.beginPath(); c.arc(cx, cy, rr, st, st + sp); c.stroke();
    }

    var rim = c.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    ri`;
