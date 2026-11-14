// The player's stall: building it, opening and closing, and serving customers.
// These methods are added to the scene, so `this` is the scene.
import { state, sell, priceOf } from '../../state.js';
import { play } from '../../audio/sound.js';
import { profile } from '../../profile.js';
import { WORLD_W, WORLD_H, STALL_SCALE } from '../constants.js';

export const stallMethods = {
  // ---------- Building the world ----------
  createStall() {
    this.stallOpen = false;

    const x = WORLD_W / 2 + 250;
    const y = WORLD_H / 2 - 120;
    const baseY = y + 55; // where the stall meets the ground

    // An invisible block the player bumps into. The art is drawn on top of it.
    this.stall = this.add.rectangle(x, y, 200, 110, 0x8d5524).setVisible(false);
    this.physics.add.existing(this.stall, true);
    this.solids.push(this.stall);

    this.stallArt = this.add.image(x, baseY - 176 * STALL_SCALE, 'stall-closed')
      .setOrigin(0.5, 0)
      .setDepth(baseY);
    this.fitStallArt();
    this.createStallSign(x, baseY);

    this.interactables.push({
      x: this.stall.x,
      y: this.stall.y,
      label: () => this.stallLabel(),
      use: () => this.useStall()
    });
  },

  // Wooden sign above the awning, carrying the name the player chose
  createStallSign(x, baseY) {
    const roofY = this.stallArt.y + 16 * STALL_SCALE;
    this.stallSign = this.makeSign(x, roofY, profile.stallName).setDepth(baseY + 1);
  },

  fitStallArt() {
    this.stallArt.setDisplaySize(220 * STALL_SCALE, 190 * STALL_SCALE);
  },

  // ---------- The stall ----------

  // One key does three jobs depending on what's happening at the stall
  stallLabel() {
    if (!this.stallOpen) return 'Open stall';
    return this.waitingCustomers().length > 0 ? 'Serve customer' : 'Close stall';
  },

  useStall() {
    if (!this.stallOpen) {
      this.setStallOpen(true);
    } else if (this.waitingCustomers().length > 0) {
      this.serveCustomer();
    } else {
      this.setStallOpen(false);
    }
  },

  setStallOpen(isOpen) {
    this.stallOpen = isOpen;

    if (isOpen) {
      this.stallArt.setTexture('stall-open');
      play('open');
      this.spawnTimer = 1500; // first customer arrives soon after opening
    } else {
      this.stallArt.setTexture('stall-closed');
      play('close');

      // Anyone still walking up turns around
      this.customers
        .filter(customer => customer.state === 'walking')
        .forEach(customer => customer.leave('neutral'));
    }

    this.fitStallArt();
  },

  // Serves the customer who has waited longest, among those we have stock for
  serveCustomer() {
    const symbol = this.setting.currencySymbol;

    const customer = this.waitingCustomers()
      .filter(c => state.stock[c.item.id] > 0)
      .sort((a, b) => a.patience - b.patience)[0];

    if (!customer) {
      this.floatText('Out of stock', '#ff6b6b');
      play('error');
      this.cameras.main.shake(120, 0.004);
      return;
    }

    sell(customer.item);
    customer.leave('happy');
    this.floatText(`+${symbol}${priceOf(customer.item)}`, '#7CFC98');
    play('coin');
    this.updateHud();
    this.refreshMissions();
  },
};
