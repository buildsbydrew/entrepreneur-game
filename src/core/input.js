// Controls: the keyboard on a computer, and on a phone a joystick under the left thumb
// and a big action button under the right.
//   Move: WASD or arrow keys, or the joystick
//   Use / talk: E or Space, or the action button
//   Pause: Esc or P, or the pause button

export function createInput(root) {
  const keys = {};
  const input = {
    move: { x: 0, z: 0 },   // -1 to 1 each way; z is "down the screen"
    action: false,          // pressed this frame
    pause: false,
    touch: matchMedia('(pointer: coarse)').matches,
    enabled: true
  };
  let actionQueued = false;
  let pauseQueued = false;

  addEventListener('keydown', e => {
    if (e.target instanceof HTMLInputElement) return; // typing a name
    keys[e.code] = true;
    if (e.repeat) return;
    if (e.code === 'KeyE' || e.code === 'Space') actionQueued = true;
    if (e.code === 'Escape' || e.code === 'KeyP') pauseQueued = true;
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => Object.keys(keys).forEach(k => { keys[k] = false; }));

  // ---------- Phone controls ----------
  const pad = document.createElement('div');
  pad.className = 'touch-pad';
  pad.innerHTML = '<div class="stick-base"><div class="stick-knob"></div></div><button class="action-btn" aria-label="Use">●</button>';
  root.appendChild(pad);
  const base = pad.querySelector('.stick-base');
  const knob = pad.querySelector('.stick-knob');
  const actionBtn = pad.querySelector('.action-btn');
  let stick = null; // { id, x, y } where the thumb first touched
  const stickMove = { x: 0, z: 0 };

  // The joystick appears wherever the left thumb lands on the left half of the screen
  addEventListener('touchstart', e => {
    input.touch = true;
    document.body.classList.add('is-touch');
    for (const t of e.changedTouches) {
      if (!stick && t.clientX < innerWidth / 2 && !(t.target.closest && t.target.closest('button, .panel'))) {
        stick = { id: t.identifier, x: t.clientX, y: t.clientY };
        base.style.left = `${t.clientX}px`;
        base.style.top = `${t.clientY}px`;
        base.classList.add('active');
      }
    }
  }, { passive: true });
  addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      if (stick && t.identifier === stick.id) {
        const max = 50;
        let dx = t.clientX - stick.x;
        let dy = t.clientY - stick.y;
        const len = Math.hypot(dx, dy);
        if (len > max) { dx *= max / len; dy *= max / len; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        stickMove.x = dx / max;
        stickMove.z = dy / max;
      }
    }
  }, { passive: true });
  const endStick = e => {
    for (const t of e.changedTouches) {
      if (stick && t.identifier === stick.id) {
        stick = null;
        stickMove.x = 0;
        stickMove.z = 0;
        knob.style.transform = '';
        base.classList.remove('active');
      }
    }
  };
  addEventListener('touchend', endStick);
  addEventListener('touchcancel', endStick);
  actionBtn.addEventListener('touchstart', e => { e.preventDefault(); actionQueued = true; }, { passive: false });
  actionBtn.addEventListener('click', () => { actionQueued = true; });
  if (input.touch) document.body.classList.add('is-touch');

  input.queuePause = () => { pauseQueued = true; };

  // Called once per frame, before the game reads the controls
  input.poll = () => {
    let x = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    let z = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
    const len = Math.hypot(x, z);
    if (len > 0) { x /= len; z /= len; }
    if (Math.hypot(stickMove.x, stickMove.z) > 0.15) { x = stickMove.x; z = stickMove.z; }
    input.move.x = input.enabled ? x : 0;
    input.move.z = input.enabled ? z : 0;
    input.action = actionQueued && input.enabled;
    input.pause = pauseQueued;
    actionQueued = false;
    pauseQueued = false;
  };

  // Shows or hides the phone controls (they hide during conversations and menus)
  input.showPad = visible => pad.classList.toggle('hidden', !visible);
  input.setActionLabel = label => { actionBtn.textContent = label; };

  return input;
}
