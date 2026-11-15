// The price board and how customers react to prices.
// These methods are added to the scene, so `this` is the scene.
import { state, priceOf, setPrice, recordPricedOut } from '../../state.js';
import { play } from '../../audio/sound.js';
import { showPriceBoard } from '../../ui/screens.js';

export const pricesMethods = {
  // ---------- Prices (Level 2) ----------

  // A price board beside the stall. It stays locked until Level 2.
  createPriceBoard() {
    const x = 1625;
    const feetY = 628;

    this.add.image(x, feetY, 'price-board')
      .setOrigin(0.5, 1)
      .setDisplaySize(64, 96)
      .setDepth(feetY);

    // An invisible block at the foot of the post, so the player can't walk through it
    const post = this.add.rectangle(x, feetY - 8, 26, 16, 0x000000).setVisible(false);
    this.physics.add.existing(post, true);
    this.solids.push(post);

    this.interactables.push({
      x,
      y: feetY - 40,
      label: () => (state.level >= 2 ? 'Set your prices' : 'Price board (opens in Level 2)'),
      use: () => this.openPriceBoard()
    });
  },

  openPriceBoard() {
    if (state.level < 2) return;

    play('page');
    this.openModal();
    showPriceBoard({
      items: this.setting.items,
      symbol: this.setting.currencySymbol,
      priceOf,
      history: item => {
        const record = day => ({ sold: day.soldBy[item.id] ?? 0, walked: day.pricedOut[item.id] ?? 0 });
        return { today: record(state.today), yesterday: state.lastDay ? record(state.lastDay) : null };
      },
      onSetPrice: (item, price) => {
        play('tick');
        setPrice(item, price);
        this.refreshMissions();
      },
      onClose: () => {
        this.closeModal();
        this.turnAwayOverpriced();
      }
    });
  },

  // Customers already at the stall look at the new prices. Anyone who finds them too high leaves.
  turnAwayOverpriced() {
    this.waitingCustomers().forEach(customer => {
      if (priceOf(customer.item) > customer.maxPrice) {
        recordPricedOut(customer.item);
        customer.leave('pricey');
      }
    });
    this.updateHud();
  },
};
