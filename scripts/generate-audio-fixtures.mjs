import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || path.resolve('handpan-app/sounds/fixtures');
const SAMPLE_RATE = 48000;
const DURATION = 0.45;
const VOICES = {
  steel: [1, 2.01, 3.99],
  warm: [1, 1.01, 2.01],
  bell: [1, 2.02, 4.01],
  soft: [1, 1.005, 2.005],
  deep: [0.5, 1, 2]
};
const NOTES = [
  ['D3',146.832],['A3',220],['Bb3',233.082],['C4',261.626],['D4',293.665],
  ['E4',329.628],['F4',349.228],['G4',391.995],['A4',440],['B4',493.883],
  ['C5',523.251],['D5',587.33],['E5',659.255]
];

function writeWav(file, voicePartials, frequency) {
  const frames = Math.floor(SAMPLE_RATE * DURATION);
  const data = Buffer.alloc(frames * 2);
  for (let i = 0; i < frames; i++) {
    const t = i / SAMPLE_RATE;
    const envelope = Math.exp(-t * 7.5);
    let sample = 0;
    voicePartials.forEach((ratio, index) => {
      sample += Math.sin(2 * Math.PI * frequency * ratio * t) * (0.52 / (index + 1));
    });
    sample *= envelope * 0.55;
    data.writeInt16LE(Math.max(-1, Math.min(1, sample)) * 32767, i * 2);
  }

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([header, data]));
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'FIXTURE-ONLY.txt'), 'Synthetic test fixtures. Never ship these as production recordings.\n');

for (const [voice, partials] of Object.entries(VOICES)) {
  const dir = path.join(OUT, voice);
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, frequency] of NOTES) {
    writeWav(path.join(dir, name + '--fixture.wav'), partials, frequency);
  }
}

console.log(`Generated synthetic fixture pack in ${OUT}`);
