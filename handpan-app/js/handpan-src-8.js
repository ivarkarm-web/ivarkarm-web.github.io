export default `m.addColorStop(0, 'rgba(232,200,100,0.7)'); rim.addColorStop(0.5, 'rgba(120,96,40,0.28)');
    rim.addColorStop(1, 'rgba(228,195,90,0.5)');
    c.strokeStyle = rim; c.lineWidth = Math.max(1.4, R * 0.012);
    c.beginPath(); c.arc(cx, cy, R - c.lineWidth / 2, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 1;
    c.beginPath(); c.arc(cx, cy, R * 0.955, 0, Math.PI * 2); c.stroke();

    for (var n = 0; n < NOTES.length; n++) {
      var f = fields[n];
      if (!f) continue;
      var fx = cx + (f.cx - layout.cx), fy = cy + (f.cy - layout.cy);
      var note = NOTES[n];

      c.save(); c.translate(fx, fy); c.rotate(f.rot); c.scale(1, f.ry / f.rx);
      var dish = c.createRadialGradient(-f.rx * 0.22, 0, f.rx * 0.05, 0, 0, f.rx);
      dish.addColorStop(0, 'rgba(255,255,255,0.075)'); dish.addColorStop(0.55, 'rgba(0,0,0,0.12)');
      dish.addColorStop(1, 'rgba(0,0,0,0.5)');
      c.fillStyle = dish; c.beginPath(); c.arc(0, 0, f.rx, 0, Math.PI * 2); c.fill();
      c.restore();

      ellipsePath(c, fx, fy, f.rx, f.ry, f.rot);
      c.strokeStyle = note.kind === 'ding' ? 'rgba(212,175,55,0.5)' : 'rgba(212,175,55,0.36)';
      c.lineWidth = note.kind === 'ding' ? 1.6 : 1.15; c.stroke();

      ellipsePath(c, fx, fy, f.rx * 0.82, f.ry * 0.82, f.rot);
      c.strokeStyle = 'rgba(255,255,255,0.045)'; c.lineWidth = 1; c.stroke();

      if (note.kind === 'ding') {
        var dome = c.createRadialGradient(fx - f.rx * 0.25, fy - f.rx * 0.3, f.rx * 0.05, fx, fy, f.rx * 0.8);
        dome.addColorStop(0, 'rgba(255,240,200,0.16)'); dome.addColorStop(1, 'rgba(255,240,200,0)');
        c.fillStyle = dome; c.beginPath(); c.arc(fx, fy, f.rx * 0.8, 0, Math.PI * 2); c.fill();
      }

      var small = false; // 9-note radial: all surrounding fields share ring size
      var fs = Math.max(8, R * (note.kind === 'ding' ? 0.072 : (small ? 0.044 : 0.058)));
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = '500 ' + fs + 'px Inter, system-ui, sans-serif';
      c.fillStyle = 'rgba(240,236,228,0.88)';
      var showKey = !COARSE;
      c.fillText(note.name, fx, fy - (showKey ? fs * 0.38 : 0));
      if (showKey) {
        c.font = '600 ' + Math.max(7, fs * 0.74) + 'px Inter, system-ui, sans-serif';
        c.fillStyle = 'rgba(212,175,55,0.7)';
        c.fillText(note.key.toUpperCase(), fx, fy + fs * 0.78);
      }
    }
    panCache = off;
  }

  function drawGuideFields(c, time, scale) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      if (f.guide < 0.01) continue;
      var pulse = 0.72 + 0.28 * Math.sin(time * 3.2 + i * 0.35);
      var a = Math.min(0.82, f.guide * pulse);
      f.guideSuccess = Math.max(0, f.guideSuccess - 0.035);
      var rx = f.rx * (1.05 + f.guide * 0.22);
      var ry = f.ry * (1.05 + f.guide * 0.22);
      var g = c.createRadialGradient(f.cx - f.rx * 0.18, f.cy - f.ry * 0.2, 0, f.cx, f.cy, Math.max(rx, ry) * 1.45);
      g.addColorStop(0, 'rgba(255,226,112,' + (a * 0.9) + ')');
      g.addColorStop(0.32, 'rgba(230,191,65,' + (a * 0.42) + ')');
      g.addColorStop(0.72, 'rgba(212,175,55,' + (a * 0.12) + ')');
      g.addColorStop(1, 'rgba(212,175,55,0)');
      c.fillStyle = g;
      c.save();
      c.translate(f.cx, f.cy);
      c.rotate(f.rot);
      c.scale(1, f.ry / f.rx);
      c.beginPath();
      c.arc(0, 0, rx * 1.38, 0, Math.PI * 2);
      c.fill();
      c.restore();
      if (`;
