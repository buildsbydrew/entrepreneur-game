import MarketScene from './scenes/MarketScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: '100%',
  height: '100%',
  backgroundColor: '#3a7d44',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  },
  scene: [MarketScene]
};

new Phaser.Game(config);