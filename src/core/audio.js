// ---------------------------------------------------------------------------
// audio.js — procedural WebAudio sound engine. No external assets: every sound
// is synthesised, so the game never breaks on a missing file. All calls are
// wrapped in guards because AudioContext may be suspended until user gesture.
// ---------------------------------------------------------------------------

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.volume = 0.5;
    this.noiseBuf = null;
    this.lastPlay = new Map();
    this.voices = 0;
    this.maxVoices = 22;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate * 0.6);
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch (e) {
      this.ctx = null;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }

  // ---- primitives -----------------------------------------------------------
  _env(node, t0, attack, decay, peak = 0.5) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    node.connect(g);
    g.connect(this.master);
    return g;
  }

  _osc(type, freq, dur, opts = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + (opts.delay || 0);
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t0 + dur);
    this._env(o, t0, opts.attack ?? 0.005, dur, opts.gain ?? 0.18);
    o.start(t0);
    o.stop(t0 + dur + (opts.attack ?? 0.005) + 0.05);
  }

  _noise(dur, opts = {}) {
    if (!this.ctx || !this.noiseBuf) return;
    const t0 = this.ctx.currentTime + (opts.delay || 0);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = opts.filter || 'bandpass';
    filter.frequency.setValueAtTime(opts.freq || 1200, t0);
    if (opts.to) filter.frequency.exponentialRampToValueAtTime(Math.max(60, opts.to), t0 + dur);
    filter.Q.value = opts.q ?? 1;
    src.connect(filter);
    this._env(filter, t0, opts.attack ?? 0.004, dur, opts.gain ?? 0.2);
    src.start(t0);
    src.stop(t0 + dur + 0.1);
  }

  // ---- public sfx -----------------------------------------------------------
  play(name) {
    if (this.muted) return;
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    const now = this.ctx.currentTime;
    const last = this.lastPlay.get(name) || 0;
    const throttle = name === 'hit' ? 0.025 : name === 'ui' ? 0.02 : 0.02;
    if (now - last < throttle) return;
    this.lastPlay.set(name, now);
    if (this.voices > this.maxVoices) return;
    this.voices++;

    switch (name) {
      case 'slash':
        this._noise(0.1, { freq: 2600, to: 700, gain: 0.14, q: 1.4 });
        this._osc('triangle', 440, 0.08, { to: 180, gain: 0.05 });
        break;
      case 'heavy':
        this._noise(0.16, { freq: 700, to: 120, gain: 0.25, filter: 'lowpass' });
        this._osc('sine', 150, 0.2, { to: 45, gain: 0.22 });
        break;
      case 'hit':
        this._noise(0.06, { freq: 1600, to: 500, gain: 0.14, q: 0.8 });
        this._osc('square', 220, 0.05, { to: 90, gain: 0.06 });
        break;
      case 'hurt':
        this._osc('sawtooth', 200, 0.16, { to: 70, gain: 0.12 });
        this._noise(0.12, { freq: 500, to: 200, gain: 0.1 });
        break;
      case 'dodge':
        this._noise(0.16, { freq: 900, to: 2400, gain: 0.08, filter: 'highpass' });
        break;
      case 'reinforce':
        this._osc('sine', 330, 0.18, { to: 620, gain: 0.08 });
        this._osc('triangle', 660, 0.12, { to: 880, gain: 0.04, delay: 0.02 });
        break;
      case 'ce':
        this._osc('triangle', 520, 0.12, { to: 780, gain: 0.07 });
        break;
      case 'technique':
        this._osc('sawtooth', 300, 0.22, { to: 900, gain: 0.1 });
        this._noise(0.2, { freq: 700, to: 2500, gain: 0.07 });
        break;
      case 'blackflash':
        this._osc('square', 90, 0.3, { to: 40, gain: 0.3 });
        this._noise(0.3, { freq: 3000, to: 200, gain: 0.3, filter: 'lowpass' });
        this._osc('sawtooth', 1200, 0.18, { to: 100, gain: 0.12, delay: 0.01 });
        break;
      case 'summon':
        this._osc('sine', 120, 0.5, { to: 320, gain: 0.17 });
        this._noise(0.4, { freq: 300, to: 1600, gain: 0.09 });
        break;
      case 'shikigami':
        this._osc('triangle', 780, 0.12, { to: 1200, gain: 0.09 });
        break;
      case 'ult':
        this._osc('sawtooth', 100, 0.7, { to: 420, gain: 0.16 });
        this._noise(0.7, { freq: 400, to: 3000, gain: 0.12 });
        break;
      case 'domain':
        this._osc('sine', 55, 1.2, { to: 110, gain: 0.28, attack: 0.1 });
        this._osc('sawtooth', 220, 1.0, { to: 55, gain: 0.09, attack: 0.15 });
        this._noise(1.1, { freq: 250, to: 3000, gain: 0.12, filter: 'lowpass' });
        break;
      case 'domainend':
        this._osc('sine', 220, 0.5, { to: 55, gain: 0.16 });
        break;
      case 'boss':
        this._osc('sawtooth', 70, 0.9, { to: 45, gain: 0.22, attack: 0.1 });
        this._noise(0.8, { freq: 160, to: 90, gain: 0.15, filter: 'lowpass' });
        break;
      case 'reward':
        this._osc('triangle', 620, 0.12, { to: 900, gain: 0.09 });
        this._osc('triangle', 900, 0.16, { to: 1250, gain: 0.07, delay: 0.08 });
        break;
      case 'pickup':
        this._osc('sine', 880, 0.1, { to: 1320, gain: 0.09 });
        break;
      case 'ui':
        this._osc('square', 420, 0.04, { gain: 0.035 });
        break;
      case 'deny':
        this._osc('square', 160, 0.14, { to: 110, gain: 0.07 });
        break;
      case 'death':
        this._osc('sawtooth', 300, 0.6, { to: 40, gain: 0.18 });
        this._noise(0.5, { freq: 800, to: 100, gain: 0.15, filter: 'lowpass' });
        break;
      case 'victory':
        [523, 659, 784, 1046].forEach((f, i) =>
          this._osc('triangle', f, 0.22, { gain: 0.11, delay: i * 0.11 })
        );
        break;
      case 'defeat':
        [330, 262, 196, 147].forEach((f, i) =>
          this._osc('sine', f, 0.32, { gain: 0.12, delay: i * 0.16 })
        );
        break;
      case 'heal':
        this._osc('sine', 520, 0.25, { to: 880, gain: 0.08 });
        break;
      case 'tame':
        [392, 523, 659, 784, 1046].forEach((f, i) =>
          this._osc('triangle', f, 0.25, { gain: 0.1, delay: i * 0.1 })
        );
        break;
      case 'mark':
        this._osc('square', 760, 0.1, { to: 520, gain: 0.06 });
        break;
      case 'beam':
        this._noise(0.5, { freq: 2400, to: 300, gain: 0.16, filter: 'bandpass' });
        this._osc('sawtooth', 700, 0.4, { to: 120, gain: 0.1 });
        break;
      default:
        this._osc('square', 440, 0.05, { gain: 0.04 });
    }
    // Decay the voice counter.
    setTimeout(() => {
      this.voices = Math.max(0, this.voices - 1);
    }, 250);
  }
}

export const audio = new AudioEngine();
