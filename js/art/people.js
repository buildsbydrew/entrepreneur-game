// People are built from layers: a body, a hairstyle, and optional extras.
// The same builder will power the character setup screen later.
import { svgDoc } from './shapes.js';

const INK = '#3b2a20';
const LINE = `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`;
const SHADOW = `<ellipse cx="40" cy="112" rx="24" ry="6" fill="#000" opacity=".18"/>`;
const FACE = `<circle cx="33" cy="32" r="2.6" fill="${INK}"/><circle cx="47" cy="32" r="2.6" fill="${INK}"/><path d="M34 40q6 5 12 0" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`;

// Teens and elders are drawn a little smaller than adults
const AGE_SCALE = { teen: 0.9, adult: 1, elder: 0.97 };

function manBody(l) {
  return `${SHADOW}<g ${LINE}>
<rect x="26" y="78" width="12" height="30" rx="5" fill="${l.pants}"/>
<rect x="42" y="78" width="12" height="30" rx="5" fill="${l.pants}"/>
<rect x="11" y="48" width="12" height="30" rx="6" fill="${l.shirt}"/>
<rect x="57" y="48" width="12" height="30" rx="6" fill="${l.shirt}"/>
<circle cx="17" cy="80" r="6" fill="${l.skin}"/>
<circle cx="63" cy="80" r="6" fill="${l.skin}"/>
<rect x="20" y="46" width="40" height="40" rx="14" fill="${l.shirt}"/>
<circle cx="40" cy="28" r="20" fill="${l.skin}"/></g>${FACE}`;
}

function womanBody(l) {
  return `${SHADOW}<g ${LINE}>
<rect x="29" y="92" width="9" height="18" rx="4" fill="${l.skin}"/>
<rect x="42" y="92" width="9" height="18" rx="4" fill="${l.skin}"/>
<rect x="11" y="48" width="12" height="30" rx="6" fill="${l.skin}"/>
<rect x="57" y="48" width="12" height="30" rx="6" fill="${l.skin}"/>
<path d="M24 46h32c4 0 6 3 7 8l6 42c0 4-3 6-6 6H17c-3 0-6-2-6-6l6-42c1-5 3-8 7-8z" fill="${l.shirt}"/>
<path d="M26 64h28" fill="none" stroke-width="2.5"/>
<circle cx="40" cy="28" r="20" fill="${l.skin}"/></g>${FACE}<path d="M29 28l-3-2M51 28l3-2" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
}

const HAIR = {
  short: c => `<path d="M20 26C20 6 60 6 60 26 52 17 28 17 20 26z" fill="${c}" ${LINE}/>`,
  afro: c => `<path d="M15 30C6 12 22 3 40 4s34 8 25 26c-4-9-10-13-25-13S19 21 15 30z" fill="${c}" ${LINE}/>`,
  bun: c => `<g fill="${c}" ${LINE}><circle cx="40" cy="8" r="7"/><path d="M20 26C20 6 60 6 60 26 52 17 28 17 20 26z"/></g>`,
  braids: c => `<g fill="${c}" ${LINE}><rect x="14" y="24" width="9" height="40" rx="4.5"/><rect x="57" y="24" width="9" height="40" rx="4.5"/><path d="M20 26C20 6 60 6 60 26 52 17 28 17 20 26z"/></g><path d="M18.5 36v22M61.5 36v22" stroke="${INK}" stroke-width="1.5" stroke-dasharray="3 4"/>`,
  wrap: c => `<g fill="${c}" ${LINE}><ellipse cx="46" cy="9" rx="15" ry="8"/><path d="M19 25C18 8 62 8 61 25 52 15 28 15 19 25z"/></g>`
};

const CAP = `<g ${LINE}><path d="M20 20C20 2 60 2 60 20z" fill="#f39c12"/><rect x="38" y="18" width="30" height="8" rx="4" fill="#d9820b"/></g>`;
const ELDER = `<g fill="none" stroke="${INK}" stroke-width="2"><circle cx="33" cy="32" r="5.5"/><circle cx="47" cy="32" r="5.5"/><path d="M38.5 32h3"/></g><rect x="61" y="82" width="5" height="28" rx="2.5" fill="#8d5524" stroke="${INK}" stroke-width="2.5"/>`;

// look: { body: 'man'|'woman', age: 'teen'|'adult'|'elder', skin, shirt, pants,
//         hairStyle: 'short'|'afro'|'bun'|'braids'|'wrap', hair, wrap, cap }
export function makePersonSvg(look) {
  const l = { pants: '#34495e', hair: '#2a1a12', wrap: '#f6c026', hairStyle: 'short', age: 'adult', ...look };
  const s = AGE_SCALE[l.age] ?? 1;
  const body = l.body === 'woman' ? womanBody(l) : manBody(l);
  const hair = (HAIR[l.hairStyle] ?? HAIR.short)(l.hairStyle === 'wrap' ? l.wrap : l.hair);
  const elder = l.age === 'elder' ? ELDER : '';
  const cap = l.cap ? CAP : '';
  // Shrinking is anchored at the feet so everyone stands on the same line
  const inner = `<g transform="translate(${40 * (1 - s)} ${120 * (1 - s)}) scale(${s})">${body}${hair}${elder}${cap}</g>`;
  return svgDoc(80, 120, inner);
}

export const PLAYER_LOOK = {
  body: 'man', age: 'adult', skin: '#8d5a3b', shirt: '#f39c12',
  hairStyle: 'short', hair: '#2a1a12', cap: true
};

export const CUSTOMER_LOOKS = [
  { body: 'woman', age: 'adult', skin: '#6b4226', shirt: '#1fa7a0', hairStyle: 'braids', hair: '#1a1a1a' },
  { body: 'man', age: 'elder', skin: '#4a2c1a', shirt: '#2f5fd0', pants: '#5b4636', hairStyle: 'short', hair: '#d8d8d8' },
  { body: 'man', age: 'teen', skin: '#c68b59', shirt: '#fff4dc', pants: '#2f3b6b', hairStyle: 'afro', hair: '#2a1a12' },
  { body: 'woman', age: 'teen', skin: '#6b4226', shirt: '#2f5fd0', hairStyle: 'braids', hair: '#1a1a1a' },
  { body: 'woman', age: 'adult', skin: '#4a2c1a', shirt: '#d6336c', hairStyle: 'wrap', wrap: '#f6c026' },
  { body: 'man', age: 'adult', skin: '#8d5a3b', shirt: '#1fa7a0', hairStyle: 'afro', hair: '#1a1a1a' },
  { body: 'woman', age: 'adult', skin: '#c68b59', shirt: '#f6c026', hairStyle: 'bun', hair: '#2a1a12' },
  { body: 'man', age: 'adult', skin: '#6b4226', shirt: '#2f5fd0', pants: '#2b2b2b', hairStyle: 'short', hair: '#111111' },
  { body: 'woman', age: 'elder', skin: '#6b4226', shirt: '#8e44ad', hairStyle: 'bun', hair: '#d8d8d8' },
  { body: 'man', age: 'teen', skin: '#8d5a3b', shirt: '#fff4dc', pants: '#2f3b6b', hairStyle: 'short', hair: '#2a1a12' }
];
