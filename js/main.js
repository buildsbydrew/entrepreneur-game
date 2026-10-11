import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import SetupScene from './scenes/SetupScene.js';
import MarketScene from './scenes/MarketScene.js';
import PauseScene from './scenes/PauseScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: '100%',
  height: '100%',
  backgroundColor: '#d8b98a',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  },
  scene: [BootScene, MenuScene, SetupScene, MarketScene, PauseScene]
};

new Phaser.Game(config);
