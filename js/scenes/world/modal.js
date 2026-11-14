// Conversations and the Notebook, which freeze the place until they close.
// These methods are added to the scene, so `this` is the scene.
import { state } from '../../state.js';
import { touch, showTouchControls, hideTouchControls } from '../../ui/touch.js';
import { play } from '../../audio/sound.js';
import { showDialogue, showNotebook } from '../../ui/screens.js';

export const modalMethods = {
  // While a conversation or the Notebook is open, the market stands still
  openModal() {
    this.modalOpen = true;
    hideTouchControls();
    this.player.body.setVelocity(0, 0);
    this.player.body.setAcceleration(0, 0);
    this.prompt.setVisible(false);
  },

  closeModal() {
    this.modalOpen = false;
    showTouchControls();
    touch.use = false;
    this.resumedAt = performance.now();

    // Throw away key presses made during the conversation so they don't act afterwards
    [this.keyE, this.keyEnter, this.keySpace].forEach(key => Phaser.Input.Keyboard.JustDown(key));
  },

  playDialogue(lines, onDone) {
    const mentor = this.mentorData.mentor;

    play('chime');
    this.openModal();
    if (this.report) this.report.setVisible(false);

    showDialogue({
      name: mentor.name,
      title: mentor.title,
      look: mentor.look,
      lines,
      onDone: () => {
        this.closeModal();
        if (onDone) onDone();
      }
    });
  },

  openNotebook() {
    if (this.modalOpen || this.scene.isPaused() || performance.now() - this.resumedAt < 300) return;

    play('page');
    this.openModal();
    showNotebook({
      entries: this.notebookData.entries,
      unlocked: state.notebook.unlocked,
      evidence: state.notebook.evidence,
      onClose: () => this.closeModal()
    });
  },
};
