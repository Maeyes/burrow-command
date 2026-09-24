/**
 * Bunny World combat SFX.
 * Procedural 8-bit Web Audio only: no external audio files.
 * AudioContext is created lazily after the first user gesture.
 */
class CombatSFX {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.noiseBuffer = null;
    this.enabled = true;
    this.masterVolume = 0.55;
    this.lastPlayedAt = new Map();
    this.cooldownsMs = {
      swing: 60,
      hit: 45,
      crit: 110,
      death: 150,
      levelup: 450,
      pickup: 80,
      skill: 70,
      warp: 250,
    };
    this.boundUnlock = () => this.unlock();
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', this.boundUnlock, { capture: true, once: true });
      window.addEventListener('keydown', this.boundUnlock, { capture: true, once: true });
    }
  }

  async unlock() {
    const AudioCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioCtor) return false;
    if (!this.audioContext) {
      this.audioContext = new AudioCtor();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this.enabled ? this.masterVolume : 0;
      this.masterGain.connect(this.audioContext.destination);
      this.noiseBuffer = this.createNoiseBuffer();
    }
    if (this.audioContext.state === 'suspended') {
      try { await this.audioContext.resume(); } catch {}
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', this.boundUnlock, true);
      window.removeEventListener('keydown', this.boundUnlock, true);
    }
    return this.audioContext.state === 'running';
  }

  createNoiseBuffer() {
    if (!this.audioContext) return null;
    const sampleRate = this.audioContext.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * 0.25));
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  canPlay(name, cooldownMs = this.cooldownsMs[name] ?? 50) {
    if (!this.enabled || !this.audioContext || this.audioContext.state !== 'running' || !this.masterGain) return false;
    const now = performance.now(), last = this.lastPlayedAt.get(name) ?? -Infinity;
    if (now - last < cooldownMs) return false;
    this.lastPlayedAt.set(name, now);
    return true;
  }

  tone({ when = 0, frequency = 440, endFrequency = frequency, duration = 0.08, volume = 0.12, type = 'square' } = {}) {
    const ctx = this.audioContext;
    if (!ctx || !this.masterGain) return;
    const start = ctx.currentTime + Math.max(0, when);
    const stop = start + Math.max(0.015, duration);
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, frequency), start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), stop);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + Math.min(0.008, duration * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, stop);
    osc.connect(gain); gain.connect(this.masterGain);
    osc.start(start); osc.stop(stop + 0.01);
  }

  noise({ when = 0, duration = 0.06, volume = 0.08, frequency = 1200, type = 'bandpass' } = {}) {
    const ctx = this.audioContext;
    if (!ctx || !this.masterGain || !this.noiseBuffer) return;
    const start = ctx.currentTime + Math.max(0, when);
    const stop = start + Math.max(0.015, duration);
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = type; filter.frequency.value = frequency; filter.Q.value = 0.7;
    gain.gain.setValueAtTime(Math.max(0.0002, volume), start);
    gain.gain.exponentialRampToValueAtTime(0.0001, stop);
    source.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
    source.start(start); source.stop(stop + 0.01);
  }

  playAttack(options = {}) {
    if (!this.canPlay('swing')) return;
    const v = options.volume ?? 1;
    this.tone({ frequency: 260, endFrequency: 105, duration: 0.075, volume: 0.075 * v, type: 'square' });
    this.noise({ duration: 0.045, volume: 0.035 * v, frequency: 2100, type: 'highpass' });
  }

  playHit(options = {}) {
    if (options.critical) return this.playCrit(options);
    if (!this.canPlay('hit')) return;
    const v = options.volume ?? 1;
    this.tone({ frequency: 120, endFrequency: 72, duration: 0.065, volume: 0.12 * v, type: 'square' });
    this.noise({ duration: 0.055, volume: 0.08 * v, frequency: 900, type: 'bandpass' });
  }

  playCrit(options = {}) {
    if (!this.canPlay('crit')) return;
    const v = options.volume ?? 1;
    this.tone({ frequency: 180, endFrequency: 82, duration: 0.085, volume: 0.13 * v, type: 'square' });
    this.noise({ duration: 0.07, volume: 0.09 * v, frequency: 1300, type: 'bandpass' });
    this.tone({ when: 0.018, frequency: 720, endFrequency: 1080, duration: 0.09, volume: 0.075 * v, type: 'square' });
  }

  playDeath(options = {}) {
    if (!this.canPlay('death')) return;
    const v = options.volume ?? 1;
    this.tone({ frequency: 170, endFrequency: 52, duration: 0.24, volume: 0.12 * v, type: 'square' });
    this.tone({ when: 0.035, frequency: 118, endFrequency: 46, duration: 0.19, volume: 0.08 * v, type: 'triangle' });
    this.noise({ duration: 0.18, volume: 0.06 * v, frequency: 520, type: 'lowpass' });
  }

  playLevelUp(options = {}) {
    if (!this.canPlay('levelup')) return;
    const v = options.volume ?? 1;
    [330, 440, 660, 880].forEach((frequency, i) => {
      this.tone({ when: i * 0.075, frequency, endFrequency: frequency * 1.04, duration: 0.11, volume: 0.075 * v, type: i < 2 ? 'square' : 'triangle' });
    });
  }

  playPickup(options = {}) {
    if (!this.canPlay('pickup')) return;
    const v = options.volume ?? 1;
    this.tone({ frequency: 620, endFrequency: 760, duration: 0.055, volume: 0.065 * v, type: 'square' });
    this.tone({ when: 0.055, frequency: 930, endFrequency: 1120, duration: 0.07, volume: 0.07 * v, type: 'square' });
  }

  playLoot(options = {}) {
    this.playPickup(options);
  }

  playWarp(options = {}) {
    if (!this.canPlay('warp')) return;
    const v = options.volume ?? 1;
    this.tone({ frequency: 260, endFrequency: 620, duration: 0.18, volume: 0.08 * v, type: 'triangle' });
    this.tone({ when: 0.07, frequency: 520, endFrequency: 1040, duration: 0.22, volume: 0.065 * v, type: 'square' });
  }

  playSkillCast(_skillId, options = {}) {
    if (!this.canPlay('skill')) return;
    const v = options.volume ?? 1;
    this.tone({ frequency: 300, endFrequency: 520, duration: 0.1, volume: 0.07 * v, type: 'square' });
  }

  setMasterVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, Number(volume) || 0));
    if (this.masterGain && this.audioContext) {
      this.masterGain.gain.setTargetAtTime(this.enabled ? this.masterVolume : 0, this.audioContext.currentTime, 0.01);
    }
  }

  toggle(force) {
    this.enabled = typeof force === 'boolean' ? force : !this.enabled;
    if (this.masterGain && this.audioContext) {
      this.masterGain.gain.setTargetAtTime(this.enabled ? this.masterVolume : 0, this.audioContext.currentTime, 0.01);
    }
    return this.enabled;
  }
}

export const combatSFX = new CombatSFX();
