// The supplier, buying stock, and the umbrellas.
// These methods are added to the scene, so `this` is the scene.
import { buy } from '../../state.js';
import { play } from '../../audio/sound.js';
import { DEPTH } from '../constants.js';
import { clock } from '../../dayClock.js';

export const supplierMethods = {
  createSupplier() {
    const startX = 700;
    const y = 480;
    const spacing = 160;
    const symbol = this.setting.currencySymbol;

    this.add.rectangle(startX + spacing, y, 560, 160, 0x6b5a45)
      .setStrokeStyle(3, 0x3b2a20)
      .setDepth(DEPTH.mat);

    this.add.text(startX + spacing, y - 92, 'SUPPLIER', {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#3b2a20'
    }).setOrigin(0.5).setDepth(DEPTH.mat + 1);

    this.setting.items.forEach((item, i) => {
      const x = startX + i * spacing;

      // Invisible block for bumping into, with the crate and goods drawn on top
      const hitbox = this.add.rectangle(x, y, 90, 70, 0x000000).setVisible(false);
      this.physics.add.existing(hitbox, true);
      this.solids.push(hitbox);

      this.add.image(x, y, 'crate').setDisplaySize(90, 70).setDepth(y + 35);
      this.add.image(x, y - 35, `icon-${item.id}`).setDisplaySize(44, 44).setDepth(y + 36);

      // The goods show what each crate is, so only the price and shelf life need words
      this.add.image(x, y + 10, 'price-tag').setDisplaySize(60, 26).setDepth(y + 37);
      this.add.text(x, y + 10, `${symbol}${item.buyPrice}`, {
        fontFamily: 'sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#3b2a20'
      }).setOrigin(0.5).setDepth(y + 38);
      this.add.text(x, y + 44, this.shelfLabel(item), {
        fontFamily: 'sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#fff4dc',
        stroke: '#3b2a20',
        strokeThickness: 3
      }).setOrigin(0.5, 0).setDepth(y + 37);

      this.interactables.push({
        x,
        y,
        label: () => (clock.tradingClosed ? 'The supplier has packed up for today' : `Buy ${item.name} (${symbol}${item.buyPrice})`),
        use: () => this.buyItem(item)
      });
    });
  },

  // How long an item lasts, as shown on its crate
  shelfLabel(item) {
    if (!item.shelfLifeDays) return 'Keeps';
    return item.shelfLifeDays === 1 ? 'Lasts 1 day' : `Lasts ${item.shelfLifeDays} days`;
  },

  // ---------- Supplier ----------
  buyItem(item) {
    const symbol = this.setting.currencySymbol;

    // After closing time the supplier has gone home. Come back in the morning.
    if (clock.tradingClosed) {
      this.floatText('Back tomorrow', '#fff4dc');
      play('error');
      return;
    }

    if (buy(item)) {
      this.floatText(`-${symbol}${item.buyPrice}`, '#ffd166');
      play('buy');
      this.updateHud();
    } else {
      this.floatText('Not enough cash', '#ff6b6b');
      play('error');
      this.cameras.main.shake(120, 0.004);
    }
  },

  // Umbrellas to make the market feel lived in. Only the pole is solid, because the canopy is high above.
  createProps() {
    [[720, 830], [1750, 900], [480, 420]].forEach(([x, y]) => {
      this.add.image(x, y, 'umbrella')
        .setOrigin(0.5, 1)
        .setDisplaySize(100, 125)
        .setDepth(y);

      const pole = this.add.rectangle(x, y - 8, 22, 16, 0x000000).setVisible(false);
      this.physics.add.existing(pole, true);
      this.solids.push(pole);
    });
  },
};
