// Procedural Web Audio API cozy synth soundscape & tactile SFX engine

const WINTER_PENTATONIC_HZ = [
  523.25, // C5
  587.33, // D5
  659.25, // E5
  783.99, // G5
  880.0,  // A5
  987.77, // B5
  1046.5, // C6
  1174.66,// D6
  1318.51,// E6
  1567.98,// G6
];

export class CozyAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  private scrapeGain: GainNode | null = null;
  private scrapeFilter: BiquadFilterNode | null = null;

  private padGain: GainNode | null = null;
  private padOscs: OscillatorNode[] = [];

  private muted = false;
  private initialized = false;
  private lastChimeTime = 0;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.72, this.ctx.currentTime, 0.04);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public unlock(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.72;
      master.connect(ctx.destination);
      this.masterGain = master;

      // 1. Cozy soft plow engine purr (filtered triangle + warm sub)
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 180;
      engineFilter.Q.value = 1.2;

      const engineGain = ctx.createGain();
      engineGain.gain.value = 0;

      const engineOsc = ctx.createOscillator();
      engineOsc.type = 'triangle';
      engineOsc.frequency.value = 54;

      const engineSub = ctx.createOscillator();
      engineSub.type = 'sine';
      engineSub.frequency.value = 27;

      engineOsc.connect(engineFilter);
      engineSub.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);

      engineOsc.start();
      engineSub.start();

      this.engineOsc = engineOsc;
      this.engineSubOsc = engineSub;
      this.engineGain = engineGain;
      this.engineFilter = engineFilter;

      // 2. Powdery snow scrape noise bed (looping pink-ish noise buffer)
      const noiseLength = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < noiseLength; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.95 * b2 + white * 0.048;
        data[i] = (b0 + b1 + b2 + white * 0.14) * 0.55;
      }

      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuffer;
      noiseSrc.loop = true;

      const scrapeFilter = ctx.createBiquadFilter();
      scrapeFilter.type = 'bandpass';
      scrapeFilter.frequency.value = 820;
      scrapeFilter.Q.value = 0.9;

      const scrapeGain = ctx.createGain();
      scrapeGain.gain.value = 0;

      noiseSrc.connect(scrapeFilter);
      scrapeFilter.connect(scrapeGain);
      scrapeGain.connect(master);
      noiseSrc.start();

      this.scrapeFilter = scrapeFilter;
      this.scrapeGain = scrapeGain;

      // 3. Ultra-gentle cozy twilight ambient chord pad (Cmaj9 low hum)
      const padFilter = ctx.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.value = 420;

      const padGain = ctx.createGain();
      padGain.gain.value = 0;

      const padNotes = [130.81, 196.0, 246.94, 293.66]; // C3, G3, B3, D4
      for (const freq of padNotes) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const voiceGain = ctx.createGain();
        voiceGain.gain.value = 0.14;
        osc.connect(voiceGain);
        voiceGain.connect(padFilter);
        osc.start();
        this.padOscs.push(osc);
      }
      padFilter.connect(padGain);
      padGain.connect(master);
      this.padGain = padGain;

      this.initialized = true;
    } catch {
      // Gracefully ignore if Web Audio is unavailable
    }
  }

  public updateContinuous(
    isPlaying: boolean,
    speedRatio: number,
    snowContact: number,
    boosting: boolean
  ): void {
    if (!this.initialized || !this.ctx || !this.engineGain || !this.engineOsc || !this.engineSubOsc || !this.engineFilter || !this.scrapeGain || !this.scrapeFilter || !this.padGain) {
      return;
    }
    const now = this.ctx.currentTime;

    if (!isPlaying) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.08);
      this.scrapeGain.gain.setTargetAtTime(0, now, 0.06);
      this.padGain.gain.setTargetAtTime(0.025, now, 0.4);
      return;
    }

    const clampedSpeed = Math.max(0, Math.min(1.5, speedRatio));
    const baseFreq = 48 + clampedSpeed * 38 + (boosting ? 18 : 0);
    this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.06);
    this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.06);
    this.engineFilter.frequency.setTargetAtTime(150 + clampedSpeed * 180 + (boosting ? 140 : 0), now, 0.07);
    this.engineGain.gain.setTargetAtTime(0.032 + clampedSpeed * 0.034 + (boosting ? 0.02 : 0), now, 0.08);

    const contact = Math.max(0, Math.min(1, snowContact));
    this.scrapeFilter.frequency.setTargetAtTime(620 + clampedSpeed * 520 + contact * 360, now, 0.05);
    this.scrapeGain.gain.setTargetAtTime(contact * (0.045 + clampedSpeed * 0.06), now, 0.04);

    this.padGain.gain.setTargetAtTime(0.042, now, 0.5);
  }

  public playTileCleared(comboStreak: number, isDrift: boolean): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    // Slight throttle so clearing wide swaths feels musical, not cluttered
    if (now - this.lastChimeTime < 0.055) return;
    this.lastChimeTime = now;

    const noteIdx = Math.min(
      WINTER_PENTATONIC_HZ.length - 1,
      Math.floor(comboStreak / 2) % WINTER_PENTATONIC_HZ.length
    );
    const freq = WINTER_PENTATONIC_HZ[noteIdx] * (0.992 + Math.random() * 0.016);

    // Warm kalimba / celesta pluck
    const osc = this.ctx.createOscillator();
    const overtone = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const overtoneGain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(freq * 2, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(isDrift ? 0.11 : 0.078, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    overtoneGain.gain.setValueAtTime(0.024, now);
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    osc.connect(gain);
    overtone.connect(overtoneGain);
    overtoneGain.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    overtone.start(now);
    osc.stop(now + 0.3);
    overtone.stop(now + 0.12);
  }

  public playDriftSmash(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    // Soft punchy bass thump
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.16);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.2);

    // Sparkling snow-crystal accent
    const sparkle = this.ctx.createOscillator();
    const sGain = this.ctx.createGain();
    sparkle.type = 'triangle';
    sparkle.frequency.setValueAtTime(1567.98, now + 0.02);
    sparkle.frequency.exponentialRampToValueAtTime(2093, now + 0.12);
    sGain.gain.setValueAtTime(0.055, now + 0.02);
    sGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    sparkle.connect(sGain);
    sGain.connect(this.masterGain);
    sparkle.start(now + 0.02);
    sparkle.stop(now + 0.2);
  }

  public playCabinWarmed(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    // Lush cozy Fmaj9 arpeggio
    const chord = [349.23, 440.0, 523.25, 659.25, 783.99];
    chord.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + i * 0.055;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1800;

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.095, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.58);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.62);
    });
  }

  public playPickup(kind: 'crystal' | 'cocoa'): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = kind === 'cocoa' ? [523.25, 659.25, 783.99] : [783.99, 1046.5, 1318.51];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.045;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.09, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  public playBoost(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.22);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, now);
    filter.frequency.exponentialRampToValueAtTime(980, now + 0.2);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.085, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  public playBlowerPulse(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.14);
    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playUpgradeBuy(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + i * 0.05;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.11, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  public playStageComplete(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const fanfare = [523.25, 659.25, 783.99, 1046.5, 987.77, 1318.51];
    const times = [0, 0.09, 0.18, 0.28, 0.42, 0.54];
    fanfare.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + times[i];
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.52);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  }

  public playShiftOver(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [440, 392, 329.63, 261.63];
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + i * 0.14;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.095, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  public playSquallWind(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.35);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.8);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.9);
  }
}
