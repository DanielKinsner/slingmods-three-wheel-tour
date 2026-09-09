import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameAudio } from './audio';
import { freshSave, newDriver } from './core';

class Param {
  value = 0;
  setTargetAtTime = vi.fn();
  setValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}
class Node {
  gain = new Param();
  frequency = new Param();
  playbackRate = new Param();
  threshold = new Param();
  knee = new Param();
  ratio = new Param();
  attack = new Param();
  release = new Param();
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  onended?: () => void;
  stop = vi.fn(() => this.onended?.());
  getFloatTimeDomainData = vi.fn();
}
class Context {
  currentTime = 0;
  destination = new Node();
  resume = vi.fn(async () => {});
  decodeAudioData = vi.fn(async () => ({ duration: 4 }));
  createGain = () => new Node();
  createDynamicsCompressor = () => new Node();
  createAnalyser = () => new Node();
  createBiquadFilter = () => new Node();
  createBufferSource = () => new Node();
}
let fetcher: ReturnType<typeof vi.fn>;
const loaded = async (audio: GameAudio) => {
  await audio.loading;
  await Promise.all(audio.decoding.values());
};
const urls = () => fetcher.mock.calls.map((call) => String(call[0]));
const settings = () => ({ ...freshSave().settings, sound: true, voice: true, music: false });

beforeEach(() => {
  fetcher = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }));
  vi.stubGlobal('fetch', fetcher);
  vi.stubGlobal('AudioContext', Context);
});
afterEach(() => vi.unstubAllGlobals());

describe('staged cached audio loading', () => {
  it('does not transfer audio before a gesture or preload optional voices/music/coast', async () => {
    const audio = new GameAudio();
    audio.preload();
    expect(fetcher).not.toHaveBeenCalled();
    audio.start();
    await loaded(audio);
    expect(urls()).toContain('./audio/engine-idle.mp3');
    expect(urls().some((url) => /brief-|green|finish|tour-music|coastal-air/.test(url))).toBe(
      false,
    );
    expect(audio.buffers.size).toBe(10);
    expect(audio.pending.size).toBe(0);
  });
  it('loads one requested voice only and exposes the exact playing subtitle', async () => {
    const audio = new GameAudio();
    audio.start();
    audio.update(newDriver(), false, settings());
    await audio.voice('green');
    expect(urls().filter((url) => /green/.test(url))).toHaveLength(1);
    expect(urls().some((url) => /brief-/.test(url))).toBe(false);
    expect(audio.activeSubtitle).toBe('Green flag. Go, go, go!');
    await audio.voice('green');
    expect(urls().filter((url) => /green/.test(url))).toHaveLength(1);
    audio.stopVoice();
    expect(audio.activeSubtitle).toBe('');
  });
  it('only loads optional beds when enabled and caches repeated update requests', async () => {
    const audio = new GameAudio();
    audio.start();
    const s = settings();
    audio.update(newDriver(), false, s);
    await loaded(audio);
    expect(urls().some((url) => /tour-music|coastal-air/.test(url))).toBe(false);
    s.music = true;
    for (let frame = 0; frame < 10; frame++) audio.update(newDriver(), true, s, true, true);
    await loaded(audio);
    expect(urls().filter((url) => /tour-music/.test(url))).toHaveLength(1);
    expect(urls().filter((url) => /coastal-air/.test(url))).toHaveLength(1);
  });
  it('cancels pending radio on mute, and higher-priority finish interrupts lower-priority radio', async () => {
    const audio = new GameAudio();
    audio.start();
    audio.update(newDriver(), true, settings());
    await audio.voice('green');
    const green = audio.voiceNode;
    await audio.voice('finish');
    expect(green?.stop).toHaveBeenCalled();
    expect(audio.activeSubtitle).toBe('Checkered flag. Nice work. Bring it back to the garage.');
    const count = fetcher.mock.calls.length;
    await audio.voice('final-lap');
    expect(fetcher.mock.calls.length).toBe(count);
    audio.update(newDriver(), false, { ...settings(), voice: false });
    expect(audio.activeVoice).toBe(false);
    expect(audio.activeSubtitle).toBe('');
  });
  it('does not refetch missing optional audio every frame and recovers on another gesture', async () => {
    const audio = new GameAudio();
    audio.start();
    await loaded(audio);
    fetcher.mockResolvedValue({ ok: false });
    audio.update(newDriver(), true, settings(), true, true);
    await loaded(audio);
    for (let i = 0; i < 20; i++) audio.update(newDriver(), true, settings(), true, true);
    expect(urls().filter((url) => /coastal-air/.test(url))).toHaveLength(1);
    fetcher.mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    audio.start();
    audio.update(newDriver(), true, settings(), true, true);
    await loaded(audio);
    expect(audio.buffers.has('coastal-air')).toBe(true);
    expect(urls().filter((url) => /coastal-air/.test(url))).toHaveLength(2);
  });
  it('does not begin a stale voice that finished loading after a pause', async () => {
    const audio = new GameAudio();
    audio.start();
    await loaded(audio);
    audio.update(newDriver(), true, settings());
    let finishFetch!: (value: { ok: boolean; arrayBuffer: () => Promise<ArrayBuffer> }) => void;
    fetcher.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishFetch = resolve;
        }),
    );
    const speaking = audio.voice('green');
    audio.silence();
    finishFetch({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    await speaking;
    expect(audio.activeVoice).toBe(false);
    expect(audio.activeSubtitle).toBe('');
  });
  it('contains decoding failures without blocking the other loops or retrying each frame', async () => {
    const audio = new GameAudio();
    audio.start();
    await loaded(audio);
    const ctx = audio.ctx as unknown as Context;
    ctx.decodeAudioData.mockRejectedValueOnce(new Error('Corrupt optional clip'));
    audio.update(newDriver(), true, settings(), true, true);
    await loaded(audio);
    expect(audio.failed.has('coastal-air')).toBe(true);
    expect(audio.loops.has('engine-mid')).toBe(true);
    audio.update(newDriver(), true, settings(), true, true);
    expect(urls().filter((url) => /coastal-air/.test(url))).toHaveLength(1);
  });
});
