import { buildTextures } from '../art/textures.js';

// Runs first: loads the setting data, draws the art, then opens the title screen.
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    this.load.json('setting', 'data/settings/ghana.json');
    this.load.json('mentors', 'data/mentors.json');
    this.load.json('notebook', 'data/notebook.json');
    this.load.json('levels', 'data/levels.json');
  }

  create() {
    const { width, height } = this.scale;
    const label = this.add.text(width / 2, height / 2, 'Setting up the market...', {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      color: '#3b2a20'
    }).setOrigin(0.5);

    const setting = this.cache.json.get('setting');

    buildTextures(this, setting, this.cache.json.get('mentors').mentor.look)
      .then(() => this.scene.start('MenuScene'))
      .catch(error => {
        console.error(error);
        label.setText('Something went wrong drawing the market. Press F12 and check the Console.');
      });
  }
}
