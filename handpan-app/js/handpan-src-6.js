export default `x += p.vx * dt; p.y += p.vy * dt;
      p.glow *= Math.pow(0.05, dt);
      if (p.y < -16 || p.x < -24 || p.x > W + 24 || p.y > H + 60) {
        particles[i] = spawnParticle(false);
        if (p.y < -16) particles[i].y = H + 12 + Math.random() * 30;
      }
    }
    for (var r = ripples.length - 1; r >= 0; r--) {
      var rp2 = ripples[r];
      rp2.r += rp2.speed * dt; rp2.speed *= Math.pow(0.55, dt);
      rp2.life -= dt * 0.55;
      if (rp2.life <= 0) ripples.splice(r, 1);
    }
    for (var s = sparks.length - 1; s >= 0; s--) {
      var sp = sparks[s];
      sp.x += sp.vx * dt; sp.y += sp.vy * dt;
      var drag = Math.pow(0.12, dt);
      sp.vx *= drag; sp.vy = sp.vy * drag - 6 * dt;
      sp.life -= sp.decay * dt;
      if (sp.life <= 0) sparks.splice(s, 1);
    }
  }

  function drawAtmosphere(time, level, intro) {
    var c = ctx2;
    var glowA = (0.05 + level * 0.2) * intro;
    var g = c.createRadialGradient(layout.cx, layout.cy, layout.R * 0.1, layout.cx, layout.cy, layout.R * 1.9);
    g.addColorStop(0, 'rgba(212,175,55,' + glowA + ')');
    g.addColorStop(0.5, 'rgba(212,175,55,' + (glowA * 0.28) + ')');
    g.addColorStop(1, 'rgba(212,175,55,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'lighter';
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var tw = 0.65 + 0.35 * Math.sin(time * p.tw + p.ph);
      var a = ((p.gold ? 0.5 : 0.3) * tw * (0.55 + p.z * 0.45) + p.glow * 0.75 + level * 0.12) * intro;
      if (a < 0.01) continue;
      var size = (p.r * 5.2 + p.glow * 16) * (0.9 + level * 0.2);
      c.globalAlpha = Math.min(1, a);
      c.drawImage(p.gold ? SPRITE_GOLD : SPRITE_COOL, p.x - size / 2, p.y - size / 2, size, size);
    }
    for (var s = 0; s < sparks.length; s++) {
      var sp = sparks[s];
      var sa = sp.life * sp.life;
      var ss = sp.size * (0.5 + sp.life * 0.7);
      c.globalAlpha = Math.min(1, sa * 0.95);
      c.drawImage(sp.gold ? SPRITE_GOLD : SPRITE_COOL, sp.x - ss / 2, sp.y - ss / 2, ss, ss);
    }
    c.globalAlpha = 1; c.lineWidth = 1.2;
    for (var r = 0; r < ripples.length; r++) {
      var rp = ripples[r];
      var ra = Math.max(0, rp.life) * 0.34 * rp.strength;
      if (ra < 0.01) continue;
      c.lineWidth = rp.width || 1.2;
      c.shadowColor = 'rgba(228,195,90,' + (ra * 0.9) + ')';
      c.shadowBlur = 16 + rp.width * 5;
      c.strokeStyle = 'rgba(238,211,119,' + ra + ')';
      c.beginPath(); c.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2); c.stroke();
      c.shadowBlur = 0;
      c.strokeStyle = 'rgba(228,195,90,' + (ra * 0.28) + ')';
      c.beginPath(); c.arc(rp.x, rp.y, rp.r * 0.72, 0, Math.PI * 2); c.stroke();
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }

  function computeLayout() {
    var topLimit = 8, bottomLimit = H - 8;
    var hr = headEl.getBoundingClientRect();
    if (hr.height > 0 && getComputedStyle(headEl).display !== 'none') {
      topLimit = Math.max(topLimit, hr.bottom + 10);
    } else {
      topLimit = Math.max(topLimit, 54);
    }

    var fr = footEl.getBoundingClientRect();
    var fcs = getComputedStyle(footEl);
    if (fr.height > 0 && fcs.display !== 'none') {
      var hint = document.getElementById('hpHint');
      var hintHidden = !hint || getComputedStyle(hint).display === 'none';
      if (!hintHidden) bottomLimit = Math.min(bottomLimit, fr.top - 8);
    }

    // The mobile scale/instrument strip lives at the TOP of the screen.
    // The o`;
