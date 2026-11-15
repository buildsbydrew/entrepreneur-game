// The pause menu.
// These methods are added to the scene, so `this` is the scene.
import { showTouchControls, hideTouchControls } from '../../ui/touch.js';
import { stopAmbience } from '../../audio/sound.js';
import { showPauseButton, hidePauseButton } from '../../ui/screens.js';

export const pauseMethods = {
  // Esc or P, or the on-screen button, freezes the market and opens the pause menu
  setupPause() {
    this.resumedAt = 0;
    const requestPause = () => this.openPause();
    const requestNotebook = () => this.openNotebook();
    this.input.keyboard.on('keyup-N', requestNotebook);

    this.input.keyboard.on('keyup-ESC', requestPause);
    this.input.keyboard.on('keyup-P', requestPause);
    showPauseButton(requestPause, requestNotebook);
    showTouchControls();

    this.hideButton = () => {
      hidePauseButton();
      hideTouchControls();
    };
    this.showButton = () => {
      this.resumedAt = performance.now();
      showPauseButton(requestPause, requestNotebook);
      showTouchControls();
    };
    this.events.on('pause', this.hideButton);
    this.events.on('resume', this.showButton);

    // Tidy up when this scene ends, so a new game starts clean
    this.events.once('shutdown', () => {
      hidePauseButton();
      hideTouchControls();
      stopAmbience();
      this.events.off('pause', this.hideButton);
      this.events.off('resume', this.showButton);
      this.events.off('customer-lost', this.onCustomerLost, this);
      this.events.off('customer-arrived', this.onCustomerArrived, this);
      this.input.keyboard.clearCaptures();
    });
  },

  openPause() {
    // The short wait stops the key that closed the menu from opening it again
    if (this.modalOpen || this.scene.isPaused() || performance.now() - this.resumedAt < 300) return;

    this.scene.launch('PauseScene', { from: this.scene.key }); // so it knows which place to come back to
    this.scene.pause();
  },
};
