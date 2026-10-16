import { profile } from '../profile.js';
import { addBackdrop } from '../ui/backdrop.js';
import { startMusic } from '../audio/sound.js';
import { showTitle, clearUi } from '../ui/screens.js';

// The title screen.
export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    this.input.keyboard.clearCaptures(); // let the browser handle every key here
    addBackdrop(this);
    startMusic(); // it begins as soon as the player clicks or presses a key

    const setting = this.cache.json.get('setting');
    showTitle({
      items: setting.items,
      look: profile.look,
      onPlay: () => this.scene.start('SetupScene')
    });

    this.events.once('shutdown', clearUi);
  }
}
