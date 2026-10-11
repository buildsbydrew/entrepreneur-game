import { profile } from '../profile.js';
import { buildPlayerTextures } from '../art/textures.js';
import { addBackdrop } from '../ui/backdrop.js';
import { showSetup, clearUi } from '../ui/screens.js';

// Where the player builds their character and names their stall.
export default class SetupScene extends Phaser.Scene {
  constructor() {
    super('SetupScene');
  }

  create() {
    this.input.keyboard.clearCaptures(); // so typing a stall name isn't blocked
    addBackdrop(this);

    this.screen = showSetup({
      profile,
      onBack: () => this.scene.start('MenuScene'),
      onStart: () => this.begin()
    });

    this.events.once('shutdown', clearUi);
  }

  // Draws the chosen character, then opens the market
  begin() {
    buildPlayerTextures(this, profile.look)
      .then(() => this.scene.start('MarketScene'))
      .catch(error => {
        console.error(error);
        this.screen.fail('Something went wrong drawing your character. Press F12 and check the Console.');
      });
  }
}
