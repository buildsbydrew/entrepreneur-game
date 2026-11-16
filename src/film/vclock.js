// Film mode's clock. When a recording is made, time in the page stops being real time and moves only
// when the recorder says "one more frame". Timers, typing text, fades and the game's own clock all
// follow this clock, so every frame of the video is smooth however slow the computer is, and the
// same seed always plays out the same life.

export function installVirtualTime() {
  const real = {
    setTimeout: window.setTimeout.bind(window),
    perfNow: performance.now.bind(performance)
  };
  const dateStart = Date.now();
  let now = 0;
  let nextId = 1;
  const timers = new Map();   // id -> { at, fn, args, every }
  let frames = new Map();     // requestAnimationFrame callbacks waiting for the next frame
  const animStart = new WeakMap();

  window.setTimeout = (fn, ms = 0, ...args) => {
    const id = nextId++;
    timers.set(id, { at: now + Math.max(0, Number(ms) || 0), fn, args, every: 0 });
    return id;
  };
  window.setInterval = (fn, ms = 0, ...args) => {
    const id = nextId++;
    const every = Math.max(1, Number(ms) || 0);
    timers.set(id, { at: now + every, fn, args, every });
    return id;
  };
  window.clearTimeout = window.clearInterval = id => { timers.delete(id); };
  window.requestAnimationFrame = fn => { const id = nextId++; frames.set(id, fn); return id; };
  window.cancelAnimationFrame = id => { frames.delete(id); };
  performance.now = () => now;
  Date.now = () => dateStart + now;

  // Lets promises that were waiting on a timer carry on before the next timer fires
  const settle = () => new Promise(resolve => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(0);
  });

  // CSS fades and slide-ins follow the same clock
  const stepAnimations = () => {
    for (const a of document.getAnimations()) {
      let start = animStart.get(a);
      if (start === undefined) {
        start = now - (a.currentTime ?? 0);
        animStart.set(a, start);
        a.pause();
      }
      const t = now - start;
      const end = a.effect?.getComputedTiming().endTime ?? Infinity;
      if (Number.isFinite(end) && t >= end) a.finish();
      else a.currentTime = t;
    }
  };

  return {
    now: () => now,
    realNow: real.perfNow,
    // Moves time on by ms, running every timer that falls due, then draws one frame
    async step(ms) {
      const target = now + ms;
      for (let guard = 0; guard < 500; guard++) {
        let due = null;
        let dueId = 0;
        for (const [id, t] of timers) if (t.at <= target && (!due || t.at < due.at)) { due = t; dueId = id; }
        if (!due) break;
        now = Math.max(now, due.at);
        if (due.every) due.at += due.every;
        else timers.delete(dueId);
        try { if (typeof due.fn === 'function') due.fn(...due.args); } catch (error) { console.error(error); }
        await settle();
      }
      now = target;
      stepAnimations();
      const waiting = frames;
      frames = new Map();
      for (const fn of waiting.values()) {
        try { fn(now); } catch (error) { console.error(error); }
      }
      await settle();
    }
  };
}

// A small random number generator from a seed, so a run can be repeated exactly
export function seededRandom(seed) {
  let a = (Number(seed) || 1) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
