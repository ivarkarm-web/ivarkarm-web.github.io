/**
 * sample-metadata.js — traceable sample source metadata for Pionier
 */

export const HANDPAN_SAMPLE_META = [
  {
    filename: 'C3.mp3',
    instrument: 'handpan',
    object: 'tone field',
    source: 'haganenote/virtual-handpan',
    creator: 'Haganenote',
    license: 'See upstream project; used for virtual instrument playback',
    licenseUrl: 'https://github.com/haganenote/virtual-handpan',
    attribution: 'Samples recorded by Haganenote (www.haganenote.com/vst)',
    status: 'modified',
    notes: 'Dry one-shot; pitch-shifted at runtime when needed',
    midi: 48
  }
];

export const PLACEHOLDER_META = {
  kitchen: {
    glass: { filename: '(synth)', instrument: 'kitchen', object: 'glass', source: 'Pionier internal synthesis', creator: 'Ivar Karm / Pionier', license: 'Original', status: 'placeholder', notes: 'Temporary synthesis. Replace with licensed recording.' },
    bowl: { filename: '(synth)', instrument: 'kitchen', object: 'ceramic bowl', source: 'Pionier internal synthesis', creator: 'Ivar Karm / Pionier', license: 'Original', status: 'placeholder', notes: 'Temporary synthesis.' },
    pot: { filename: '(synth)', instrument: 'kitchen', object: 'pot', source: 'Pionier internal synthesis', creator: 'Ivar Karm / Pionier', license: 'Original', status: 'placeholder', notes: 'Temporary synthesis.' },
    pan: { filename: '(synth)', instrument: 'kitchen', object: 'pan', source: 'Pionier internal synthesis', creator: 'Ivar Karm / Pionier', license: 'Original', status: 'placeholder', notes: 'Temporary synthesis.' },
    spoon: { filename: '(synth)', instrument: 'kitchen', object: 'spoon/metal', source: 'Pionier internal synthesis', creator: 'Ivar Karm / Pionier', license: 'Original', status: 'placeholder', notes: 'Temporary synthesis.' }
  },
  bird: {
    chirp: { filename: '(synth)', instrument: 'bird', object: 'chirp', source: 'Pionier internal synthesis', creator: 'Ivar Karm / Pionier', license: 'Original', status: 'placeholder', notes: 'Temporary hybrid FM/noise.' },
    trill: { filename: '(synth)', instrument: 'bird', object: 'trill', source: 'Pionier internal synthesis', creator: 'Ivar Karm / Pionier', license: 'Original', status: 'placeholder', notes: 'Temporary synthesis.' },
    whistle: { filename: '(synth)', instrument: 'bird', object: 'whistle', source: 'Pionier internal synthesis', creator: 'Ivar Karm / Pionier', license: 'Original', status: 'placeholder', notes: 'Temporary synthesis.' },
    click: { filename: '(synth)', instrument: 'bird', object: 'click', source: 'Pionier internal synthesis', creator: 'Ivar Karm / Pionier', license: 'Original', status: 'placeholder', notes: 'Temporary synthesis.' },
    call: { filename: '(synth)', instrument: 'bird', object: 'call', source: 'Pionier internal synthesis', creator: 'Ivar Karm / Pionier', license: 'Original', status: 'placeholder', notes: 'Temporary synthesis.' }
  }
};

export function enrichFromManifest(manifestEntry) {
  return {
    filename: manifestEntry.file,
    instrument: 'handpan',
    object: 'tone field',
    source: manifestEntry.source || 'haganenote/virtual-handpan',
    creator: 'Haganenote',
    license: 'See upstream project',
    licenseUrl: 'https://github.com/haganenote/virtual-handpan',
    attribution: 'Samples recorded by Haganenote',
    status: 'modified',
    notes: manifestEntry.type || 'one-shot',
    midi: manifestEntry.midi
  };
}
