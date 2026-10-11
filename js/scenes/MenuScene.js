import { profile } from '../profile.js';
import { addBackdrop } from '../ui/backdrop.js';
import { showTitle, clearUi } from '../ui/screens.js';

// The title screen.
export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    this.input.keyboard.clearCaptures(); // let the browser handle every key here
    addBackdrop(this);

    const setting = this.cache.json.get('setting');
    showTitle({
      items: setting.items,
      look: profile.look,
      onPlay: () => this.scene.start('SetupScene')
    });

    this.events.once('shutdown', clearUi);
  }
}
