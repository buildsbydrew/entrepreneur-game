// The game itself: it owns the 3D view, the current place and its people, the player, the clock,
// the interface and saving, and runs everything once per frame.
import * as THREE from 'three';
import world from '../data/world.json';
import placesData from '../data/places.json';
import peopleData from '../data/people.json';
import conversationsData from '../data/conversations.json';
import { state, newLife, importState } from './state.js';
import { saveGame, loadGame } from './save.js';
import { tick, nextMorning, formatTime, seasonOf, ageOf, isBedtime } from './clock.js';
import { createInput } from './input.js';
import { createUI } from '../ui/ui.js';
import { QUALITY, loadQuality, saveQuality } from '../render/quality.js';
import { createDaylight } from '../render/daylight.js';
import Place from '../world/Place.js';
import Person from '../people/Person.js';
import { stageForAge } from '../people/body.js';
import { pickConversation } from '../story/conversation.js';
import { runConversation } from '../story/talk.js';

const deg = d => THREE.MathUtils.degToRad(d ?? 0);
const TALK_RANGE = 1.9;   // how close the player must be to talk or use something
const AUTOSAVE_MS = 10000;

export default class Game {
  constructor(root) {
    this.root = root;
    this.qualityLevel = loadQuality();
    const quality = QUALITY[this.qualityLevel];

    // The 3D view
    this.renderer = new THREE.WebGLRenderer({ antialias: quality.antialias, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, quality.pixelRatio));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    root.querySelector('#world').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 220);
    this.daylight = createDaylight(this.scene, quality);
    addEventListener('resize', () => this.resize());

    this.ui = createUI(root.querySelector('#ui'));
    this.input = createInput(root.querySelector('#ui'));
    this.ui.hud.onPause(() => this.input.queuePause());

    this.mode = 'title';   // 'title', 'play', 'talk', 'menu', 'busy' (fading)
    this.place = null;
    this.people = [];
    this.player = null;
    this.camTarget = new THREE.Vector3();
    this.zoom = 1;
    this.titleClock = { minutes: 8.5 * 60 };
    this.lastSave = performance.now();

    // Zoom with the mouse wheel, or two fingers on a phone
    addEventListener('wheel', e => { this.zoom = THREE.MathUtils.clamp(this.zoom * (1 + Math.sign(e.deltaY) * 0.08), 0.6, 2.2); }, { passive: true });
    let pinch = null;
    addEventListener('touchstart', e => { if (e.touches.length === 2) pinch = { d: this.touchGap(e), zoom: this.zoom }; }, { passive: true });
    addEventListener('touchmove', e => { if (pinch && e.touches.length === 2) this.zoom = THREE.MathUtils.clamp(pinch.zoom * pinch.d / this.touchGap(e), 0.6, 2.2); }, { passive: true });
    addEventListener('touchend', () => { pinch = null; });

    // Phones close games without warning, so save the moment the game is hidden, and pause
    const saveNow = () => { if (this.player && state.life) this.save(); };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        saveNow();
        if (this.mode === 'play') this.openPause();
      }
    });
    addEventListener('pagehide', saveNow);

    this.clockTimer = new THREE.Clock();
    this.showTitle();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  touchGap(e) {
    return Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  // ---------- Title, new life, continue ----------

  showTitle() {
    this.mode = 'title';
    this.clearPlace();
    this.buildPlace('lane'); // the live street sits behind the title, with people going about their day
    this.ui.hud.show(false);
    this.input.showPad(false);
    const saved = loadGame();
    this.ui.showTitle({
      title: world.worldName,
      saved: saved ? this.describeSave(saved.state) : null,
      onNew: () => this.ui.showNewLife({
        skins: peopleData.skins,
        onBack: () => this.showTitle(),
        onStart: choice => this.startNewLife(choice)
      }),
      onContinue: () => this.continueLife(saved)
    });
  }

  describeSave(s) {
    const season = seasonOf(s.clock, world);
    return `${s.life.name}, age ${ageOf(s.life.birth, s.clock, world)} · Year ${s.clock.year}, ${season.name}`;
  }

  async startNewLife({ name, body, skin }) {
    this.ui.closeScreen();
    newLife(world, {
      name,
      look: { body, skin, shirt: '#f39c12', bottom: '#2c3e50', hair: body === 'girl' ? 'bun' : 'cap', accent: '#f39c12' }
    });
    await this.enterPlace('home', 'bed', `Welcome to the world, ${name}`, 'Year 1 · ' + seasonOf(state.clock, world).name);
    this.ui.toast('Walk with WASD or the arrow keys. Press E to talk to people.');
    this.save();
  }

  async continueLife(saved) {
    this.ui.closeScreen();
    importState(saved.state);
    await this.enterPlace(state.place, state.player ? null : 'bed', state.life.name, this.dateText());
  }

  // ---------- Places ----------

  clearPlace() {
    this.people.forEach(p => p.destroy());
    this.people = [];
    if (this.player) this.player.destroy();
    this.player = null;
    if (this.place) this.place.dispose();
    this.place = null;
  }

  // Builds a place and the people who are there. entry: where the player appears (null: their saved spot,
  // or no player at all on the title screen).
  buildPlace(id, entry) {
    const data = placesData[id];
    this.place = new Place(this.scene, data);
    this.people = peopleData.people
      .filter(p => p.place === id)
      .map(p => {
        const person = new Person(this.scene, this.place.space, { id: p.id, name: p.name, look: p.look, stage: p.stage, x: p.spot.x, z: p.spot.z, facing: deg(p.spot.facing) });
        person.data = p;
        person.idleFor = 2 + Math.random() * 6;
        return person;
      });
    if (entry !== undefined && state.life) {
      const spot = (entry && data.entries[entry]) || state.player || data.entries[Object.keys(data.entries)[0]];
      this.player = new Person(this.scene, this.place.space, {
        id: 'you', look: state.life.look, stage: stageForAge(ageOf(state.life.birth, state.clock, world)),
        x: spot.x, z: spot.z, facing: deg(spot.facing ?? 0)
      });
      this.camTarget.set(spot.x, 0, spot.z);
    } else {
      this.camTarget.set(0, 0, 2);
    }
  }

  async enterPlace(id, entry, cardTitle = '', cardSubtitle = '') {
    this.mode = 'busy';
    this.input.showPad(false);
    this.ui.hidePrompt();
    await this.ui.fadeOut(cardTitle, cardSubtitle);
    this.clearPlace();
    state.place = id;
    if (entry) state.player = null;
    this.buildPlace(id, entry ?? null);
    this.ui.hud.show(true);
    this.updateHud();
    this.mode = 'play';
    this.input.showPad(true);
    await this.ui.fadeIn();
  }

  // ---------- Each frame ----------

  frame() {
    const dt = Math.min(0.05, this.clockTimer.getDelta());
    this.input.poll();

    if (this.mode === 'title') {
      this.titleClock.minutes += dt * 6; // the title street slowly moves through the day
      if (this.titleClock.minutes > 20 * 60) this.titleClock.minutes = 6 * 60;
      this.updatePeople(dt);
      const t = performance.now() / 9000;
      this.camera.position.set(Math.sin(t) * 14, 13, 19 + Math.cos(t) * 3);
      this.camera.lookAt(0, 1, 1);
      this.place?.update(dt, { x: 999, z: 999 }, this.daylight.lamps);
      this.daylight.update(this.titleClock.minutes, this.camTarget);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.mode === 'play') {
      if (this.input.pause) { this.openPause(); }
      else this.play(dt);
    } else if (this.player) {
      this.player.rest(dt);
    }

    if (this.player) {
      this.updatePeople(dt);
      this.player.update(dt);
      this.place.update(dt, this.player.pos, this.daylight.lamps);
      this.followCamera(dt);
    }
    if (state.clock) this.daylight.update(state.clock.minutes, this.camTarget);
    this.renderer.render(this.scene, this.camera);
  }

  play(dt) {
    // Time passes
    tick(state.clock, world, dt * 1000);
    if (isBedtime(state.clock, world)) {
      this.sleep(true);
      return;
    }

    // Walking
    const { x, z } = this.input.move;
    this.player.moveBy(x * this.player.speed, z * this.player.speed, dt);
    if (Math.hypot(x, z) < 0.1) this.player.rest(dt);
    state.player = { x: this.player.pos.x, z: this.player.pos.z };

    // Walking off an edge where there's a way out
    const exit = this.place.exitAt(this.player.pos.x, this.player.pos.z, this.player.radius, x, z);
    if (exit) {
      this.enterPlace(exit.to, exit.arriveAt);
      return;
    }

    // Who or what is close enough to use
    const target = this.nearestTarget();
    if (target) {
      const head = new THREE.Vector3(target.x, target.height + 0.45, target.z).project(this.camera);
      this.ui.showPrompt((head.x + 1) / 2 * innerWidth, (1 - head.y) / 2 * innerHeight, target.label);
      this.input.setActionLabel(target.short);
      if (this.input.action) target.use();
    } else {
      this.ui.hidePrompt();
      this.input.setActionLabel('●');
    }

    this.updateHud();
    if (performance.now() - this.lastSave > AUTOSAVE_MS) this.save();
  }

  // The nearest person or thing within reach, with what pressing E would do
  nearestTarget() {
    const p = this.player.pos;
    let best = null;
    let bestD = TALK_RANGE;
    for (const person of this.people) {
      const d = Math.hypot(person.pos.x - p.x, person.pos.z - p.z);
      if (d < bestD) {
        bestD = d;
        best = { x: person.pos.x, z: person.pos.z, height: person.headHeight(), label: `Talk to ${person.name}`, short: 'Talk', use: () => this.talkTo(person) };
      }
    }
    for (const thing of this.place.interactables) {
      const d = Math.hypot(thing.x - p.x, thing.z - p.z);
      if (d < bestD) {
        bestD = d;
        best = { x: thing.x, z: thing.z, height: 0.6, label: this.thingLabel(thing), short: thing.kind === 'sleep' ? (state.clock.minutes >= 18 * 60 ? 'Sleep' : 'Bed') : 'Look', use: () => this.useThing(thing) };
      }
    }
    return best;
  }

  thingLabel(thing) {
    if (thing.kind === 'sleep') return state.clock.minutes >= 18 * 60 ? 'Go to sleep' : `${thing.label} (sleep after 6 PM)`;
    return thing.label;
  }

  useThing(thing) {
    if (thing.kind === 'sleep') {
      if (state.clock.minutes >= 18 * 60) this.sleep(false);
      else this.ui.toast("You're not tired yet.");
      return;
    }
    if (thing.text) this.ui.toast(thing.text);
  }

  // ---------- People ----------

  // People stand at their spot, now and then stroll somewhere nearby and come back,
  // and turn to look at the player when they come close
  updatePeople(dt) {
    for (const person of this.people) {
      if (person.talking) {
        person.rest(dt);
        person.faceToward(this.player.pos.x, this.player.pos.z, dt);
      } else if (person.route.length) {
        person.followRoute(dt);
      } else {
        person.rest(dt);
        const near = this.player && Math.hypot(this.player.pos.x - person.pos.x, this.player.pos.z - person.pos.z) < 3;
        if (near) person.faceToward(this.player.pos.x, this.player.pos.z, dt * 0.5);
        else person.turnToward(deg(person.data.spot.facing), dt * 0.3);
        person.idleFor -= dt;
        if (person.idleFor <= 0 && !near && person.data.wander?.length) {
          const there = person.data.wander[Math.floor(Math.random() * person.data.wander.length)];
          person.walkTo([there, person.data.spot]);
          person.idleFor = 5 + Math.random() * 9;
        }
      }
      person.update(dt);
    }
  }

  async talkTo(person) {
    const convo = pickConversation(person.data, conversationsData.conversations);
    if (!convo) return;
    this.mode = 'talk';
    this.ui.hidePrompt();
    this.input.showPad(false);
    person.route = [];
    person.talking = true;
    this.player.faceToward(person.pos.x, person.pos.z);

    const nameOf = id => peopleData.people.find(p => p.id === id)?.name ?? id;
    const notes = await runConversation(this.ui, convo, { personId: person.id, nameOf, names: { currency: world.currency.plural } });

    person.talking = false;
    // Show how it went: who liked it, and money changing hands
    const head = new THREE.Vector3(person.pos.x, person.headHeight() + 0.6, person.pos.z).project(this.camera);
    const sx = (head.x + 1) / 2 * innerWidth;
    const sy = (1 - head.y) / 2 * innerHeight;
    notes.forEach((note, i) => setTimeout(() => {
      if (note.kind === 'bond') this.ui.feeling(sx, sy, `${nameOf(note.personId)} ${note.amount > 0 ? 'liked that' : "didn't like that"}`);
      if (note.kind === 'money') this.ui.feeling(sx, sy + 30, `${note.amount > 0 ? '+' : ''}${note.amount} ${world.currency.plural}`);
    }, i * 500));

    this.mode = 'play';
    this.input.showPad(true);
    this.updateHud();
    this.save();
  }

  // ---------- Days ----------

  // Off to bed: tonight in bed, or wherever you are if it's too late. Morning comes at home.
  async sleep(tooLate) {
    this.mode = 'busy';
    if (tooLate) this.ui.toast("It's late. You can't keep your eyes open.");
    nextMorning(state.clock, world);
    const season = seasonOf(state.clock, world);
    await this.enterPlace('home', 'bed', `Day ${season.dayOfSeason} of ${season.name}`, `Year ${state.clock.year}`);
    this.save();
  }

  dateText() {
    const season = seasonOf(state.clock, world);
    return `${season.name} ${season.dayOfSeason}`;
  }

  updateHud() {
    this.ui.hud.update({ time: formatTime(state.clock.minutes), date: this.dateText(), money: state.money });
  }

  save() {
    this.lastSave = performance.now();
    saveGame();
  }

  // ---------- Camera ----------

  // Glides after the player from above and behind; a little closer for small people and indoors
  followCamera(dt) {
    const p = this.player.pos;
    this.camTarget.lerp(new THREE.Vector3(p.x, 0, p.z), Math.min(1, dt * 4));
    const size = { baby: 0.72, child: 0.86, teen: 0.95, adult: 1, elder: 1 }[this.player.stage];
    const indoors = this.place.insideHouse(p.x, p.z) ? 0.94 : 1;
    const portrait = Math.max(1, Math.sqrt(0.9 / this.camera.aspect)); // tall phone screens see less from side to side, so step back
    const k = size * indoors * this.zoom * portrait;
    this.camera.position.set(this.camTarget.x, 13 * k, this.camTarget.z + 13 * k);
    this.camera.lookAt(this.camTarget.x, 0.7 * size, this.camTarget.z);
  }

  // ---------- Pause ----------

  openPause() {
    this.mode = 'menu';
    this.ui.hidePrompt();
    this.input.showPad(false);
    this.save();
    this.ui.showPause({
      quality: this.qualityLevel,
      qualities: QUALITY,
      onResume: () => this.closePause(),
      onQuality: level => this.setQuality(level),
      onMenu: () => { this.save(); this.ui.closeScreen(); this.showTitle(); }
    });
    // Esc closes the menu again
    const onKey = e => {
      if ((e.code === 'Escape' || e.code === 'KeyP') && this.mode === 'menu') { removeEventListener('keydown', onKey); this.closePause(); }
    };
    setTimeout(() => addEventListener('keydown', onKey), 0);
    this.pauseKeyListener = onKey;
  }

  closePause() {
    removeEventListener('keydown', this.pauseKeyListener);
    this.ui.closeScreen();
    this.mode = 'play';
    this.input.showPad(true);
    this.input.poll(); // throw away the key that closed the menu
  }

  setQuality(level) {
    this.qualityLevel = level;
    saveQuality(level);
    const q = QUALITY[level];
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, q.pixelRatio));
    this.renderer.setSize(innerWidth, innerHeight);
    this.daylight.setShadows(q);
  }

  // ---------- For testing (only with ?dev in the address) ----------
  setPlayerStage(stage) {
    if (this.player) this.player.setStage(stage);
  }
}
