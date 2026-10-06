export default `f.guideSuccess > 0.01) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = f.guideSuccess * 0.72;
        c.strokeStyle = 'rgba(255,245,188,0.95)';
        c.lineWidth = Math.max(2, f.rx * 0.032);
        c.beginPath();
        c.ellipse(f.cx, f.cy, rx * (1.12 + (1 - f.guideSuccess) * 0.18), ry * (1.12 + (1 - f.guideSuccess) * 0.18), f.rot, 0, Math.PI * 2);
        c.stroke();
        c.restore();
      }
      c.globalAlpha = Math.min(1, f.guide * 0.95);
      c.strokeStyle = 'rgba(255,221,112,' + (0.35 + f.guide * 0.45) + ')';
      c.lineWidth = Math.max(1.4, f.rx * 0.025);
      c.beginPath();
      c.ellipse(f.cx, f.cy, rx, ry, f.rot, 0, Math.PI * 2);
      c.stroke();
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.restore();
  }

  function drawPan(time, level, intro) {
    if (!panCache) return;
    var c = ctx2;
    var S = layout.S;
    var e = easeOutExpo(intro);
    var scale = (0.84 + 0.16 * e) * (1 + level * 0.006);
    c.save();
    c.globalAlpha = clamp(intro * 1.4, 0, 1);
    c.translate(layout.cx, layout.cy); c.scale(scale, scale);
    var sh = c.createRadialGradient(0, S * 0.02, S * 0.38, 0, S * 0.02, S * 0.64);
    sh.addColorStop(0, 'rgba(0,0,0,0.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = sh; c.fillRect(-S * 0.7, -S * 0.7, S * 1.4, S * 1.4);
    c.drawImage(panCache, -S / 2, -S / 2, S, S);
    c.restore();

    c.save();
    c.translate(layout.cx, layout.cy); c.scale(scale, scale);
    c.translate(-layout.cx, -layout.cy);
    c.globalCompositeOperation = 'lighter';
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      if (f.glow < 0.01 && f.held < 0.01) continue;
      var a = Math.min(1, f.glow * 0.9 + f.held * 0.35);
      var size = (f.rx + f.ry) * (1.1 + f.glow * 0.6);
      c.globalAlpha = a;
      c.drawImage(SPRITE_GOLD, f.cx - size / 2, f.cy - size / 2, size, size);
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.restore();
    drawGuideFields(c, time, scale);
  }

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, REDUCED ? 1.5 : 2);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx2.setTransform(DPR, 0, 0, DPR, 0, 0);
    computeLayout(); buildFields(); syncParticleCount(); renderPan();
  }

  var resizeTimer = null;
  function queueResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 60);
  }
  window.addEventListener('resize', queueResize);
  window.addEventListener('orientationchange', function () { setTimeout(queueResize, 120); });

  var heldKeys = new Set();
  var pointerMap = new Map();
  var lastPointerDown = {time: 0, noteIndex: -1};
  var TWO_FINGER_WINDOW = 110;

  function haptic(kind) {
    if (!COARSE || !navigator.vibrate || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    try {
      navigator.vibrate(kind === 'accent' ? [4, 8, 4] : 5);
    } catch (e) {}
  }

  function getImpact(px, py, field) {
    var dx = px - field.cx, dy = py - field.cy;
    var along = dx * field.ux + dy * field.uy;
    var across = dx * (-field.uy) + dy * field.ux;
    var nx = along / Math.max(1, field.rx);
    var ny = across / Math.max(1, field.ry);
    var d = Math.sqrt(nx * nx + ny * ny);
    return {
      x: nx,
      y`;
