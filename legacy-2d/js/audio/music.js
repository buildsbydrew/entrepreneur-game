// The background music, written as a rule rather than a recording. No sound is made here:
// this only works out which notes to play. The loop is four bars over the chords C, A minor, F
// and G, with a plucked melody, a bass, a shaker and a clave pattern. It is rebuilt now and then,
// so it varies but always sounds like itself.
export const TEMPO = 100; // beats per minute
export const STEPS_PER_BAR = 16; // sixteenth notes

export const midiToHz = midi => 440 * Math.pow(2, (midi - 69) / 12);

// One chord per bar. Tones sit around middle C, and the bass is an octave or two lower.
const CHORDS = [
  { tones: [60, 64, 67], bass: 48 }, // C
  { tones: [57, 60, 64], bass: 45 }, // A minor
  { tones: [53, 57, 60], bass: 41 }, // F
  { tones: [55, 59, 62], bass: 43 }  // G
];

// Notes for the melody to step between: C major pentatonic, which sounds good over all four chords
export const SCALE = [64, 67, 69, 72, 74, 76, 79, 81, 84];

// Where in the bar the melody plays (in sixteenths)
const RHYTHMS = [[0, 3, 6, 8, 11, 14], [0, 2, 6, 8, 10, 13], [0, 4, 6, 9, 12, 14], [0, 3, 7, 8, 11, 15]];

// The clave pattern, as a wooden click
const CLAVE = [0, 3, 6, 10, 12];

const pick = (list, random) => list[Math.floor(random() * list.length)];

function nearestIndex(note) {
  let best = 0;
  SCALE.forEach((value, i) => {
    if (Math.abs(value - note) < Math.abs(SCALE[best] - note)) best = i;
  });
  return best;
}

// All the notes for one bar: { step, voice, midi, gain }
export function buildBar(chordIndex, random = Math.random) {
  const chord = CHORDS[chordIndex % CHORDS.length];
  const events = [];

  // Melody: a chord tone on the main beats, and a step along the scale in between
  let last = chord.tones[0] + 12;
  pick(RHYTHMS, random).forEach(step => {
    let midi;
    if (step % 4 === 0) {
      midi = pick(chord.tones, random) + 12;
    } else {
      const index = nearestIndex(last) + pick([-2, -1, 1, 2], random);
      midi = SCALE[Math.min(SCALE.length - 1, Math.max(0, index))];
    }
    last = midi;
    events.push({ step, voice: 'pluck', midi, gain: (step % 4 === 0 ? 0.2 : 0.15) + (random() - 0.5) * 0.04 });
  });

  // Bass: the root, then the fifth, and now and then the root again
  events.push({ step: 0, voice: 'bass', midi: chord.bass, gain: 0.22 });
  events.push({ step: 8, voice: 'bass', midi: chord.bass + 7, gain: 0.16 });
  if (random() < 0.5) events.push({ step: 12, voice: 'bass', midi: chord.bass, gain: 0.14 });

  // Shaker on the in-between sixteenths, and the clave
  for (let step = 0; step < STEPS_PER_BAR; step++) {
    if (step % 2 === 1) events.push({ step, voice: 'shaker', gain: 0.045 });
    else if (step % 4 === 2) events.push({ step, voice: 'shaker', gain: 0.03 });
  }
  CLAVE.forEach(step => events.push({ step, voice: 'wood', gain: 0.07 }));

  return events;
}

export function buildPhrase(random = Math.random) {
  return { bars: CHORDS.map((chord, i) => buildBar(i, random)) };
}
