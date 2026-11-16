// Film mode (?film in the address): the game plays a whole life by itself so it can be recorded for
// the "I let AI live a whole life in my game" videos. Never shown to normal players.
//
//   ?film                         watch the autopilot play, in real time
//   &name=Ada&body=girl&skin=3    who is born (skin is 1 to 6)
//   &personality=kind             kind, troublemaker, ambitious or dreamer
//   &seed=7                       the same seed plays out the same life
//   &step                         the recorder moves time on frame by frame (see video/record.mjs)
//   &quality=high                 picture quality for the recording
//
// It hides the testing panel and phone controls, plays the life (see autopilot.js), frames it with a
// film camera (camera.js) and keeps a log of everything that happens (window.film.log), which the
// video editing turns into captions and chapter cards.
import world from '../data/world.json';
import peopleData from '../data/people.json';
import { state } from '../core/state.js';
import { playerAge, playerStage } from '../core/life.js';
import { QUALITY } from '../render/quality.js';
import { installVirtualTime, seededRandom } from './vclock.js';
import { createFilmCamera } from './camera.js';
import { createFilmLook } from './look.js';
import { createAutopilot } from './autopilot.js';
import { PROFILES } from './personality.js';

export function startFilm(createGame, params) {
  const options = {
    name: params.get('name') || 'Ada',
    body: params.get('body') === 'boy' ? 'boy' : 'girl',
    skin: Math.min(6, Math.max(1, Number(params.get('skin')) || 3)),
    personality: PROFILES[params.get('personality')] ? params.get('personality') : 'kind',
    seed: Number(params.get('seed')) || 1,
    step: params.has('step'),
    quality: QUALITY[params.get('quality')] ? params.get('quality') : null
  };

  // Film mode never touches the player's own saved life: it keeps its own save under another name
  const SAVE_KEY = 'lifegame.save';
  const FILM_KEY = 'lifegame.film.save';
  const swapKey = key => (key === SAVE_KEY ? FILM_KEY : key);
  const { getItem, setItem, removeItem } = Storage.prototype;
  Storage.prototype.getItem = function (key) {
    if (key === 'lifegame.quality' && options.quality) return options.quality;
    return getItem.call(this, swapKey(key));
  };
  Storage.prototype.setItem = function (key, value) { if (key === 'lifegame.quality') return; setItem.call(this, swapKey(key), value); };
  Storage.prototype.removeItem = function (key) { removeItem.call(this, swapKey(key)); };
  try { removeItem.call(localStorage, FILM_KEY); } catch (error) { /* storage blocked */ }

  // Hiding the window (or the recorder running in the background) must not pause the life
  document.addEventListener('visibilitychange', e => e.stopImmediatePropagation(), true);

  // The same seed gives the same life. The 3D engine also uses random numbers (for ids) while it draws,
  // and a recording draws only some frames, so drawing gets numbers of its own and never shifts the life's.
  const lifeRandom = seededRandom(options.seed);
  const drawRandom = seededRandom(options.seed + 99991);
  Math.random = lifeRandom;

  const clock = options.step ? installVirtualTime() : null;
  document.body.classList.add('film');
  if (innerHeight > innerWidth) document.body.classList.add('tall');

  const game = createGame();

  // ---------- The log of the life ----------
  // t: seconds into the footage (only frames that were recorded count). sim: seconds since the start.
  const film = {
    options,
    log: [],
    footage: 0,
    capture: true,
    done: false,
    game,
    state
  };
  const simNow = () => (clock ? clock.now() : performance.now()) / 1000;
  const simStart = simNow();
  const realStart = performance.now();
  film.add = (type, data = {}) => {
    const t = clock ? film.footage : (performance.now() - realStart) / 1000;
    const entry = { t: Math.round(t * 1000) / 1000, sim: Math.round((simNow() - simStart) * 1000) / 1000, type, ...data };
    if (state.life && state.clock) {
      entry.age = playerAge(world);
      entry.year = state.clock.year;
      entry.day = state.clock.day;
      entry.hour = Math.round(state.clock.minutes / 6) / 10;
    }
    film.log.push(entry);
    return entry;
  };
  film.add('film', { ...options, profile: PROFILES[options.personality].label, about: PROFILES[options.personality].about, world: world.worldName, game: world.gameTitle });

  // The recorder calls this once per video frame
  if (clock) {
    const realRender = (scene, camera) => {
      Math.random = drawRandom;
      try { look.render(scene, camera); } finally { Math.random = lifeRandom; }
    };
    film.step = async (ms = 1000 / 30) => {
      // Frames that won't be kept don't need drawing
      game.renderer.render = film.capture ? realRender : () => {};
      await clock.step(ms);
      const kept = film.capture;
      if (kept) film.footage += ms / 1000;
      return { kept, done: film.done, sim: simNow() - simStart };
    };
    // Steps until a condition (for testing in the browser): film.run(seconds)
    film.run = async (seconds, until = () => false) => {
      const end = simNow() + seconds;
      while (simNow() < end && !film.done && !until()) await film.step();
      return film.log.length;
    };
  }

  // ---------- Camera and the film look ----------
  const camera = createFilmCamera(game);
  const look = createFilmLook(game, camera);
  film.camera = camera;
  game.film = film;
  if (!clock) game.renderer.render = (scene, cam) => look.render(scene, cam);
  game.followCamera = dt => camera.update(dt);
  const cinematicFrame = game.cinematicFrame.bind(game);
  game.cinematicFrame = dt => { cinematicFrame(dt); camera.adjustPrologue(); };

  // ---------- Things worth logging, from the game's own interface ----------
  const ui = game.ui;
  const wrap = (obj, key, before) => {
    const original = obj[key].bind(obj);
    obj[key] = (...args) => before(original, ...args);
  };
  wrap(ui, 'fadeOut', (orig, title = '', subtitle = '') => {
    if (title) film.add('card', { title, subtitle });
    camera.cut();
    return orig(title, subtitle);
  });
  wrap(ui, 'toast', (orig, message) => { film.add('toast', { text: message }); return orig(message); });
  wrap(ui, 'feeling', (orig, x, y, text) => { film.add('feeling', { text }); return orig(x, y, text); });

  // Journal entries and birthdays, checked every frame
  let journalSeen = 0;
  let lastAge = null;
  let lastStage = null;
  const watch = () => {
    if (!state.life || !state.clock || !state.journal) return;
    if (state.journal.length < journalSeen) journalSeen = 0;
    while (journalSeen < state.journal.length) {
      film.add('memory', { text: state.journal[journalSeen].text, memoryAge: state.journal[journalSeen].age });
      journalSeen++;
    }
    if (game.mode === 'play') {
      const age = playerAge(world);
      const stage = playerStage(world);
      if (age !== lastAge) { film.add('age', { now: age, stage, before: lastAge }); lastAge = age; }
      if (stage !== lastStage) { if (lastStage) film.add('stage', { now: stage, before: lastStage }); lastStage = stage; }
    }
  };

  // ---------- The autopilot ----------
  const pilot = createAutopilot({ game, film, ui, profile: PROFILES[options.personality], options, random: seededRandom(options.seed * 7919 + 13), peopleData });
  const poll = game.input.poll;
  let last = performance.now();
  game.input.poll = () => {
    poll();
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    watch();
    pilot.frame(dt);
  };

  film.pilot = pilot;
  window.film = film;
  window.game = game;
  window.lifeState = state;
  return film;
}
