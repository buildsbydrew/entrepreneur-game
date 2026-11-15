// Sound effects as recipes, so every sound is made in code and nothing is borrowed.
// A recipe is a list of notes. A note is either a tone or a burst of noise:
//   at: seconds after the sound starts   len: how long it lasts   gain: how loud, 0 to 1
//   hz: pitch of a tone   glide: a pitch for it to slide to   filter and q shape a noise burst
const tone = (type, hz, at, len, gain, glide) => ({ type, hz, at, len, gain, glide });
const noise = (filter, hz, at, len, gain, q = 1) => ({ noise: true, filter, hz, at, len, gain, q });

export const SFX = {
  // A sale: a bright two-note "ching"
  coin: [tone('sine', 1319, 0, 0.22, 0.3), tone('sine', 1760, 0.08, 0.4, 0.28), tone('triangle', 3520, 0.08, 0.25, 0.08)],
  // Buying stock: a short low pop
  buy: [tone('triangle', 392, 0, 0.12, 0.28, 294), tone('sine', 196, 0, 0.15, 0.2)],
  // Something you can't do: a low double buzz
  error: [tone('square', 150, 0, 0.14, 0.16, 110), tone('square', 120, 0.13, 0.18, 0.14)],
  // Opening and closing the stall
  open: [tone('sine', 523, 0, 0.18, 0.25), tone('sine', 659, 0.1, 0.18, 0.25), tone('sine', 784, 0.2, 0.3, 0.25)],
  close: [tone('sine', 784, 0, 0.18, 0.2), tone('sine', 659, 0.1, 0.18, 0.2), tone('sine', 523, 0.2, 0.3, 0.2)],
  // A customer reaches the stall
  arrive: [tone('sine', 880, 0, 0.08, 0.08)],
  // A customer leaves unhappy, or walks away over the price
  sad: [tone('triangle', 330, 0, 0.2, 0.2, 220)],
  nope: [tone('triangle', 262, 0, 0.1, 0.2), tone('triangle', 196, 0.1, 0.18, 0.2)],
  // A goal is finished, and a whole level
  mission: [tone('sine', 523, 0, 0.2, 0.2), tone('sine', 659, 0.09, 0.2, 0.2), tone('sine', 784, 0.18, 0.2, 0.2), tone('triangle', 1047, 0.27, 0.4, 0.2)],
  levelUp: [
    tone('sine', 523, 0, 0.18, 0.24), tone('sine', 659, 0.12, 0.18, 0.24), tone('sine', 784, 0.24, 0.18, 0.24),
    tone('sine', 1047, 0.36, 0.18, 0.24), tone('sine', 1319, 0.5, 0.18, 0.24),
    tone('sine', 523, 0.62, 0.9, 0.11), tone('sine', 659, 0.62, 0.9, 0.11), tone('sine', 784, 0.62, 0.9, 0.11)
  ],
  // The interface
  ui: [noise('bandpass', 2500, 0, 0.03, 0.12, 2)],
  tick: [tone('sine', 600, 0, 0.03, 0.1)],
  blip: [tone('sine', 740, 0, 0.05, 0.1)],
  page: [noise('bandpass', 1800, 0, 0.18, 0.15, 0.8)],
  chime: [tone('sine', 988, 0, 0.3, 0.15), tone('sine', 1319, 0.1, 0.4, 0.12)],
  // The day: a bell at closing time, and a morning call
  bell: [tone('sine', 659, 0, 1.0, 0.22), tone('sine', 1318, 0, 0.8, 0.1), tone('sine', 659, 0.5, 1.0, 0.18)],
  morning: [tone('sine', 784, 0, 0.3, 0.15), tone('sine', 988, 0.15, 0.3, 0.15), tone('sine', 1175, 0.3, 0.5, 0.15)],
  // The player's footsteps, soft and dusty
  step: [noise('lowpass', 400, 0, 0.05, 0.1)]
};
