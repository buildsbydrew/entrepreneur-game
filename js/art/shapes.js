// The market's art, drawn as SVG code. Every shape follows docs/art-style.md:
// a 3px warm-brown outline, flat fills, rounded corners, one soft oval shadow.
const INK = '#3b2a20';
const LINE = `stroke="${INK}" stroke-linejoin="round" stroke-linecap="round"`;

// Wraps shapes in an SVG document. px is how many pixels to draw per unit.
export function svgDoc(w, h, inner, px = 2) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * px}" height="${h * px}" viewBox="0 0 ${w} ${h}">${inner}</svg>`;
}

// Goods, each drawn in a 48 x 48 box
export const ITEM_ART = {
  bread: `<g ${LINE} stroke-width="2.5"><path d="M6 28c0-9 8-16 18-16s18 7 18 16c0 5-3 8-8 8H14c-5 0-8-3-8-8z" fill="#d4a24c"/><path d="M16 18l4 8M25 16l3 9M34 19l2 7" fill="none"/></g>`,
  water: `<g ${LINE} stroke-width="2.5"><path d="M9 14c3-3 7-4 15-4s12 1 15 4l-2 20c-3 4-8 5-13 5s-10-1-13-5z" fill="#8fd0f5"/><path d="M12 14l2 2M17 12l1 3M23 11v3M29 12l-1 3M35 14l-2 2" fill="none"/><path d="M16 26c2 3 5 4 8 4" fill="none" stroke="#fff"/></g>`,
  plantain: `<g ${LINE} stroke-width="2.5"><path d="M7 32C8 17 20 7 38 7c3 0 4 3 2 5-12 3-19 10-21 22-1 4-5 6-9 4-2-1-3-4-3-6z" fill="#7fb069"/><path d="M13 28c3-10 10-16 22-18" fill="none" stroke="#b6d98f"/></g>`,
  yam: `<g ${LINE} stroke-width="2.5"><path d="M6 34c-2-6 4-10 14-14 10-4 18-10 22-8 4 2 2 8-4 14-8 8-18 14-26 12-3-1-5-2-6-4z" fill="#b5835a"/><path d="M16 28l3-3M24 24l3-3M31 19l3-3" fill="none" stroke="#8a5f3a"/></g>`,
  tomato: `<g ${LINE} stroke-width="2.5"><circle cx="24" cy="28" r="14" fill="#d94b3d"/><path d="M16 17l8 5 8-5-3 7-5-2-5 2z" fill="#3a7d44"/></g>`
};

// Items with no drawing yet get a simple colored disc
function itemArt(item) {
  return ITEM_ART[item.id] ?? `<circle cx="24" cy="24" r="16" fill="${item.color ?? '#cccccc'}" ${LINE} stroke-width="2.5"/>`;
}

export const itemSvg = item => svgDoc(48, 48, itemArt(item));

// The stall's frame: posts, counter and a striped awning in two colors
function stallBase(a, b) {
  let stripes = '';
  for (let i = 0; i < 6; i++) {
    stripes += `<path d="M${2 + i * 36} 40h36v22a18 14 0 0 1-36 0z" fill="${i % 2 ? b : a}" ${LINE} stroke-width="3"/>`;
  }
  return `<ellipse cx="110" cy="182" rx="104" ry="8" fill="#000" opacity=".18"/>
<g ${LINE} stroke-width="3">
<rect x="22" y="40" width="10" height="126" fill="#6e4219"/>
<rect x="188" y="40" width="10" height="126" fill="#6e4219"/>
<rect x="14" y="112" width="192" height="64" rx="8" fill="#8d5524"/>
<path d="M18 134h184M18 155h184" fill="none" stroke-width="2" opacity=".45"/>
<rect x="8" y="100" width="204" height="16" rx="7" fill="#b27436"/>
<rect x="0" y="16" width="220" height="26" rx="9" fill="${a}"/>
</g>${stripes}`;
}

// Open: bright awning and goods on the counter
export function stallOpenSvg(items, a = '#1fa7a0', b = '#fff4dc') {
  const goods = [0, 1, 2, 3].map(i => {
    const item = items[i % items.length];
    return `<g transform="translate(${26 + i * 44} 74) scale(.75)">${itemArt(item)}</g>`;
  }).join('');
  return svgDoc(220, 190, stallBase(a, b) + goods);
}

// Closed: greyed-out awning and a shutter across the counter
export function stallClosedSvg() {
  return svgDoc(220, 190, stallBase('#8c8f92', '#c9c9c4') +
    `<rect x="26" y="78" width="168" height="22" rx="5" fill="#6e4219" ${LINE} stroke-width="3"/><text x="110" y="94" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="800" fill="#f6e7c8" letter-spacing="2">CLOSED</text>`);
}

export const crateSvg = () => svgDoc(90, 70,
  `<ellipse cx="45" cy="64" rx="42" ry="6" fill="#000" opacity=".18"/><g ${LINE} stroke-width="3"><rect x="4" y="16" width="82" height="46" rx="6" fill="#b27436"/><path d="M4 31h82M4 46h82" fill="none" stroke-width="2" opacity=".5"/><rect x="2" y="12" width="86" height="10" rx="4" fill="#c88a44"/></g>`);

export const umbrellaSvg = () => svgDoc(120, 150,
  `<ellipse cx="60" cy="144" rx="26" ry="5" fill="#000" opacity=".18"/><g ${LINE} stroke-width="3"><rect x="56" y="58" width="8" height="84" rx="3" fill="#6e4219"/><path d="M6 62C10 24 38 6 60 6s50 18 54 56c-9-8-18-8-27 0-9-8-18-8-27 0-9-8-18-8-27 0-9-8-18-8-27 0z" fill="#d6336c"/><path d="M60 6C48 24 42 44 33 62c9-8 18-8 27 0zM60 6c12 18 18 38 27 56-9-8-18-8-27 0z" fill="#f6c026"/></g>`);

// Thought bubble that sits above a customer
export const bubbleSvg = () => svgDoc(64, 74,
  `<g ${LINE} stroke-width="3"><path d="M25 52 32 68 39 52z" fill="#fff"/><rect x="2" y="2" width="60" height="52" rx="14" fill="#fff"/></g><path d="M27 53h10" stroke="#fff" stroke-width="4"/>`);

// Small tag that hangs on a crate and carries its price
export const tagSvg = () => svgDoc(60, 26,
  `<rect x="2" y="2" width="56" height="22" rx="8" fill="#fff4dc" stroke="${INK}" stroke-width="3"/>`);

// Repeating ground tile. Nothing touches the edges, so it tiles without seams.
export const dirtSvg = () => svgDoc(128, 128,
  `<rect width="128" height="128" fill="#d8b98a"/><ellipse cx="32" cy="38" rx="18" ry="8" fill="#c49a64" opacity=".5"/><ellipse cx="94" cy="92" rx="22" ry="9" fill="#c49a64" opacity=".5"/><ellipse cx="98" cy="28" rx="11" ry="5" fill="#e3c99c" opacity=".7"/><ellipse cx="30" cy="104" rx="13" ry="5" fill="#e3c99c" opacity=".7"/><circle cx="62" cy="62" r="2.5" fill="#b98a55"/><circle cx="14" cy="76" r="2" fill="#b98a55"/><circle cx="112" cy="58" r="2" fill="#b98a55"/><circle cx="70" cy="14" r="1.8" fill="#b98a55"/><circle cx="52" cy="116" r="1.8" fill="#b98a55"/>`, 1);
