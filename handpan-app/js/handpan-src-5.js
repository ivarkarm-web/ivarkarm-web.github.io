export default ` DPR = 1;
  var layout = { cx: 0, cy: 0, S: 0, R: 0 };
  var fields = [];
  var panCache = null;
  var introT = 0;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function easeOutExpo(t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }

  function makeSprite(r, g, b) {
    var s = document.createElement('canvas');
    s.width = s.height = 64;
    var c = s.getContext('2d');
    var grad = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',1)');
    grad.addColorStop(0.18, 'rgba(' + r + ',' + g + ',' + b + ',0.55)');
    grad.addColorStop(0.5, 'rgba(' + r + ',' + g + ',' + b + ',0.14)');
    grad.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
    c.fillStyle = grad; c.fillRect(0, 0, 64, 64);
    return s;
  }
  var SPRITE_GOLD = makeSprite(235, 200, 100);
  var SPRITE_COOL = makeSprite(205, 215, 235);

  var particles = [];
  var ripples = [];
  var sparks = [];
  var MAX_RIPPLES = 28;
  var MAX_SPARKS = 420;

  function particleTarget() {
    var n = Math.round((W * H) / 9500);
    if (W < 700) n = Math.round(n * 0.7);
    if (REDUCED) n = Math.round(n * 0.5);
    return clamp(n, 60, 190);
  }

  function spawnParticle(anywhere) {
    var z = 0.3 + Math.random() * 0.7;
    return {
      x: Math.random() * W, y: anywhere ? Math.random() * H : H + 12 + Math.random() * 30,
      vx: 0, vy: 0, z: z,
      r: (0.7 + Math.random() * 1.9) * (0.55 + z * 0.7),
      gold: Math.random() < 0.62, ph: Math.random() * Math.PI * 2,
      tw: 0.6 + Math.random() * 1.6, glow: 0
    };
  }

  function syncParticleCount() {
    var target = particleTarget();
    while (particles.length < target) particles.push(spawnParticle(true));
    if (particles.length > target) particles.length = target;
  }

  function addRipple(x, y, strength) {
    var count = REDUCED ? 2 : 4;
    for (var k = 0; k < count; k++) {
      if (ripples.length >= MAX_RIPPLES) ripples.shift();
      ripples.push({ x: x, y: y, r: 10 + k * 18, speed: 300 + 95 * strength - k * 12, strength: strength * (1 - k * 0.12), life: 1, width: k === 0 ? 2.2 : 1.15 });
    }
  }

  function addBurst(x, y, strength, gold) {
    var n = REDUCED ? 6 : Math.round(12 + 14 * strength);
    for (var i = 0; i < n; i++) {
      if (sparks.length >= MAX_SPARKS) sparks.shift();
      var a = Math.random() * Math.PI * 2;
      var sp = 55 + Math.random() * (150 + 120 * strength);
      sparks.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 18,
        life: 1, decay: 0.55 + Math.random() * 0.7,
        size: 5 + Math.random() * 11, gold: gold || Math.random() < 0.7
      });
    }
  }

  function updateAtmosphere(dt, time) {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var driftX = Math.sin(time * 0.17 + p.ph + p.y * 0.0035) * 9 * p.z;
      var driftY = -(5 + 13 * p.z) + Math.cos(time * 0.13 + p.ph) * 3;
      var k = Math.min(1, dt * 0.9);
      p.vx += (driftX - p.vx) * k; p.vy += (driftY - p.vy) * k;
      for (var j = 0; j < ripples.length; j++) {
        var rp = ripples[j];
        var dx = p.x - rp.x, dy = p.y - rp.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 0.001;
        var band = Math.abs(d - rp.r);
        if (band < 52) {
          var f = 1 - band / 52; f = f * f * rp.strength * rp.life;
          var a = 980 * f * p.z * dt;
          p.vx += (dx / d) * a; p.vy += (dy / d) * a;
          if (f > p.glow) p.glow = f;
        }
      }
      p.`;
