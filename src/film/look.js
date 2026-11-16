// The film look: a shallow depth of field (the background softly blurred in close shots, focused on
// whoever the camera is on) and a gentle colour grade for the mood of the scene (warm at home,
// cooler and darker when the man in the green coat is near). Only in film mode.
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const GRADES = {
  home: 'sepia(0.14) saturate(1.12) contrast(1.04) brightness(1.02)',
  tense: 'saturate(0.78) hue-rotate(-10deg) contrast(1.08) brightness(0.95)',
  night: 'saturate(0.9) contrast(1.06) brightness(0.98)',
  day: 'saturate(1.06) contrast(1.04)'
};

export function createFilmLook(game, filmCamera) {
  const renderer = game.renderer;
  const draw = renderer.render.bind(renderer);
  let composer = null;
  let bokeh = null;
  let inside = false;
  let grade = '';

  function setup(scene, camera) {
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(innerWidth, innerHeight);
    composer.addPass(new RenderPass(scene, camera));
    bokeh = new BokehPass(scene, camera, { focus: 10, aperture: 0.002, maxblur: 0.008 });
    composer.addPass(bokeh);
    composer.addPass(new OutputPass());
    addEventListener('resize', () => { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight); });
  }

  function updateGrade() {
    const pl = game.player;
    const tense = pl && game.people.some(p => p.id === 'corin' && Math.hypot(p.pos.x - pl.pos.x, p.pos.z - pl.pos.z) < 12);
    const hour = (game.clockNow?.().minutes ?? 720) / 60;
    const g = tense ? GRADES.tense : game.place?.id === 'home' ? GRADES.home : hour >= 19 || hour < 6 ? GRADES.night : GRADES.day;
    if (g !== grade) {
      grade = g;
      renderer.domElement.style.filter = g;
    }
  }

  return {
    render(scene, camera) {
      // The composer draws through the renderer too: let those calls straight through
      if (inside) return draw(scene, camera);
      if (game.mode === 'title' || !game.player) return draw(scene, camera);
      if (!composer) setup(scene, camera);
      updateGrade();
      const close = filmCamera.closeness();
      bokeh.uniforms.focus.value = filmCamera.focus();
      bokeh.uniforms.aperture.value = 0.0006 + close * 0.0045;
      bokeh.uniforms.maxblur.value = 0.004 + close * 0.008;
      inside = true;
      try { composer.render(); } finally { inside = false; }
    }
  };
}
