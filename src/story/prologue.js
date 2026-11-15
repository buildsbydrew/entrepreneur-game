// The prologue: the years before your first memory, shown as short scenes with captions, told the way
// families tell them. Each scene can ask one question whose answer shapes who you are. The player can
// skip it at any time. The scenes are data, in src/data/prologue.json.
import prologue from '../data/prologue.json';
import world from '../data/world.json';
import { applyEffects, fillText } from './conversation.js';
import { remember } from '../core/life.js';

const fill = text => fillText(text, { currency: world.currency.plural });

// Plays every scene in turn. Resolves when the prologue is over, whether it was watched or skipped.
export async function playPrologue(game) {
  let skipped = false;
  game.ui.cinema.open(() => { skipped = true; });

  for (const scene of prologue.scenes) {
    if (skipped) break;
    game.ui.cinema.clear();
    await game.stageScene(scene, prologue.birth);
    if (scene.captions[0]) remember(fill(scene.captions[0]), world);

    for (const line of scene.captions) {
      if (skipped) break;
      await game.ui.cinema.caption(fill(line));
    }
    if (scene.choice && !skipped) {
      const option = await game.ui.cinema.choose(fill(scene.choice.prompt), scene.choice.options);
      if (option) applyEffects(option.effects, null);
    }
  }

  // The last words, over black, before your first memory
  game.ui.cinema.clear();
  game.mode = 'busy'; // no scene now, just words over black
  await game.ui.fadeOut();
  game.clearPlace();
  game.ui.cinema.dark(true);
  if (!skipped) {
    for (const line of prologue.ending) {
      if (skipped) break;
      await game.ui.cinema.caption(fill(line));
    }
  }
  game.ui.cinema.close();
  return { skipped, start: prologue.start, birth: prologue.birth, knownNeighbours: prologue.knownNeighbours };
}
