import { DriftAttack, RouteTokens, driftKey, type PlayMode } from './playground';
import { loadMiamiAssets } from './miami';
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-700.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-800.css';
import './style.css';
import { World, Circuit, loadBrand } from './world';
import { TRACKS, CHAPTERS, PAINTS, RIVALS, UPGRADES } from './content';
import {
  freshSave,
  sanitizeSave,
  buyUpgrade,
  rewardRace,
  formatTime,
  newDriver,
  clamp,
  steeringToLane,
  type Save,
  type UpgradeId,
} from './core';
import { GameAudio } from './audio';
import { engineMix, shift } from './drivetrain';
import { FixedClock, simulateVehicle, aiInput, spawnVehicle, positionOf } from './simulation';
import { RaceProgress, makeGates, commitRace, RULES_VERSION } from './race-rules';
import { DIFFICULTIES, rivalTarget, bestKey, type Difficulty } from './difficulty';
import { PRODUCTS, stageProduct, type Product } from './catalog';
import { RGB_COLORS } from './lighting';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const app = $('app');
const canvas = $<HTMLCanvasElement>('world');
const audio = new GameAudio();
const world = new World(canvas);
let save: Save = freshSave(),
  storageOK = true;
const SAVE_KEY = 'slingmods-tour-v1';
try {
  save = sanitizeSave(JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'));
} catch {
  storageOK = false;
}
if (matchMedia('(prefers-reduced-motion: reduce)').matches) save.settings.motion = false;
function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    storageOK = true;
  } catch {
    storageOK = false;
  }
}
let screen = 'home',
  tab = 'tour',
  selected = 1,
  player = newDriver(),
  raceChapter: number | null = null,
  laps = 1,
  countdown = 3.5,
  raceTime = 0,
  paused = false,
  finish = false,
  hudTick = 0,
  currentLap = 1,
  lapStart = 0,
  bestLap = Infinity,
  notice = '',
  noticeTime = 0,
  finishPlace = 6;
let opponents = RIVALS.map((name, i) => ({
  ...newDriver(),
  name,
  distance: 10 + i * 7,
  lane: i % 2 ? -3.3 : 3.3,
  speed: 0,
  skill: 1 - i * 0.032,
  done: 0,
}));
const clock = new FixedClock();
let raceId = '',
  progress: RaceProgress[] = [];
let raceDifficulty: Difficulty = 'easy';
let raceNight = false;
let garageTab = 'build';
let playMode: PlayMode = 'race';
let driftAttack = new DriftAttack();
let routeTokens: RouteTokens | undefined;
function loadTrack(night = save.settings.night && [1, 4, 5].includes(selected)) {
  world.rgb = save.rgb;
  world.rgbCycle = save.rgbCycle;
  world.load(TRACKS[selected], PAINTS[save.paint].color, night);
  world.customize(save.rims, save.exhaust);
}
function difficultyPicker() {
  return `<div class="difficulty-picker" role="group" aria-label="Race difficulty">${(['easy', 'hard'] as const).map((d) => `<button data-difficulty="${d}" aria-pressed="${save.settings.difficulty === d}"><b>${DIFFICULTIES[d].name}</b><small>${d === 'hard' ? (playMode === 'race' ? '+30% RACE PURSE' : 'FULL CONTROL') : 'GRIP ASSIST'}</small></button>`).join('')}</div><p class="mode-description">${DIFFICULTIES[save.settings.difficulty].description}</p>`;
}
function nightPicker() {
  return [1, 4, 5].includes(selected)
    ? `<div class="time-picker" role="group" aria-label="Coastal lighting"><button data-night="day" aria-pressed="${!world.night}">SUNSET</button><button data-night="night" aria-pressed="${world.night}">AFTER DARK <span>↗</span></button></div>`
    : '';
}
function personalBest() {
  return save.bests[
    bestKey(TRACKS[selected].id, laps, save.settings.difficulty, world.night) + '-' + RULES_VERSION
  ];
}
let lastReward: ReturnType<typeof rewardRace> | null = null;
const taps = new Map<string, number>();
const held = (k: string) => keys.has(k) || (taps.get(k) || 0) > performance.now();
const keys = new Set<string>();
const touch = new Set<string>();
const touchHeld = (k: string) => touch.has(k) || (taps.get('touch-' + k) || 0) > performance.now();
let lastFrame = performance.now();
let lastFrameMs = 0;
const measuredFrames: number[] = [];
function frameProfile() {
  const sorted = [...measuredFrames].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] || 0;
  return {
    samples: sorted.length,
    p50: at(0.5),
    p95: at(0.95),
    p99: at(0.99),
    max: at(1),
    over33ms: sorted.filter((x) => x > 33.34).length,
  };
}
let lastCount = 4;
const circuits = TRACKS.map((t) => new Circuit(t));
const icons = {
  arrow: '<svg viewBox="0 0 24 24"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>',
  sound:
    '<svg viewBox="0 0 24 24"><path d="m4 9 4 0 5-4v14l-5-4H4V9Zm12-1q5 4 0 8m3-11q7 7 0 14"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><path d="m10 3 4 0 1 3 3 1 3 3-2 3 0 3-3 3-3-1-3 3-3-2-1-3-3-1 0-4 3-1 1-3 3-1Z"/><circle cx="12" cy="12" r="3"/></svg>',
  expand: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5m6 0h5v5M4 15v5h5m6 0h5v-5"/></svg>',
};
function logo() {
  return `<button class="brand" data-action="home" aria-label="SlingMods home"><span><img src="./slingmods-logo.png" width="180" height="43" alt="SlingMods.com"><small>THREE-WHEEL TOUR</small></span></button>`;
}
function header(active = '') {
  return `<header>${logo()}<nav aria-label="Main navigation"><button class="nav-button ${active === 'tour' ? 'active' : ''}" data-action="tour">THE TOUR</button><button class="nav-button ${active === 'garage' ? 'active' : ''}" data-action="garage">GARAGE</button><button class="nav-button" data-action="help">HOW TO PLAY</button></nav><div class="header-right"><span class="wallet"><i>◈</i> ${save.credits.toLocaleString()} <small>CR</small></span><button class="icon-button" data-action="sound" aria-label="${save.settings.sound ? 'Mute' : 'Enable'} sound">${icons.sound}<span class="sound-dot ${save.settings.sound ? 'on' : ''}"></span></button><button class="icon-button" data-action="settings" aria-label="Settings">${icons.gear}</button><button class="icon-button full-button" data-action="fullscreen" aria-label="Fullscreen">${icons.expand}</button></div></header>`;
}
function trackMap(i: number, cls = '') {
  return `<svg class="track-outline ${cls}" viewBox="0 0 150 150" aria-hidden="true"><path d="${circuits[i].svg()}"/></svg>`;
}
function home() {
  audio.stopVoice();
  screen = 'home';
  paused = false;
  finish = false;
  tab = 'tour';
  loadTrack();
  renderHome();
}
function renderHome() {
  const chapter = Math.min(save.chapter, 7),
    c = CHAPTERS[chapter];
  app.innerHTML = `<div class="menu-screen">${header('tour')}<main class="home-main"><div class="hero-copy"><div class="eyebrow"><span class="live-dot"></span> THE OPEN ROAD IS CALLING</div><h1>THREE WHEELS.<br>SIX STOPS.<br><em>YOUR STORY.</em></h1><p class="hero-description">Chase the apex. Build your ride.<br>Earn your place on the SlingMods tour.</p><div class="hero-actions"><button class="primary" data-action="campaign">${save.chapter === 8 ? 'TOUR COMPLETE' : save.chapter ? 'CONTINUE THE TOUR' : 'START YOUR STORY'} ${icons.arrow}</button><button class="text-button" data-action="quick">QUICK RACE <span>↗</span></button></div><div class="campaign-progress"><span>${save.chapter === 8 ? 'CHAMPION' : `CHAPTER ${String(chapter + 1).padStart(2, '0')} / 08`}</span><div>${CHAPTERS.map((_, i) => `<i class="${i < save.chapter ? 'done' : i === save.chapter ? 'current' : ''}"></i>`).join('')}</div><small>${save.chapter === 8 ? 'The road is yours.' : c.title}</small></div></div><div class="vehicle-tag"><span class="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span><strong>BUILT TO STAND OUT.</strong><span>OPEN COCKPIT / THREE WHEELS / ZERO LIMITS</span></div><div class="scene-label"><span>LIVE FROM</span><strong>${TRACKS[selected].location}</strong><small>${TRACKS[selected].state}</small>${nightPicker()}</div></main><section class="destinations" aria-label="Choose a destination"><div class="section-kicker"><span>THE TOUR ROUTE</span><small>06 DESTINATIONS · ONE OPEN ROAD</small></div><div class="track-list">${TRACKS.map((t, i) => `<button class="track-card ${selected === i ? 'selected' : ''}" data-track="${i}" style="--track-color:${t.color}" aria-label="Preview ${t.location}" aria-pressed="${selected === i}"><span class="track-number">0${i + 1}</span>${trackMap(i)}<span class="track-copy"><small>${t.state}</small><strong>${t.location}</strong><span>${t.character}</span></span><span class="track-arrow">↗</span></button>`).join('')}</div></section><footer><span>SPONSORED BY <b>SLINGMODS.COM</b></span><span class="footer-note">PLAYGROUND / v0.5 PREVIEW</span><span>${storageOK ? 'PROGRESS SAVED ON THIS DEVICE' : 'SESSION ONLY · STORAGE UNAVAILABLE'}</span></footer></div>`;
}
function briefing(quick = false) {
  screen = 'briefing';
  tab = quick ? 'quick' : 'tour';
  const c = CHAPTERS[Math.min(save.chapter, 7)];
  audio.stopVoice();
  if (!quick) {
    selected = c.track;
    playMode = 'race';
  }
  loadTrack(quick ? save.settings.night && [1, 4, 5].includes(selected) : save.chapter === 3);
  if (!quick) void audio.voice(`brief-${Math.min(save.chapter, 7)}`);
  const t = TRACKS[selected],
    solo = quick && playMode !== 'race';
  const description =
    playMode === 'free'
      ? 'Your build. Your pace. Drive this closed course without rivals or a clock. Collect all 12 gold route tokens to top up your boost. Tokens reset each session; no campaign credits.'
      : playMode === 'drift'
        ? '90 seconds. Carry speed through a controlled slide, then straighten for 1.15 seconds to bank. Build up to a 5× combo. Impacts, off-road driving, reversing or spins lose the unbanked combo.'
        : `${t.subtitle} Six riders. One finish line. Earn credits and chase your personal best.`;
  const best = save.driftBests[driftKey(t.id, save.settings.difficulty, world.night)];
  app.innerHTML = `<div class="menu-screen sub-screen">${header('tour')}<main class="briefing">
    <button class="back" data-action="home">← BACK TO THE TOUR</button><div class="eyebrow">${quick ? 'PICK YOUR PLAYGROUND' : `CHAPTER ${String(Math.min(save.chapter + 1, 8)).padStart(2, '0')} / 08`}</div>
    <h1>${quick ? t.name : c.title}</h1><div class="location-line">${t.location.toUpperCase()} <span>/</span> ${t.state}</div>
    ${
      quick
        ? `<div class="play-modes" role="group" aria-label="Play mode">${(['race', 'drift', 'free'] as PlayMode[]).map((mode, i) => `<button data-mode="${mode}" aria-pressed="${playMode === mode}"><b>${['QUICK RACE', 'DRIFT ATTACK', 'FREE RIDE'][i]}</b><small>${['CHASE THE PODIUM', '90 SECONDS / BIG COMBOS', 'NO CLOCK / ROUTE TOKENS'][i]}</small></button>`).join('')}</div>
    <p class="brief-text">${description}</p><div class="quick-tracks">${TRACKS.map((track, i) => `<button class="chip ${selected === i ? 'selected' : ''}" data-quicktrack="${i}">${track.location}${i === 5 ? ' / NEW' : ''}</button>`).join('')}</div>
    ${!solo ? `<label class="lap-select">RACE LENGTH <select id="laps" aria-label="Race length"><option value="1" ${laps === 1 ? 'selected' : ''}>1 lap · Sprint</option><option value="2" ${laps === 2 ? 'selected' : ''}>2 laps · Main event</option></select></label>` : ''}`
        : `<div class="radio-message"><span class="radio-avatar">${c.contact[0]}</span><div><span class="eyebrow">${c.contact}</span><p>${c.text}</p></div></div>`
    }
    ${difficultyPicker()}${quick ? nightPicker() : ''}<div class="race-detail"><div><small>OBJECTIVE</small><strong>${!quick ? c.goal : playMode === 'free' ? 'Explore the course' : playMode === 'drift' ? 'BANK YOUR BEST SCORE' : 'Race for the podium'}</strong></div><div><small>${playMode === 'free' ? 'SESSION CHALLENGE' : quick ? 'PERSONAL BEST' : 'SPONSOR BONUS'}</small><strong>${playMode === 'free' ? '12 BOOST TOKENS' : playMode === 'drift' ? (best ? best.toLocaleString() + ' PTS' : 'SET YOUR FIRST SCORE') : quick ? (personalBest() ? formatTime(personalBest()) : 'SET YOUR FIRST TIME') : `◈ ${c.reward.toLocaleString()} CR`}</strong></div></div>
    <button class="primary" data-action="race">${playMode === 'free' ? 'EXPLORE THE COURSE' : playMode === 'drift' ? 'START DRIFT ATTACK' : 'LET’S RIDE'} ${icons.arrow}</button>
    <div class="brief-controls"><kbd>A</kbd><kbd>D</kbd> STEER <span>·</span> <kbd>SPACE</kbd> DRIFT <span>·</span> <kbd>SHIFT</kbd> BOOST${playMode === 'free' ? ' <span>·</span> W / GAS TO ACCELERATE' : ''}</div>
  </main><div class="brief-map">${trackMap(selected)}<span>${(circuits[selected].length / 1000).toFixed(2)} KM / LAP</span></div></div>`;
}

function productTile(p: Product) {
  return `<a class="product-tile" href="${p.url}" target="_blank" rel="noopener noreferrer"><div class="product-photo"><img src="${p.image}" alt="${p.shortName}" loading="lazy"></div><small>${p.brand}</small><h3>${p.shortName}</h3><span>${p.fitment}</span><b>VIEW ON SLINGMODS ↗</b></a>`;
}
function garage() {
  audio.stopVoice();
  screen = 'garage';
  paused = false;
  finish = false;
  world.rgb = save.rgb;
  world.rgbCycle = save.rgbCycle;
  world.repaint(PAINTS[save.paint].color);
  world.customize(save.rims, save.exhaust);
  app.innerHTML = `<div class="menu-screen garage-screen">${header('garage')}<main class="garage-main"><div class="garage-heading"><button class="back" data-action="home">← BACK TO THE TOUR</button><div class="eyebrow">SLINGMODS / PERFORMANCE STUDIO</div><h1>BUILT<br><em>BY YOU.</em></h1><p>Real parts. Your signature.</p><button class="night-drive-link" data-action="night-drive">TAKE IT OUT AFTER DARK ↗</button></div><section class="garage-shop" aria-label="Vehicle upgrades"><div class="garage-tabs" role="group" aria-label="Garage panels"><button data-garagetab="build" aria-pressed="${garageTab === 'build'}">YOUR BUILD <span>${save.upgrades.power + save.upgrades.grip + save.upgrades.boost}/9</span></button><button data-garagetab="catalog" aria-pressed="${garageTab === 'catalog'}">REAL PARTS <span>06</span></button></div>${
    garageTab === 'catalog'
      ? `<div class="catalog-grid">${PRODUCTS.map(productTile).join('')}</div>`
      : UPGRADES.map((u) => {
          const level = save.upgrades[u.id],
            cost = u.prices[level],
            max = level === 3,
            p = stageProduct(u.id, Math.min(level, 2));
          return `<article class="upgrade"><div class="upgrade-head"><span class="upgrade-icon">${u.icon}</span><div><h2>${u.name}</h2><small>${max ? 'BUILD COMPLETE' : `STAGE ${level + 1} / 3`}</small></div><span class="level">${[0, 1, 2].map((i) => `<i class="${i < level ? 'filled' : ''}"></i>`).join('')}</span></div>${p ? `<a class="featured-part" href="${p.url}" target="_blank" rel="noopener noreferrer"><img src="${p.image}" alt="${p.shortName}"><span><small>${p.brand}</small><strong>${p.shortName}</strong><em>${p.fitment}</em><b>REAL PRODUCT ↗</b></span></a>` : `<p>${u.id === 'power' ? 'Crew calibration · a fictional game upgrade.' : u.description}</p>`}<button class="upgrade-buy" data-upgrade="${u.id}" ${max || save.credits < cost ? 'disabled' : ''}><span>${max ? 'INSTALLED' : `INSTALL STAGE ${level + 1}`}</span><strong>${max ? '✓' : `◈ ${cost.toLocaleString()} CR`}</strong></button></article>`;
        }).join('')
  }<div class="garage-note">Credits and performance boosts are game values. Photos and links feature actual SlingMods products. Check each product page for current fitment, requirements, and pricing.</div></section><div class="vehicle-customization"><div class="photo-tools"><button data-action="photo">SAVE BUILD PHOTO ↗</button><select aria-label="Studio lighting" data-studio><option value="studio" ${world.studioMood === 'studio' ? 'selected' : ''}>STUDIO LIGHT</option><option value="warm" ${world.studioMood === 'warm' ? 'selected' : ''}>WARM LIGHT</option><option value="night" ${world.studioMood === 'night' ? 'selected' : ''}>RGB NIGHT</option></select></div><div class="owner-spec"><label>TRANSMISSION<select data-owner="transmission"><option value="automatic" ${save.transmission === 'automatic' ? 'selected' : ''}>Automatic</option><option value="manual" ${save.transmission === 'manual' ? 'selected' : ''}>Manual · Q / E</option></select></label><label>WHEEL FINISH<select data-owner="rims">${['graphite', 'silver', 'bronze'].map((v) => `<option ${save.rims === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label><label>EXHAUST FINISH<select data-owner="exhaust">${['standard', 'sport'].map((v) => `<option ${save.exhaust === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div><div class="vehicle-views" role="group" aria-label="Vehicle views"><button aria-pressed="${world.vehicleView === 0}" data-view="0">FRONT ¾</button><button aria-pressed="${world.vehicleView === 0.9}" data-view="0.9">SIDE</button><button aria-pressed="${world.vehicleView === 2.1}" data-view="2.1">REAR ¾</button></div><div class="paint-picker"><span class="eyebrow">BODY COLOR</span><div>${PAINTS.map((p, i) => `<button aria-label="${p.name}" aria-pressed="${save.paint === i}" class="swatch ${save.paint === i ? 'selected' : ''}" data-paint="${i}" style="--paint:${p.color}"></button>`).join('')}</div><span>${PAINTS[save.paint].name}</span></div><div class="rgb-picker"><span class="eyebrow">RGB UNDERGLOW <small>FREE IN GAME</small></span><div>${RGB_COLORS.map((p, i) => `<button aria-label="${p.name} underglow" aria-pressed="${save.rgb === i && !save.rgbCycle}" data-rgb="${i}" style="--paint:${p.color}" class="swatch ${save.rgb === i && !save.rgbCycle ? 'selected' : ''}"></button>`).join('')}<button class="rgb-cycle" data-action="rgb-cycle" aria-pressed="${save.rgbCycle}">SPECTRUM</button></div><a href="${PRODUCTS.find((p) => p.id === 'rgb')!.url}" target="_blank" rel="noopener noreferrer">INSPIRED BY TRICLED · SHOP THE KIT ↗</a></div></div></main></div>`;
}
function modal(type: 'help' | 'settings' | 'pause' | 'reset') {
  if (screen === 'race') paused = true;
  audio.silence();
  const old = $('overlay');
  old?.remove();
  const node = document.createElement('div');
  node.id = 'overlay';
  node.className = 'overlay';
  const title =
    type === 'help'
      ? 'OWN THE NEXT CORNER.'
      : type === 'settings'
        ? 'YOUR RIDE. YOUR RULES.'
        : type === 'reset'
          ? 'START FRESH?'
          : 'TAKE A BREATHER.';
  node.innerHTML = `<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><button class="close" data-action="close" aria-label="Close dialog">×</button><span class="eyebrow">THREE-WHEEL TOUR</span><h2 id="dialog-title">${title}</h2>${type === 'help' ? `<p>Finish races to earn credits. Install garage upgrades and work your way through eight chapters across the original four destinations, plus Miami and Harbor Run bonus circuits. Quick Race also offers Drift Attack and Free Ride. In Free Ride, use W / GAS to accelerate; collect tokens for a session boost refill.</p><div class="control-grid"><span><kbd>A</kbd> <kbd>D</kbd> / <kbd>←</kbd> <kbd>→</kbd></span><strong>Steer left / right</strong><span><kbd>S</kbd> / <kbd>↓</kbd></span><strong>Brake for tight corners</strong><span><kbd>SPACE</kbd></span><strong>Hold while steering to drift</strong><span><kbd>SHIFT</kbd></span><strong>Hold for boost</strong><span><kbd>W</kbd> / <kbd>↑</kbd></span><strong>Accelerate (auto-accelerate off)</strong><span><kbd>ESC</kbd> / <kbd>P</kbd></span><strong>Pause the race</strong><span><kbd>R</kbd></span><strong>Recover to last checkpoint · C changes camera · Q/E manual gears</strong></div><p class="tip">Auto-accelerate is on by default. Follow a rival closely to draft and refill boost. Drifting earns style credits. Grass slows you down.</p><p class="muted">Touch: on-screen steering, brake, drift, and boost. Standard gamepad: left stick, LT brake, A drift, RB boost, RT throttle, Menu pause.</p><button class="primary" data-action="close">GOT IT ${icons.arrow}</button>` : type === 'settings' ? `<div class="settings-list"><label><span>Master audio</span><input type="checkbox" data-setting="sound" ${save.settings.sound ? 'checked' : ''}></label><label><span>Original driving soundtrack</span><input type="checkbox" data-setting="music" ${save.settings.music ? 'checked' : ''}></label><label><span>Crew radio</span><input type="checkbox" data-setting="voice" ${save.settings.voice ? 'checked' : ''}></label>${(['effectsVolume', 'musicVolume', 'voiceVolume'] as const).map((k, i) => `<label><span>${['Engine & effects level', 'Music level', 'Radio level'][i]}</span><input type="range" min="0" max="1" step="0.05" value="${save.settings[k]}" data-setting="${k}" aria-label="${['Engine and effects volume', 'Music volume', 'Radio volume'][i]}"></label>`).join('')}<label><span>Auto-accelerate</span><input type="checkbox" data-setting="autoThrottle" ${save.settings.autoThrottle ? 'checked' : ''}></label><label><span>Camera motion & speed effects</span><input type="checkbox" data-setting="motion" ${save.settings.motion ? 'checked' : ''}></label><label><span>Graphics quality</span><select data-setting="quality"><option value="auto" ${save.settings.quality === 'auto' ? 'selected' : ''}>Adaptive</option><option value="high" ${save.settings.quality === 'high' ? 'selected' : ''}>High</option><option value="low" ${save.settings.quality === 'low' ? 'selected' : ''}>Performance</option></select></label></div><button class="text-button" data-action="help">HOW TO PLAY ↗</button><p class="muted">Progress stays in this browser. No account, tracking, or real-money purchases. Renderer: ${world.backend}.</p><button class="danger-link" data-action="reset-dialog">Reset saved progress</button>` : type === 'reset' ? `<p>This removes your tour progress, credits, upgrades, and best times from this browser. It cannot be undone.</p><button class="primary" data-action="reset-confirm">RESET PROGRESS</button><button class="text-button" data-action="close">KEEP MY BUILD</button>` : `<p>The road will still be here.</p><button class="primary" data-action="close">BACK TO THE RACE ${icons.arrow}</button><button class="secondary" data-action="restart">RESTART RACE</button><button class="text-button" data-action="home">LEAVE RACE</button>`}</section>`;
  app.append(node);
  node.querySelector<HTMLElement>('button')?.focus();
}
function closeModal() {
  $('overlay')?.remove();
  if (screen === 'race') {
    paused = false;
    lastFrame = performance.now();
    clock.reset();
    audio.start();
  }
  keys.clear();
  taps.clear();
  touch.clear();
}
function startRace(restart = false) {
  audio.start();
  audio.stopVoice();
  if (tab === 'tour') playMode = 'race';
  if (!restart) {
    raceDifficulty = save.settings.difficulty;
    raceNight = world.night;
  }
  if (!restart) {
    raceChapter = tab === 'tour' && save.chapter < 8 ? save.chapter : null;
    laps =
      raceChapter !== null
        ? CHAPTERS[raceChapter].laps
        : Number($<HTMLSelectElement>('laps')?.value || laps);
  }
  loadTrack(raceNight);
  screen = 'race';
  paused = false;
  finish = false;
  lastReward = null;
  player = newDriver();
  player.lane = -2.5;
  player.boost = 100 + save.upgrades.boost * 24;
  opponents = RIVALS.map((name, i) => ({
    ...newDriver(),
    name,
    distance: 11 + i * 7,
    lane: i % 2 ? -3 : 3,
    speed: 0,
    skill: 1 - i * 0.036,
    done: 0,
  }));
  if (playMode !== 'race') opponents = [];
  countdown = playMode === 'free' ? 0 : 3.5;
  driftAttack = new DriftAttack();
  routeTokens = playMode === 'free' ? RouteTokens.forCircuit(world.circuit) : undefined;
  world.setTokens(routeTokens);
  world.showCheckpoints = playMode === 'race';
  lastCount = 4;
  raceTime = 0;
  currentLap = 1;
  lapStart = 0;
  bestLap = Infinity;
  notice = '';
  noticeTime = 0;
  clock.reset();
  raceId = crypto.randomUUID();
  progress = [player, ...opponents].map(
    () =>
      new RaceProgress(
        makeGates(world.circuit),
        playMode === 'race' ? laps : 999999,
        world.circuit.length,
      ),
  );
  spawnVehicle(player, world.circuit, 0, -2.5);
  opponents.forEach((o, i) => spawnVehicle(o, world.circuit, 11 + i * 7, i % 2 ? -3 : 3));
  keys.clear();
  taps.clear();
  touch.clear();
  renderHUD();
  if (playMode === 'free') notify('FREE RIDE · W / GAS TO ACCELERATE · COLLECT 12 TOKENS', 5);
}
function renderHUD() {
  app.innerHTML = `<div class="race-screen"><div class="race-top"><div class="race-position"><span id="position">${playMode === 'race' ? '6' : playMode === 'drift' ? '1×' : '0'}</span><small>${playMode === 'race' ? '/ 6<br>POSITION' : playMode === 'drift' ? 'COMBO' : '/ 12<br>TOKENS'}</small></div><div class="race-event"><span class="eyebrow">${raceChapter !== null ? `CHAPTER ${raceChapter + 1} · ${CHAPTERS[raceChapter].goal}` : playMode === 'drift' ? 'DRIFT ATTACK' : playMode === 'free' ? 'FREE RIDE' : 'QUICK RACE'} · ${raceDifficulty.toUpperCase()}${raceNight ? ' / NIGHT' : ''}</span><strong>${TRACKS[selected].name}</strong><span id="lap">LAP 1 / ${laps}</span></div><div class="timing"><strong id="time">0:00.00</strong><span>${playMode === 'free' ? 'TAKE YOUR TIME' : playMode === 'drift' ? 'TIME LEFT' : 'RACE TIME'}</span><button class="icon-button" data-action="pause" aria-label="Pause race">Ⅱ</button></div></div><div id="leaderboard" class="leaderboard"></div><div id="race-notice" class="race-notice"></div><div id="crew-subtitle" class="crew-subtitle" aria-live="polite"></div><div id="countdown" class="countdown">3</div><div class="race-bottom"><div class="minimap-wrap"><canvas id="minimap" width="240" height="220" aria-label="Circuit map with racers"></canvas><span>${TRACKS[selected].location.toUpperCase()}</span></div><div class="race-tips"><span><kbd>A</kbd><kbd>D</kbd> STEER</span><span><kbd>SPACE</kbd> DRIFT</span><span><kbd>SHIFT</kbd> BOOST</span><span><kbd>S</kbd> BRAKE</span><span><kbd>R</kbd> RECOVER</span><span><kbd>C</kbd> CAMERA</span><span><kbd>Q</kbd><kbd>E</kbd> SHIFT</span></div><div class="speedometer"><div class="speed-read"><span id="speed">0</span><small>MPH<br><b id="gear">N</b></small></div><div class="tachometer" aria-label="Engine RPM"><i id="rpm-fill"></i></div><div class="rpm-label"><span id="rpm-value">1200 RPM</span><span>REDLINE 8500</span></div><div class="boost-label"><span>ϟ TOUR BOOST</span><strong id="boost-value">100%</strong></div><div class="boost-bar"><i id="boost-bar"></i></div><div class="style-line"><span id="style">0 STYLE</span><span id="drive-state">READY TO RIDE</span></div></div></div><div class="touch-controls"><div><button data-touch="left" aria-label="Steer left">◀</button><button data-touch="right" aria-label="Steer right">▶</button></div><div><button data-action="camera" aria-label="Change camera">VIEW</button><button data-action="recover">RESET</button>${save.transmission === 'manual' ? '<button data-action="shift-down">− GEAR</button><button data-action="shift-up">+ GEAR</button>' : ''}<button data-touch="throttle" class="touch-throttle" aria-label="Accelerate">GAS</button><button data-touch="brake">BRAKE</button><button data-touch="drift">DRIFT</button><button data-touch="boost" class="touch-boost">ϟ BOOST</button></div></div><div class="speed-vignette" id="speed-vignette"></div></div>`;
  setupTouch();
  updateHud();
}
function rank() {
  return [
    { name: 'YOU', distance: player.distance, done: progress[0]?.finishedAt || 0 },
    ...opponents,
  ]
    .map((r, i) => ({
      ...r,
      valid: progress[i]
        ? progress[i].validProgress +
          clamp(r.distance - progress[i].validProgress, 0, world.circuit.length / 32)
        : r.distance,
    }))
    .sort((a, b) =>
      a.done && b.done ? a.done - b.done : a.done ? -1 : b.done ? 1 : b.valid - a.valid,
    );
}
function notify(msg: string, time = 2) {
  notice = msg;
  noticeTime = time;
}
function updateHud() {
  if (screen !== 'race') return;
  const position = rank().findIndex((r) => r.name === 'YOU') + 1;
  $('position').textContent =
    playMode === 'race'
      ? String(position)
      : playMode === 'drift'
        ? `${driftAttack.combo}×`
        : String(routeTokens?.collected.size || 0);
  $('crew-subtitle').textContent = audio.activeSubtitle;
  $('time').textContent =
    playMode === 'free' ? '∞' : formatTime(playMode === 'drift' ? driftAttack.remaining : raceTime);
  $('speed').textContent = String(Math.round(Math.abs(player.speed) * 2.237));
  const telemetry = engineMix(player.telemetry);
  $('gear').textContent = telemetry.gear < 0 ? 'R' : String(telemetry.gear);
  $('rpm-fill').style.transform = `scaleX(${telemetry.redline})`;
  $('rpm-value').textContent = `${Math.round(telemetry.rpm / 100) * 100} RPM`;
  $('rpm-fill').classList.toggle('redline', telemetry.redline > 0.88);
  $('lap').textContent =
    playMode === 'race'
      ? `LAP ${Math.min(laps, currentLap)} / ${laps}`
      : playMode === 'drift'
        ? `${driftAttack.banked.toLocaleString()} PTS BANKED`
        : 'CLOSED-COURSE EXPLORATION';
  const boost = (player.boost / (100 + save.upgrades.boost * 24)) * 100;
  $('boost-value').textContent = `${Math.floor(boost)}%`;
  $('boost-bar').style.transform = `scaleX(${boost / 100})`;
  $('style').textContent =
    playMode === 'drift'
      ? `+${Math.floor(driftAttack.pending * driftAttack.combo).toLocaleString()} UNBANKED`
      : `${Math.floor(player.style).toLocaleString()} STYLE`;
  $('drive-state').textContent = player.boosting
    ? 'BOOST ACTIVE'
    : player.drift > 0.1
      ? 'DRIFTING'
      : player.draft > 0
        ? 'DRAFTING'
        : Math.abs(player.lane) > 8.2
          ? 'OFF ROAD'
          : `GATE ${progress[0]?.lastGate || 0}/32`;
  $('race-notice').textContent =
    countdown > 0
      ? ''
      : playMode !== 'free' && progress[0]?.wrongWay
        ? 'WRONG WAY · TURN AROUND OR PRESS R'
        : noticeTime > 0
          ? notice
          : playMode === 'drift'
            ? driftAttack.feedback
            : player.drift > 0.3
              ? `DRIFT +${Math.floor(player.drift * 65)}`
              : player.draft > 0
                ? 'SLIPSTREAM · BOOST RECHARGING'
                : '';
  $('speed-vignette').classList.toggle('boosting', player.boosting && save.settings.motion);
  $('leaderboard').style.display = playMode === 'race' ? '' : 'none';
  $('leaderboard').innerHTML = rank()
    .map(
      (r, i) =>
        `<div class="${r.name === 'YOU' ? 'you' : ''}"><span>${i + 1}</span><strong>${r.name}</strong><small>${r.name === 'YOU' ? 'SLINGMODS' : r.done ? 'FINISHED' : `${Math.abs(r.distance - player.distance).toFixed(0)} m`}</small></div>`,
    )
    .join('');
  drawMap();
}
function drawMap() {
  const c = $<HTMLCanvasElement>('minimap');
  if (!c) return;
  const ctx = c.getContext('2d')!,
    pts = world.circuit.samples;
  ctx.clearRect(0, 0, 240, 220);
  const xs = pts.map((a) => a.p.x),
    zs = pts.map((a) => a.p.z);
  const minX = Math.min(...xs),
    minZ = Math.min(...zs),
    maxX = Math.max(...xs),
    maxZ = Math.max(...zs),
    sc = 172 / Math.max(maxX - minX, maxZ - minZ);
  const draw = (d: number) => {
    const a = world.circuit.at(d);
    return [(a.p.x - (minX + maxX) / 2) * sc + 120, (a.p.z - (minZ + maxZ) / 2) * sc + 110];
  };
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 12) {
    const [x, y] = draw((i / pts.length) * world.circuit.length);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#f3eedb44';
  ctx.stroke();
  for (const o of opponents) {
    const [x, y] = draw(o.distance);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#f3eedb';
    ctx.fill();
  }
  const [x, y] = draw(player.distance);
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#ff633b';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#fff1db';
  ctx.stroke();
}
function input() {
  const pads = navigator.getGamepads?.() || [];
  const gp = Array.from(pads).find((p) => p && p.mapping === 'standard');
  const axis = gp && Math.abs(gp.axes[0]) > 0.12 ? gp.axes[0] : 0;
  return {
    steer: steeringToLane(
      held('KeyA') || held('ArrowLeft') || touchHeld('left'),
      held('KeyD') || held('ArrowRight') || touchHeld('right'),
      axis,
    ),
    throttle:
      (playMode !== 'free' && save.settings.autoThrottle) ||
      held('KeyW') ||
      held('ArrowUp') ||
      touchHeld('throttle') ||
      gp?.buttons[7]?.value ||
      0,
    brake: held('KeyS') || held('ArrowDown') || touchHeld('brake') || gp?.buttons[6]?.value || 0,
    drift: held('Space') || touchHeld('drift') || !!gp?.buttons[0]?.pressed,
    boost:
      held('ShiftLeft') || held('ShiftRight') || touchHeld('boost') || !!gp?.buttons[5]?.pressed,
  };
}
let gamepadPause = false;
let gamepadEdges = [false, false, false, false];
function step(dt: number) {
  if (paused || finish) return;
  if (countdown > 0) {
    countdown -= dt;
    const n = Math.ceil(countdown);
    if (n !== lastCount) {
      lastCount = n;
      if (n > 0 && n <= 3) audio.tone(440, 0.12, 0.3, 'sine');
      if (n === 0) {
        audio.tone(880, 0.35, 0.3);
        notify('GREEN FLAG · GO, GO, GO!', 2);
        void audio.voice('green');
      }
    }
    $('countdown').textContent = n > 0 ? String(Math.min(n, 3)) : 'GO';
    $('countdown').style.opacity = countdown < -0.2 ? '0' : '1';
    return;
  }
  $('countdown').style.display = 'none';
  raceTime += dt;
  noticeTime = Math.max(0, noticeTime - dt);
  player.draft = opponents.some(
    (o) =>
      o.distance - player.distance > 4 &&
      o.distance - player.distance < 27 &&
      Math.abs(o.lane - player.lane) < 1.8,
  )
    ? 1
    : 0;
  if (player.draft) player.style += dt * 17;
  const racers = [player, ...opponents];
  racers.forEach((p, i) => {
    if (progress[i].finishedAt !== null) return;
    const oldDistance = p.distance;
    const from = positionOf(p),
      controls =
        i === 0
          ? input()
          : aiInput(p, world.circuit, racers, opponents[i - 1].skill, raceDifficulty, i);
    const oldHit = p.hit;
    simulateVehicle(
      p,
      controls,
      world.circuit,
      i === 0 ? save.upgrades : { power: raceDifficulty === 'hard' ? 1 : 0, grip: 0, boost: 0 },
      dt,
      i === 0 ? raceDifficulty : 'hard',
      i > 0 || save.transmission === 'automatic',
      world.collision,
    );
    progress[i].cross(from, positionOf(p), raceTime, dt);
    progress[i].wrongWay =
      Math.cos(
        p.pose!.yaw -
          Math.atan2(world.circuit.at(p.distance).t.x, world.circuit.at(p.distance).t.z),
      ) *
        Math.sign(p.speed) <
      -0.25;
    if (i === 0 && p.hit > oldHit) {
      notify('BARRIER CONTACT · EASE IT BACK', 1);
      audio.effect('impact', 0.35);
    }
    if (i === 0 && playMode === 'drift')
      driftAttack.step(p, p.distance - oldDistance, dt, progress[0].wrongWay);
    if (i === 0 && routeTokens) {
      const hits = routeTokens.collect(from, positionOf(p));
      if (hits.length) {
        player.boost = clamp(player.boost + hits.length * 24, 0, 100 + save.upgrades.boost * 24);
        audio.tone(760, 0.12, 0.1);
        notify(
          routeTokens.collected.size === 12
            ? 'ALL TOKENS FOUND · NICE TOUR!'
            : `TOKEN ${routeTokens.collected.size} / 12 · +24 BOOST`,
          1.8,
        );
      }
    }
    if (i > 0 && progress[i].finishedAt !== null) opponents[i - 1].done = progress[i].finishedAt!;
  });
  // Chassis contact between racers; no position or pace teleporting.
  for (let i = 0; i < racers.length; i++)
    for (let j = i + 1; j < racers.length; j++) {
      const a = racers[i],
        b = racers[j],
        dx = a.pose!.x - b.pose!.x,
        dz = a.pose!.z - b.pose!.z,
        d = Math.hypot(dx, dz);
      if (d < 1.8 && d > 0.001) {
        const correction = (1.8 - d) * 0.5;
        a.pose!.x += (dx / d) * correction;
        a.pose!.z += (dz / d) * correction;
        b.pose!.x -= (dx / d) * correction;
        b.pose!.z -= (dz / d) * correction;
        if (a.hit <= 0 && b.hit <= 0) {
          a.speed *= 0.85;
          b.speed *= 0.85;
          a.hit = b.hit = 0.45;
        }
      }
    }
  if (playMode === 'drift' && driftAttack.done) {
    finishDrift();
    return;
  }
  if (playMode !== 'race') return;
  const newLap = progress[0].lap + 1;
  if (newLap > currentLap) {
    currentLap = newLap;
    if (newLap <= laps) {
      notify('FINAL LAP · MAKE YOUR MOVE', 3);
      void audio.voice('final-lap');
    }
  }
  if (progress[0].finishedAt !== null) {
    raceTime = progress[0].finishedAt;
    finishPlace = 1 + opponents.filter((o) => o.done > 0 && o.done <= raceTime).length;
    finishRace();
  }
}
function finishDrift() {
  finish = true;
  screen = 'results';
  const key = driftKey(TRACKS[selected].id, raceDifficulty, raceNight),
    score = driftAttack.banked;
  const previous = save.driftBests[key] || 0,
    isBest = score > previous;
  if (isBest) {
    save.driftBests[key] = score;
    persist();
  }
  audio.tone(659, 0.3, 0.12);
  app.innerHTML = `<div class="results-screen">${header()}<main class="results"><div class="eyebrow">DRIFT ATTACK / ${TRACKS[selected].location}</div><h1>${isBest ? 'NEW HIGH SCORE.' : 'ONE MORE SLIDE.'}</h1><div class="attack-score">${score.toLocaleString()} <small>POINTS BANKED</small></div><p class="result-story">${isBest ? 'Your new personal best is saved.' : `Personal best: ${previous.toLocaleString()} points.`} Link controlled slides for a bigger multiplier. Straighten to bank; an impact loses the current combo.</p><div class="result-actions"><button class="primary" data-action="restart">RUN IT AGAIN ${icons.arrow}</button><button class="secondary" data-action="quick">CHANGE COURSE / MODE</button><button class="text-button" data-action="home">THE TOUR ↗</button></div><p class="muted">Drift scores are separate from race records and campaign credits.</p></main></div>`;
}
function finishRace() {
  finish = true;
  screen = 'results';
  const key = bestKey(TRACKS[selected].id, laps, raceDifficulty, raceNight) + '-' + RULES_VERSION;
  const isBest = !save.bests[key] || raceTime < save.bests[key];
  if (isBest) save.bests[key] = raceTime;
  lastReward = commitRace(save, {
    id: raceId,
    place: finishPlace,
    chapter: raceChapter,
    style: player.style,
    difficulty: raceDifficulty,
  });
  if (!lastReward) return;
  persist();
  void audio.voice('finish');
  audio.tone(523, 0.3, 0.2);
  audio.tone(659, 0.4, 0.2, 'sine', (audio.ctx?.currentTime || 0) + 0.15);
  audio.tone(784, 0.6, 0.2, 'sine', (audio.ctx?.currentTime || 0) + 0.3);
  const c = raceChapter !== null ? CHAPTERS[raceChapter] : null;
  app.innerHTML = `<div class="results-screen">${header()}<main class="results"><div class="eyebrow">${lastReward.complete ? 'CHAPTER COMPLETE' : finishPlace === 1 ? 'FIRST TO THE FLAG' : 'RACE COMPLETE'}</div><h1>${finishPlace === 1 ? 'WHAT. A. RIDE.' : finishPlace <= 3 ? 'PODIUM ENERGY.' : 'KEEP CHASING.'}</h1><div class="result-position"><strong>${finishPlace}<sup>${['ST', 'ND', 'RD', 'TH', 'TH', 'TH'][finishPlace - 1]}</sup></strong><div><span>${TRACKS[selected].location}</span><b>${formatTime(raceTime)}</b><small>${isBest ? 'NEW PERSONAL BEST' : `BEST ${formatTime(save.bests[key])}`}</small></div></div><p class="result-story">${lastReward.complete ? c!.after : c ? `The crew is still with you. ${c.goal} to move the story forward. Spend your winnings on an upgrade and take another run.` : 'Another finish. Another step toward your perfect build. Spend your credits in the SlingMods garage or chase a faster time.'}</p><div class="earnings"><div><span>RACE PURSE${raceDifficulty === 'hard' ? ' +30%' : ''}</span><b>+${lastReward.base}</b></div><div><span>STYLE BONUS</span><b>+${lastReward.bonus}</b></div><div><span>SPONSOR BONUS</span><b>+${lastReward.sponsor}</b></div><div class="total"><span>CREDITS EARNED</span><b>◈ ${lastReward.total.toLocaleString()}</b></div></div><div class="result-actions"><button class="primary" data-action="garage">VISIT THE GARAGE ${icons.arrow}</button><button class="secondary" data-action="${lastReward.complete && save.chapter < 8 ? 'campaign' : 'restart'}">${lastReward.complete && save.chapter < 8 ? 'NEXT CHAPTER' : 'RACE AGAIN'}</button><button class="text-button" data-action="home">THE TOUR ↗</button></div></main></div>`;
}
function recover() {
  if (playMode === 'drift') driftAttack.breakCombo();
  spawnVehicle(
    player,
    world.circuit,
    playMode === 'free' ? player.distance : progress[0].recoveryDistance,
    0,
  );
  progress[0].resets++;
  world.cameraReady = false;
  notify('RECOVERED TO LAST VALID CHECKPOINT', 2);
}
function setupTouch() {
  app.querySelectorAll<HTMLButtonElement>('[data-touch]').forEach((b) => {
    const k = b.dataset.touch!;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      touch.add(k);
      taps.set('touch-' + k, performance.now() + 150);
      b.classList.add('pressed');
    });
    const up = () => {
      touch.delete(k);
      b.classList.remove('pressed');
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
  });
}
app.addEventListener('click', async (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('button,a');
  if (!b) return;
  if (b instanceof HTMLButtonElement && b.disabled) return;
  audio.start();
  audio.click();
  const action = b.dataset.action;
  if (b.dataset.mode) {
    playMode = b.dataset.mode as PlayMode;
    briefing(true);
    return;
  }
  if (b.dataset.difficulty) {
    save.settings.difficulty = b.dataset.difficulty as Difficulty;
    persist();
    briefing(tab === 'quick');
    return;
  }
  if (b.dataset.night) {
    save.settings.night = b.dataset.night === 'night';
    persist();
    if (screen === 'briefing') briefing(true);
    else home();
    return;
  }
  if (b.dataset.garagetab) {
    garageTab = b.dataset.garagetab;
    garage();
    return;
  }
  if (b.dataset.rgb) {
    save.rgb = Number(b.dataset.rgb);
    save.rgbCycle = false;
    persist();
    garage();
    return;
  }
  if (action === 'rgb-cycle') {
    save.rgbCycle = !save.rgbCycle;
    persist();
    garage();
    return;
  }
  if (action === 'night-drive') {
    selected = 1;
    save.settings.night = true;
    persist();
    briefing(true);
    return;
  }
  if (b.dataset.track !== undefined) {
    selected = Number(b.dataset.track);
    if (selected === 4) await loadMiamiAssets();
    loadTrack();
    renderHome();
    return;
  }
  if (b.dataset.quicktrack !== undefined) {
    selected = Number(b.dataset.quicktrack);
    if (selected === 4) await loadMiamiAssets();
    briefing(true);
    return;
  }
  if (b.dataset.paint !== undefined) {
    save.paint = Number(b.dataset.paint);
    persist();
    garage();
    return;
  }
  if (b.dataset.upgrade) {
    if (buyUpgrade(save, b.dataset.upgrade as UpgradeId)) {
      persist();
      garage();
      audio.effect('install', 0.55);
      toast('STAGE INSTALLED. LET’S FEEL THE DIFFERENCE.');
    }
    return;
  }
  if (b.dataset.view) {
    world.vehicleView = Number(b.dataset.view);
    document
      .querySelectorAll<HTMLElement>('[data-view]')
      .forEach((el) => el.setAttribute('aria-pressed', String(el === b)));
    return;
  }
  if (action === 'home' || action === 'tour') home();
  if (action === 'campaign') {
    if (save.chapter === 8) briefing(true);
    else briefing();
  }
  if (action === 'quick') briefing(true);
  if (action === 'garage') garage();
  if (action === 'race') startRace();
  if (action === 'restart') startRace(true);
  if (action === 'photo') {
    world.photoPending = true;
    toast('Saving your rendered build photo.');
  }
  if (action === 'camera') {
    world.cockpit = !world.cockpit;
    world.cameraReady = false;
  }
  if (action === 'recover' && countdown <= 0) recover();
  if (action === 'shift-up') shift(player.telemetry, 1);
  if (action === 'shift-down') shift(player.telemetry, -1);
  if (action === 'pause') modal('pause');
  if (action === 'close') closeModal();
  if (action === 'help') modal('help');
  if (action === 'settings') modal('settings');
  if (action === 'reset-dialog') modal('reset');
  if (action === 'reset-confirm') {
    save = freshSave();
    persist();
    world.setQuality(save.settings.quality);
    home();
  }
  if (action === 'sound') {
    save.settings.sound = !save.settings.sound;
    persist();
    b.setAttribute('aria-label', save.settings.sound ? 'Mute sound' : 'Enable sound');
    b.querySelector('.sound-dot')?.classList.toggle('on', save.settings.sound);
  }
  if (action === 'fullscreen') {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else
      void document.documentElement
        .requestFullscreen()
        .catch(() => toast('Fullscreen is unavailable in this browser.'));
  }
});
app.addEventListener('change', (e) => {
  const target = e.target as HTMLInputElement;
  if (target.hasAttribute('data-studio')) world.setStudioMood(target.value);
  const owner = target.dataset.owner;
  if (owner === 'transmission') save.transmission = target.value as Save['transmission'];
  if (owner === 'rims') save.rims = target.value as Save['rims'];
  if (owner === 'exhaust') save.exhaust = target.value as Save['exhaust'];
  if (owner) {
    persist();
    world.customize(save.rims, save.exhaust);
  }
  const k = target.dataset.setting;
  if (k) {
    if (k === 'quality') {
      save.settings.quality = target.value as Save['settings']['quality'];
      world.setQuality(target.value);
    } else if (['sound', 'music', 'autoThrottle', 'motion', 'voice'].includes(k))
      save.settings[k as 'sound' | 'music' | 'autoThrottle' | 'motion' | 'voice'] = target.checked;
    else if (['effectsVolume', 'musicVolume', 'voiceVolume'].includes(k))
      save.settings[k as 'effectsVolume' | 'musicVolume' | 'voiceVolume'] = clamp(
        Number(target.value),
        0,
        1,
      );
    persist();
  }
  if (target.id === 'laps') {
    laps = Number(target.value);
    briefing(true);
  }
});
function toast(text: string) {
  $('toast')?.remove();
  const el = document.createElement('div');
  el.id = 'toast';
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = text;
  app.append(el);
  setTimeout(() => el.remove(), 3000);
}
window.addEventListener('keydown', (e) => {
  if (e.code === 'Tab' && $('overlay')) {
    const elements = Array.from(
      $('overlay').querySelectorAll<HTMLElement>('button,input,select,a'),
    );
    const first = elements[0],
      last = elements[elements.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
    return;
  }
  if (e.code === 'Escape' && $('overlay')) {
    closeModal();
    return;
  }
  if (screen !== 'race') return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code))
    e.preventDefault();
  if (!e.repeat && (e.code === 'Escape' || e.code === 'KeyP')) {
    paused ? closeModal() : modal('pause');
    return;
  }
  if (!e.repeat && e.code === 'KeyC') {
    world.cockpit = !world.cockpit;
    world.cameraReady = false;
  }
  if (!e.repeat && !paused && save.transmission === 'manual' && ['KeyQ', 'KeyE'].includes(e.code))
    shift(player.telemetry, e.code === 'KeyE' ? 1 : -1);
  if (e.code === 'KeyR' && !paused && countdown <= 0) recover();
  keys.add(e.code);
  if (!e.repeat) taps.set(e.code, performance.now() + 150);
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => {
  keys.clear();
  taps.clear();
  touch.clear();
  if (screen === 'race' && !paused) modal('pause');
  audio.silence();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    keys.clear();
    taps.clear();
    touch.clear();
    if (screen === 'race' && !paused) modal('pause');
    audio.silence();
  }
});
function frame(now: number) {
  const rawDt = Math.max(0, (now - lastFrame) / 1000);
  const dt = Math.min(rawDt, 0.05);
  lastFrame = now;
  lastFrameMs = rawDt * 1000;
  if (screen === 'race' && !paused && !document.hidden && countdown <= 0) {
    measuredFrames.push(lastFrameMs);
    if (measuredFrames.length > 18000) measuredFrames.shift();
  }
  if (rawDt > 0) world.frameMs += (rawDt * 1000 - world.frameMs) * 0.03;
  world.qualityClock += dt;
  if (world.quality === 'auto' && world.qualityClock > 6) {
    world.qualityClock = 0;
    const ratio = world.renderer.getPixelRatio();
    if (world.frameMs > 28 && ratio > 0.8) {
      world.renderer.setPixelRatio(Math.max(0.8, ratio - 0.2));
      world.resize();
    }
  }
  if (!document.hidden) {
    if (screen === 'race' && !paused) {
      const gp = Array.from(navigator.getGamepads?.() || []).find((g) => g?.mapping === 'standard');
      const press = !!gp?.buttons[9]?.pressed;
      if (press && !gamepadPause) modal('pause');
      gamepadPause = press;
      const buttons = [
        !!gp?.buttons[2]?.pressed,
        !!gp?.buttons[3]?.pressed,
        !!gp?.buttons[1]?.pressed,
        !!gp?.buttons[10]?.pressed,
      ];
      buttons.forEach((pressed, i) => {
        if (!pressed || gamepadEdges[i]) return;
        if (i < 2 && save.transmission === 'manual') shift(player.telemetry, i === 0 ? -1 : 1);
        if (i === 2 && countdown <= 0) recover();
        if (i === 3) {
          world.cockpit = !world.cockpit;
          world.cameraReady = false;
        }
      });
      gamepadEdges = buttons;
      world.interpolationAlpha = clock.advance(rawDt, step);
      if (clock.pausedForStall) {
        modal('pause');
        notify('PAUSED AFTER A LONG FRAME', 3);
      }
      hudTick += dt;
      if (hudTick > 0.07) {
        updateHud();
        hudTick = 0;
      }
    }
    world.update(
      paused ? 0 : dt,
      player,
      opponents,
      screen === 'race'
        ? 'race'
        : screen === 'results'
          ? 'finish'
          : screen === 'garage'
            ? 'garage'
            : 'menu',
      save.settings.motion,
    );
    if (progress[0]) world.checkpointDistance = progress[0].gates[progress[0].next].distance;
    audio.update(
      player,
      screen === 'race' && !paused && countdown <= 0,
      save.settings,
      !$('overlay'),
      ['coast', 'miami', 'harbor'].includes(TRACKS[selected].id),
    );
  }
  requestAnimationFrame(frame);
}
async function boot() {
  try {
    await document.fonts.ready;
    await loadBrand();
    await world.init();
    audio.preload();
    world.setQuality(save.settings.quality);
    home();
    lastFrame = performance.now();
    requestAnimationFrame(frame);
  } catch (error) {
    console.error(error);
    app.innerHTML = `<div class="boot"><span class="eyebrow">LET’S GET YOU ON THE ROAD</span><h1>GRAPHICS COULD<br>NOT START.</h1><p>Try the compatibility renderer, or enable hardware acceleration in your browser.</p><a class="primary" href="?webgl=1">TRY WEBGL 2 →</a></div>`;
  }
}
void boot();
// Read-only diagnostics for QA; no race completion, economy, or input shortcuts.
Object.defineProperty(window, '__tour', {
  get: () => ({
    build: '0.5.0-playground-preview',
    playMode,
    driftAttack: { ...driftAttack },
    tokens: routeTokens
      ? { collected: routeTokens.collected.size, total: routeTokens.points.length }
      : null,
    night: world.night,
    difficulty: raceDifficulty,
    audio: {
      loaded: audio.buffers.size,
      state: audio.ctx?.state,
      voice: audio.activeVoice,
      peakDb: 20 * Math.log10(Math.max(0.000001, audio.peak)),
    },
    rgb: save.rgb,
    camera: world.camera.position.toArray(),
    car: world.cars[0]?.position.toArray(),
    wheelCenters: world.cars[0]?.userData.pivots.map((p: { matrixWorld: { elements: number[] } }) =>
      p.matrixWorld.elements.slice(12, 15),
    ),
    guide: world.circuit
      ? {
          point: world.circuit
            .at(player.distance + Math.max(12, Math.abs(player.speed) * 0.75))
            .p.toArray(),
          bend: Math.max(
            ...[12, 28, 48, 70].map((d) => Math.abs(world.circuit.at(player.distance + d).curve)),
          ),
        }
      : null,
    carScreen: world.cars[0]?.position.clone().project(world.camera).toArray(),
    vehicleUpY: world.cars.map((car) => car.matrixWorld.elements[5]),
    triangles: world.renderer.info.render.triangles,
    cpu: { ...world.cpu },
    pixelRatio: world.renderer.getPixelRatio(),
    contacts: world.collision.contacts,
    screen,
    paused,
    countdown,
    raceTime,
    checkpoints: progress.map((p) => ({
      next: p.next,
      lap: p.lap,
      finishedAt: p.finishedAt,
      resets: p.resets,
    })),
    player: structuredClone(player),
    opponents: opponents.map((o) => structuredClone(o)),
    track: selected,
    length: world.circuit?.length,
    backend: world.backend,
    frameMs: world.frameMs,
    lastFrameMs,
    frameProfile: frameProfile(),
    viewport: [innerWidth, innerHeight],
    drawingBuffer: [canvas.width, canvas.height],
    textures: world.renderer.info.memory.textures,
    geometries: world.renderer.info.memory.geometries,
    drawCalls: world.renderer.info.render.drawCalls,
    curve: world.circuit?.at(player.distance).curve,
    save: structuredClone(save),
    position: rank().findIndex((r) => r.name === 'YOU') + 1,
  }),
});
