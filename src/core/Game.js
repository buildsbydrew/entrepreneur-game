// The game itself: it owns the 3D view, the current place and its people, the player, the clock,
// the interface, sound and saving, and runs everything once per frame.
import * as THREE from 'three';
import world from '../data/world.json';
import placesData from '../data/places.json';
import peopleData from '../data/people.json';
import conversationsData from '../data/conversations.json';
import focusData from '../data/focus.json';
import eventsData from '../data/events.json';
import storyData from '../data/storydays.json';
import { state, newLife, importState, personRecord, giveItem, takeItem } from './state.js';
import { saveGame, loadGame, deleteSave } from './save.js';
import { tick, formatTime, seasonOf, ageOf, isBedtime, nextMorning, createClock, daysPerYear } from './clock.js';
import { stageForAge, playerAge, playerStage, chapterOf, focusChoices, jumpTime, drainEnergy, applyLifeEffects, topTraits, remember } from './life.js';
import { scheduleNow, isPresent, setTodaySchedules } from './schedule.js';
import { nextBigDay, jumpLength, todaysBigDay, beginBigDay, endBigDay, goalStatus, dueMoments, markTalksAtStart } from '../story/storyDays.js';
import { createInput } from './input.js';
import { createUI } from '../ui/ui.js';
import { QUALITY, loadQuality, saveQuality } from '../render/quality.js';
import { createDaylight } from '../render/daylight.js';
import Place from '../world/Place.js';
import Person from '../people/Person.js';
import { pickConversation, conditionsMet, fillText } from '../story/conversation.js';
import { runConversation } from '../story/talk.js';
import { playPrologue } from '../story/prologue.js';
import { speak, stopSpeaking, voiceFor } from '../audio/voice.js';
import { initAudio, play, footstep, talkBlip, setMusicTime, setIndoors, soundSettings, setSound } from '../audio/sound.js';

const deg = d => THREE.MathUtils.degToRad(d ?? 0);
const TALK_RANGE = 1.9;   // how close the player must be to talk or use something
const AUTOSAVE_MS = 10000;
const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

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
    this.ui.hud.onPeople(() => { if (this.mode === 'play') this.openPeople(); });
    addEventListener('keydown', e => {
      if (e.code !== 'KeyJ' || e.repeat) return;
      if (this.mode === 'play') this.openPeople();
      else if (this.mode === 'people') this.closePeople();
    });

    // Sound: people say their lines out loud in Urlivani (the English shows in the box), a click when choosing
    initAudio();
    this.ui.onSay = (speaker, isYou, text) => speak(text, this.voiceOf(speaker, isYou));
    this.ui.onSayEnd = () => stopSpeaking();
    this.ui.onChoose = () => play('choose');

    this.mode = 'title';   // 'title', 'cinematic' (the prologue), 'play', 'talk', 'menu', 'people', 'busy' (fading or between days)
    this.place = null;
    this.people = [];
    this.player = null;
    this.camTarget = new THREE.Vector3();
    this.zoom = 1;
    // The title screen's street is shown some years in, so the neighbours' children have grown up a little
    this.titleClock = { year: 8, day: 30, minutes: 8.5 * 60 };
    this.lastSave = performance.now();
    this.scheduleTimer = 0;
    this.lastStep = 0;
    this.toastCooldown = 0;
    this.wasIndoors = null;

    // Zoom with the mouse wheel, or two fingers on a phone
    addEventListener('wheel', e => { this.zoom = THREE.MathUtils.clamp(this.zoom * (1 + Math.sign(e.deltaY) * 0.08), 0.6, 2.2); }, { passive: true });
    let pinch = null;
    addEventListener('touchstart', e => { if (e.touches.length === 2) pinch = { d: this.touchGap(e), zoom: this.zoom }; }, { passive: true });
    addEventListener('touchmove', e => { if (pinch && e.touches.length === 2) this.zoom = THREE.MathUtils.clamp(pinch.zoom * pinch.d / this.touchGap(e), 0.6, 2.2); }, { passive: true });
    addEventListener('touchend', () => { pinch = null; });

    // Phones close games without warning, so save the moment the game is hidden, and pause
    const saveNow = () => { if (this.player && state.life && !state.dead && this.mode !== 'cinematic') this.save(); };
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

  // Each person's own Urlivani voice, from their body and their age right now (so it changes as they grow)
  voiceOf(name, isYou = false) {
    if (isYou && state.life) {
      return voiceFor({ body: state.life.look.body, stage: playerStage(world), seed: `you:${state.life.name}` });
    }
    const person = peopleData.people.map(p => this.personView(p)).find(p => p.name === name);
    if (!person) return voiceFor({ seed: name });
    const stage = stageForAge(ageOf(person.born, this.clockNow(), world));
    return voiceFor({ body: person.look.body, stage, seed: person.id });
  }

  // A person as they are in this life: your little brother or sister gets the name you chose for them
  personView(p) {
    const sibling = state.life?.sibling;
    if (!p.sibling || !sibling) return p;
    return { ...p, name: sibling.name ?? p.name, look: { ...p.look, body: sibling.body ?? p.look.body } };
  }

  nameOf(id) {
    const p = peopleData.people.find(person => person.id === id);
    return p ? this.personView(p).name : id;
  }

  // The date and time the world is at: the life being played, or the title screen's street
  clockNow() {
    return this.mode === 'title' || !state.clock ? this.titleClock : state.clock;
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
      title: world.gameTitle,
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

  // A new life: the prologue (the years you don't remember), then your first memory at age 5
  async startNewLife({ name, body, skin }) {
    this.ui.closeScreen();
    this.ui.hud.show(false);
    this.input.showPad(false);
    newLife(world, {
      name,
      look: { body, skin, shirt: '#f39c12', bottom: '#2c3e50', hair: body === 'girl' ? 'bun' : 'cap', accent: '#f39c12' }
    });
    // You know your family from the day you're born
    peopleData.people.filter(p => (p.tags ?? []).includes('family')).forEach(p => { personRecord(p.id).met = true; });

    const { start, birth, knownNeighbours } = await playPrologue(this);

    // Your first memory: a few days after your fifth birthday, first thing in the morning
    state.life.birth = { ...birth };
    state.clock = createClock(world, { year: birth.year, day: birth.day, minutes: start.hour * 60 });
    nextMorning(state.clock, world, start.age * daysPerYear(world) + start.extraDays);
    state.clock.minutes = start.hour * 60;
    state.money = start.money;
    state.needs = { energy: 100, health: 100, happiness: 80 };
    knownNeighbours.forEach(id => { personRecord(id).met = true; });
    remember(fillText(start.remember, { currency: world.currency.plural }), world);
    // The first memory is the first big day: the first day out alone
    const first = nextBigDay(storyData, world);
    if (first && first.days <= 0) this.startBigDay(first.day);

    const season = seasonOf(state.clock, world);
    await this.enterPlace('home', 'bed', 'Your first memory', `Age ${playerAge(world)} · ${season.name}, Year ${state.clock.year}`);
    play('morning');
    this.ui.toast("You're five now. Today, for the first time, you're allowed out on Willow Lane by yourself.");
    this.save();
  }

  // Sets up one scene of the prologue: the place, the time, who is there, and you
  async stageScene(scene, birth) {
    this.mode = 'busy';
    await this.ui.fadeOut();
    this.clearPlace();
    state.clock = createClock(world, { year: birth.year, day: birth.day });
    nextMorning(state.clock, world, scene.days);
    state.clock.minutes = scene.hour * 60;

    this.place = new Place(this.scene, placesData[scene.place]);
    this.people = [];
    for (const c of scene.cast) {
      const data = peopleData.people.find(p => p.id === c.id);
      const person = this.spawnPerson(data, c.x, c.z, deg(c.facing));
      person.scriptFacing = deg(c.facing);
      if (c.walkTo) person.walkTo(c.walkTo);
    }
    const you = scene.you;
    this.player = new Person(this.scene, this.place.space, {
      id: 'you', look: state.life.look, stage: playerStage(world), x: you.x, z: you.z, facing: deg(you.facing)
    });
    this.player.lift = you.lift ?? 0;
    this.player.scriptFacing = deg(you.facing);
    if (you.walkTo) this.player.walkTo(you.walkTo);

    this.cine = { x: scene.camera.x, z: scene.camera.z, zoom: scene.camera.zoom ?? 1, t: 0 };
    this.camTarget.set(this.cine.x, 0, this.cine.z);
    this.mode = 'cinematic';
    await this.ui.fadeIn();
  }

  // Each frame of the prologue: people go about the scene, and the camera drifts slowly closer
  cinematicFrame(dt) {
    if (!this.player || !this.place) return;
    const c = this.cine;
    c.t += dt;
    for (const person of [...this.people, this.player]) {
      if (person.route.length) person.followRoute(dt);
      else {
        person.rest(dt);
        person.turnToward(person.scriptFacing, dt * 3);
      }
      person.update(dt);
    }
    this.place.update(dt, { x: c.x, z: c.z }, this.daylight.lamps);
    const k = c.zoom * (1.1 - Math.min(0.12, c.t * 0.012));
    const sway = Math.sin(c.t * 0.25) * 1.2;
    this.camera.position.set(c.x + sway, 13 * k, c.z + 13 * k);
    this.camera.lookAt(c.x, 0.5, c.z);
  }

  async continueLife(saved) {
    this.ui.closeScreen();
    importState(saved.state);
    setTodaySchedules(todaysBigDay(storyData)?.schedules);
    await this.enterPlace(state.place, state.player ? null : this.bedEntry(), state.life.name, this.dateText());
  }

  // Babies sleep in their cot; everyone else in a bed
  bedEntry() {
    return playerStage(world) === 'baby' ? 'cot' : 'bed';
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

  // Puts a person from people.json into the current place, at a position
  spawnPerson(data, x, z, facing) {
    const p = this.personView(data);
    const clock = this.clockNow();
    const person = new Person(this.scene, this.place.space, {
      id: p.id, name: p.name, look: p.look, stage: stageForAge(ageOf(p.born, clock, world)), x, z, facing
    });
    person.data = p;
    person.plan = scheduleNow(p, clock.minutes);
    person.idleFor = 2 + Math.random() * 6;
    this.people.push(person);
    return person;
  }

  // Builds a place and the people who are there. entry: where the player appears (null: their saved spot;
  // undefined: no player at all, for the title screen).
  buildPlace(id, entry) {
    const data = placesData[id];
    const clock = this.clockNow();
    this.place = new Place(this.scene, data);
    this.people = [];
    peopleData.people
      .filter(p => isPresent(p, id, clock, world))
      .forEach(p => {
        const plan = scheduleNow(p, clock.minutes);
        this.spawnPerson(p, plan.spot.x, plan.spot.z, deg(plan.spot.facing));
      });
    if (entry !== undefined && state.life) {
      const spot = (entry && data.entries[entry]) || state.player || data.entries[Object.keys(data.entries)[0]];
      this.player = new Person(this.scene, this.place.space, {
        id: 'you', look: state.life.look, stage: playerStage(world), x: spot.x, z: spot.z, facing: deg(spot.facing ?? 0)
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
    if (!cardTitle) play('whoosh');
    await this.ui.fadeOut(cardTitle, cardSubtitle);
    this.clearPlace();
    state.place = id;
    if (entry) state.player = null;
    this.buildPlace(id, entry ?? null);
    this.ui.closeScreen();
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
      this.updateSchedules(dt);
      this.updatePeople(dt);
      const t = performance.now() / 9000;
      this.camera.position.set(Math.sin(t) * 14, 13, 19 + Math.cos(t) * 3);
      this.camera.lookAt(0, 1, 1);
      this.place?.update(dt, { x: 999, z: 999 }, this.daylight.lamps);
      this.daylight.update(this.titleClock.minutes, this.camTarget);
      setMusicTime(this.titleClock.minutes);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.mode === 'cinematic' || (this.mode === 'busy' && !this.player && state.clock)) {
      if (this.mode === 'cinematic') this.cinematicFrame(dt);
      this.daylight.update(state.clock.minutes, this.camTarget);
      setMusicTime(state.clock.minutes);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.mode === 'play') {
      if (this.input.pause) this.openPause();
      else this.play(dt);
    } else if (this.player) {
      this.player.rest(dt);
    }

    if (this.player) {
      if (this.mode === 'play') this.updateSchedules(dt);
      this.updatePeople(dt);
      this.player.update(dt);
      this.place.update(dt, this.player.pos, this.daylight.lamps);
      this.followCamera(dt);
      const indoors = Boolean(this.place.insideHouse(this.player.pos.x, this.player.pos.z));
      if (indoors !== this.wasIndoors) {
        setIndoors(indoors);
        this.wasIndoors = indoors;
      }
    }
    if (state.clock) {
      this.daylight.update(state.clock.minutes, this.camTarget);
      setMusicTime(state.clock.minutes);
    }
    this.renderer.render(this.scene, this.camera);
  }

  play(dt) {
    // Time passes, at the speed of this stage of life, and the day wears you out
    const before = state.clock.minutes;
    tick(state.clock, world, dt * 1000, chapterOf(world).realMinutesPerDay);
    drainEnergy(state.clock.minutes - before, world);
    if (isBedtime(state.clock, world)) {
      this.sleep(true);
      return;
    }
    this.toastCooldown -= dt;

    // Walking. Tired people walk slower.
    const { x, z } = this.input.move;
    const tiredness = 0.6 + 0.4 * Math.min(1, state.needs.energy / 40);
    const speed = this.player.speed * tiredness;
    this.player.moveBy(x * speed, z * speed, dt);
    if (Math.hypot(x, z) < 0.1) this.player.rest(dt);
    state.player = { x: this.player.pos.x, z: this.player.pos.z };
    this.footsteps();

    // Walking off an edge where there's a way out (babies can't go out on their own)
    const exit = this.place.exitAt(this.player.pos.x, this.player.pos.z, this.player.radius, x, z);
    if (exit) {
      if (this.player.stage === 'baby') {
        if (this.toastCooldown <= 0) {
          this.ui.toast("You're too little to go out on your own.");
          this.toastCooldown = 3;
        }
      } else {
        this.enterPlace(exit.to, exit.arriveAt);
        return;
      }
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
    this.updateStory(dt);
    if (performance.now() - this.lastSave > AUTOSAVE_MS) this.save();
  }

  // ---------- Big days ----------

  startBigDay(day) {
    beginBigDay(day);
    markTalksAtStart(peopleData.people.map(p => p.id));
    setTodaySchedules(day.schedules);
    this.storyTimer = 0;
  }

  // A few times a second on a big day: tick off goals, and play any moment that's due
  updateStory(dt) {
    const day = todaysBigDay(storyData);
    if (!day) {
      this.ui.goals.hide();
      return;
    }
    this.storyTimer = (this.storyTimer ?? 0) - dt;
    if (this.storyTimer > 0 || this.runningMoment) return;
    this.storyTimer = 0.4;
    const context = { place: this.place.id, hour: state.clock.minutes / 60 };
    this.ui.goals.show(day.title, goalStatus(day, context));
    const due = dueMoments(day, context);
    if (!due.length) return;
    this.runningMoment = true;
    (async () => {
      for (const moment of due) await this.runActions(moment.do);
    })().catch(e => console.error('A big day moment failed', e)).finally(() => { this.runningMoment = false; });
  }

  // Carries out a moment's actions, in order (see src/story/storyDays.js for the list)
  async runActions(actions = []) {
    const names = { currency: world.currency.plural };
    const find = id => this.people.find(p => p.id === id && !p.leaving);
    for (const a of actions) {
      if (!this.place || state.dead) return;
      if (a.chooseSibling && !state.life.sibling?.body) {
        const body = Math.random() < 0.5 ? 'girl' : 'boy';
        state.life.sibling = { ...(state.life.sibling ?? {}), body };
        state.flags[`sibling-${body}`] = true;
      }
      if (a.appear && !find(a.appear)) {
        const data = peopleData.people.find(p => p.id === a.appear);
        if (data) {
          const person = this.spawnPerson(data, a.x, a.z, deg(a.facing));
          person.staged = true;
          person.plan = { place: this.place.id, spot: { x: a.x, z: a.z, facing: a.facing ?? 0 } };
          if (a.walkTo) person.walkTo(a.walkTo);
        }
      }
      if (a.leave) {
        const person = find(a.leave);
        if (person) {
          if (person.talking) await new Promise(r => { const t = setInterval(() => { if (!person.talking) { clearInterval(t); r(); } }, 200); });
          person.staged = false;
          person.leaving = true;
          person.walkTo(a.walkTo ?? this.place.routeToEdge(person.pos));
        }
      }
      if (a.setFlag) [].concat(a.setFlag).forEach(f => { state.flags[f] = true; });
      if (a.remember) remember(fillText(a.remember, names), world);
      if (a.give) giveItem(a.give);
      if (a.take) takeItem(a.take);
      if (a.camera === 'look' && a.at) this.lookAt = { id: a.at, until: performance.now() + (a.seconds ?? 3) * 1000 };
      if (a.toast) {
        this.ui.toast(fillText(a.toast, names));
        play('event');
      }
      if (a.say) await this.ui.dialogue.say(this.nameOf(a.say[0]), fillText(a.say[1], names), a.say[0] === 'you');
      if (a.talk) {
        const person = find(a.with);
        const convo = conversationsData.conversations.find(c => c.id === a.talk);
        if (!person || !convo || (convo.once && state.flags[`talked:${convo.id}`])) continue;
        // Wait for whatever else is going on (another conversation, a door) to finish first
        while (this.mode !== 'play') {
          if (state.dead || this.mode === 'title') return;
          await new Promise(r => setTimeout(r, 200));
        }
        if (conditionsMet(convo.when, person.id)) await this.talkTo(person, convo);
      }
    }
  }

  // A footstep sound each time a foot lands: soft on the ground, a tap on floors indoors
  footsteps() {
    const step = Math.floor(this.player.phase / Math.PI);
    if (step !== this.lastStep && this.player.pace > 0.3) {
      const indoors = this.place.insideHouse(this.player.pos.x, this.player.pos.z);
      footstep(indoors ? 'floor' : 'ground', this.player.stage === 'baby' || this.player.stage === 'child');
    }
    this.lastStep = step;
  }

  // The nearest person or thing within reach, with what pressing E would do
  nearestTarget() {
    const p = this.player.pos;
    const stage = this.player.stage;
    let best = null;
    let bestD = TALK_RANGE;
    for (const person of this.people) {
      if (person.leaving) continue;
      const d = Math.hypot(person.pos.x - p.x, person.pos.z - p.z);
      if (d < bestD) {
        bestD = d;
        best = { x: person.pos.x, z: person.pos.z, height: person.headHeight(), label: stage === 'baby' ? `Babble at ${person.name}` : `Talk to ${person.name}`, short: 'Talk', use: () => this.talkTo(person) };
      }
    }
    for (const thing of this.place.interactables) {
      if (thing.stages && !thing.stages.includes(stage)) continue;
      const d = Math.hypot(thing.x - p.x, thing.z - p.z);
      if (d < bestD) {
        bestD = d;
        const evening = state.clock.minutes >= 18 * 60;
        best = {
          x: thing.x, z: thing.z, height: 0.6, label: this.thingLabel(thing),
          short: thing.kind === 'sleep' ? (evening ? 'Sleep' : 'Bed') : 'Look',
          use: () => this.useThing(thing)
        };
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
      // Some nights you can't sleep yet: something is still going to happen
      const day = todaysBigDay(storyData);
      if (day?.bedFrom && state.clock.minutes < day.bedFrom * 60) {
        if (this.toastCooldown <= 0) {
          this.ui.toast('You can\'t sleep. Not yet. Not tonight.');
          this.toastCooldown = 4;
        }
        return;
      }
      if (state.clock.minutes >= 18 * 60) this.sleep(false);
      else {
        play('error');
        this.ui.toast("You're not tired yet.");
      }
      return;
    }
    const text = this.player.stage === 'baby' && thing.babyText ? thing.babyText : thing.text;
    if (text) this.ui.toast(fillText(text, { currency: world.currency.plural }));
    // Some things do you good, once a day
    const key = `thing:${thing.id}:${state.clock.year}:${state.clock.day}`;
    if (thing.daily && !state.flags[key]) {
      state.flags[key] = true;
      applyLifeEffects(thing.daily, peopleData);
      play('warm');
    } else {
      play('click');
    }
  }

  // ---------- People ----------

  // Every second or so, people check their schedule: those who should be elsewhere walk off
  // (out through their door if they're indoors) and those who should be here arrive from the edge
  updateSchedules(dt) {
    this.scheduleTimer -= dt;
    if (this.scheduleTimer > 0 || !this.place) return;
    this.scheduleTimer = 1;
    const clock = this.clockNow();
    const id = this.place.id;

    for (const p of peopleData.people) {
      const here = this.people.find(person => person.id === p.id);
      const present = isPresent(p, id, clock, world);
      if (present && !here) {
        // Arriving: appear at the edge and walk in (through the door if their spot is indoors)
        const plan = scheduleNow(p, clock.minutes);
        const route = this.place.routeToEdge(plan.spot).reverse();
        const start = route.shift() ?? plan.spot;
        const person = this.spawnPerson(p, start.x, start.z, 0);
        person.walkTo([...route, plan.spot]);
      } else if (here?.staged) {
        // Brought in by a big day's moment: they stay until the moment sends them off
        continue;
      } else if (!present && here && !here.leaving && !here.talking) {
        // Leaving: walk to the edge, then vanish
        here.leaving = true;
        here.walkTo(this.place.routeToEdge(here.pos));
      } else if (present && here && !here.leaving && !here.talking) {
        // Same place, new part of the day: walk to the new spot
        const plan = scheduleNow(p, clock.minutes);
        if (plan !== here.plan) {
          here.plan = plan;
          const fromHouse = this.place.insideHouse(here.pos.x, here.pos.z);
          const toHouse = this.place.insideHouse(plan.spot.x, plan.spot.z);
          const via = [];
          if (fromHouse && fromHouse !== toHouse) via.push(fromHouse.doorIn, fromHouse.doorOut);
          if (toHouse && toHouse !== fromHouse) via.push(toHouse.doorOut, toHouse.doorIn);
          here.walkTo([...via, plan.spot]);
        }
      }
    }
  }

  // People stand at their spot, now and then stroll somewhere nearby and come back,
  // and turn to look at the player when they come close
  updatePeople(dt) {
    for (const person of [...this.people]) {
      if (person.scriptFacing !== undefined) {
        // In a prologue scene: they only do what the scene tells them
        person.rest(dt);
        person.update(dt);
        continue;
      }
      if (person.talking) {
        person.rest(dt);
        person.faceToward(this.player.pos.x, this.player.pos.z, dt);
      } else if (person.route.length) {
        person.followRoute(dt);
      } else if (person.leaving) {
        person.destroy();
        this.people = this.people.filter(p => p !== person);
        continue;
      } else {
        person.rest(dt);
        const plan = person.plan;
        const near = this.player && Math.hypot(this.player.pos.x - person.pos.x, this.player.pos.z - person.pos.z) < 3;
        if (near) person.faceToward(this.player.pos.x, this.player.pos.z, dt * 0.5);
        else if (plan?.spot) person.turnToward(deg(plan.spot.facing), dt * 0.3);
        person.idleFor -= dt;
        if (person.idleFor <= 0 && !near && plan?.spot && plan.wander?.length) {
          const there = plan.wander[Math.floor(Math.random() * plan.wander.length)];
          person.walkTo([there, plan.spot]);
          person.idleFor = 5 + Math.random() * 9;
        }
      }
      person.update(dt);
    }
  }

  // convo: a particular conversation (a big day's moment); otherwise whatever they want to talk about
  async talkTo(person, convo = pickConversation(person.data, conversationsData.conversations)) {
    if (!convo || this.mode === 'talk') return;
    this.mode = 'talk';
    this.ui.hidePrompt();
    this.input.showPad(false);
    person.route = [];
    person.talking = true;
    this.player.faceToward(person.pos.x, person.pos.z);

    const nameOf = id => this.nameOf(id);
    const notes = await runConversation(this.ui, convo, { personId: person.id, nameOf, names: { currency: world.currency.plural } });

    person.talking = false;
    // Show how it went: who liked it, money changing hands, a lift in mood
    const head = new THREE.Vector3(person.pos.x, person.headHeight() + 0.6, person.pos.z).project(this.camera);
    const sx = (head.x + 1) / 2 * innerWidth;
    const sy = (1 - head.y) / 2 * innerHeight;
    notes.forEach((note, i) => setTimeout(() => {
      if (note.kind === 'bond') {
        this.ui.feeling(sx, sy, `${nameOf(note.personId)} ${note.amount > 0 ? 'liked that' : "didn't like that"}`);
        play(note.amount > 0 ? 'warm' : 'cold');
      }
      if (note.kind === 'money') {
        this.ui.feeling(sx, sy + 30, `${note.amount > 0 ? '+' : ''}${note.amount} ${world.currency.plural}`);
        play(note.amount > 0 ? 'coin' : 'spend');
      }
      if (note.kind === 'happiness' && note.amount > 0) this.ui.feeling(sx, sy + 60, 'That made you happy');
    }, i * 500));

    this.mode = 'play';
    this.input.showPad(true);
    this.updateHud();
    this.save();
  }

  // ---------- The People screen ----------

  openPeople() {
    this.mode = 'people';
    this.ui.hidePrompt();
    this.input.showPad(false);
    play('page');
    const clock = state.clock;
    const people = peopleData.people
      .filter(p => state.people[p.id]?.met)
      .map(p => {
        const age = ageOf(p.born, clock, world);
        return { name: this.personView(p).name, bond: state.people[p.id].bond, detail: `Age ${age}` };
      })
      .sort((a, b) => b.bond - a.bond);
    const traits = Object.entries(state.traits).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([id]) => world.traits[id] ?? id);
    const skills = Object.entries(state.skills).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([id, level]) => ({ name: world.skills[id] ?? id, level }));
    this.ui.showPeople({ people, journal: state.journal, traits, skills, onClose: () => this.closePeople() });
    const onKey = e => { if (e.code === 'Escape' && this.mode === 'people') this.closePeople(); };
    this.peopleKey = onKey;
    addEventListener('keydown', onKey);
  }

  closePeople() {
    removeEventListener('keydown', this.peopleKey);
    this.ui.closeScreen();
    this.mode = 'play';
    this.input.showPad(true);
    this.input.poll();
  }

  // ---------- Days and the years between them ----------

  // Off to bed: tonight in bed, or wherever you are if it's too late. Then time jumps forward, shaped by
  // what you choose to focus on, and morning comes at home, months or years later.
  async sleep(tooLate) {
    if (this.mode === 'busy') return;
    this.mode = 'busy';
    this.ui.hidePrompt();
    this.input.showPad(false);
    if (tooLate) this.ui.toast("It's late. You can't keep your eyes open.");
    play('sleep');
    this.ui.goals.hide();
    await this.ui.fadeOut();

    // The end of a big day: the line that closes it (often a cliffhanger), on a black screen
    const ending = endBigDay(storyData);
    setTodaySchedules(null);
    this.lookAt = null;
    if (ending) {
      if (ending.remember) remember(fillText(ending.remember, { currency: world.currency.plural }), world);
      if (ending.line) {
        this.ui.cinema.open(null);
        this.ui.cinema.dark(true);
        await this.ui.cinema.caption(fillText(ending.line, { currency: world.currency.plural }));
        this.ui.cinema.close();
      }
    }

    // Some stories need the very next day to be played (a promise made for tomorrow)
    if (state.flags.playTomorrow) {
      delete state.flags.playTomorrow;
      nextMorning(state.clock, world, 1);
      state.needs.energy = 100;
      await this.wake();
      return;
    }

    // Time jumps forward, but never past the next big day
    const { days: jumpDays, bigDay } = jumpLength(chapterOf(world).jumpDays, storyData, world);
    const choices = focusChoices(focusData, world);
    const nextSpan = this.spanText(jumpDays, 'will pass');
    const focus = await this.ui.chooseFocus({
      heading: 'Time passes',
      sub: `${nextSpan} before the next day you live. What will you focus on?`,
      choices
    });
    const stageBefore = playerStage(world);
    const result = jumpTime({ world, focusData, eventsData, peopleData, focusId: focus.id, days: jumpDays });
    const lines = result.lines.map(line => fillText(line, { currency: world.currency.plural }));
    play(result.died ? 'end' : result.stageAfter !== stageBefore ? 'grow' : 'event');

    if (result.died) {
      deleteSave(); // a finished life can't be continued
      this.showLifeStory(result.died);
      return;
    }

    await this.ui.showSummary({
      heading: this.spanText(result.days, 'pass'),
      sub: this.ageText(),
      lines: lines.length ? lines : ['Life went on, quietly.']
    });
    await this.wake(bigDay);
  }

  // Morning at home. On a big day, the day starts at its own hour, with its title on the card.
  async wake(bigDay = null) {
    const season = seasonOf(state.clock, world);
    let title = `Day ${season.dayOfSeason} of ${season.name}`;
    if (bigDay) {
      this.startBigDay(bigDay);
      if (bigDay.hour !== undefined) state.clock.minutes = bigDay.hour * 60;
      title = bigDay.title;
    }
    await this.enterPlace(bigDay?.place ?? 'home', bigDay?.wake ?? this.bedEntry(), title, `Year ${state.clock.year} · Age ${playerAge(world)}`);
    play('morning');
    this.save();
  }

  // "You are 7 now", or for a baby under a year, how many seasons old they are
  ageText() {
    const age = playerAge(world);
    if (age > 0) return `You are ${age} now.`;
    const days = (state.clock.year - state.life.birth.year) * world.calendar.daysPerSeason * world.calendar.seasons.length + state.clock.day - state.life.birth.day;
    const seasons = Math.max(1, Math.round(days / world.calendar.daysPerSeason));
    return `You are ${seasons === 1 ? 'one season' : `${NUMBER_WORDS[seasons].toLowerCase()} seasons`} old.`;
  }

  // "A season passes", "Two years pass" and so on, for a number of days
  spanText(days, verb) {
    const perYear = world.calendar.daysPerSeason * world.calendar.seasons.length;
    const seasons = Math.round(days / world.calendar.daysPerSeason);
    const singular = verb === 'pass' ? 'passes' : verb;
    if (days < world.calendar.daysPerSeason) {
      const weeks = Math.max(1, Math.round(days / 7));
      return weeks === 1 ? `A week ${singular}` : `${NUMBER_WORDS[weeks] ?? 'A few'} weeks ${verb}`;
    }
    if (days < perYear) return seasons <= 1 ? `A season ${singular}` : `${NUMBER_WORDS[seasons] ?? seasons} seasons ${verb}`;
    const years = days / perYear;
    const whole = Math.floor(years);
    const half = years - whole >= 0.4;
    if (whole === 1) return half ? `A year and a half ${singular}` : `A year ${singular}`;
    return `${NUMBER_WORDS[whole] ?? whole} years${half ? ' and a half' : ''} ${verb}`;
  }

  // The end of a life: the story of it, then a fresh start
  showLifeStory(died) {
    this.mode = 'menu';
    this.ui.hud.show(false);
    const closest = Object.entries(state.people)
      .filter(([, r]) => r.met && r.bond > 0)
      .sort((a, b) => b[1].bond - a[1].bond)
      .slice(0, 3)
      .map(([id]) => peopleData.people.find(p => p.id === id)?.name ?? id);
    this.ui.showLifeStory({
      name: state.life.name,
      years: `Year ${state.life.birth.year} to Year ${state.clock.year} · lived to ${died.age}`,
      cause: died.cause,
      moments: state.journal.slice(-12),
      closest,
      traits: topTraits(2).map(id => world.traits[id] ?? id),
      money: `${state.money} ${world.currency.plural}`,
      onNew: () => { this.ui.closeScreen(); this.ui.fadeIn(); this.showTitle(); }
    });
  }

  dateText() {
    const season = seasonOf(state.clock, world);
    return `${season.name} ${season.dayOfSeason} · Age ${playerAge(world)}`;
  }

  updateHud() {
    this.ui.hud.update({ time: formatTime(state.clock.minutes), date: this.dateText(), money: state.money, needs: state.needs });
  }

  save() {
    if (state.dead) return;
    this.lastSave = performance.now();
    saveGame();
  }

  // ---------- Camera ----------

  // Glides after the player from above and behind; a little closer for small people and indoors
  followCamera(dt) {
    let p = this.player.pos;
    // A big day's moment can turn the camera to someone for a few seconds
    if (this.lookAt) {
      const other = performance.now() < this.lookAt.until && this.people.find(person => person.id === this.lookAt.id);
      if (other) p = { x: (p.x + other.pos.x * 2) / 3, z: (p.z + other.pos.z * 2) / 3 };
      else this.lookAt = null;
    }
    this.camTarget.lerp(new THREE.Vector3(p.x, 0, p.z), Math.min(1, dt * (this.lookAt ? 2 : 4)));
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
      sound: soundSettings(),
      onSound: (kind, on) => setSound(kind, on),
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
