import { profile } from '../profile.js';
import { buildPlayerTextures } from '../art/textures.js';
import { loadGame, describeSave } from '../save.js';
import { addBackdrop } from '../ui/backdrop.js';
import { showTitle, clearUi } from '../ui/screens.js';
import { startMusic } from '../audio/sound.js';

// The title screen. If there is a saved game, it offers to continue it.
export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    this.input.keyboard.clearCaptures(); // let the browser handle every key here
    addBackdrop(this);
    startMusic(); // it begins as soon as the player clicks or presses a key

    const setting = this.cache.json.get('setting');
    const save = loadGame(setting);

    showTitle({
      items: setting.items,
      look: save ? save.profile.look : profile.look,
      saved: save ? describeSave(save, setting) : null,
      onPlay: () => this.scene.start('SetupScene'),
      onContinue: () => this.continueGame(save)
    });

    this.events.once('shutdown', clearUi);
  }

  // Brings back the saved character, draws them, and opens the market with the saved game
  continueGame(save) {
    profile.stallName = save.profile.stallName;
    profile.look = { ...save.profile.look };
    this.registry.set('loadedState', save.state);

    buildPlayerTextures(this, profile.look)
      .then(() => this.scene.start('MarketScene'))
      .catch(error => console.error(error));
  }
}
