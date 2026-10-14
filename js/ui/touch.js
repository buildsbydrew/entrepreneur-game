// On-screen controls for phones and tablets: a joystick on the left and a Use button on the right.
// The game reads `touch` every frame. Nothing here draws the market.
export const touch = { x: 0, y: 0, use: false };

const RADIUS = 52; // how far the knob can travel from the centre of the stick

export function isTouchDevice() {
  return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
}

// Turns how far the knob has moved into a direction from -1 to 1 on each axis,
// never longer than 1, and also gives back where to draw the knob.
export function stickVector(dx, dy, radius = RADIUS) {
  const length = Math.hypot(dx, dy);
  const scale = length > radius ? radius / length : 1;
  const knobX = dx * scale;
  const knobY = dy * scale;
  return { x: knobX / radius, y: knobY / radius, knobX, knobY };
}

let ready = false;

function setUp() {
  const stick = document.getElementById('stick');
  const knob = document.getElementById('knob');
  const useButton = document.getElementById('use-btn');
  let activePointer = null;

  function move(event) {
    const box = stick.getBoundingClientRect();
    const v = stickVector(event.clientX - (box.left + box.width / 2), event.clientY - (box.top + box.height / 2));
    knob.style.transform = `translate(${v.knobX}px, ${v.knobY}px)`;
    touch.x = v.x;
    touch.y = v.y;
  }

  function release() {
    activePointer = null;
    knob.style.transform = '';
    touch.x = 0;
    touch.y = 0;
  }

  stick.addEventListener('pointerdown', event => {
    activePointer = event.pointerId;
    stick.setPointerCapture(event.pointerId);
    move(event);
  });
  stick.addEventListener('pointermove', event => {
    if (event.pointerId === activePointer) move(event);
  });
  stick.addEventListener('pointerup', release);
  stick.addEventListener('pointercancel', release);

  useButton.addEventListener('pointerdown', event => {
    event.preventDefault();
    touch.use = true;
  });

  // Stops a long press from opening the browser's menu
  document.getElementById('touch').addEventListener('contextmenu', event => event.preventDefault());
  touch.release = release;
}

export function showTouchControls() {
  if (!isTouchDevice()) return;
  if (!ready) {
    setUp();
    ready = true;
  }
  document.getElementById('touch').hidden = false;
}

export function hideTouchControls() {
  document.getElementById('touch').hidden = true;
  if (touch.release) touch.release();
  touch.use = false;
}
