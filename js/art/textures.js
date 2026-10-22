// Draws every piece of art once, at startup, and hands it to Phaser as a texture.
import { itemSvg, stallOpenSvg, stallClosedSvg, crateSvg, umbrellaSvg, bubbleSvg, tagSvg, dirtSvg, priceBoardSvg } from './shapes.js';
import { makePersonSvg, WALK_FRAMES, CUSTOMER_LOOKS } from './people.js';

export const CUSTOMER_KEYS = CUSTOMER_LOOKS.map((look, i) => `customer-${i}`);

function addSvgTexture(scene, key, svg) {
  if (scene.textures.exists(key)) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      scene.textures.addImage(key, img);
      resolve();
    };
    img.onerror = () => reject(new Error(`Could not draw the texture "${key}"`));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

// Standing frames for some views and walking frames for others, named like
// player-side-idle and player-side-walk0. Only the views a person uses get drawn.
function personJobs(key, look, { idle, walk }) {
  const jobs = idle.map(view => [`${key}-${view}-idle`, makePersonSvg(look, 'idle', view)]);

  walk.forEach(view => {
    for (let i = 0; i < WALK_FRAMES; i++) {
      jobs.push([`${key}-${view}-walk${i}`, makePersonSvg(look, `walk${i}`, view)]);
    }
  });

  return jobs;
}

// The player and the customers walk every way.
const PLAYER_VIEWS = { idle: ['down', 'up', 'side'], walk: ['down', 'up', 'side'] };
const CUSTOMER_VIEWS = { idle: ['down', 'up', 'side'], walk: ['down', 'up', 'side'] };
const MENTOR_VIEWS = { idle: ['down', 'up', 'side'], walk: ['down', 'up', 'side'] };
const MENTOR_GOODS = [{ id: 'yam' }, { id: 'tomato' }, { id: 'plantain' }];
const VENDOR_VIEWS = { idle: ['down', 'up', 'side'], walk: ['down', 'up', 'side'] };
const WALKER_VIEWS = { idle: ['down', 'up', 'side'], walk: ['down', 'up', 'side'] };

export function buildTextures(scene, setting, mentorLook, ambient) {
  const jobs = [
    ['dirt', dirtSvg()],
    ['crate', crateSvg()],
    ['umbrella', umbrellaSvg()],
    ['bubble', bubbleSvg()],
    ['price-tag', tagSvg()],
    ['stall-open', stallOpenSvg(setting.items)],
    ['stall-closed', stallClosedSvg()],
    ['mentor-stall', stallOpenSvg(MENTOR_GOODS, '#d6336c', '#fff4dc')],
    ['price-board', priceBoardSvg()],
    ...personJobs('mentor', mentorLook, MENTOR_VIEWS)
  ];

  setting.items.forEach(item => jobs.push([`icon-${item.id}`, itemSvg(item)]));
  CUSTOMER_LOOKS.forEach((look, i) => jobs.push(...personJobs(CUSTOMER_KEYS[i], look, CUSTOMER_VIEWS)));

  // Small icons for goods that are only sold at the other stalls, for the shopping bubbles
  const stallGoods = new Set([...ambient.vendors.flatMap(vendor => vendor.goods), ...MENTOR_GOODS.map(goods => goods.id)]);
  stallGoods.forEach(id => {
    if (!setting.items.some(item => item.id === id)) jobs.push([`icon-${id}`, itemSvg({ id })]);
  });

  // The other traders, their stalls, and the people strolling around the market
  ambient.vendors.forEach((vendor, i) => {
    jobs.push([`vendor-stall-${i}`, stallOpenSvg(vendor.goods.map(id => ({ id })), vendor.awning[0], vendor.awning[1])]);
    jobs.push(...personJobs(`vendor-${i}`, vendor.look, VENDOR_VIEWS));
  });
  ambient.walkers.people.forEach((person, i) => jobs.push(...personJobs(`walker-${i}`, person.look, WALKER_VIEWS)));

  return Promise.all(jobs.map(([key, svg]) => addSvgTexture(scene, key, svg)));
}

// The player's drawings are made after the setup screen, from the look they chose.
// Any older player drawings are thrown away first.
export function buildPlayerTextures(scene, look) {
  const jobs = personJobs('player', look, PLAYER_VIEWS);

  jobs.forEach(([key]) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
  });

  return Promise.all(jobs.map(([key, svg]) => addSvgTexture(scene, key, svg)));
}
