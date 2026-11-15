// The home's art, drawn as SVG code. Same rules as the market (docs/art-style.md):
// a 3px warm-brown outline, flat fills, rounded corners, one soft oval shadow under
// anything that stands on the ground.
import { svgDoc } from './shapes.js';

const INK = '#3b2a20';
const LINE = `stroke="${INK}" stroke-linejoin="round" stroke-linecap="round"`;
const shadow = (cx, cy, rx, ry = 6) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#000" opacity=".18"/>`;

// A wooden bed against the wall, with a white sheet, a pillow and a striped cloth
export function bedSvg() {
  const stripes = ['#f39c12', '#1fa7a0', '#f6c026', '#3a7d44', '#f39c12', '#d6336c', '#f6c026', '#1fa7a0', '#f39c12']
    .map((fill, i) => `<rect x="${12 + i * 14}" y="60" width="14" height="40" fill="${fill}"/>`).join('');
  return svgDoc(150, 124, `${shadow(75, 117, 72)}
<g ${LINE} stroke-width="3">
<rect x="4" y="4" width="142" height="32" rx="8" fill="#8d5524"/>
<rect x="6" y="26" width="138" height="84" rx="8" fill="#6e4219"/>
<rect x="12" y="28" width="126" height="74" rx="6" fill="#fff4dc"/>
<rect x="32" y="34" width="86" height="20" rx="9" fill="#ffffff"/>
</g>
${stripes}
<path d="M12 60h126v36a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6z" fill="none" ${LINE} stroke-width="3"/>
<path d="M12 72h126M12 88h126" stroke="#fff4dc" stroke-width="2" opacity=".7"/>
<rect x="6" y="106" width="138" height="10" rx="3" fill="#5a3412" ${LINE} stroke-width="3"/>`);
}

// A small wooden table with a plate and a cup
export function tableSvg() {
  return svgDoc(124, 92, `${shadow(62, 86, 58)}
<g ${LINE} stroke-width="3">
<rect x="14" y="50" width="12" height="34" rx="3" fill="#6e4219"/>
<rect x="98" y="50" width="12" height="34" rx="3" fill="#6e4219"/>
<rect x="4" y="6" width="116" height="48" rx="8" fill="#b27436"/>
<rect x="4" y="46" width="116" height="12" rx="4" fill="#8d5524"/>
<ellipse cx="46" cy="28" rx="18" ry="10" fill="#fff4dc"/>
<ellipse cx="46" cy="27" rx="10" ry="5" fill="#f6c026"/>
<rect x="76" y="16" width="16" height="20" rx="4" fill="#2f5fd0"/>
</g>`);
}

// A low wooden stool
export function stoolSvg() {
  return svgDoc(44, 40, `${shadow(22, 35, 18, 4)}
<g ${LINE} stroke-width="3">
<rect x="9" y="18" width="7" height="16" rx="2" fill="#6e4219"/>
<rect x="28" y="18" width="7" height="16" rx="2" fill="#6e4219"/>
<rect x="4" y="6" width="36" height="16" rx="6" fill="#b27436"/>
</g>`);
}

// A woven rug that lies flat on the floor
export function rugSvg() {
  let diamonds = '';
  for (let i = 0; i < 5; i++) {
    const x = 42 + i * 34;
    diamonds += `<path d="M${x} 50l12 15-12 15-12-15z" fill="${i % 2 ? '#f6c026' : '#fff4dc'}"/>`;
  }
  return svgDoc(220, 130, `<g ${LINE} stroke-width="3">
<rect x="4" y="4" width="212" height="122" rx="10" fill="#d6336c"/>
<rect x="18" y="18" width="184" height="94" rx="6" fill="#1fa7a0"/>
</g>
${diamonds}
<path d="M22 36h176M22 94h176" stroke="#fff4dc" stroke-width="4" stroke-dasharray="8 8"/>`);
}

// A cupboard standing against the back wall, with a radio on top
export function cupboardSvg() {
  return svgDoc(90, 124, `${shadow(45, 118, 42)}
<g ${LINE} stroke-width="3">
<rect x="4" y="22" width="82" height="94" rx="6" fill="#8d5524"/>
<rect x="12" y="32" width="30" height="74" rx="4" fill="#b27436"/>
<rect x="48" y="32" width="30" height="74" rx="4" fill="#b27436"/>
<rect x="18" y="4" width="44" height="22" rx="5" fill="#d6336c"/>
<circle cx="30" cy="15" r="5" fill="#fff4dc"/>
<path d="M44 11h12M44 18h12" fill="none"/>
</g>
<circle cx="38" cy="70" r="2.5" fill="${INK}"/><circle cx="52" cy="70" r="2.5" fill="${INK}"/>`);
}

// A window set in the back wall
export function windowSvg() {
  return svgDoc(84, 56, `<g ${LINE} stroke-width="3">
<rect x="4" y="4" width="76" height="48" rx="5" fill="#8d5524"/>
<rect x="11" y="10" width="62" height="36" rx="3" fill="#8fd0f5"/>
<path d="M42 10v36M11 28h62" fill="none"/>
</g>
<path d="M18 16l10-0M18 21l6 0" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`);
}

// A clay water pot with a lid and a cup
export function waterPotSvg() {
  return svgDoc(54, 60, `${shadow(27, 54, 24, 5)}
<g ${LINE} stroke-width="3">
<path d="M10 22c-6 8-6 20 2 27 8 6 22 6 30 0 8-7 8-19 2-27z" fill="#b5652b"/>
<rect x="12" y="14" width="30" height="10" rx="4" fill="#9a5222"/>
<ellipse cx="27" cy="13" rx="17" ry="6" fill="#c97d45"/>
<rect x="38" y="4" width="10" height="10" rx="3" fill="#f6c026"/>
</g>
<path d="M14 34c3 6 8 9 14 9" stroke="#e7a36b" stroke-width="3" fill="none" stroke-linecap="round"/>`);
}

// A charcoal stove with glowing coals
export function coalPotSvg() {
  return svgDoc(54, 56, `${shadow(27, 50, 24, 5)}
<g ${LINE} stroke-width="3">
<path d="M14 30l-4 16h34l-4-16z" fill="#6c6f73"/>
<path d="M6 16c0 10 9 16 21 16s21-6 21-16z" fill="#8c8f92"/>
<ellipse cx="27" cy="16" rx="21" ry="7" fill="#4a4c4f"/>
</g>
<circle cx="20" cy="15" r="4" fill="#f39c12"/><circle cx="30" cy="14" r="4" fill="#ff6b3d"/><circle cx="35" cy="18" r="3" fill="#f6c026"/>`);
}

// A shady tree. Only the trunk is solid, because the leaves are high above.
export function treeSvg() {
  return svgDoc(150, 180, `${shadow(75, 172, 60, 10)}
<g ${LINE} stroke-width="3">
<path d="M64 120c2 20 0 36-4 50h30c-4-14-6-30-4-50z" fill="#8d5524"/>
<circle cx="45" cy="78" r="36" fill="#3a7d44"/>
<circle cx="105" cy="80" r="34" fill="#3a7d44"/>
<circle cx="75" cy="50" r="44" fill="#4a9a52"/>
<circle cx="78" cy="98" r="32" fill="#3a7d44"/>
</g>
<circle cx="60" cy="40" r="10" fill="#6cbf6a" opacity=".7"/>
<circle cx="92" cy="70" r="5" fill="#f39c12"/><circle cx="50" cy="92" r="5" fill="#f39c12"/>`);
}

// A low leafy bush
export function bushSvg() {
  return svgDoc(80, 56, `${shadow(40, 50, 36, 5)}
<g ${LINE} stroke-width="3">
<circle cx="24" cy="32" r="18" fill="#3a7d44"/>
<circle cx="56" cy="32" r="18" fill="#3a7d44"/>
<circle cx="40" cy="22" r="20" fill="#4a9a52"/>
</g>
<circle cx="30" cy="20" r="3.5" fill="#d6336c"/><circle cx="50" cy="30" r="3.5" fill="#f6c026"/><circle cx="60" cy="22" r="3.5" fill="#d6336c"/>`);
}

// A post with an arrow-shaped board, pointing right. The game flips it to point left,
// and writes the place's name on it.
export function signpostSvg() {
  return svgDoc(140, 120, `${shadow(70, 114, 18, 5)}
<g ${LINE} stroke-width="3">
<rect x="63" y="30" width="14" height="84" rx="3" fill="#6e4219"/>
<path d="M8 10h100l26 22-26 22H8a6 6 0 0 1-6-6V16a6 6 0 0 1 6-6z" fill="#b27436"/>
</g>`);
}

// Cement floor tiles, drawn so they repeat without seams
export function floorSvg() {
  return svgDoc(64, 64, `<rect width="64" height="64" fill="#dccdb2"/>
<path d="M0 63.5h64M63.5 0v64" stroke="#c4b291" stroke-width="2"/>
<circle cx="20" cy="22" r="1.5" fill="#c4b291"/><circle cx="44" cy="46" r="1.2" fill="#c4b291"/>`, 1);
}

// Every home texture, by name
export const HOME_ART = {
  'home-bed': bedSvg,
  'home-table': tableSvg,
  'home-stool': stoolSvg,
  'home-rug': rugSvg,
  'home-cupboard': cupboardSvg,
  'home-window': windowSvg,
  'home-waterPot': waterPotSvg,
  'home-coalPot': coalPotSvg,
  'home-tree': treeSvg,
  'home-bush': bushSvg,
  'home-floor': floorSvg,
  signpost: signpostSvg
};

// The size each piece is shown at in the world, in pixels
export const HOME_SIZES = {
  bed: [150, 124],
  table: [124, 92],
  stool: [44, 40],
  rug: [220, 130],
  cupboard: [90, 124],
  window: [84, 56],
  waterPot: [54, 60],
  coalPot: [54, 56],
  tree: [150, 180],
  bush: [80, 56]
};
