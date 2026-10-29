// Original sorcerer creation. The assigned kit is chosen once and saved.
import { CHARACTERS } from '../data/characters.js';
import { createSorcerer, sorcererLook, SKINS, HAIRS, UNIFORMS, STYLES } from '../data/sorcerer.js';
import { drawHumanoid, humanoidPose } from '../render/sprites.js';
import { panel, text } from '../ui/ui.js';

export class CharSelectScene {
  constructor(game, params = {}) {
    this.game = game;
    this.params = params;
    this.canPause = false;
    this.t = 0;
    this.appearance = { skin: 0, hair: 0, uniform: 0, style: 0, ...(game.save.data.sorcerer?.appearance || {}) };
  }
  enter() {
    const profile = this.game.save.data.sorcerer;
    const form = document.createElement('form');
    form.className = 'sorcerer-form';
    form.innerHTML = `<label>Name <input name="name" maxlength="20" autocomplete="off" required></label>
      <div class="sorcerer-options">
        <label>Skin <select name="skin"></select></label><label>Hair color <select name="hair"></select></label>
        <label>Hair style <select name="style"></select></label><label>Uniform <select name="uniform"></select></label>
      </div><div class="sorcerer-actions"><button type="submit">${profile ? 'SAVE & CONTINUE' : 'CREATE SORCERER'}</button>
      <button type="button" class="cancel">BACK</button></div>`;
    form.elements.name.value = profile?.name || '';
    for (const [key, values] of Object.entries({ skin: SKINS, hair: HAIRS, style: STYLES, uniform: UNIFORMS })) {
      values.forEach((_, i) => {
        const option = document.createElement('option'); option.value = i; option.textContent = key === 'style' ? STYLES[i] : `${i + 1}`;
        form.elements[key].appendChild(option);
      });
      form.elements[key].value = this.appearance[key];
      form.elements[key].addEventListener('change', () => { this.appearance[key] = Number(form.elements[key].value); });
    }
    // Do not send typing or selection keys into the game input handler.
    form.addEventListener('keydown', (e) => e.stopPropagation());
    form.addEventListener('keyup', (e) => e.stopPropagation());
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.game.engine.transition.active) return;
      const name = form.elements.name.value.trim().slice(0, 20);
      if (!name) { form.elements.name.focus(); return; }
      const current = this.game.save.data.sorcerer;
      if (current) { current.name = name; current.appearance = { ...this.appearance }; }
      else this.game.save.data.sorcerer = createSorcerer(name, { ...this.appearance });
      this.game.selectedChar = this.game.save.data.sorcerer.technique;
      this.game.save.save();
      this.game.audio.play('pickup');
      this.game.engine.go('hub', { fresh: true }, 0.3);
    });
    form.querySelector('.cancel').addEventListener('click', () => this.game.engine.go(this.params.from === 'hub' ? 'hub' : 'title', {}, 0.25));
    document.getElementById('stage').appendChild(form);
    this.form = form;
  }
  exit() { this.form?.remove(); }
  update(dt) { this.t += dt; }
  draw(ctx) {
    ctx.fillStyle = '#0a0a16'; ctx.fillRect(0, 0, 640, 360);
    panel(ctx, 38, 25, 564, 310, { fill: 'rgba(10,12,20,0.96)', border: '#5b8cff', inner: false });
    text(ctx, 'YOUR SORCERER', 320, 50, { size: 16, align: 'center', color: '#f2eef8' });
    drawHumanoid(ctx, { x: 135, y: 225, look: sorcererLook(this.appearance), facingX: 1,
      pose: humanoidPose('idle', this.t, { facingX: 1, progress: 0.2 }), t: this.t, scale: 3, alpha: 1, flash: 0, aura: 0 });
    const p = this.game.save.data.sorcerer;
    text(ctx, p ? `TECHNIQUE: ${CHARACTERS[p.technique].title.toUpperCase()}` : 'INNATE TECHNIQUE', 135, 261, { size: 7, align: 'center', color: '#9fd8ff' });
    text(ctx, p ? `${p.unlocked} SKILLS · ${p.trainingWins} TRAINING WINS` : 'ASSIGNED ONCE AT RANDOM', 135, 276, { size: 6, align: 'center', color: '#93a0b8' });
    text(ctx, 'Spar with your technique trainer to grow.', 320, 318, { size: 7, align: 'center', color: '#93a0b8' });
  }
}
