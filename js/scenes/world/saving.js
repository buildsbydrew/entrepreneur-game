// Saving the game.
// These methods are added to the scene, so `this` is the scene.
import { saveGame } from '../../save.js';
import { profile } from '../../profile.js';

export const savingMethods = {
  // Saves the game. This happens each morning, and when a new game begins.
  saveProgress() {
    if (saveGame(profile)) this.showBanner('Game saved');
  },
};
