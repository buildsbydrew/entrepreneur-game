// The customers: where they wait, who comes, what they want, and when they leave.
// These methods are added to the scene, so `this` is the scene.
import { state, recordAsked, recordLostCustomer, priceOf, recordPricedOut } from '../../state.js';
import Customer from '../../entities/Customer.js';
import { play } from '../../audio/sound.js';
import Crowd from '../../entities/crowd.js';
import { CUSTOMER_KEYS } from '../../art/textures.js';
import { DEPTH } from '../constants.js';

export const customersMethods = {
  // Spots in front of the stall where customers wait, plus the spawn timer
  createCustomerArea() {
    this.customers = [];
    this.spawnTimer = 0;

    // Everyone in the market, so people can keep out of each other's way
    this.crowd = new Crowd(this.solids);

    // Invisible blocks that follow people around, so the player can't walk through them
    this.movers = this.physics.add.group({ allowGravity: false, immovable: true });

    const slotY = this.stall.y + 110;
    this.slots = [-80, 0, 80].map(offset => ({
      x: this.stall.x + offset,
      y: slotY,
      customer: null
    }));

    // Faint marks on the ground so players can see where customers stand
    this.slots.forEach(slot => {
      this.add.ellipse(slot.x, slot.y + 20, 56, 16, 0x000000, 0.12).setDepth(DEPTH.marks);
    });

    // Customers announce when they give up waiting
    this.events.on('customer-lost', this.onCustomerLost, this);
    this.events.on('customer-arrived', this.onCustomerArrived, this);
  },

  handleCustomers(delta) {
    // New customers only show up while the stall is open
    if (this.stallOpen) {
      this.spawnTimer -= delta;
      if (this.spawnTimer <= 0) {
        this.spawnCustomer();
        this.resetSpawnTimer();
      }
    }

    this.customers.forEach(customer => customer.update(delta));
    this.customers = this.customers.filter(customer => !customer.gone);
  },

  // ---------- Customers ----------
  spawnCustomer() {
    const slot = this.slots.find(s => !s.customer);
    if (!slot) return; // every spot is taken, so this shopper walks on by

    // Nobody appears on top of someone who is still on the street there
    const startX = this.stall.x + 700;
    if (this.crowd.blocker(null, startX, slot.y + 70)) return;

    const item = this.pickWantedItem();
    const customer = new Customer(
      this,
      item,
      slot,
      startX,
      this.setting.customers.patienceMs,
      this.pickCustomerLook()
    );

    slot.customer = customer;
    this.customers.push(customer);
  },

  // Picks a look that nobody at the stall is already wearing
  pickCustomerLook() {
    const used = new Set(this.customers.map(customer => customer.textureKey));
    const free = CUSTOMER_KEYS.filter(key => !used.has(key));
    return Phaser.Utils.Array.GetRandom(free.length > 0 ? free : CUSTOMER_KEYS);
  },

  resetSpawnTimer() {
    const { spawnMinMs, spawnMaxMs } = this.setting.customers;
    this.spawnTimer = Phaser.Math.Between(spawnMinMs, spawnMaxMs);
  },

  // Picks an item at random, but popular items come up more often
  pickWantedItem() {
    const items = this.setting.items;
    const total = items.reduce((sum, item) => sum + item.demand, 0);
    let roll = Math.random() * total;

    for (const item of items) {
      roll -= item.demand;
      if (roll <= 0) return item;
    }
    return items[items.length - 1];
  },

  waitingCustomers() {
    return this.customers.filter(customer => customer.state === 'waiting');
  },

  onCustomerLost(customer) {
    recordLostCustomer(customer.item, state.stock[customer.item.id] === 0);
    this.floatText('Customer left', '#ff6b6b', customer.body.x, customer.body.y - 175);
    this.updateHud();
    this.refreshMissions();
  },

  // A customer reached the stall and is waiting. We record what they came for.
  onCustomerArrived(customer) {
    recordAsked(customer.item);
    play('arrive');

    // From Level 2 on, customers look at the price and walk away if it is too high
    if (state.level >= 2 && priceOf(customer.item) > customer.maxPrice) {
      recordPricedOut(customer.item);
      customer.leave('pricey');
    }
  },
};
