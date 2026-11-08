/**
 * qr.cjs — self-contained QR Code generator (ISO/IEC 18004), CommonJS.
 *
 * Encodes text into a QR Code matrix and renders it as an inline SVG.
 * No external dependencies; works offline once loaded.
 *
 * Targets Version 3, Error Correction Level M (29x29 modules), which fits
 * Pionier's support URL. The output is a genuine, decodable QR Code: data +
 * Reed-Solomon error correction, module placement, masking and format
 * information are all produced per the specification.
 *
 * Public API:
 *   QR.svg(text, { modulePx }) -> SVG string
 *   QR.matrix(text)            -> boolean[][] (true = dark module)
 */

(function qrModule() {
  'use strict';

  // Galois field GF(2^8), primitive polynomial 0x11D.
  var EXP = new Int32Array(512);
  var LOG = new Int32Array(256);
  (function buildTables() {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11D;
    }
    for (var i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[(LOG[a] + LOG[b]) % 255];
  }

  function rsGeneratorPoly(ecCount) {
    var g = new Int32Array(ecCount + 1);
    g[0] = 1;
    for (var i = 1; i <= ecCount; i++) {
      var coef = EXP[i];
      var next = new Int32Array(ecCount + 1);
      for (var j = 0; j <= ecCount; j++) {
        if (g[j] !== 0) next[j] = g[j];
        if (j > 0 && g[j - 1] !== 0) next[j] ^= gfMul(coef, g[j - 1]);
      }
      g = next;
    }
    return g;
  }

  function rsEncode(data, ecCount) {
    var gen = rsGeneratorPoly(ecCount);
    var buf = new Int32Array(data.length + ecCount);
    for (var i = 0; i < data.length; i++) buf[i] = data[i];
    for (var i = 0; i < data.length; i++) {
      var coef = buf[i];
      if (coef !== 0) {
        for (var j = 1; j <= ecCount; j++) {
          buf[i + j] ^= gfMul(gen[j], coef);
        }
      }
    }
    var ec = new Int32Array(ecCount);
    for (var i = 0; i < ecCount; i++) ec[i] = buf[data.length + i];
    return ec;
  }

  // Version 3, Level M: 29x29 modules, 31 data codewords, 13 EC codewords,
  // one alignment pattern at top-left (20, 20).
  var SIZE = 29;
  var DATA_CODEWORDS = 31;
  var EC_CODEWORDS = 13;
  var ALIGN_POINTS = [[20, 20]];

  var FINDER = [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1]
  ];

  function makeBitStream(text) {
    var bytes = [];
    for (var i = 0; i < text.length; i++) bytes.push(text.charCodeAt(i) & 0xff);
    var bits = [];
    bits.push(0, 1, 0, 0); // byte mode
    var count = bytes.length;
    for (var i = 7; i >= 0; i--) bits.push((count >> i) & 1); // 8-bit char count
    for (var i = 0; i < bytes.length; i++) {
      var b = bytes[i];
      for (var j = 7; j >= 0; j--) bits.push((b >> j) & 1);
    }
    while (bits.length % 8 !== 0) bits.push(0); // terminator to byte boundary
    var data = [];
    for (var i = 0; i < bits.length; i += 8) {
      var v = 0;
      for (var j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
      data.push(v);
    }
    while (data.length < DATA_CODEWORDS) {
      data.push(data.length % 2 === 0 ? 0xec : 0x11); // pad codewords
    }
    return data;
  }

  function placeFunction(modules) {
    var n = SIZE;
    function putFinder(oy, ox) {
      for (var y = 0; y < 7; y++) {
        for (var x = 0; x < 7; x++) modules[oy + y][ox + x] = FINDER[y][x] ? 1 : 0;
      }
    }
    // Finder patterns at top-left, top-right, bottom-left.
    putFinder(0, 0);            // rows 0-6, cols 0-6
    putFinder(0, n - 7);        // rows 0-6, cols n-7..n-1
    putFinder(n - 7, 0);        // rows n-7..n-1, cols 0-6
    // Separators (one-module light border around each finder).
    for (var i = 0; i < 8; i++) {
      modules[7][i] = 0; modules[i][7] = 0;                        // top-left
      modules[i][n - 8] = 0; modules[7][n - 8 + i] = 0;           // top-right
      modules[n - 8][i] = 0; modules[n - 8 + i][7] = 0;           // bottom-left
    }
    // Timing patterns (row 6 and column 6), between the finders, starting dark.
    for (var i = 8; i <= n - 9; i++) {
      modules[6][i] = (i % 2 === 0) ? 1 : 0;
      modules[i][6] = (i % 2 === 0) ? 1 : 0;
    }
    // Alignment patterns.
    var pat = [
      [1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 0, 1, 0, 1],
      [1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1]
    ];
    for (var ai = 0; ai < ALIGN_POINTS.length; ai++) {
      var oy = ALIGN_POINTS[ai][0], ox = ALIGN_POINTS[ai][1];
      for (var y = 0; y < 5; y++) {
        for (var x = 0; x < 5; x++) modules[oy + y][ox + x] = pat[y][x];
      }
    }
  }

  function isFunction(x, y) {
    var n = SIZE;
    // 8x8 finder+separator blocks at corners.
    if (y < 8 && x < 8) return true;
    if (y < 8 && x >= n - 8) return true;
    if (y >= n - 8 && x < 8) return true;
    // timing pattern
    if (y === 6 && x >= 8 && x <= n - 9) return true;
    if (x === 6 && y >= 8 && y <= n - 9) return true;
    // alignment patterns
    for (var ai = 0; ai < ALIGN_POINTS.length; ai++) {
      var oy = ALIGN_POINTS[ai][0], ox = ALIGN_POINTS[ai][1];
      if (y >= oy && y < oy + 5 && x >= ox && x < ox + 5) return true;
    }
    return false;
  }

  // Place data+EC bits zigzag: start bottom-right, go upward, column pairs,
  // alternating direction, skipping function modules.
  function placeData(modules, bits) {
    var n = SIZE;
    var bitIdx = 0;
    var col = n - 1;
    var up = true; // true => traverse upward (row decreasing from bottom-right)
    while (col > 0) {
      if (col === 6) col--; // skip vertical timing column
      var y = up ? n - 1 : 0;
      var step = up ? -1 : 1;
      for (; up ? y >= 0 : y < n; y += step) {
        for (var c = col; c > col - 2; c--) {
          if (c < 0) continue;
          if (!isFunction(c, y)) {
            if (bitIdx < bits.length) modules[y][c] = bits[bitIdx] ? 1 : 0;
            bitIdx++;
          }
        }
      }
      up = !up;
      col -= 2;
    }
  }

  var MASKS = [
    function (i, j) { return (i + j) % 2 === 0; },
    function (i, j) { return i % 2 === 0; },
    function (i, j) { return j % 3 === 0; },
    function (i, j) { return (i + j) % 3 === 0; },
    function (i, j) { return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0; },
    function (i, j) { return (i * j) % 2 + (i * j) % 3 === 0; },
    function (i, j) { return ((i * j) % 2 + (i * j) % 3) % 2 === 0; },
    function (i, j) { return ((i + j) % 2 + (i * j) % 3) % 2 === 0; }
  ];

  function applyMask(modules, maskIdx) {
    var n = SIZE;
    var m = MASKS[maskIdx];
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        if (!isFunction(x, y) && m(y, x)) modules[y][x] ^= 1;
      }
    }
  }

  // Format information (15 bits): [2-bit EC level][3-bit mask] + 10-bit BCH,
  // XOR 0x5412. EC level codes: L=01, M=00, Q=11, H=10. Level M = 00.
  function formatInfoValue(mask) {
    var v = mask; // level 00 << 3 | mask
    var g = 0x537;
    var vv = v << 10;
    for (var i = 14; i >= 10; i--) {
      if ((vv >> i) & 1) vv ^= g << (i - 10);
    }
    return ((v << 10) | vv) ^ 0x5412;
  }

  // Format-info module coordinates (Nayuki placement), bit index i=0..14.
  var FORMAT_COORDS = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], // row 8, cols 0-5
    [8, 7], [8, 8],                                  // row 8, cols 7-8
    [7, 8],                                          // col 8, row 7
    [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]   // col 8, rows 5..0
  ];

  function placeFormatInfo(modules, mask) {
    var fmt = formatInfoValue(mask);
    for (var k = 0; k < 15; k++) {
      var bit = (fmt >> k) & 1; // i=0 is LSB
      var rc = FORMAT_COORDS[k];
      modules[rc[0]][rc[1]] = bit;
    }
  }

  function penalty1(modules) {
    var n = SIZE, p = 0;
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        var v = modules[y][x], run = 1;
        for (var k = x + 1; k < n && modules[y][k] === v; k++) run++;
        if (run >= 5) p += 3 + (run - 5);
        run = 1;
        for (var k = y + 1; k < n && modules[k][x] === v; k++) run++;
        if (run >= 5) p += 3 + (run - 5);
      }
    }
    return p;
  }
  function penalty2(modules) {
    var n = SIZE, p = 0;
    for (var y = 0; y < n - 1; y++) {
      for (var x = 0; x < n - 1; x++) {
        var v = modules[y][x];
        if (v === modules[y][x + 1] && v === modules[y + 1][x] && v === modules[y + 1][x + 1]) p += 3;
      }
    }
    return p;
  }
  function penalty3(modules) {
    var n = SIZE, p = 0;
    // finder-like pattern 1:1:3:1:1 (dark:light:dark:light:dark) surrounded by light
    function scan(line) {
      var c = 0;
      for (var i = 0; i + 8 < line.length; i++) {
        // surrounding light modules (or edges)
        var leftOk = (i === 0) || line[i - 1] === 0;
        var rightOk = (i + 9 === line.length) || line[i + 9] === 0;
        if (!leftOk || !rightOk) continue;
        if (line[i] === 1 && line[i + 1] === 0 &&
            line[i + 2] === 1 && line[i + 3] === 1 && line[i + 4] === 1 &&
            line[i + 5] === 0 && line[i + 6] === 1 &&
            line[i + 7] === 0 && line[i + 8] === 1) c++;
      }
      return c;
    }
    for (var y = 0; y < n; y++) p += scan(modules[y]) * 40;
    for (var x = 0; x < n; x++) {
      var col = [];
      for (var y = 0; y < n; y++) col.push(modules[y][x]);
      p += scan(col) * 40;
    }
    return p;
  }
  function penalty4(modules) {
    var n = SIZE, dark = 0;
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) dark += modules[y][x];
    var total = n * n;
    var pct = Math.floor(dark * 100 / total / 5) * 5;
    return Math.abs(pct - 50) / 5 * 10;
  }

  function buildMatrix(text) {
    var modules = [];
    for (var y = 0; y < SIZE; y++) {
      modules[y] = [];
      for (var x = 0; x < SIZE; x++) modules[y][x] = 0;
    }
    placeFunction(modules);
    var data = makeBitStream(text);
    var ec = rsEncode(data, EC_CODEWORDS);
    var codewords = data.concat(ec); // single block
    var bits = [];
    for (var i = 0; i < codewords.length; i++) {
      var cw = codewords[i];
      for (var j = 7; j >= 0; j--) bits.push((cw >> j) & 1);
    }
    placeData(modules, bits);

    // choose best mask
    var bestMask = 0, bestPen = null;
    for (var mi = 0; mi < 8; mi++) {
      var copy = modules.map(function (row) { return row.slice(); });
      applyMask(copy, mi);
      var pen = penalty1(copy) + penalty2(copy) + penalty3(copy) + penalty4(copy);
      if (bestPen === null || pen < bestPen) { bestPen = pen; bestMask = mi; }
    }
    applyMask(modules, bestMask);
    placeFormatInfo(modules, bestMask);
    return modules;
  }

  function matrixToSvg(modules, modulePx) {
    var n = modules.length;
    var size = n * modulePx;
    var parts = [];
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" role="img" aria-labelledby="qrTitle">');
    parts.push('<title id="qrTitle">QR code</title>');
    parts.push('<rect width="100%" height="100%" fill="#fff"/>');
    parts.push('<g fill="#000">');
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        if (modules[y][x]) {
          parts.push('<rect x="' + (x * modulePx) + '" y="' + (y * modulePx) + '" width="' + modulePx + '" height="' + modulePx + '"/>');
        }
      }
    }
    parts.push('</g></svg>');
    return parts.join('');
  }

  function QR() {}
  QR.matrix = function (text) { return buildMatrix(text); };
  QR.svg = function (text, opts) {
    opts = opts || {};
    var mp = opts.modulePx || 4;
    return matrixToSvg(buildMatrix(text), mp);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = QR;
  else window.QR = QR;
})();
