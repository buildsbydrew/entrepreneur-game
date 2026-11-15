// The interface over the 3D world: corner readouts, the "press E" prompt, short messages,
// conversations with choices, the title screen, starting a new life, the pause menu, and fades.
// Everything is plain HTML, styled in ui.css.

const COIN = '<svg class="coin" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5" fill="#f6c026" stroke="#3b2a20" stroke-width="2"/><circle cx="10" cy="10" r="4.5" fill="none" stroke="#b8860b" stroke-width="1.6"/></svg>';

const el = (html) => {
  const wrap = document.createElement('div');
  wrap.innerHTML = html.trim();
  return wrap.firstElementChild;
};

const escapeHtml = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createUI(root) {
  const ui = {};

  // ---------- Corner readouts: time and date on the left, money and pause on the right ----------
  const left = el('<div class="hud left"><div class="chip" data-time></div></div>');
  const right = el(`<div class="hud right"><div class="chip" data-money>${COIN}<span></span></div><button class="icon-btn" data-pause aria-label="Pause">II</button></div>`);
  root.append(left, right);
  const timeChip = left.querySelector('[data-time]');
  const moneyText = right.querySelector('[data-money] span');
  ui.hud = {
    show(visible) { left.classList.toggle('hidden', !visible); right.classList.toggle('hidden', !visible); },
    update({ time, date, money }) {
      const html = `${escapeHtml(time)} <small>${escapeHtml(date)}</small>`;
      if (timeChip.innerHTML !== html) timeChip.innerHTML = html;
      const m = String(money);
      if (moneyText.textContent !== m) moneyText.textContent = m;
    },
    onPause(fn) { right.querySelector('[data-pause]').addEventListener('click', fn); }
  };
  ui.hud.show(false);

  // ---------- The "press E" prompt over whatever the player can use ----------
  const prompt = el('<div class="prompt hidden"></div>');
  root.append(prompt);
  ui.showPrompt = (x, y, label) => {
    const html = `<kbd>E</kbd>${escapeHtml(label)}`;
    if (prompt.innerHTML !== html) prompt.innerHTML = html;
    prompt.classList.remove('hidden');
    // Keep it on screen, even when the thing is near the edge
    const half = prompt.offsetWidth / 2 + 8;
    prompt.style.left = `${Math.min(Math.max(x, half), innerWidth - half)}px`;
    prompt.style.top = `${Math.max(y, prompt.offsetHeight + 56)}px`;
  };
  ui.hidePrompt = () => prompt.classList.add('hidden');

  // ---------- Short messages ----------
  const toasts = el('<div class="toasts"></div>');
  root.append(toasts);
  ui.toast = message => {
    const t = el(`<div class="toast">${escapeHtml(message)}</div>`);
    toasts.append(t);
    setTimeout(() => t.remove(), 3800);
  };
  // A small word floating up from a point on screen, like "Nico liked that"
  ui.feeling = (x, y, text) => {
    const f = el(`<div class="feeling">${escapeHtml(text)}</div>`);
    f.style.left = `${x}px`;
    f.style.top = `${y}px`;
    root.append(f);
    setTimeout(() => f.remove(), 1500);
  };

  // ---------- Conversations ----------
  const box = el('<div class="dialogue hidden" role="dialog" aria-live="polite"><div class="speaker"></div><div class="text"></div><div class="choices"></div><div class="next"></div></div>');
  root.append(box);
  const speakerEl = box.querySelector('.speaker');
  const textEl = box.querySelector('.text');
  const choicesEl = box.querySelector('.choices');
  const nextEl = box.querySelector('.next');
  let advance = null; // what pressing "next" does right now

  addEventListener('keydown', e => {
    if (box.classList.contains('hidden') || e.repeat) return;
    if (['Enter', 'Space', 'KeyE'].includes(e.code) && advance) { e.preventDefault(); advance(); }
    const n = Number(e.key);
    if (n >= 1 && n <= 9) choicesEl.querySelectorAll('.choice')[n - 1]?.click();
  });
  box.addEventListener('click', e => { if (!e.target.closest('.choice') && advance) advance(); });

  ui.dialogue = {
    open() { box.classList.remove('hidden'); },
    close() { box.classList.add('hidden'); advance = null; },

    // Shows one line, typing it out. Resolves when the player moves on.
    say(speaker, text, isYou = false) {
      speakerEl.textContent = speaker;
      speakerEl.classList.toggle('you', isYou);
      choicesEl.innerHTML = '';
      nextEl.textContent = matchMedia('(pointer: coarse)').matches ? 'Tap to continue' : 'Enter, E or click to continue';
      return new Promise(resolve => {
        let shown = 0;
        const timer = setInterval(() => {
          shown += 2;
          textEl.textContent = text.slice(0, shown);
          if (shown >= text.length) clearInterval(timer);
        }, 16);
        advance = () => {
          if (shown < text.length) { // first press shows the whole line
            shown = text.length;
            clearInterval(timer);
            textEl.textContent = text;
            return;
          }
          advance = null;
          resolve();
        };
      });
    },

    // Shows the choices. Resolves with the one picked.
    choose(speaker, prompt, choices, isYou = false) {
      speakerEl.textContent = speaker;
      speakerEl.classList.toggle('you', isYou);
      textEl.textContent = prompt;
      nextEl.textContent = '';
      advance = null;
      choicesEl.innerHTML = '';
      return new Promise(resolve => {
        choices.forEach((choice, i) => {
          const b = el(`<button class="choice"><span class="num">${i + 1}.</span>${escapeHtml(choice.text)}</button>`);
          b.addEventListener('click', e => { e.stopPropagation(); choicesEl.innerHTML = ''; resolve(choice); });
          choicesEl.append(b);
        });
        choicesEl.querySelector('.choice')?.focus({ preventScroll: true });
      });
    }
  };

  // ---------- Full-screen menus ----------
  let screen = null;
  const showScreen = (html, className = '') => {
    if (screen) screen.remove();
    screen = el(`<div class="screen ${className}">${html}</div>`);
    root.append(screen);
    return screen;
  };
  ui.closeScreen = () => { if (screen) screen.remove(); screen = null; };
  ui.screenOpen = () => Boolean(screen);

  // The title screen, over the live 3D world
  ui.showTitle = ({ title, saved, onNew, onContinue }) => {
    const s = showScreen(`<div class="panel">
      <h1>${escapeHtml(title)}</h1>
      <p class="muted">One life. Every choice is yours.</p>
      <div class="stack">
        ${saved ? `<button class="btn primary" data-continue>Continue</button><div class="muted">${escapeHtml(saved)}</div>` : ''}
        <button class="btn ${saved ? '' : 'primary'}" data-new>${saved ? 'Start a new life' : 'Begin a life'}</button>
      </div></div>`, 'title-screen');
    s.querySelector('[data-continue]')?.addEventListener('click', onContinue);
    const newBtn = s.querySelector('[data-new]');
    newBtn.addEventListener('click', () => {
      if (saved && !newBtn.dataset.sure) { // ask once, so a saved life isn't lost by accident
        newBtn.dataset.sure = '1';
        newBtn.textContent = 'This replaces your saved life. Click again';
        return;
      }
      onNew();
    });
  };

  // Choosing who you'll be
  ui.showNewLife = ({ skins, onStart, onBack }) => {
    const s = showScreen(`<div class="panel">
      <h2>A new life</h2>
      <label for="life-name">Your name</label>
      <input id="life-name" type="text" maxlength="16" placeholder="Type a name" autocomplete="off">
      <label>You are</label>
      <div class="row" data-body><button class="toggle on" data-v="boy">A boy</button><button class="toggle" data-v="girl">A girl</button></div>
      <label>Skin</label>
      <div class="row" data-skin>${skins.map((c, i) => `<button class="swatch ${i === 1 ? 'on' : ''}" data-v="${c}" style="background:${c}" aria-label="Skin tone ${i + 1}"></button>`).join('')}</div>
      <p></p>
      <div class="row"><button class="btn" data-back>Back</button><button class="btn primary" data-start>Be born</button></div>
    </div>`, 'dim');
    const pickOne = sel => s.querySelector(sel).addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      s.querySelectorAll(`${sel} button`).forEach(x => x.classList.toggle('on', x === b));
    });
    pickOne('[data-body]');
    pickOne('[data-skin]');
    const nameInput = s.querySelector('#life-name');
    setTimeout(() => nameInput.focus(), 50);
    s.querySelector('[data-back]').addEventListener('click', onBack);
    const start = () => {
      const name = nameInput.value.trim() || 'Sam';
      onStart({
        name,
        body: s.querySelector('[data-body] .on').dataset.v,
        skin: s.querySelector('[data-skin] .on').dataset.v
      });
    };
    s.querySelector('[data-start]').addEventListener('click', start);
    nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') start(); });
  };

  // The pause menu: Resume, Settings, Main menu
  ui.showPause = ({ quality, qualities, onResume, onQuality, onMenu }) => {
    const s = showScreen(`<div class="panel">
      <h2>Paused</h2>
      <div class="stack">
        <button class="btn primary" data-resume>Resume</button>
        <div><label>Picture quality</label>
          <div class="row" data-quality>${Object.entries(qualities).map(([k, q]) => `<button class="toggle ${k === quality ? 'on' : ''}" data-v="${k}">${q.label}</button>`).join('')}</div></div>
        <button class="btn" data-menu>Main menu</button>
        <div class="muted">Your life saves by itself as you play.</div>
      </div></div>`, 'dim');
    s.querySelector('[data-resume]').addEventListener('click', onResume);
    s.querySelector('[data-menu]').addEventListener('click', onMenu);
    s.querySelector('[data-quality]').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      s.querySelectorAll('[data-quality] button').forEach(x => x.classList.toggle('on', x === b));
      onQuality(b.dataset.v);
    });
  };

  // ---------- Fading to black between places and days ----------
  const fade = el('<div class="fade"><div class="card"></div></div>');
  root.append(fade);
  const card = fade.querySelector('.card');
  const wait = ms => new Promise(r => setTimeout(r, ms));
  ui.fadeOut = async (title = '', subtitle = '') => {
    card.innerHTML = title ? `${escapeHtml(title)}${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ''}` : '';
    fade.classList.add('on');
    await wait(360);
    if (title) {
      fade.classList.add('show-card');
      await wait(1600);
    }
  };
  ui.fadeIn = async () => {
    fade.classList.remove('show-card');
    fade.classList.remove('on');
    await wait(360);
  };

  return ui;
}
