// What every place the player can walk around has in common: the interface, the player and their
// controls, conversations, goals, the pause menu, the clock, the shape of the day, saving,
// and walking from one place to the next.
// A place extends this and adds what is special to it, such as the market's stall.
import { hudMethods } from './world/hud.js';
import { controlsMethods } from './world/controls.js';
import { modalMethods } from './world/modal.js';
import { pauseMethods } from './world/pause.js';
import { missionsMethods } from './world/missions.js';
import { clockMethods } from './world/clock.js';
import { savingMethods } from './world/saving.js';
import { signsMethods } from './world/signs.js';
import { dayMethods } from './world/day.js';
import { travelMethods } from './world/travel.js';

export default class WorldScene extends Phaser.Scene {
  constructor(key) {
    super(key);
  }
}

Object.assign(
  WorldScene.prototype,
  hudMethods,
  controlsMethods,
  modalMethods,
  pauseMethods,
  missionsMethods,
  clockMethods,
  savingMethods,
  signsMethods,
  dayMethods,
  travelMethods
);
