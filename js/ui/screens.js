// The menu screens are ordinary web page elements drawn over the game. That gives
// us real text boxes, buttons that work with a keyboard, and layouts that fit any screen.
import { makePersonSvg } from '../art/people.js';
import { stallOpenSvg } from '../art/shapes.js';
import { GAME_TITLE } from '../config.js';
import { DEFAULT_STALL_NAME } from '../profile.js';
import { SKIN_TONES, HAIR_STYLES, HAIR_COLORS, WRAP_COLORS, OUTFIT_COLORS } from './options.js';

const ui = () => document.getElementById('ui');
const svgUri = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
const pick = list => list[Math.floor(Math.random() * list.length)];

export function clearUi() {
  ui().innerHTML = '';
}

// ---------- The small pause button shown during play ----------

export function showPauseButton(onClick) {
  const button = document.getElementById('pause-btn');
  button.hidden = false;
  button.onclick = () => {
    button.blur(); // so pressing Space or Enter later doesn't press it again
    onClick();
  };
}

export function hidePauseButton() {
  document.getElementById('pause-btn').hidden = true;
}

// ---------- Title screen ----------

export function showTitle({ items, look, onPlay }) {
  ui().innerHTML = `
    <div class="screen title">
      <div class="hero">
        <img class="hero-stall" alt="" src="${svgUri(stallOpenSvg(items))}">
        <img class="hero-person" alt="" src="${svgUri(makePersonSvg(look, 'idle', 'down'))}">
      </div>
      <h1>${GAME_TITLE}</h1>
      <p class="tagline">Run a stall. Grow it into a business.</p>
      <button class="btn" id="play">Play</button>
      <p class="hint">WASD or arrows to move &middot; E to interact &middot; Esc to pause</p>
    </div>`;

  const play = document.getElementById('play');
  play.onclick = onPlay;
  play.focus();
}

// ---------- Character setup ----------

function chips(opt, choices, current) {
  const buttons = choices.map(([value, label]) =>
    `<button class="chip" data-opt="${opt}" data-val="${value}" aria-pressed="${value === current}">${label}</button>`);
  return `<div class="row">${buttons.join('')}</div>`;
}

function swatches(opt, colors, current, label) {
  const buttons = colors.map((color, i) =>
    `<button class="sw" data-opt="${opt}" data-val="${color}" style="background:${color}" aria-label="${label} ${i + 1}" aria-pressed="${color === current}"></button>`);
  return `<div class="row">${buttons.join('')}</div>`;
}

// Edits profile.look and profile.stallName as the player chooses.
// Returns { fail(text) } so the scene can report a problem while starting.
export function showSetup({ profile, onBack, onStart }) {
  const look = profile.look;
  const views = ['down', 'side', 'up'];
  let viewIndex = 0;

  ui().innerHTML = `
    <div class="screen panel setup">
      <h1>Create your trader</h1>
      <div class="setup-grid">
        <button class="preview" id="preview" aria-label="Turn your character around">
          <img id="pv" alt="Your character">
          <small>Click to turn</small>
        </button>
        <div>
          <div id="opts"></div>
          <label class="group-label" for="stallName">Stall name</label>
          <input id="stallName" class="field" maxlength="22" autocomplete="off" placeholder="e.g. Ama's Corner">
        </div>
      </div>
      <p class="msg" id="msg" role="status"></p>
      <div class="actions">
        <button class="btn ghost" id="back">Back</button>
        <button class="btn ghost" id="random">Surprise me</button>
        <button class="btn" id="start">Open for business</button>
      </div>
    </div>`;

  const opts = document.getElementById('opts');
  const preview = document.getElementById('pv');
  const nameInput = document.getElementById('stallName');
  const message = document.getElementById('msg');
  const startButton = document.getElementById('start');

  nameInput.value = profile.stallName;

  // Redraws the choices and the preview. Keeps keyboard focus on the button just pressed.
  function render(focusOpt, focusVal) {
    const wrap = look.hairStyle === 'wrap';
    const colorLabel = wrap ? 'Headwrap color' : 'Hair color';

    opts.innerHTML = `
      <p class="group-label">Gender</p>
      ${chips('body', [['man', 'Man'], ['woman', 'Woman']], look.body)}
      <p class="group-label">Skin tone</p>
      ${swatches('skin', SKIN_TONES, look.skin, 'Skin tone')}
      <p class="group-label">Hair</p>
      ${chips('hairStyle', HAIR_STYLES, look.hairStyle)}
      <p class="group-label">${colorLabel}</p>
      ${swatches('color', wrap ? WRAP_COLORS : HAIR_COLORS, wrap ? look.wrap : look.hair, colorLabel)}
      <p class="group-label">Outfit color</p>
      ${swatches('shirt', OUTFIT_COLORS, look.shirt, 'Outfit color')}`;

    preview.src = svgUri(makePersonSvg(look, 'idle', views[viewIndex]));

    if (focusOpt) {
      const again = opts.querySelector(`[data-opt="${focusOpt}"][data-val="${focusVal}"]`);
      if (again) again.focus();
    }
  }

  opts.addEventListener('click', event => {
    const button = event.target.closest('[data-opt]');
    if (!button) return;

    const { opt, val } = button.dataset;
    if (opt === 'color') look[look.hairStyle === 'wrap' ? 'wrap' : 'hair'] = val;
    else look[opt] = val;

    render(opt, val);
  });

  document.getElementById('preview').onclick = () => {
    viewIndex = (viewIndex + 1) % views.length;
    render();
  };

  document.getElementById('random').onclick = () => {
    look.body = pick(['man', 'woman']);
    look.skin = pick(SKIN_TONES);
    look.hairStyle = pick(HAIR_STYLES)[0];
    look.hair = pick(HAIR_COLORS);
    look.wrap = pick(WRAP_COLORS);
    look.shirt = pick(OUTFIT_COLORS);
    render();
  };

  const start = () => {
    profile.stallName = nameInput.value.trim() || DEFAULT_STALL_NAME;
    startButton.disabled = true;
    message.textContent = 'Getting your stall ready...';
    onStart();
  };

  startButton.onclick = start;
  nameInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') start();
  });
  document.getElementById('back').onclick = onBack;

  render();
  nameInput.focus();

  return {
    fail(text) {
      startButton.disabled = false;
      message.textContent = text;
    }
  };
}

// ---------- Pause menu ----------

// First click asks "are you sure?", second click does it
function confirmOnce(button, action, warning) {
  const original = button.textContent;
  let armed = false;

  button.onclick = () => {
    if (!armed) {
      armed = true;
      button.textContent = warning;
      return;
    }
    action();
  };

  button.onblur = () => {
    armed = false;
    button.textContent = original;
  };
}

export function showPause({ onResume, onNewGame, onMenu }) {
  ui().innerHTML = `
    <div class="screen dim">
      <div class="panel pause">
        <h1>Paused</h1>
        <button class="btn" id="resume">Resume</button>
        <button class="btn ghost" id="new">New game</button>
        <button class="btn ghost" id="menu">Main menu</button>
        <p class="hint">Esc to resume</p>
      </div>
    </div>`;

  const resume = document.getElementById('resume');
  resume.onclick = onResume;
  resume.focus();

  confirmOnce(document.getElementById('new'), onNewGame, 'Lose progress? Click again');
  confirmOnce(document.getElementById('menu'), onMenu, 'Lose progress? Click again');
}
