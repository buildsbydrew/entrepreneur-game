// The interface drawn over every place: cash and stock, the clock, messages, and the "press E" prompt.
// These methods are added to the scene, so `this` is the scene.
import { state, expiringTonight } from '../../state.js';
import { touch, isTouchDevice } from '../../ui/touch.js';
import { INTERACT_RANGE, DEPTH } from '../constants.js';
import { skyTint } from '../../dayClock.js';

export const hudMethods = {
  createHud() {
    const boxStyle = {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 10, y: 6 }
    };

    this.hintText = this.add.text(16, 16, isTouchDevice() ? 'Left stick to move, Use button to interact' : 'WASD or arrows to move, E to interact, N for Notebook, Esc to pause', {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#3b2a20'
    }).setScrollFactor(0).setDepth(DEPTH.hud);

    this.cashText = this.add.text(16, 44, '', boxStyle).setScrollFactor(0).setDepth(DEPTH.hud);
    this.stockText = this.add.text(16, 86, '', boxStyle).setScrollFactor(0).setDepth(DEPTH.hud);
    this.statsText = this.add.text(16, 128, '', boxStyle).setScrollFactor(0).setDepth(DEPTH.hud);

    // Day and clock sit in the top-right corner
    this.clockText = this.add.text(0, 16, '', {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 12, y: 6 }
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(DEPTH.hud);

    this.updateHud();
    this.updateClock();
  },

  // Smaller screens get a smaller interface, so it doesn't cover the market
  layoutHud() {
    const s = this.scale.height < 420 ? 0.6 : this.scale.height < 560 ? 0.72 : 1;
    const place = (item, x, y) => item.setScale(s).setPosition(x, y * s);

    place(this.hintText, 16, 16);
    place(this.cashText, 16, 44);
    place(this.stockText, 16, 86);
    place(this.statsText, 16, 128);
    place(this.missionText, 16, 178);
    place(this.clockText, this.scale.width - 16, 16);
  },

  updateHud() {
    const symbol = this.setting.currencySymbol;
    this.cashText.setText(`Cash: ${symbol}${state.cash}`);

    // Items that will go bad tonight get a warning next to them
    const stock = this.setting.items
      .map(item => {
        const expiring = expiringTonight(item);
        const warning = expiring > 0 ? ` (${expiring} spoil tonight)` : '';
        return `${item.name} ${state.stock[item.id]}${warning}`;
      })
      .join('   ');
    this.stockText.setText(`Stock: ${stock}`);

    this.statsText.setText(`Served: ${state.today.served}   Lost: ${state.today.lost}`);
  },

  // The colour of the light: a cool dawn, a warm glow toward closing time, then night
  createDusk() {
    this.dusk = this.add.rectangle(0, 0, 6000, 6000, 0xff7a2f, 0)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(4000);
    this.updateDusk();
  },

  updateDusk() {
    const { color, alpha } = skyTint();
    this.dusk.setFillStyle(color, 1).setAlpha(alpha);
  },

  // A short message across the top of the screen that fades away. Several can show at once.
  showBanner(message) {
    const slot = this.bannerCount;
    this.bannerCount += 1;

    const text = this.add.text(this.scale.width / 2, 24 + slot * 46, message, {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#fff4dc',
      backgroundColor: '#3b2a20',
      padding: { x: 14, y: 8 }
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH.hud);

    this.tweens.add({
      targets: text,
      alpha: 0,
      delay: 3800,
      duration: 700,
      onComplete: () => {
        text.destroy();
        this.bannerCount -= 1;
      }
    });
  },

  // ---------- Feedback ----------

  // Small message that rises and fades out. Defaults to above the player's head.
  floatText(message, color, x = this.player.x, y = this.player.y - 140) {
    const text = this.add.text(x, y, message, {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color,
      stroke: '#3b2a20',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(DEPTH.floatText);

    this.tweens.add({
      targets: text,
      y: text.y - 50,
      alpha: 0,
      duration: 900,
      onComplete: () => text.destroy()
    });
  },

  createPrompt() {
    this.prompt = this.add.text(0, 0, '', {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5).setVisible(false).setDepth(DEPTH.prompt);
  },

  handleInteraction() {
    const pressedE = Phaser.Input.Keyboard.JustDown(this.keyE) || this.takeUseTap();
    const target = this.findNearestInteractable();

    if (!target) {
      this.prompt.setVisible(false);
      return;
    }

    this.prompt.setText(`${this.useLabel}: ${target.label()}`);
    this.prompt.setPosition(this.player.x, this.player.y - 112);
    this.prompt.setVisible(true);

    if (pressedE) target.use();
  },

  findNearestInteractable() {
    let nearest = null;
    let nearestDistance = INTERACT_RANGE;

    this.interactables.forEach(thing => {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, thing.x, thing.y);
      if (d < nearestDistance) {
        nearest = thing;
        nearestDistance = d;
      }
    });

    return nearest;
  },

  // Taps on the Use button are saved up until the next frame, then used once
  takeUseTap() {
    const tapped = touch.use;
    touch.use = false;
    return tapped;
  },
};
