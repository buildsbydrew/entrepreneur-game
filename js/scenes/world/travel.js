// Getting a place ready, and walking off its edge into the next one.
// Each place lists its exits and entries in data/places.json.
// These methods are added to the scene, so `this` is the scene.
import { state, initState, importState } from '../../state.js';
import { setupClock, startMorning } from '../../dayClock.js';
import { DEPTH } from '../constants.js';

// How far past an edge with a way out the view can look, in pixels
export const VIEW_MARGIN = 360;

export const travelMethods = {
  // The data every place needs, read once when the place is built
  loadData() {
    this.setting = this.cache.json.get('setting');
    this.mentorData = this.cache.json.get('mentors');
    this.notebookData = this.cache.json.get('notebook');
    this.levelsData = this.cache.json.get('levels');
    this.ambientData = this.cache.json.get('ambient');
    this.placesData = this.cache.json.get('places');
    setupClock(this.setting.day);
  },

  // Coming from the title screen: either a saved game, or a brand new one.
  // Walking in from another place carries the game on as it is. Returns 'loaded', 'new' or null.
  prepareGame(data) {
    const saved = this.registry.get('loadedState');
    this.registry.set('loadedState', null);

    if (saved) {
      importState(saved);
      startMorning(); // games are saved first thing in the morning
      return 'loaded';
    }
    if (data.newGame || !state.today) {
      initState(this.setting);
      startMorning();
      return 'new';
    }
    return null;
  },

  // Where the player appears when arriving by this entry, from data/places.json
  entrySpot(place, entry) {
    const spot = place.entries?.[entry];
    return spot ?? { x: this.worldW / 2, y: this.worldH / 2, facing: 'down' };
  },

  // ---------- Exits ----------

  // Walking off this stretch of an edge takes the player somewhere else.
  // Arrows on the ground and a signpost make it easy to see.
  createExits(exits) {
    this.exits = exits ?? [];
    this.travelling = false;

    // The view can look a little past an edge that has a way out, so the path is seen carrying
    // on, and the player is never tucked under the interface when they arrive
    this.viewMargin = { west: 0, east: 0, north: 0, south: 0 };
    this.exits.forEach(exit => { this.viewMargin[exit.edge] = VIEW_MARGIN; });
    this.exits.forEach(exit => this.drawExitArrows(exit));
  },

  // Three soft arrows on the ground, pointing off the edge
  drawExitArrows(exit) {
    const g = this.add.graphics().setDepth(DEPTH.marks);
    const middle = (exit.min + exit.max) / 2;
    const outward = { west: [-1, 0], east: [1, 0], north: [0, -1], south: [0, 1] }[exit.edge];

    // Where the arrows start: a little way in from the edge
    let x;
    let y;
    if (exit.edge === 'west') [x, y] = [150, middle];
    if (exit.edge === 'east') [x, y] = [this.worldW - 150, middle];
    if (exit.edge === 'north') [x, y] = [middle, 150];
    if (exit.edge === 'south') [x, y] = [middle, this.worldH - 150];

    for (let i = 0; i < 3; i++) {
      const cx = x + outward[0] * i * 40;
      const cy = y + outward[1] * i * 40;
      g.lineStyle(6, 0x3b2a20, 0.22 + i * 0.08);
      g.beginPath();
      // A chevron: two short lines meeting at the tip
      const [dx, dy] = outward;
      const tipX = cx + dx * 12;
      const tipY = cy + dy * 12;
      g.moveTo(cx - dx * 6 - dy * 16, cy - dy * 6 - dx * 16);
      g.lineTo(tipX, tipY);
      g.lineTo(cx - dx * 6 + dy * 16, cy - dy * 6 + dx * 16);
      g.strokePath();
    }
  },

  // A wooden signpost with the name of where this way leads
  makeSignpost(x, feetY, label, pointsLeft) {
    const post = this.add.image(x, feetY, 'signpost')
      .setOrigin(0.5, 1)
      .setDisplaySize(140, 120)
      .setFlipX(Boolean(pointsLeft))
      .setDepth(feetY);

    // The board's middle sits a little toward the arrow's tail
    const boardX = x + (pointsLeft ? 8 : -8);
    const boardY = feetY - 120 + 32;
    const text = this.add.text(boardX, boardY, label, {
      fontFamily: 'sans-serif',
      fontSize: '19px',
      fontStyle: 'bold',
      color: '#fff4dc',
      stroke: '#3b2a20',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(feetY + 1);
    if (text.width > 96) text.setScale(96 / text.width);

    // An invisible block at the foot of the post
    const block = this.add.rectangle(x, feetY - 8, 20, 16, 0x000000).setVisible(false);
    this.physics.add.existing(block, true);
    this.solids.push(block);
    return post;
  },

  // Is the player pushing against an edge where there is a way out?
  checkExits() {
    if (this.travelling) return;
    const body = this.player.body;

    for (const exit of this.exits) {
      const along = exit.edge === 'west' || exit.edge === 'east' ? this.player.y : this.player.x;
      if (along < exit.min || along > exit.max) continue;

      const leaving = {
        west: body.left <= 2 && body.acceleration.x < 0,
        east: body.right >= this.worldW - 2 && body.acceleration.x > 0,
        north: body.top <= 2 && body.acceleration.y < 0,
        south: body.bottom >= this.worldH - 2 && body.acceleration.y > 0
      }[exit.edge];

      if (leaving) {
        this.travelTo(exit);
        return;
      }
    }
  },

  // A short fade, then the next place
  travelTo(exit) {
    this.travelling = true;
    this.prompt.setVisible(false);
    const note = this.beforeLeaving ? this.beforeLeaving() : null;

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(exit.leadsTo, { entry: exit.arriveAt, note });
    });
  },
};
