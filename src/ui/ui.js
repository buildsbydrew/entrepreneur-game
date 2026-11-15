// The interface over the 3D world: corner readouts, the "press E" prompt, short messages,
// conversations with choices, the title screen, starting a new life, the pause menu, fades, the
// "time passes" screens, the People screen and the life story at the end.
// Everything is plain HTML, styled in ui.css.

const COIN = '<svg class="coin" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5" fill="#f6c026" stroke="#3b2a20" stroke-width="2"/><circle cx="10" cy="10" r="4.5" fill="none" stroke="#b8860b" stroke-width="1.6"/></svg>';

// Little icons for energy, health, happiness and people
const ICONS = {
  energy: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M11 1 3 12h6l-1 7 8-11h-6z" fill="#f6c026" stroke="#3b2a20" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  health: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 17S2 12 2 7a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 5-8 10-8 10z" fill="#e2546a" stroke="#3b2a20" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  happiness: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="#7cc4f2" stroke="#3b2a20" stroke-width="1.6"/><path d="M6.5 11.5c1 2 6 2 7 0" fill="none" stroke="#3b2a20" stroke-width="1.6" stroke-linecap="round"/><circle cx="7.5" cy="8" r="1" fill="#3b2a20"/><circle cx="12.5" cy="8" r="1" fill="#3b2a20"/></svg>',
  people: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="7" cy="7" r="3" fill="#3b2a20"/><circle cx="14" cy="8" r="2.5" fill="#3b2a20"/><path d="M1.5 17c0-4 2.5-6 5.5-6s5.5 2 5.5 6zM11 17c0-2.6 1.3-4.5 3-4.5s4 1.4 4 4.5z" fill="#3b2a20"/></svg>'
};

const el = (html) => {
  const wrap = document.createElement('div');
  wrap.innerHTML = html.trim();
  return wrap.firstElementChild;
};

const escapeHtml = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createUI(root) {
  const ui = {};

  // ---------- Corner readouts: time and date on the left, money and pause on the right ----------
  const needsHtml = ['energy', 'health', 'happiness'].map(n => `<span class="need" title="${n}">${ICONS[n]}<i><b data-need="${n}"></b></i></span>`).join('');
  const left = el(`<div class="hud left"><div class="chip" data-time></div><div class="chip needs">${needsHtml}</div></div>`);
  const right = el(`<div class="hud right"><div class="chip" data-money>${COIN}<span></span></div><button class="icon-btn" data-people aria-label="People and journal">${ICONS.people}</button><button class="icon-btn" data-pause aria-label="Pause">II</button></div>`);
  root.append(left, right);
  const timeChip = left.querySelector('[data-time]');
  const moneyText = right.querySelector('[data-money] span');
  ui.hud = {
    show(visible) { left.classList.toggle('hidden', !visible); right.classList.toggle('hidden', !visible); },
    update({ time, date, money, needs }) {
      const html = `${escapeHtml(time)} <small>${escapeHtml(date)}</small>`;
      if (timeChip.innerHTML !== html) timeChip.innerHTML = html;
      const m = String(money);
      if (moneyText.textContent !== m) moneyText.textContent = m;
      if (needs) {
        left.querySelectorAll('[data-need]').forEach(bar => {
          const v = Math.round(needs[bar.dataset.need]);
          bar.style.width = `${v}%`;
          bar.classList.toggle('low', v < 25);
        });
      }
    },
    onPause(fn) { right.querySelector('[data-pause]').addEventListener('click', fn); },
    onPeople(fn) { right.querySelector('[data-people]').addEventListener('click', fn); }
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
      ui.onSay?.(speaker, isYou); // the game plays a little voice sound
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
          b.addEventListener('click', e => { e.stopPropagation(); choicesEl.innerHTML = ''; ui.onChoose?.(); resolve(choice); });
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
  ui.showPause = ({ quality, qualities, sound, onSound, onResume, onQuality, onMenu }) => {
    const s = showScreen(`<div class="panel">
      <h2>Paused</h2>
      <div class="stack">
        <button class="btn primary" data-resume>Resume</button>
        <div><label>Picture quality</label>
          <div class="row" data-quality>${Object.entries(qualities).map(([k, q]) => `<button class="toggle ${k === quality ? 'on' : ''}" data-v="${k}">${q.label}</button>`).join('')}</div></div>
        <div><label>Sound</label>
          <div class="row" data-sound>${[['sfx', 'Effects'], ['music', 'Music'], ['ambience', 'Outdoors']].map(([k, label]) => `<button class="toggle ${sound[k] ? 'on' : ''}" data-v="${k}">${label}</button>`).join('')}</div></div>
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
    s.querySelector('[data-sound]').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      b.classList.toggle('on');
      onSound(b.dataset.v, b.classList.contains('on'));
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

// ---------- Time passing between played days ----------

  // Asks what to focus on until the next played day. Resolves with the focus picked.
  ui.chooseFocus = ({ heading, sub, choices }) => new Promise(resolve => {
    const s = showScreen(`<div class="panel wide">
      <h2>${escapeHtml(heading)}</h2>
      <p>${escapeHtml(sub)}</p>
      <div class="focus-list">${choices.map((c, i) => `<button class="choice" data-i="${i}"><span class="num">${i + 1}.</span><b>${escapeHtml(c.label)}</b><small>${escapeHtml(c.hint ?? '')}</small></button>`).join('')}</div>
    </div>`, 'night');
    const pick = i => { removeEventListener('keydown', onKey); resolve(choices[i]); };
    const onKey = e => { const n = Number(e.key); if (n >= 1 && n <= choices.length) pick(n - 1); };
    addEventListener('keydown', onKey);
    s.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => pick(Number(b.dataset.i))));
    s.querySelector('[data-i]')?.focus({ preventScroll: true });
  });

  // Shows what happened while time passed. Resolves when the player carries on.
  ui.showSummary = ({ heading, sub, lines, button = 'Carry on' }) => new Promise(resolve => {
    const s = showScreen(`<div class="panel wide">
      <h2>${escapeHtml(heading)}</h2>
      ${sub ? `<p class="muted">${escapeHtml(sub)}</p>` : ''}
      <ul class="summary">${lines.map((l, i) => `<li style="animation-delay:${0.2 + i * 0.45}s">${escapeHtml(l)}</li>`).join('')}</ul>
      <button class="btn primary" data-go>${escapeHtml(button)}</button>
    </div>`, 'night');
    const go = () => { removeEventListener('keydown', onKey); resolve(); };
    const onKey = e => { if (e.code === 'Enter' || e.code === 'Space') go(); };
    setTimeout(() => addEventListener('keydown', onKey), 300);
    s.querySelector('[data-go]').addEventListener('click', go);
  });

  // ---------- The People screen: who you know, your story so far, who you are ----------
  ui.showPeople = ({ people, journal, traits, skills, onClose }) => {
    // Up to five hearts for how much someone likes you; crosses if they don't
    const hearts = bond => {
      const n = Math.max(-3, Math.min(5, Math.round(bond / 2)));
      if (n < 0) return `<span class="hearts cold">${'✕'.repeat(-n)}</span>`;
      return `<span class="hearts">${'♥'.repeat(n)}<span class="empty">${'♥'.repeat(5 - n)}</span></span>`;
    };
    const peopleHtml = people.length
      ? `<ul class="people-list">${people.map(p => `<li><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.detail)}</small>${hearts(p.bond)}</li>`).join('')}</ul>`
      : '<p class="muted">You haven\'t really met anyone yet.</p>';
    const storyHtml = journal.length
      ? `<ul class="journal">${[...journal].reverse().map(j => `<li><small>Age ${j.age}</small>${escapeHtml(j.text)}</li>`).join('')}</ul>`
      : '<p class="muted">Your story is just beginning.</p>';
    const traitsHtml = traits.length ? traits.map(escapeHtml).join(', ') : '<span class="muted">Still finding out who you are.</span>';
    const skillsHtml = skills.length
      ? `<ul class="skills">${skills.map(k => `<li>${escapeHtml(k.name)}<i><b style="width:${Math.min(100, k.level * 8)}%"></b></i></li>`).join('')}</ul>`
      : '<p class="muted">Nothing yet. Skills grow by doing.</p>';
    const s = showScreen(`<div class="panel wide book">
      <div class="tabs"><button class="tab on" data-tab="people">People</button><button class="tab" data-tab="story">My story</button><button class="tab" data-tab="me">Me</button></div>
      <div data-page="people">${peopleHtml}</div>
      <div data-page="story" class="hidden">${storyHtml}</div>
      <div data-page="me" class="hidden"><label>Personality</label><p>${traitsHtml}</p><label>Good at</label>${skillsHtml}</div>
      <button class="btn" data-close>Close</button>
    </div>`, 'dim');
    s.querySelector('.tabs').addEventListener('click', e => {
      const t = e.target.closest('[data-tab]');
      if (!t) return;
      s.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === t));
      s.querySelectorAll('[data-page]').forEach(pg => pg.classList.toggle('hidden', pg.dataset.page !== t.dataset.tab));
    });
    s.querySelector('[data-close]').addEventListener('click', onClose);
  };

  // ---------- The end of a life ----------
  ui.showLifeStory = ({ name, years, cause, moments, closest, traits, money, onNew }) => {
    const momentsHtml = moments.map(m => `<li><small>Age ${m.age}</small>${escapeHtml(m.text)}</li>`).join('') || '<li>A quiet life.</li>';
    const s = showScreen(`<div class="panel wide book story-end">
      <h1>${escapeHtml(name)}</h1>
      <p class="muted">${escapeHtml(years)}</p>
      <p>${escapeHtml(cause)}</p>
      ${traits.length ? `<p>Remembered as ${traits.map(t => escapeHtml(t.toLowerCase())).join(' and ')}.</p>` : ''}
      ${closest.length ? `<label>Closest to</label><p>${closest.map(escapeHtml).join(', ')}</p>` : ''}
      <label>Moments</label>
      <ul class="journal">${momentsHtml}</ul>
      <p class="muted">Left behind: ${escapeHtml(money)}</p>
      <button class="btn primary" data-new>Begin a new life</button>
    </div>`, 'night');
    s.querySelector('[data-new]').addEventListener('click', onNew);
  };

  // ---------- The prologue: cinema bars, captions, and family choices ----------
  const cinema = el(`<div class="cinema hidden">
    <div class="bar top"><button class="skip" data-skip>Skip</button></div>
    <div class="bar bottom"></div>
    <div class="caption-box"><p class="caption"></p><div class="caption-choices"></div><div class="caption-next"></div></div>
  </div>`);
  root.append(cinema);
  const captionEl = cinema.querySelector('.caption');
  const captionChoices = cinema.querySelector('.caption-choices');
  const captionNext = cinema.querySelector('.caption-next');
  let captionAdvance = null;
  let onSkip = null;

  cinema.querySelector('[data-skip]').addEventListener('click', e => { e.stopPropagation(); onSkip?.(); captionAdvance?.(true); });
  cinema.addEventListener('click', e => { if (!e.target.closest('button') && captionAdvance) captionAdvance(); });
  addEventListener('keydown', e => {
    if (cinema.classList.contains('hidden') || e.repeat) return;
    if (['Enter', 'Space', 'KeyE'].includes(e.code) && captionAdvance) { e.preventDefault(); captionAdvance(); }
    const n = Number(e.key);
    if (n >= 1 && n <= 9) captionChoices.querySelectorAll('.choice')[n - 1]?.click();
  });

  ui.cinema = {
    // skip: what to do when the player presses Skip
    open(skip) {
      onSkip = skip;
      cinema.classList.remove('hidden');
      cinema.classList.remove('dark');
      captionEl.textContent = '';
      captionChoices.innerHTML = '';
      captionNext.textContent = '';
    },
    close() {
      cinema.classList.add('hidden');
      captionAdvance = null;
      onSkip = null;
    },
    // A black screen behind the captions, for the words between scenes
    dark(on) { cinema.classList.toggle('dark', on); },
    clear() {
      captionEl.textContent = '';
      captionChoices.innerHTML = '';
      captionNext.textContent = '';
    },

    // Types out one caption. Resolves when the player moves on (or skips).
    caption(text) {
      captionChoices.innerHTML = '';
      captionNext.textContent = matchMedia('(pointer: coarse)').matches ? 'Tap to continue' : 'Enter or click to continue';
      return new Promise(resolve => {
        let shown = 0;
        const timer = setInterval(() => {
          shown += 1;
          captionEl.textContent = text.slice(0, shown);
          if (shown >= text.length) clearInterval(timer);
        }, 28);
        captionAdvance = (skipAll = false) => {
          if (!skipAll && shown < text.length) {
            shown = text.length;
            clearInterval(timer);
            captionEl.textContent = text;
            return;
          }
          clearInterval(timer);
          captionAdvance = null;
          resolve();
        };
      });
    },

    // Shows a question and its answers. Resolves with the answer picked, or null if skipped.
    choose(prompt, options) {
      captionEl.textContent = prompt;
      captionNext.textContent = '';
      captionChoices.innerHTML = '';
      return new Promise(resolve => {
        captionAdvance = skipAll => { if (skipAll) { captionAdvance = null; captionChoices.innerHTML = ''; resolve(null); } };
        options.forEach((option, i) => {
          const b = el(`<button class="choice"><span class="num">${i + 1}.</span>${escapeHtml(option.text)}</button>`);
          b.addEventListener('click', e => {
            e.stopPropagation();
            captionAdvance = null;
            captionChoices.innerHTML = '';
            resolve(option);
          });
          captionChoices.append(b);
        });
        captionChoices.querySelector('.choice')?.focus({ preventScroll: true });
      });
    }
  };

  return ui;
}
