// The other traders and the people strolling around, and who shops where.
// These methods are added to the scene, so `this` is the scene.
import Walker from '../../entities/Walker.js';
import { findPath, pathLength } from '../../entities/routes.js';
import { popShopBubble } from '../../entities/shopBubble.js';

export const ambientMethods = {
  // ---------- A lively market ----------

  // Other traders around the market. Each has a stall, and is a person who calls out to passers-by
  // and now and then leaves the stall to go shopping at another one.
  createVendors() {
    const scale = 0.95;

    this.vendors = this.ambientData.vendors.map((vendor, i) => {
      const baseY = vendor.y + 50; // where the stall meets the ground

      // An invisible block so the player can't walk through the stall
      const block = this.add.rectangle(vendor.x, vendor.y, 180, 100, 0x8d5524).setVisible(false);
      this.physics.add.existing(block, true);
      this.solids.push(block);

      const art = this.add.image(vendor.x, baseY - 176 * scale, `vendor-stall-${i}`)
        .setOrigin(0.5, 0)
        .setDisplaySize(220 * scale, 190 * scale)
        .setDepth(baseY);
      this.makeSign(vendor.x, art.y + 16 * scale, vendor.name).setDepth(baseY + 1);

      const walker = new Walker(this, `vendor-${i}`, {
        graph: this.graph,
        node: vendor.homeNode,
        speed: 70,
        pickShop: self => this.pickShop(self),
        onShop: shop => this.shopkeeperThanks(shop),
        errandMs: this.ambientData.vendorErrandMs,
        canLeave: () => !this.vendors.some(vendor => vendor.walker.onErrand)
      });

      return {
        walker,
        calls: vendor.calls,
        shopNode: vendor.shopNode,
        icons: [...new Set(vendor.goods)],
        nextCallIn: Phaser.Math.Between(2000, 9000)
      };
    });
  },

  // People strolling around the market on a loop, now and then stopping to shop
  createWalkers() {
    const { ring, people, speedMin, speedMax } = this.ambientData.walkers;

    this.walkers = people.map((person, i) => new Walker(this, `walker-${i}`, {
      graph: this.graph,
      node: person.start,
      ring,
      direction: person.direction,
      speed: Phaser.Math.Between(speedMin, speedMax),
      pickShop: self => this.pickShop(self),
      onShop: shop => this.shopkeeperThanks(shop)
    }));
  },

  // The places people can shop: the supplier and every stall except the player's.
  // A shop is only open while its owner is home, and one person shops at a time.
  createShops() {
    const { supplier, mentor } = this.ambientData;

    this.shops = [
      { id: 'supplier', node: supplier.node, icons: supplier.icons, busy: false, owner: null, ownerHome: () => true },
      { id: 'mentor', node: mentor.shopNode, icons: mentor.icons, busy: false, owner: 'mentor', ownerHome: () => this.mentorIsHome() },
      ...this.vendors.map((vendor, i) => ({
        id: `vendor-${i}`,
        node: vendor.shopNode,
        icons: vendor.icons,
        busy: false,
        owner: vendor,
        ownerHome: () => !vendor.walker.onErrand
      }))
    ];

    this.mentorShop = this.shops[1];
    this.vendors.forEach((vendor, i) => { vendor.walker.ownShop = this.shops[i + 2]; });
  },

  // Which shop should this person visit? One that is open and free, and not too far away.
  pickShop(person) {
    const options = this.shops
      .filter(shop => !shop.busy && shop.ownerHome() && shop !== person.ownShop)
      .map(shop => ({ shop, length: pathLength(this.graph, findPath(this.graph, person.at, shop.node)) }))
      .filter(option => Number.isFinite(option.length))
      .sort((a, b) => a.length - b.length)
      .slice(0, 2);

    return options.length > 0 ? Phaser.Utils.Array.GetRandom(options).shop : null;
  },

  // Someone started shopping, so the person who owns the stall thanks them
  shopkeeperThanks(shop) {
    const owner = shop.owner === 'mentor' ? this.mentorSprite.image : shop.owner?.walker.person.image;
    if (owner) this.sayAbove(owner.x, owner.y, 'Thank you!');
  },

  // The mentor reaches a shop, and the person who owns it thanks her
  shopVisit(shop, image) {
    const icons = shop.icons;
    popShopBubble(this, image.x, image.y, `icon-${icons[Math.floor(Math.random() * icons.length)]}`, 1800);
    this.shopkeeperThanks(shop);
  },

  // A few words above someone's head that fade after a moment
  sayAbove(x, feetY, message) {
    const text = this.add.text(x, feetY - 118, message, {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#3b2a20',
      backgroundColor: '#fff4dc',
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5, 1).setDepth(2100);

    this.tweens.add({
      targets: text,
      alpha: 0,
      delay: 2200,
      duration: 400,
      onComplete: () => text.destroy()
    });
  },

  updateAmbient(delta) {
    this.walkers.forEach(walker => walker.update(delta));

    this.vendors.forEach(vendor => {
      vendor.walker.update(delta);

      // Traders call out to passers-by, unless they are away shopping
      vendor.nextCallIn -= delta;
      if (vendor.nextCallIn <= 0) {
        vendor.nextCallIn = Phaser.Math.Between(9000, 16000);
        if (!vendor.walker.onErrand) {
          const image = vendor.walker.person.image;
          this.sayAbove(image.x, image.y, Phaser.Utils.Array.GetRandom(vendor.calls));
        }
      }
    });
  },
};
