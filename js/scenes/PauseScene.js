import { showPause, clearUi } from '../ui/screens.js';

// Sits on top of the frozen market while the game is paused.
export default class PauseScene extends Phaser.Scene {
  constructor() {
    super('PauseScene');
  }

  create() {
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
    this.scene.resume('MarketScene');
    this.scene.stop();
  }

  leaveFor(next) {
    clearUi();
    this.scene.stop('MarketScene');
    this.scene.start(next);
  }
}
