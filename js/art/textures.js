// Draws every piece of art once, at startup, and hands it to Phaser as a texture.
import { itemSvg, stallOpenSvg, stallClosedSvg, crateSvg, umbrellaSvg, bubbleSvg, dirtSvg } from './shapes.js';
import { makePersonSvg, PLAYER_LOOK, CUSTOMER_LOOKS } from './people.js';

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

export function buildTextures(scene, setting) {
  const jobs = [
    ['dirt', dirtSvg()],
    ['crate', crateSvg()],
    ['umbrella', umbrellaSvg()],
    ['bubble', bubbleSvg()],
    ['stall-open', stallOpenSvg(setting.items)],
    ['stall-closed', stallClosedSvg()],
    ['player', makePersonSvg(PLAYER_LOOK)]
  ];

  setting.items.forEach(item => jobs.push([`icon-${item.id}`, itemSvg(item)]));
  CUSTOMER_LOOKS.forEach((look, i) => jobs.push([CUSTOMER_KEYS[i], makePersonSvg(look)]));

  return Promise.all(jobs.map(([key, svg]) => addSvgTexture(scene, key, svg)));
}
