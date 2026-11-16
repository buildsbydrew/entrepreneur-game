// The autopilot: plays a life the way a person would. It starts a new life from the title screen,
// watches the prologue and answers its questions, and each played day goes to see whoever has
// something new to say, plays with things now and then, lets the quiet hours pass, goes to bed,
// and picks what to focus on while time jumps. Every choice follows its personality (personality.js),
// with a little seeded randomness, and the reason goes into the log.
import world from '../data/world.json';
import conversationsData from '../data/conversations.json';
import { state } from '../core/state.js';
import { playerStage, drainEnergy } from '../core/life.js';
import { scheduleNow, isPresent } from '../core/schedule.js';
import { pickConversation } from '../story/conversation.js';
import { buildGrid, findPath } from './nav.js';
import { scoreEffects, pickOption } from './personality.js';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];
const lineTime = text => Math.min(6500, 900 + text.length * 50);

export function createAutopilot({ game, film, ui, profile, options, random, peopleData }) {
  const conversations = conversationsData.conversations;
  const nameOf = id => peopleData.people.find(p => p.id === id)?.name ?? id;
  const pilot = { convo: null };
  let task = null;
  let dayKey = '';
  let talkedToday = new Set();
  let thingsToday = 0;
  let repeatsToday = 0;
  let lastFocus = null;
  let storyShown = false;
  let decideTimer = 0;
  const grids = new Map();

  // ---------- Starting a life from the title screen ----------
  async function beginLife() {
    film.add('title', { title: world.gameTitle });
    await wait(2600);
    $('.screen [data-new]')?.click();
    await wait(900);
    const input = $('#life-name');
    if (input) {
      for (const ch of options.name) {
        input.value += ch;
        input.dispatchEvent(new Event('input'));
        await wait(140);
      }
    }
    await wait(500);
    $(`[data-body] [data-v="${options.body}"]`)?.click();
    await wait(450);
    $$('[data-skin] button')[options.skin - 1]?.click();
    await wait(900);
    film.add('born', { name: options.name, body: options.body });
    $('[data-start]')?.click();
  }
  if (game.mode === 'title') setTimeout(beginLife, 0);

  // ---------- Choosing ----------
  // Highlights the option the way arrow keys would, then picks it
  async function press(button) {
    if (!button) return;
    $$('.selected').forEach(b => b.classList.remove('selected'));
    button.classList.add('selected');
    await wait(650);
    button.click();
  }

  // The effects of a conversation choice, including what it leads to next
  const choiceEffects = choice => {
    const parts = [];
    const next = pilot.convo?.nodes?.[choice.next];
    return { now: choice.effects, next: next?.effects, parts };
  };

  // ---------- Conversations ----------
  const dialogueBox = $('.dialogue');
  const say = ui.dialogue.say.bind(ui.dialogue);
  ui.dialogue.say = (speaker, text, isYou = false) => {
    film.add('line', { speaker, text, isYou });
    const shown = say(speaker, text, isYou);
    let finished = false;
    shown.then(() => { finished = true; });
    (async () => {
      await wait(Math.ceil(text.length / 2) * 16 + 60 + lineTime(text));
      for (let i = 0; i < 4 && !finished; i++) {
        dialogueBox.click();
        await wait(80);
      }
    })();
    return shown;
  };

  const choose = ui.dialogue.choose.bind(ui.dialogue);
  ui.dialogue.choose = (speaker, prompt, choices, isYou = false) => {
    const picked = choose(speaker, prompt, choices, isYou);
    (async () => {
      const partner = game.filmTalkPartner;
      const who = id => (id ? nameOf(id) : partner?.name ?? 'They');
      const { index, reason } = pickOption(profile, choices, choice => {
        const { now, next } = choiceEffects(choice);
        return [...scoreEffects(profile, now, who), ...scoreEffects(profile, next, who, 0.8)];
      }, random);
      film.add('choice', { kind: 'talk', with: partner?.name, prompt, options: choices.map(c => c.text), picked: index, text: choices[index].text, reason });
      await wait(1500 + choices.length * 350);
      await press($$('.dialogue .choice')[index]);
    })();
    return picked;
  };

  const talkTo = game.talkTo.bind(game);
  game.talkTo = async person => {
    const convo = pickConversation(person.data, conversations);
    if (!convo) return;
    pilot.convo = convo;
    game.filmTalkPartner = person;
    film.add('talk', { with: person.name, id: person.id, convo: convo.id, isNew: !state.flags[`talked:${convo.id}`], place: game.place?.id });
    await talkTo(person);
    film.add('talk-end', { with: person.name, id: person.id });
    game.filmTalkPartner = null;
    pilot.convo = null;
  };

  // ---------- The prologue ----------
  const stageScene = game.stageScene.bind(game);
  game.stageScene = (scene, birth) => {
    film.add('prologue-scene', { id: scene.id, place: scene.place });
    return stageScene(scene, birth);
  };
  const cinemaEl = $('.cinema');
  const caption = ui.cinema.caption.bind(ui.cinema);
  ui.cinema.caption = text => {
    film.add('caption', { text });
    const shown = caption(text);
    let finished = false;
    shown.then(() => { finished = true; });
    (async () => {
      await wait(text.length * 28 + 80 + Math.min(7000, 1400 + text.length * 45));
      for (let i = 0; i < 4 && !finished; i++) {
        cinemaEl.click();
        await wait(80);
      }
    })();
    return shown;
  };
  const cinemaChoose = ui.cinema.choose.bind(ui.cinema);
  ui.cinema.choose = (prompt, choiceOptions) => {
    const picked = cinemaChoose(prompt, choiceOptions);
    (async () => {
      const { index, reason } = pickOption(profile, choiceOptions, o => scoreEffects(profile, o.effects, id => (id ? nameOf(id) : 'Family')), random);
      film.add('choice', { kind: 'prologue', prompt, options: choiceOptions.map(o => o.text), picked: index, text: choiceOptions[index].text, reason });
      await wait(2200 + choiceOptions.length * 350);
      await press($$('.caption-choices .choice')[index]);
    })();
    return picked;
  };

  // ---------- Time jumps ----------
  const chooseFocus = ui.chooseFocus.bind(ui);
  ui.chooseFocus = args => {
    const picked = chooseFocus(args);
    (async () => {
      const { index, reason } = pickOption(profile, args.choices, c => {
        const parts = scoreEffects(profile, c.effects, () => 'Family');
        if (c.id === lastFocus) parts.push({ score: -0.6, why: 'something new' });
        return parts;
      }, random, 3.2);
      lastFocus = args.choices[index].id;
      film.add('choice', { kind: 'focus', prompt: args.sub, options: args.choices.map(c => c.label), picked: index, text: args.choices[index].label, focus: args.choices[index].id, reason });
      await wait(2400);
      await press($$('.screen [data-i]')[index]);
    })();
    return picked;
  };

  const showSummary = ui.showSummary.bind(ui);
  ui.showSummary = args => {
    film.add('jump', { heading: args.heading, sub: args.sub, lines: args.lines });
    const done = showSummary(args);
    (async () => {
      const letters = args.lines.join(' ').length;
      await wait(Math.min(9000, 1400 + args.lines.length * 450 + letters * 38));
      $('.screen [data-go]')?.click();
    })();
    return done;
  };

  const sleep = game.sleep.bind(game);
  game.sleep = tooLate => {
    if (game.mode !== 'busy') film.add('sleep', { tooLate, place: game.place?.id });
    task = null;
    return sleep(tooLate);
  };

  const enterPlace = game.enterPlace.bind(game);
  game.enterPlace = async (id, entry, cardTitle, cardSubtitle) => {
    task = null;
    await enterPlace(id, entry, cardTitle, cardSubtitle);
    film.add('place', { id, name: game.place?.data?.name ?? id });
  };

  // ---------- The end ----------
  const showLifeStory = ui.showLifeStory.bind(ui);
  ui.showLifeStory = args => {
    storyShown = true;
    const { onNew, ...story } = args;
    film.add('story', story);
    showLifeStory(args);
    setTimeout(() => { film.add('end'); film.done = true; }, 16000);
  };

  // ---------- A played day ----------
  function gridFor() {
    const key = `${game.place.id}:${game.player.stage}`;
    if (!grids.has(key) || grids.get(key).space !== game.place.space) grids.set(key, buildGrid(game.place.space, game.player.radius));
    return grids.get(key);
  }

  const hour = () => state.clock.minutes / 60;

  // Where someone with something to say is, and whether it's worth going
  function candidates() {
    const list = [];
    const here = game.place.id;
    for (const p of peopleData.people) {
      if (talkedToday.has(p.id)) continue;
      const convo = pickConversation(p, conversations);
      if (!convo) continue;
      const plan = scheduleNow(p, state.clock.minutes);
      if (!plan.place || !isPresent(p, plan.place, state.clock, world)) continue;
      const isNew = !state.flags[`talked:${convo.id}`];
      if (!isNew) {
        // Old news: only now and then, and at most once a day
        if (repeatsToday >= 1 || random() > profile.chatty * 0.6) { talkedToday.add(p.id); continue; }
      }
      const later = p.schedule.find(e => e.from > hour());
      const leavingSoon = later && later.from - hour() < 1.5 && later.place !== plan.place;
      list.push({ kind: 'talk', id: p.id, name: p.name, place: plan.place, spot: plan.spot, isNew, score: (isNew ? 10 : 3) - (plan.place !== here ? 2 : 0) + (leavingSoon ? 2 : 0) + random() });
    }
    if (thingsToday < 1) {
      for (const thing of game.place.interactables) {
        if (thing.kind === 'sleep' || !thing.daily) continue;
        if (thing.stages && !thing.stages.includes(game.player.stage)) continue;
        if (state.flags[`thing:${thing.id}:${state.clock.year}:${state.clock.day}`]) continue;
        if (random() > profile.playful) { thingsToday++; continue; }
        list.push({ kind: 'thing', thing, place: here, label: thing.label, score: 2.5 + random() });
      }
    }
    return list.sort((a, b) => b.score - a.score);
  }

  function decide() {
    if (hour() >= 18) return { kind: 'bed', place: 'home' };
    const best = candidates()[0];
    if (best) return best;
    if (game.place.id !== 'home') return { kind: 'home', place: 'home' };
    return { kind: 'wait' };
  }

  // The way out of this place toward another
  function exitToward(placeId) {
    const exits = game.place.data.exits ?? [];
    return exits.find(e => e.to === placeId) ?? exits[0];
  }

  // Walks toward a point; true once within reach
  function walk(point, within, dt) {
    const pos = game.player.pos;
    const dist = Math.hypot(point.x - pos.x, point.z - pos.z);
    if (dist <= within) { setMove(0, 0); return true; }
    const nav = task.nav ?? (task.nav = { path: null, target: null, timer: 0, best: Infinity, stuck: 0, replans: 0 });
    nav.timer -= dt;
    const moved = !nav.target || Math.hypot(nav.target.x - point.x, nav.target.z - point.z) > 0.8;
    if (!nav.path || moved || nav.timer <= 0) {
      const others = game.people
        .filter(p => p.id !== task.id && Math.hypot(p.pos.x - point.x, p.pos.z - point.z) > 0.5)
        .map(p => ({ x: p.pos.x, z: p.pos.z, r: p.radius }));
      nav.path = findPath(gridFor(), pos, point, others);
      if (!nav.path.length) nav.path = findPath(gridFor(), pos, point);
      nav.target = { x: point.x, z: point.z };
      nav.timer = 2.5;
    }
    while (nav.path.length && Math.hypot(nav.path[0].x - pos.x, nav.path[0].z - pos.z) < 0.22) nav.path.shift();
    const next = nav.path[0] ?? point;
    let dx = next.x - pos.x;
    let dz = next.z - pos.z;
    let len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    // Step around anyone standing right in the way (not the person we're going to see)
    for (const other of game.people) {
      if (other.id === task.id) continue;
      const ox = pos.x - other.pos.x;
      const oz = pos.z - other.pos.z;
      const d = Math.hypot(ox, oz) || 0.01;
      const reach = other.radius + game.player.radius + 0.3;
      if (d < reach) {
        const push = 1.6 * (reach - d) / 0.3;
        dx += (ox / d) * push;
        dz += (oz / d) * push;
      }
    }
    len = Math.hypot(dx, dz) || 1;
    setMove(dx / len, dz / len);
    // Not getting any closer: find another way, and give up after a few tries
    if (dist < nav.best - 0.3) { nav.best = dist; nav.stuck = 0; }
    else nav.stuck += dt;
    // Someone standing in the way (often in a doorway): they step aside, as people do
    if (nav.stuck > 1.2 && !nav.asked) {
      const blocker = game.people.find(o => o.id !== task.id && !o.talking && Math.hypot(o.pos.x - pos.x, o.pos.z - pos.z) < o.radius + game.player.radius + 0.35);
      if (blocker) {
        nav.asked = true;
        const ax = blocker.pos.x - pos.x;
        const az = blocker.pos.z - pos.z;
        const al = Math.hypot(ax, az) || 1;
        const tries = [[ax / al, az / al], [-az / al, ax / al], [az / al, -ax / al]];
        const grid = gridFor();
        const freeAt = (x, z) => {
          const i = Math.floor((x - grid.minX) / 0.1);
          const j = Math.floor((z - grid.minZ) / 0.1);
          return i >= 0 && j >= 0 && i < grid.w && j < grid.h && grid.free[j * grid.w + i];
        };
        const spot = tries.map(([dx2, dz2]) => ({ x: blocker.pos.x + dx2 * 1.3, z: blocker.pos.z + dz2 * 1.3 })).find(p => freeAt(p.x, p.z));
        if (spot) blocker.walkTo([spot]);
      }
    }
    if (nav.stuck > 2.5) {
      nav.asked = false;
      nav.stuck = 0;
      nav.best = dist;
      nav.path = null;
      if (++nav.replans > 4) task.failed = true;
    }
    return false;
  }

  let move = { x: 0, z: 0 };
  const setMove = (x, z) => { move = { x, z }; };

  function startTask(next) {
    task = next;
    task.since = 0;
    task.placeId = game.place.id;
    if (task.kind === 'talk') film.add('go', { to: task.name, id: task.id, isNew: task.isNew, place: task.place });
    if (task.kind === 'thing') film.add('go', { to: task.label, thing: task.thing.id });
    if (task.kind === 'bed') film.add('go', { to: 'bed' });
    if (task.kind === 'home') film.add('go', { to: 'home' });
  }

  function endTask() {
    if (task?.lapse) film.add('timelapse-end', {});
    task = null;
    setMove(0, 0);
  }

  function runTask(dt) {
    task.since += dt;
    if (task.failed || task.since > 90) {
      if (task.id) talkedToday.add(task.id);
      film.add('gave-up', { kind: task.kind, to: task.name ?? task.label ?? task.kind });
      endTask();
      return;
    }
    // Somewhere else first
    if (task.place && task.place !== game.place.id) {
      const exit = exitToward(task.place);
      if (!exit) { task.failed = true; return; }
      const b = game.place.bounds;
      const mid = (exit.min + exit.max) / 2;
      const edge = { west: { x: b.minX + 0.4, z: mid }, east: { x: b.maxX - 0.4, z: mid }, north: { x: mid, z: b.minZ + 0.4 }, south: { x: mid, z: b.maxZ - 0.4 } }[exit.edge];
      if (walk(edge, 0.9, dt)) {
        const out = { west: [-1, 0], east: [1, 0], north: [0, -1], south: [0, 1] }[exit.edge];
        setMove(out[0], out[1]); // keep walking off the edge; the game takes it from there
        // Steps are whole frames, so the last one can stop just short of the edge: close the gap
        const pos = game.player.pos;
        const r = game.player.radius + 0.005;
        if (exit.edge === 'west' && pos.x - r - b.minX < 0.2) pos.x = b.minX + r;
        if (exit.edge === 'east' && b.maxX - pos.x - r < 0.2) pos.x = b.maxX - r;
        if (exit.edge === 'north' && pos.z - r - b.minZ < 0.2) pos.z = b.minZ + r;
        if (exit.edge === 'south' && b.maxZ - pos.z - r < 0.2) pos.z = b.maxZ - r;
      }
      return;
    }

    if (task.kind === 'talk') {
      const person = game.people.find(p => p.id === task.id && !p.leaving);
      const point = person ? person.pos : task.spot;
      if (!point) { task.failed = true; return; }
      if (walk(point, person ? 1.45 : 0.6, dt) && person) {
        talkedToday.add(task.id);
        if (!task.isNew) repeatsToday++;
        endTask();
        game.talkTo(person);
      }
      return;
    }
    if (task.kind === 'thing') {
      if (walk(task.thing, 1.3, dt)) {
        thingsToday++;
        const thing = task.thing;
        endTask();
        film.add('use', { thing: thing.id, label: thing.label });
        game.useThing(thing);
      }
      return;
    }
    if (task.kind === 'bed' || task.kind === 'home') {
      const stage = game.player.stage;
      const bed = game.place.interactables.find(t => t.kind === 'sleep' && (!t.stages || t.stages.includes(stage)));
      if (!bed) { task.failed = true; return; }
      if (walk(bed, 1.4, dt)) {
        setMove(0, 0);
        if (task.kind === 'home') { endTask(); return; }
        if (hour() >= 18) { endTask(); game.useThing(bed); }
      }
      return;
    }
    if (task.kind === 'wait') {
      // Nothing to do right now: let the hours pass quickly, until someone turns up or it's evening
      setMove(0, 0);
      if (!task.lapse) { task.lapse = true; film.add('timelapse', { from: Math.round(hour() * 10) / 10 }); }
      const before = state.clock.minutes;
      state.clock.minutes = Math.min(18 * 60 + 1, state.clock.minutes + dt * 240);
      drainEnergy(state.clock.minutes - before, world);
      decideTimer -= dt;
      if (decideTimer <= 0) {
        decideTimer = 0.25;
        const next = decide();
        if (next.kind !== 'wait') { endTask(); startTask(next); }
      }
    }
  }

  pilot.frame = dt => {
    // Keep the life going: close menus that hiding the window can open
    if (game.mode === 'menu' && !storyShown && $('.screen [data-resume]')) game.closePause();
    if (game.mode === 'people') game.closePeople();

    if (game.mode === 'play' && game.player && state.clock) {
      const key = `${state.clock.year}:${state.clock.day}`;
      if (key !== dayKey) {
        dayKey = key;
        talkedToday = new Set();
        thingsToday = 0;
        repeatsToday = 0;
        task = null;
        film.add('day', { stage: playerStage(world), place: game.place.id });
      }
      if (task && task.placeId !== game.place.id && task.kind !== 'wait') task.placeId = game.place.id;
      if (!task) startTask(decide());
      runTask(dt);
      game.input.move.x = move.x;
      game.input.move.z = move.z;
    } else {
      move = { x: 0, z: 0 };
    }
  };

  Object.defineProperty(pilot, 'task', { get: () => task });
  pilot.move = () => move;
  return pilot;
}
