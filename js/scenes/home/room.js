// Home: the room with its walls and door, the furniture, the bed, and the yard with the path
// to the market. The layout comes from data/places.json.
// These methods are added to the scene, so `this` is the scene.
import { phase, dayTimes, formatTime } from '../../dayClock.js';
import { play } from '../../audio/sound.js';
import { HOME_SIZES } from '../../art/home.js';
import { DEPTH } from '../constants.js';
import { VIEW_MARGIN } from '../world/travel.js';

const OUTLINE = 0x3b2a20;
const WALL_TOP = 0xefe0c2;   // the top of the walls, seen from above
const WALL_FACE = 0xe3cb9c;  // the inside of the back wall
const BASEBOARD = 0xb98d5c;

export const roomMethods = {
  // An invisible block the player bumps into. The art is drawn separately.
  addSolid(x, y, w, h) {
    const block = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000).setVisible(false);
    this.physics.add.existing(block, true);
    this.solids.push(block);
  },

  // The floor, the four walls, and a doorway in the east wall
  createRoom() {
    const { x, y, w, h, wall, faceHeight, door } = this.place.room;
    const right = x + w - wall;

    // Cement floor tiles
    this.add.tileSprite(x + wall, y + faceHeight, w - wall * 2, h - faceHeight - wall, 'home-floor')
      .setOrigin(0)
      .setDepth(DEPTH.ground + 1);

    const g = this.add.graphics().setDepth(DEPTH.ground + 3);
    const box = (bx, by, bw, bh, color) => {
      g.fillStyle(color, 1).fillRect(bx, by, bw, bh);
      g.lineStyle(3, OUTLINE, 1).strokeRect(bx, by, bw, bh);
    };

    // The back wall: its top, then its inside face down to the floor, then a dark baseboard
    box(x + wall, y + wall, w - wall * 2, faceHeight - wall, WALL_FACE);
    box(x + wall, y + faceHeight - 10, w - wall * 2, 10, BASEBOARD);
    box(x, y, w, wall, WALL_TOP);

    // The side walls and the front wall, seen from above
    box(x, y, wall, h, WALL_TOP);
    box(x, y + h - wall, w, wall, WALL_TOP);
    box(right, y, wall, door.from - y, WALL_TOP);
    box(right, door.to, wall, y + h - door.to, WALL_TOP);

    // The doorway: a wooden step, and the door standing open against the inside wall
    box(right, door.from, wall, door.to - door.from, 0x8d5524);
    box(right - 14, door.from - 96, 14, 96, 0xb27436);

    // What the player can't walk through
    this.addSolid(x, y, w, faceHeight);
    this.addSolid(x, y, wall, h);
    this.addSolid(x, y + h - wall, w, wall);
    this.addSolid(right, y, wall, door.from - y);
    this.addSolid(right, door.to, wall, y + h - door.to);
    this.addSolid(right - 14, door.from - 96, 14, 96);
  },

  // Everything listed under furniture in data/places.json
  createFurniture() {
    this.place.furniture.forEach(piece => {
      const [w, h] = HOME_SIZES[piece.type];
      const key = `home-${piece.type}`;

      if (piece.type === 'rug') {
        // Lies flat, so everything stands on top of it
        this.add.image(piece.x, piece.y, key).setDisplaySize(w, h).setDepth(DEPTH.ground + 2);
      } else if (piece.type === 'window') {
        // Set into the back wall
        this.add.image(piece.x, piece.y, key).setDisplaySize(w, h).setDepth(DEPTH.ground + 4);
      } else {
        // Stands on the ground: its bottom edge is where it touches the floor
        this.add.image(piece.x, piece.y, key).setOrigin(0.5, 1).setDisplaySize(w, h).setDepth(piece.y);
      }

      if (piece.solid) {
        const [sw, sh] = piece.solid;
        this.addSolid(piece.x - sw / 2, piece.y - sh, sw, sh);
      }
    });
  },

  // The bed: sleep once the trading day is over
  createBed() {
    const bed = this.place.bed;
    this.interactables.push({
      x: bed.x + 10,
      y: bed.y + 10,
      label: () => (phase() === 'evening' || phase() === 'night' ? 'Sleep' : `Bed (sleep after ${formatTime(dayTimes().close)})`),
      use: () => this.useBed()
    });
  },

  useBed() {
    if (phase() === 'evening' || phase() === 'night') {
      this.goToSleep(false);
      return;
    }
    this.floatText('Not tired yet', '#fff4dc');
    play('error');
  },

  // The yard outside: a worn path from the door to the east edge, with a signpost to the market
  createYard() {
    const { x, w, door } = this.place.room;
    const exit = this.place.exits[0];
    const middle = (door.from + door.to) / 2;

    const path = this.add.graphics().setDepth(DEPTH.ground + 1);
    const pathW = this.worldW - (x + w) + VIEW_MARGIN + 60; // it carries on past the edge, toward the market
    path.fillStyle(0xe6cfa4, 1).fillRoundedRect(x + w - 10, middle - 62, pathW, 124, 56);
    path.lineStyle(3, 0xc49a64, 1).strokeRoundedRect(x + w - 10, middle - 62, pathW, 124, 56);

    this.createExits(this.place.exits);
    this.makeSignpost(this.worldW - 190, middle - 78, exit.label, false);
  },
};
