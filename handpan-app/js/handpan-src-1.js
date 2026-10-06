export default ` [0, 7, 10, 12, 14, 15, 17, 19, 22],
      description: 'Open, highly resonant minor scale allowing for continuous melody flow.'
    },
    {
      id: 'akebono',
      label: 'AkeBono',
      intervals: [0, 7, 8, 12, 13, 17, 19, 20, 24],
      description: 'Traditional Japanese pentatonic scale, deeply spiritual and calming.'
    },
    {
      id: 'equinox',
      label: 'Equinox',
      intervals: [0, 5, 8, 12, 14, 15, 17, 19, 24],
      description: 'A highly balanced scale mixing major and minor emotional states.'
    },
    {
      id: 'mixolydian',
      label: 'Mixolydian',
      intervals: [0, 7, 10, 12, 14, 16, 17, 19, 22],
      description: 'Bright, uplifting, and bluesy; excellent for high-energy looping.'
    },
    {
      id: 'aeolian',
      label: 'Aeolian',
      intervals: [0, 7, 8, 10, 12, 13, 15, 17, 19],
      description: 'Natural minor scale providing melancholic, cinematic atmospheres.'
    },
    {
      id: 'major-sabye',
      label: 'Major / Sabye',
      intervals: [0, 7, 11, 12, 14, 16, 17, 19, 23],
      description: 'Joyful, bright, and strictly harmonious; zero dissonance.'
    }
  ];

  // Transposition state — dynamic, not hardcoded per key
  // Default Ding = D3 (MIDI 50)
  var baseMidi = 50;
  var octaveOffset = 0; // -1 | 0 | +1
  var scaleIndex = 0;
  var NOTES = [];
  var KEY_TO_IDX = {};
  var CODE_TO_IDX = {};

  var NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  var NOTE_NAMES_FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

  function midiToName(midi, preferFlat) {
    var m = Math.round(midi);
    var pc = ((m % 12) + 12) % 12;
    var oct = Math.floor(m / 12) - 1;
    var names = preferFlat ? NOTE_NAMES_FLAT : NOTE_NAMES;
    return names[pc] + oct;
  }

  function currentRootName() {
    return midiToName(baseMidi + octaveOffset * 12);
  }

  function buildNotesFromScale(scale) {
    var list = [];
    var intervals = scale.intervals;
    for (var i = 0; i < 9; i++) {
      var midi = baseMidi + intervals[i] + (octaveOffset * 12);
      var isDing = i === 0;
      var angle = isDing ? 0 : RING_ANGLES[i - 1];
      list.push({
        key: KEYS[i].key,
        code: KEYS[i].code,
        name: midiToName(midi),
        midi: midi,
        interval: intervals[i],
        kind: isDing ? 'ding' : 'ring',
        a: angle
      });
    }
    list.forEach(function (n) {
      n.freq = mtof(n.midi);
      n.pan = n.kind === 'ding' ? 0 : Math.max(-0.6, Math.min(0.6, Math.sin(n.a * Math.PI / 180) * 0.55));
    });
    return list;
  }

  function reindexKeys() {
    KEY_TO_IDX = {}; CODE_TO_IDX = {};
    NOTES.forEach(function (n, i) {
      KEY_TO_IDX[n.key] = i; CODE_TO_IDX[n.code] = i;
    });
  }

  function updateTransposeUI() {
    var rootEl = document.getElementById('hpRootNote');
    if (rootEl) rootEl.textContent = currentRootName();
    var octEl = document.getElementById('hpOctaveLabel');
    if (octEl) {
      var o = octaveOffset;
      octEl.textContent = o === 0 ? '0' : (o > 0 ? '+' + o : String(o));
    }
  }

  /**
   * Rebuild note frequencies/names from current scale + transposition.
   * Does NOT interrupt active voices — only remaps the pad → MIDI table.
   */
  function rebuildNotes(dir) {
    var scale = SCALES[scaleIndex];
    NOTES = buildNotesFromScale(scale);
    reindexKeys();
    updateTransposeUI();

    var sub = document.getElementById('hpSub');
    if (sub) sub.textContent = scale.label + ' · ' + current`;
