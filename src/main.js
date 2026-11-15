// Starts the game. With ?dev in the address, a small testing panel appears too.
import './ui/ui.css';
import Game from './core/Game.js';
import { state } from './core/state.js';

const game = new Game(document.getElementById('app'));

if (new URLSearchParams(location.search).has('dev')) {
  // Testing panel: change your stage of life and the time of day
  const panel = document.createElement('div');
  panel.className = 'dev';
  panel.innerHTML = `<b>Test</b>
    ${['baby', 'child', 'teen', 'adult', 'elder'].map(s => `<button data-stage="${s}">${s}</button>`).join('')}
    <input type="range" min="300" max="1315" step="5" data-time aria-label="Time of day">`;
  document.getElementById('ui').append(panel);
  panel.addEventListener('click', e => {
    const stage = e.target.dataset.stage;
    if (stage) game.setPlayerStage(stage);
  });
  panel.querySelector('[data-time]').addEventListener('input', e => {
    if (state.clock) state.clock.minutes = Number(e.target.value);
  });
  window.game = game; // for poking at it from the browser console
  window.lifeState = state;
}
