import { showPause, clearUi } from '../ui/screens.js';
import { setDuck } from '../audio/sound.js';

// Sits on top of the frozen market while the game is paused.
export default class PauseScene extends Phaser.Scene {
  constructor() {
    super('PauseScene');
  }

  create() {
    setDuck(true); // the music and murmur get quieter while paused
    showPause({
      onResume: () => this.resume(),
      onNewGame: () => this.leaveFor('SetupScene'),
      onMenu: () => this.leaveFor('MenuScene')
    });

    this.input.keyboard.on('keyup-ESC', () => this.resume());
    this.input.keyboard.on('keyup-P', () => this.resume());
  }

  resume() {
    clearUi();
    setDuck(false);
    this.scene.resume('MarketScene');
    this.scene.stop();
  }

  leaveFor(next) {
    clearUi();
    setDuck(false);
    this.scene.stop('MarketScene');
    this.scene.start(next);
  }
}
