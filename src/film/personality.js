// Personalities for the autopilot. Each one says how much it cares about each kind of outcome
// (being kind, being cheeky, money, friends, school...). A choice is scored by what it changes,
// plus a little randomness from the seed, and the reason is the thing that tipped it.

export const PROFILES = {
  kind: {
    label: 'Kind',
    about: 'puts other people first',
    traits: { kind: 4, calm: 2, curious: 1, bold: 0.5, cheeky: -2 },
    skills: { social: 2, study: 1, craft: 1, fitness: 0.5, money: 0.3 },
    bond: 2.5, money: -0.2, happiness: 0.5, health: 0.4,
    bondTag: { family: 1.5, friends: 1.5 },
    chatty: 0.7, playful: 0.5
  },
  troublemaker: {
    label: 'Troublemaker',
    about: 'always up to something',
    traits: { cheeky: 4, bold: 3, curious: 1, kind: -1, calm: -1.5 },
    skills: { fitness: 1.5, social: 1, money: 1, craft: 0.5, study: -0.8 },
    bond: 0.4, money: 0.8, happiness: 0.8, health: 0.1,
    bondTag: { friends: 1.5, family: -0.3 },
    chatty: 0.5, playful: 0.9
  },
  ambitious: {
    label: 'Ambitious',
    about: 'wants to get somewhere',
    traits: { bold: 2.5, curious: 2, kind: 0.5, calm: 0.5 },
    skills: { study: 3, money: 3, craft: 1.5, social: 1, fitness: 0.5 },
    bond: 0.8, money: 1.4, happiness: 0.1, health: 0.3,
    bondTag: { family: 0.5, friends: 0.5 },
    chatty: 0.4, playful: 0.3
  },
  dreamer: {
    label: 'Dreamer',
    about: 'head in the clouds, hands always making something',
    traits: { curious: 4, calm: 2, kind: 1, bold: 0.5 },
    skills: { craft: 3, study: 1, social: 0.5 },
    bond: 1, money: -0.1, happiness: 1, health: 0.3,
    bondTag: { family: 1, friends: 1 },
    chatty: 0.5, playful: 0.8
  }
};

const TRAIT_WORDS = {
  kind: 'the kind thing to do', bold: 'the bold move', cheeky: 'pure cheek', curious: 'curiosity wins', calm: 'the calm choice'
};
const SKILL_WORDS = {
  study: 'good for the brain', social: 'more friends, more fun', fitness: 'keeps you moving', craft: 'something to make', money: 'a head for money'
};

// Turns an effects object into scored parts: [{ score, why }]
export function scoreEffects(profile, effects, nameOf = id => id, scale = 1) {
  const parts = [];
  if (!effects) return parts;
  const add = (score, why) => { if (score) parts.push({ score: score * scale, why }); };
  for (const [id, v] of Object.entries(effects.traits ?? {})) add((profile.traits[id] ?? 0) * v, TRAIT_WORDS[id] ?? id);
  for (const [id, v] of Object.entries(effects.skills ?? {})) add((profile.skills[id] ?? 0) * v, SKILL_WORDS[id] ?? id);
  if (effects.bond) add(profile.bond * effects.bond, effects.bond > 0 ? `${nameOf(null)} will like it` : `${nameOf(null)} won't like it`);
  for (const [id, v] of Object.entries(effects.bondWith ?? {})) add(profile.bond * v, v > 0 ? `${nameOf(id)} will like it` : `${nameOf(id)} won't like it`);
  for (const [tag, v] of Object.entries(effects.bondTag ?? {})) add((profile.bondTag[tag] ?? 0) * v, tag === 'family' ? 'family first' : tag === 'friends' ? 'friends first' : tag);
  if (effects.money) {
    const v = Math.sign(effects.money) * Math.sqrt(Math.abs(effects.money));
    add(profile.money * v, effects.money > 0 ? 'it pays' : profile.money < 0 ? 'happy to share' : 'it costs livs');
  }
  const happiness = (effects.happiness ?? 0) + (effects.needs?.happiness ?? 0);
  if (happiness) add(profile.happiness * happiness / 4, happiness > 0 ? "it's fun" : 'not much fun');
  if (effects.needs?.health) add(profile.health * effects.needs.health / 4, effects.needs.health > 0 ? 'good for you' : 'hard on the body');
  if (effects.remember) add(1, 'a moment worth remembering');
  if (effects.setFlag) add(0.3, 'something might come of it');
  return parts;
}

// Picks one option. score(option) gives its parts. Returns { index, reason }.
export function pickOption(profile, options, partsOf, random, temperature = 1.6) {
  let best = -1;
  let bestTotal = -Infinity;
  let bestParts = [];
  let bestNoise = 0;
  options.forEach((option, i) => {
    const parts = partsOf(option, i);
    const noise = random() * temperature;
    const total = parts.reduce((a, p) => a + p.score, 0) + noise;
    if (total > bestTotal) { bestTotal = total; best = i; bestParts = parts; bestNoise = noise; }
  });
  const top = [...bestParts].sort((a, b) => b.score - a.score)[0];
  const reason = top && top.score > bestNoise * 0.6 ? top.why : (top && top.score > 0 ? top.why : 'it just felt right');
  return { index: Math.max(0, best), reason: `${profile.label}: ${reason}` };
}
