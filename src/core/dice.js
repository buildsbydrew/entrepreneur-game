// Two kinds of chance. The life's own dice (Math.random) decide what happens: life events, a baby's
// sex, how long someone lives. These "cosmetic" dice decide only how things look and sound: when
// someone blinks, their stride, when they stroll, the wobble of a voice. Keeping them apart means a
// change to how people look or sound never changes the story of a life (film mode seeds both).
let roll = () => Math.random();

export function cosmetic() {
  return roll();
}

// Film mode gives the cosmetic dice their own seeded stream
export function setCosmeticDice(fn) {
  roll = fn;
}
