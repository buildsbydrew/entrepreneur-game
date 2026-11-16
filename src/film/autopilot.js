// The autopilot: plays a life the way a person would. It starts a new life from the title screen,
// watches the prologue and answers its questions, and each played day goes to see whoever has
// something new to say, plays with things now and then, lets the quiet hours pass, goes to bed,
// and picks what to focus on while time jumps. Every choice follows its personality (personality.js),
// with a little seeded randomness, and the reason goes into the log.
import world from '../data/world.json';
import conversationsData from '../data/conversations.json';
import { state } from '../core/state.js';
import { playerStage, drainEnergy } from '../core/life.js';
import { scheduleNow, scheduleOf, isPresent } from '../core/schedule.js';
import { bigDayToday, bigDayNeed, bedHour, nextMomentElsewhere, nextMomentHere, nextPlaceToward, noteGoals } from './bigdays.js';
import { pickConversation, fillText } from '../story/conversation.js';
import { buildGrid, findPath } from './nav.js';
import { nearestSpot } from '../world/spots.js';
import { scoreEffects, pickOption } from './personality.js';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];
const lineTime = text => Math.min(6500, 900 + text.length * 50);

export function createAutopilot({ game, film, ui, profile, options, random, peopleData }) {
  const conversations = conversationsData.conversations;
  const nameOf = id => game.nameOf?.(id) ?? peopleData.people.find(p => p.id === id)?.name ?? id;
  const pilot = { convo: null };
  let task = null;
  let dayKey = '';
  let talkedToday = new Set();
  let thingsToday = 0;
  let repeatsToday = 0;
  let lastFocus = null;
  let storyShown = false;
  let decideTimer = 0;
  let closing = false; // between going to sleep and the next morning: a caption then is the day's closing line
  let lastBigDay = null;
  let achieved = new Set(); // today's big-day goals already done
  let jumpNext = false;      // a jump for joy, after a happy moment
  const grids = new Map();

  // ---------- Starting a life ----------
  // Straight in: no title screen or name form on camera
  async function beginLife() {
    film.add('title', { title: world.gameTitle });
    await wait(200);
    film.add('born', { name: options.name, body: options.body });
    game.startNewLife({ name: options.name, body: options.body, skin: peopleData.skins[options.skin - 1] ?? peopleData.skins[2] });
  }
  if (game.mode === 'title') setTimeout(beginLife, 0);

  // ---------- Choosing ----------
  // How big a decision is: how differently its options would shape the life (for the edit's decision cards)
  const sizeOf = e => !e ? 0 : Math.abs(e.bond ?? 0) + Math.abs(e.money ?? 0) / 2 + Math.abs(e.happiness ?? 0) / 4
    + Object.values(e.traits ?? {}).reduce((a, v) => a + Math.abs(v), 0) + Object.values(e.bondWith ?? {}).reduce((a, v) => a + Math.abs(v), 0)
    + (e.remember ? 2 : 0) + (e.setFlag ? 1 : 0);
  const decisionWeight = options => {
    const sizes = options.map(o => sizeOf(o.effects) + sizeOf(pilot.convo?.nodes?.[o.next]?.effects));
    return options.length < 2 ? 0 : Math.round((Math.max(...sizes) + (Math.max(...sizes) - Math.min(...sizes))) * 10) / 10;
  };

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
    film.camera?.onLine(speaker, isYou);
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

  // In the film there are no menus: the AI decides, and the answer is simply said out loud,
  // as the player's own line, so the scene plays on like a film
  const spoken = text => fillText(String(text).replace(/\s*\((?=[^)]*\{currency\}|[^)]*\d)[^)]*\)\s*$/, ''), { currency: world.currency.plural });
  ui.dialogue.choose = async (speaker, prompt, choices) => {
    const partner = game.filmTalkPartner;
    const who = id => (id ? nameOf(id) : partner?.name ?? 'They');
    const { index, reason, whys } = pickOption(profile, choices, choice => {
      const { now, next } = choiceEffects(choice);
      return [...scoreEffects(profile, now, who), ...scoreEffects(profile, next, who, 0.8)];
    }, random);
    const choice = choices[index];
    film.add('choice', { kind: 'talk', with: partner?.name, prompt, options: choices.map(c => spoken(c.text)), picked: index, text: spoken(choice.text), reason, whys, weight: decisionWeight(choices) });
    await wait(500);
    ui.onChoose?.();
    // A stage direction before the words, like (Whisper to Nico) "Show-off.", leaves just the words
    let said = spoken(choice.text);
    const direction = said.match(/^\(([^)]*)\)\s*(.+)$/);
    if (direction) {
      film.add('action', { text: `(${direction[1]})` });
      said = direction[2].replace(/^"(.*)"$/, '$1');
    }
    if (/^\(.*\)$/.test(said.trim())) { film.add('action', { text: said }); await wait(1400); }
    else await ui.dialogue.say(state.life?.name ?? 'You', said, true);
    return choice;
  };

  const talkTo = game.talkTo.bind(game);
  game.talkTo = async (person, chosen) => {
    const convo = chosen ?? pickConversation(person.data, conversations);
    if (!convo || game.mode === 'talk') return;
    pilot.convo = convo;
    game.filmTalkPartner = person;
    film.add('talk', { with: person.name, id: person.id, convo: convo.id, isNew: !state.flags[`talked:${convo.id}`], place: game.place?.id, bigDay: state.flags.today ?? null, moment: Boolean(chosen) });
    await talkTo(person, convo);
    if (game.player?.mood === 'happy' && game.player.stage !== 'baby') jumpNext = true;
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
    if (closing) film.add('closing', { text, bigDay: lastBigDay });
    else film.add('caption', { text });
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
  // Prologue questions: no menu; the family's answer is told as one more caption
  ui.cinema.choose = async (prompt, choiceOptions) => {
    const { index, reason, whys } = pickOption(profile, choiceOptions, o => scoreEffects(profile, o.effects, id => (id ? nameOf(id) : 'Family')), random);
    const option = choiceOptions[index];
    film.add('choice', { kind: 'prologue', prompt, options: choiceOptions.map(o => o.text), picked: index, text: option.text, reason, whys, weight: decisionWeight(choiceOptions) });
    const answer = option.text.replace(/^"|"$/g, '');
    // "...they'll tell you that you were... a quiet baby." (names keep their capitals)
    const small = /^(A|An|The|Some|Always|Very)\b/.test(answer) ? answer.charAt(0).toLowerCase() + answer.slice(1) : answer;
    const end = /[.!?"]$/.test(answer) ? '' : '.';
    const told = /\.\.\.\s*$/.test(prompt)
      ? `${prompt.trim()} ${/^"/.test(option.text) ? option.text : small}${end}`
      : `${/^"/.test(option.text) ? option.text : answer}${end}`;
    await ui.cinema.caption(told);
    return option;
  };

  // ---------- Time jumps ----------
  // Time jumps: no screens. The AI picks a focus straight away; what happened goes in the log,
  // and the edit turns it into a short caption ("A year passed. Ada spent it with family.")
  ui.chooseFocus = async args => {
    closing = false;
    const { index, reason } = pickOption(profile, args.choices, c => {
      const parts = scoreEffects(profile, c.effects, () => 'Family');
      if (c.id === lastFocus) parts.push({ score: -0.6, why: 'something new' });
      return parts;
    }, random, 3.2);
    lastFocus = args.choices[index].id;
    film.add('choice', { kind: 'focus', prompt: args.sub, options: args.choices.map(c => c.label), picked: index, text: args.choices[index].label, focus: args.choices[index].id, reason });
    await wait(300);
    return args.choices[index];
  };

  ui.showSummary = async args => {
    film.add('jump', { heading: args.heading, sub: args.sub, lines: args.lines });
    await wait(900);
  };

  const sleep = game.sleep.bind(game);
  game.sleep = tooLate => {
    if (game.mode !== 'busy') film.add('sleep', { tooLate, place: game.place?.id, bigDay: state.flags.today ?? null });
    lastBigDay = state.flags.today ?? null;
    closing = true;
    task = null;
    return sleep(tooLate);
  };

  const enterPlace = game.enterPlace.bind(game);
  game.enterPlace = async (id, entry, cardTitle, cardSubtitle) => {
    task = null;
    closing = false;
    if (state.flags.today && cardTitle) film.add('big-day', { id: state.flags.today, title: cardTitle });
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
    const day = bigDayToday();
    const allowed = day ? new Set(['home', here, day.place, ...(day.goals ?? []).map(g => g.done?.place), ...(day.moments ?? []).map(m => m.place)].filter(Boolean)) : null;
    for (const p of peopleData.people) {
      if (talkedToday.has(p.id)) continue;
      if (p.born && p.born.year * 1000 + p.born.day > state.clock.year * 1000 + state.clock.day) continue; // not born yet
      const convo = pickConversation(p, conversations);
      if (!convo) continue;
      const plan = scheduleNow(p, state.clock.minutes);
      if (!plan.place || !isPresent(p, plan.place, state.clock, world)) continue;
      if (allowed && !allowed.has(plan.place)) continue;
      const isNew = !state.flags[`talked:${convo.id}`];
      if (!isNew) {
        // Old news: only now and then, and at most once a day
        if (repeatsToday >= 1 || random() > profile.chatty * 0.6) { talkedToday.add(p.id); continue; }
      }
      const later = scheduleOf(p).find(e => e.from > hour());
      const leavingSoon = later && later.from - hour() < 1.5 && later.place !== plan.place;
      list.push({ kind: 'talk', id: p.id, name: nameOf(p.id), place: plan.place, spot: plan.spot, isNew, score: (isNew ? 10 : 3) - (plan.place !== here ? 2 : 0) + (leavingSoon ? 2 : 0) + random() });
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

  // Where someone is right now (their place today), or null
  const whereIs = id => {
    if (game.people.some(x => x.id === id && !x.leaving)) return game.place.id;
    const p = peopleData.people.find(x => x.id === id);
    if (!p) return null;
    const plan = scheduleNow(p, state.clock.minutes);
    return plan.place && isPresent(p, plan.place, state.clock, world) ? plan.place : null;
  };
  const canTalk = id => {
    const p = peopleData.people.find(x => x.id === id);
    return Boolean(p && pickConversation(p, conversations)) && !talkedToday.has(id);
  };
  const talkTask = (id, place) => {
    const p = peopleData.people.find(x => x.id === id);
    const convo = p && pickConversation(p, conversations);
    return { kind: 'talk', id, name: nameOf(id), place, spot: p && scheduleNow(p, state.clock.minutes).spot, isNew: Boolean(convo && !state.flags['talked:' + convo.id]) };
  };

  function decide() {
    const day = bigDayToday();
    if (day) {
      // A big day: its goals and moments come first, and bed waits until the day is done
      const here = game.place.id;
      const need = bigDayNeed(day, { here, hour: hour(), isPresentAt: whereIs, canTalk, achieved });
      if (need?.kind === 'talk') return talkTask(need.id, need.place);
      if (need?.kind === 'go') return { kind: 'go', place: need.place };
      if (need?.kind === 'wait') return { kind: 'wait', place: need.place, until: need.until, near: need.near };
      const best = candidates()[0];
      if (best) return best;
      const later = nextMomentElsewhere(day, here, hour());
      if (later) return { kind: 'go', place: later.place };
      if (hour() >= bedHour(day)) return { kind: 'bed', place: 'home' };
      if (here !== 'home') return { kind: 'home', place: 'home' };
      return { kind: 'wait', until: Math.min(bedHour(day), nextMomentHere(day, here, hour()) ?? 99), near: here === 'home' ? 'gran' : null };
    }
    if (hour() >= 18) return { kind: 'bed', place: 'home' };
    const best = candidates()[0];
    if (best) return best;
    if (game.place.id !== 'home') return { kind: 'home', place: 'home' };
    return { kind: 'wait' };
  }

  // The way out of this place toward another, however many places away it is
  function exitToward(placeId) {
    const exits = game.place.data.exits ?? [];
    const step = nextPlaceToward(game.place.id, placeId);
    return exits.find(e => e.to === step) ?? exits.find(e => e.to === placeId) ?? null;
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

  const FRIENDS = new Set(['nico', 'juno', 'sibling']);
  function startTask(next) {
    task = next;
    task.since = 0;
    const child = game.player?.stage === 'child' || game.player?.stage === 'teen';
    task.run = (task.kind === 'talk' && FRIENDS.has(task.id)) || ((task.kind === 'go' || task.kind === 'home') && child && random() < 0.4);
    task.placeId = game.place.id;
    if (task.kind === 'talk') film.add('go', { to: task.name, id: task.id, isNew: task.isNew, place: task.place });
    if (task.kind === 'thing') film.add('go', { to: task.label, thing: task.thing.id });
    if (task.kind === 'bed') film.add('go', { to: 'bed' });
    if (task.kind === 'home') film.add('go', { to: 'home' });
    if (task.kind === 'go') film.add('go', { to: task.place });
    if (task.kind === 'wait' && task.until !== undefined) film.add('wait', { until: task.until, near: task.near ?? null, place: task.place ?? game.place.id });
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
      // Aim for the clearest part of the way out (someone may be standing in the gate)
      const alongEdge = exit.edge === 'west' || exit.edge === 'east' ? 'z' : 'x';
      const edgeLine = { west: b.minX, east: b.maxX, north: b.minZ, south: b.maxZ }[exit.edge];
      const blockers = game.people.filter(p => Math.abs((alongEdge === 'z' ? p.pos.x : p.pos.z) - edgeLine) < 2.5);
      let mid = (exit.min + exit.max) / 2;
      if (blockers.length) {
        let best = -1;
        for (let a = exit.min + 0.5; a <= exit.max - 0.5; a += 0.25) {
          const room = Math.min(...blockers.map(p => Math.abs((alongEdge === 'z' ? p.pos.z : p.pos.x) - a)));
          if (room > best) { best = room; mid = a; }
        }
      }
      task.exitStuck = (task.exitStuck ?? 0) + dt;
      if (task.exitStuck > 2 && blockers.length && !task.askedAside) {
        // Still not through: whoever is in the gate steps aside
        task.askedAside = true;
        for (const p of blockers) {
          if (p.talking) continue;
          const side = (alongEdge === 'z' ? p.pos.z : p.pos.x) < mid ? -1.4 : 1.4;
          const inward = { west: [1.2, 0], east: [-1.2, 0], north: [0, 1.2], south: [0, -1.2] }[exit.edge];
          p.walkTo([{ x: p.pos.x + inward[0] + (alongEdge === 'x' ? side : 0), z: p.pos.z + inward[1] + (alongEdge === 'z' ? side : 0) }]);
        }
      }
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
    if (task.kind === 'go') { endTask(); return; } // arrived
    if (task.kind === 'bed' || task.kind === 'home') {
      const stage = game.player.stage;
      const bed = game.place.interactables.find(t => t.kind === 'sleep' && (!t.stages || t.stages.includes(stage)));
      if (!bed) { task.failed = true; return; }
      if (walk(bed, 1.4, dt)) {
        setMove(0, 0);
        if (task.kind === 'home') { endTask(); return; }
        if (hour() >= bedHour(bigDayToday())) { endTask(); game.useThing(bed); }
        else if (task.kind === 'bed') { endTask(); startTask({ kind: 'wait', until: bedHour(bigDayToday()), near: 'gran' }); }
      }
      return;
    }
    if (task.kind === 'wait') {
      // Nothing to do right now: let the hours pass quickly, until someone turns up or it's evening
      setMove(0, 0);
      // Beside the person the next moment is with (Gran, waiting for news)
      const near = task.near && game.people.find(p => p.id === task.near && !p.leaving);
      if (near && !task.settled) {
        if (!walk(near.pos, 1.9, dt)) return;
        task.settled = true;
      }
      // A seat nearby: sit down to wait (on the sofa beside Gran, on the bench in the garden)
      if (!task.seatChecked && !game.player.activity && game.player.stage !== 'baby') {
        task.seatChecked = true;
        const pos = game.player.pos;
        task.seat = nearestSpot(game.place.spots ?? [], 'sit', pos.x, pos.z, 4.5, game.player);
      }
      if (task.seat && !game.player.activity) {
        const stand = task.seat.stand ?? task.seat;
        if (task.seat.taken && task.seat.taken !== game.player) task.seat = null;
        else if (!walk(stand, 0.45, dt)) return;
        else { setMove(0, 0); game.useSpot(task.seat); task.seat = null; }
      }
      const day = bigDayToday();
      const until = Math.min(task.until ?? 18, day ? bedHour(day) : 18, day ? (nextMomentHere(day, game.place.id, hour()) ?? 99) : 99);
      if (hour() >= until) {
        // Due now: give the game a moment to play it, then think again. If nothing comes of it after a
        // while (a moment that can't happen), let time move on a little.
        task.overdue = (task.overdue ?? 0) + dt;
        if (task.overdue > 25) {
          film.add('gave-up', { kind: 'wait', to: `until ${task.until}` });
          task.until = (task.until ?? 18) + 0.5;
          task.overdue = 0;
          task.lapse = false;
        }
        decideTimer -= dt;
        if (decideTimer <= 0) {
          decideTimer = 0.5;
          const next = decide();
          if (next.kind !== 'wait' || next.until !== task.until) { endTask(); startTask(next); }
        }
        return;
      }
      if (!task.lapse) { task.lapse = true; film.add('timelapse', { from: Math.round(hour() * 10) / 10, until }); }
      const before = state.clock.minutes;
      state.clock.minutes = Math.min(until * 60 + (day ? 0 : 1), state.clock.minutes + dt * 240);
      drainEnergy(state.clock.minutes - before, world);
      decideTimer -= dt;
      if (decideTimer <= 0) {
        decideTimer = 0.25;
        const next = decide();
        if (next.kind !== 'wait' || (next.until ?? 18) !== (task.until ?? 18)) { endTask(); startTask(next); }
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
        achieved = new Set();
        task = null;
        film.add('day', { stage: playerStage(world), place: game.place.id });
      }
      const today = bigDayToday();
      if (today) noteGoals(today, achieved, { place: game.place.id, hour: hour() });
      if (game.runningMoment) { setMove(0, 0); game.input.move.x = 0; game.input.move.z = 0; return; }
      if (task && task.placeId !== game.place.id && task.kind !== 'wait') task.placeId = game.place.id;
      if (!task) startTask(decide());
      runTask(dt);
      game.input.move.x = move.x;
      game.input.move.z = move.z;
      game.input.run = Boolean(task?.run) && Math.hypot(move.x, move.z) > 0.5;
      game.input.jump = false;
      if (jumpNext && !game.player.activity) { game.input.jump = true; jumpNext = false; film.add('hop'); }
    } else {
      move = { x: 0, z: 0 };
    }
  };

  Object.defineProperty(pilot, 'task', { get: () => task });
  pilot.move = () => move;
  return pilot;
}
