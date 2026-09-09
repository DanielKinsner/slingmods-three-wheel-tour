import { clamp, type Driver, type Save } from './core';
import { engineTelemetry } from './audio-model';
type Loop = { source: AudioBufferSourceNode; gain: GainNode };
const IDS = [
  'engine-idle',
  'engine-mid',
  'engine-high',
  'wind',
  'tire',
  'impact',
  'shift',
  'install',
  'tour-music',
  ...Array.from({ length: 8 }, (_, i) => `brief-${i}`),
  'green',
  'final-lap',
  'finish',
];
export class GameAudio {
  ctx: AudioContext | null = null;
  master!: GainNode;
  effects!: GainNode;
  musicGain!: GainNode;
  radio!: GainNode;
  meter!: AnalyserNode;
  meterData = new Float32Array(2048);
  peak = 0;
  buffers = new Map<string, AudioBuffer>();
  loops = new Map<string, Loop>();
  pending = new Map<string, Promise<ArrayBuffer | null>>();
  loading?: Promise<void>;
  voiceNode?: AudioBufferSourceNode;
  voiceEpoch = 0;
  activeVoice = false;
  lastGear = 0;
  lastImpact = -10;
  settings?: Save['settings'];
  preload() {
    for (const id of IDS)
      if (!this.pending.has(id))
        this.pending.set(
          id,
          fetch(`./audio/${id}.mp3`)
            .then((r) => (r.ok ? r.arrayBuffer() : null))
            .catch(() => null),
        );
  }
  start() {
    if (this.ctx) {
      void this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const ctx = (this.ctx = new AudioContext());
      this.master = ctx.createGain();
      this.master.gain.value = 0.55;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.knee.value = 9;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.18;
      this.master.connect(limiter);
      this.meter = ctx.createAnalyser();
      this.meter.fftSize = 2048;
      // Web Audio compression includes makeup gain. Trim after it so the
      // protective bus cannot make the mix louder than the intended balance.
      const outputTrim = ctx.createGain();
      outputTrim.gain.value = 0.5;
      limiter.connect(outputTrim);
      outputTrim.connect(this.meter);
      this.meter.connect(ctx.destination);
      this.effects = ctx.createGain();
      this.effects.connect(this.master);
      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = 0;
      this.musicGain.connect(this.master);
      this.radio = ctx.createGain();
      const radioFilter = ctx.createBiquadFilter();
      radioFilter.type = 'highpass';
      radioFilter.frequency.value = 240;
      this.radio.connect(radioFilter);
      radioFilter.connect(this.master);
      this.preload();
      this.loading = Promise.all(
        IDS.map(async (id) => {
          const bytes = await this.pending.get(id);
          if (!bytes) return;
          try {
            const b = await ctx.decodeAudioData(bytes);
            this.buffers.set(id, b);
            if (
              ['engine-idle', 'engine-mid', 'engine-high', 'wind', 'tire', 'tour-music'].includes(
                id,
              )
            ) {
              const s = ctx.createBufferSource(),
                g = ctx.createGain();
              s.buffer = b;
              s.loop = true;
              // Exported loops are already crossfaded at their sample boundaries.
              s.loopStart = 0;
              s.loopEnd = b.duration;
              g.gain.value = 0;
              s.connect(g);
              g.connect(id === 'tour-music' ? this.musicGain : this.effects);
              s.start();
              this.loops.set(id, { source: s, gain: g });
            }
          } catch {
            /* Failed media never blocks driving. */
          }
        }),
      ).then(() => {});
    } catch {
      this.ctx = null;
    }
  }
  tone(freq: number, duration = 0.12, volume = 0.12, type: OscillatorType = 'sine', at?: number) {
    if (!this.ctx) return;
    const now = at ?? this.ctx.currentTime,
      o = this.ctx.createOscillator(),
      g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(volume, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    o.connect(g);
    g.connect(this.effects);
    o.start(now);
    o.stop(now + duration + 0.03);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  click() {
    this.tone(460, 0.05, 0.045, 'triangle');
  }
  effect(id: string, volume = 0.5) {
    if (!this.ctx || !this.buffers.has(id)) return;
    if (id === 'impact' && this.ctx.currentTime - this.lastImpact < 0.35) return;
    if (id === 'impact') this.lastImpact = this.ctx.currentTime;
    const s = this.ctx.createBufferSource(),
      g = this.ctx.createGain();
    s.buffer = this.buffers.get(id)!;
    g.gain.value = volume;
    s.connect(g);
    g.connect(this.effects);
    s.start();
    s.onended = () => {
      s.disconnect();
      g.disconnect();
    };
  }
  stopVoice() {
    this.voiceEpoch++;
    this.voiceNode?.stop();
    this.voiceNode = undefined;
    this.activeVoice = false;
  }
  async voice(id: string) {
    this.stopVoice();
    const epoch = this.voiceEpoch;
    if (!this.ctx) return;
    await this.loading;
    if (
      epoch !== this.voiceEpoch ||
      !this.settings?.sound ||
      !this.settings?.voice ||
      !this.buffers.has(id)
    )
      return;
    const s = this.ctx.createBufferSource();
    s.buffer = this.buffers.get(id)!;
    s.connect(this.radio);
    this.voiceNode = s;
    this.activeVoice = true;
    s.start();
    s.onended = () => {
      s.disconnect();
      if (this.voiceNode === s) {
        this.voiceNode = undefined;
        this.activeVoice = false;
      }
    };
  }
  update(p: Driver, racing: boolean, s: Save['settings'], audible = true) {
    this.settings = s;
    if (!this.ctx) return;
    this.meter.getFloatTimeDomainData(this.meterData);
    for (const sample of this.meterData) this.peak = Math.max(this.peak, Math.abs(sample));
    const now = this.ctx.currentTime,
      t = engineTelemetry(p.speed);
    this.master.gain.setTargetAtTime(s.sound && audible ? 0.55 : 0, now, 0.045);
    this.effects.gain.setTargetAtTime(s.effectsVolume, now, 0.1);
    this.radio.gain.setTargetAtTime(s.voice ? s.voiceVolume : 0, now, 0.1);
    this.musicGain.gain.setTargetAtTime(
      s.music ? s.musicVolume * (this.activeVoice ? 0.22 : 1) * (racing ? 0.8 : 1) : 0,
      now,
      0.12,
    );
    const set = (id: string, v: number, pitch = 1) => {
      const l = this.loops.get(id);
      if (l) {
        l.gain.gain.setTargetAtTime(v, now, 0.08);
        l.source.playbackRate.setTargetAtTime(pitch, now, 0.07);
      }
    };
    const volume = (racing ? 0.58 : 0) * (this.activeVoice ? 0.7 : 1);
    set('engine-idle', t.idle * volume, clamp(t.rpm / 1200, 0.8, 1.55));
    set('engine-mid', t.mid * volume, clamp(t.rpm / 3300, 0.72, 1.35));
    set('engine-high', t.high * volume, clamp(t.rpm / 5800, 0.8, 1.2));
    set('wind', racing ? Math.pow(p.speed / 70, 2) * 0.22 : 0);
    set('tire', racing && p.drift > 0.1 ? 0.25 : 0);
    set('tour-music', 1);
    if (racing && t.gear > this.lastGear && this.lastGear > 0) this.effect('shift', 0.18);
    this.lastGear = racing ? t.gear : 0;
  }
  silence() {
    this.stopVoice();
    if (this.ctx) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.025);
  }
}
