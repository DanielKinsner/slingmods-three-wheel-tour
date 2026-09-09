import { clamp, type Driver, type Save } from './core';
import { engineMix } from './drivetrain';
type Loop = { source: AudioBufferSourceNode; gain: GainNode };
const CORE_IDS = [
  'road-roll',
  'shoulder-roll',
  'engine-idle',
  'engine-mid',
  'engine-high',
  'wind',
  'tire',
  'impact',
  'shift',
  'install',
];
const LOOP_IDS = new Set([
  'engine-idle',
  'engine-mid',
  'engine-high',
  'wind',
  'tire',
  'road-roll',
  'shoulder-roll',
  'coastal-air',
  'tour-music',
]);
// Exact original generation scripts from AUDIO-PROVENANCE.json, not invented captions.
const RADIO_LINES: Record<string, { text: string; priority: number; cooldown: number }> = {
  green: { text: 'Green flag. Go, go, go!', priority: 2, cooldown: 6 },
  'final-lap': { text: 'Final lap. Make this one count.', priority: 3, cooldown: 12 },
  finish: {
    text: 'Checkered flag. Nice work. Bring it back to the garage.',
    priority: 4,
    cooldown: 8,
  },
};
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
  decoding = new Map<string, Promise<AudioBuffer | null>>();
  failed = new Set<string>();
  loading?: Promise<void>;
  voiceNode?: AudioBufferSourceNode;
  voiceEpoch = 0;
  activeVoice = false;
  activeSubtitle = '';
  private voicePriority = 0;
  private lastVoiceAt = -Infinity;
  private voiceCooldowns = new Map<string, number>();
  lastGear = 0;
  lastImpact = -10;
  settings?: Save['settings'];
  preload() {
    // The shell may call preload(), but no audio transfer begins before a gesture.
    if (!this.ctx) return;
    this.loading = Promise.all(CORE_IDS.map((id) => this.load(id))).then(() => {});
  }
  private load(id: string): Promise<AudioBuffer | null> {
    if (this.buffers.has(id)) return Promise.resolve(this.buffers.get(id)!);
    if (this.decoding.has(id)) return this.decoding.get(id)!;
    const ctx = this.ctx;
    if (!ctx || this.failed.has(id)) return Promise.resolve(null);
    const bytes = fetch(
      `./audio/${id}.${['road-roll', 'shoulder-roll', 'coastal-air'].includes(id) ? 'wav' : 'mp3'}`,
    )
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null);
    this.pending.set(id, bytes);
    const decoded = bytes.then(async (data) => {
      try {
        if (!data) throw new Error('Missing audio');
        const buffer = await ctx.decodeAudioData(data);
        if (this.ctx !== ctx) return null;
        this.buffers.set(id, buffer);
        if (LOOP_IDS.has(id)) {
          const source = ctx.createBufferSource(),
            gain = ctx.createGain();
          source.buffer = buffer;
          source.loop = true;
          source.loopStart = 0;
          source.loopEnd = buffer.duration;
          gain.gain.value = 0;
          source.connect(gain);
          gain.connect(id === 'tour-music' ? this.musicGain : this.effects);
          source.start();
          this.loops.set(id, { source, gain });
        }
        return buffer;
      } catch {
        this.failed.add(id);
        return null;
      } finally {
        // decodeAudioData consumes its ArrayBuffer. Keep only decoded/cache status.
        this.pending.delete(id);
        this.decoding.delete(id);
      }
    });
    this.decoding.set(id, decoded);
    return decoded;
  }
  start() {
    if (this.ctx) {
      void this.ctx.resume().catch(() => {});
      // Retry missing media only after a new gesture, never once per render frame.
      this.failed.clear();
      this.preload();
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
      void ctx.resume().catch(() => {});
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
    try {
      this.voiceNode?.stop();
    } catch {
      /* Already stopped or interrupted context. */
    }
    this.voiceNode = undefined;
    this.activeVoice = false;
    this.activeSubtitle = '';
    this.voicePriority = 0;
  }
  async voice(id: string) {
    if (!this.ctx || !this.settings?.sound || !this.settings?.voice) return;
    if (!RADIO_LINES[id] && !/^brief-[0-7]$/.test(id)) return;
    const cue = RADIO_LINES[id],
      priority = cue?.priority ?? 1,
      now = this.ctx.currentTime;
    if (now - (this.voiceCooldowns.get(id) ?? -Infinity) < (cue?.cooldown ?? 2)) return;
    if (this.voicePriority >= priority || (now - this.lastVoiceAt < 3 && priority < 3)) return;
    this.stopVoice();
    this.voicePriority = priority;
    this.lastVoiceAt = now;
    this.voiceCooldowns.set(id, now);
    const epoch = this.voiceEpoch;
    const buffer = await this.load(id);
    if (epoch !== this.voiceEpoch || !this.settings?.sound || !this.settings?.voice || !buffer) {
      if (epoch === this.voiceEpoch) this.voicePriority = 0;
      return;
    }
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    s.connect(this.radio);
    this.voiceNode = s;
    this.activeVoice = true;
    this.activeSubtitle = cue?.text ?? '';
    s.start();
    s.onended = () => {
      s.disconnect();
      if (this.voiceNode === s) {
        this.voiceNode = undefined;
        this.activeVoice = false;
        this.activeSubtitle = '';
        this.voicePriority = 0;
      }
    };
  }
  update(p: Driver, racing: boolean, s: Save['settings'], audible = true, coastal = false) {
    this.settings = s;
    if (!this.ctx) return;
    if ((!s.sound || !s.voice || !audible) && this.voicePriority) this.stopVoice();
    if (s.sound && s.music && audible) void this.load('tour-music');
    if (s.sound && coastal && audible) void this.load('coastal-air');
    this.meter.getFloatTimeDomainData(this.meterData);
    for (const sample of this.meterData) this.peak = Math.max(this.peak, Math.abs(sample));
    const now = this.ctx.currentTime,
      t = engineMix(p.telemetry);
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
    const volume =
      (racing
        ? 0.48 * (0.55 + 0.45 * p.telemetry.load) * (p.telemetry.shiftRemaining > 0 ? 0.65 : 1)
        : 0) * (this.activeVoice ? 0.7 : 1);
    set('engine-idle', t.idle * volume, clamp(t.rpm / 1200, 0.8, 1.55));
    set('engine-mid', t.mid * volume, clamp(t.rpm / 3300, 0.72, 1.35));
    set('engine-high', t.high * volume, clamp(t.rpm / 5800, 0.8, 1.2));
    set('wind', racing ? Math.pow(Math.abs(p.speed) / 70, 2) * 0.22 : 0);
    set(
      'tire',
      racing
        ? Math.min(0.22, Math.abs(p.telemetry.slipRatio) * 0.1 + (p.drift > 0.1 ? 0.12 : 0))
        : 0,
    );
    set(
      'road-roll',
      racing && p.telemetry.surface === 'road'
        ? Math.min(0.16, (Math.abs(p.speed) / 70) * 0.16)
        : 0,
    );
    set(
      'shoulder-roll',
      racing && p.telemetry.surface === 'shoulder'
        ? Math.min(0.18, (Math.abs(p.speed) / 50) * 0.18)
        : 0,
    );
    set('coastal-air', coastal && audible ? 0.075 : 0);
    set('tour-music', 1);
    if (racing && p.telemetry.shiftSerial !== this.lastGear) this.effect('shift', 0.14);
    this.lastGear = p.telemetry.shiftSerial;
  }
  silence() {
    this.stopVoice();
    if (this.ctx) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.025);
  }
}
