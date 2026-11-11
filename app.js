/**
 * Time Capsule — cinematic birthday page.
 * Countdown → chest → particle "19" → letter, wish, fireworks.
 */
'use strict';

/* ---------- Settings (edit these) ---------- */
const CONFIG = {
  name: 'Khondamir',
  age: 19,
  unlockDate: new Date(2026, 5, 14, 0, 0, 0), // month is 0-indexed: 5 = June
};
//for deploy
/* Hidden preview for testing (no visible UI):
   add ?preview=countdown to the URL to see the countdown unlock after 10 seconds. */
const params = new URLSearchParams(location.search);
const isPreview = params.get('preview') === 'countdown';
const TARGET_DATE = isPreview ? new Date(Date.now() + 10_000) : CONFIG.unlockDate;
const COUNT_START = isPreview
  ? new Date(Date.now())
  : new Date(TARGET_DATE.getFullYear() - 1, TARGET_DATE.getMonth(), TARGET_DATE.getDate());
const BASE_TITLE = document.title;

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = motionQuery.matches;
motionQuery.addEventListener?.('change', (e) => { reducedMotion = e.matches; });

const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* storage blocked */ } },
};

/* ---------- DOM ---------- */
const $ = (sel) => document.querySelector(sel);
const countdownView = $('#countdown-view');
const unlockedView = $('#unlocked-view');
const unlockedContent = $('#unlocked-content');
const numberSlot = $('#number-slot');
const flashOverlay = $('#flash-overlay');
const chestContainer = $('#chest-container');
const chestSvg = $('#chest-svg');
const countdownCard = $('#countdown-card');
const progressTrack = $('#progress-track');
const progressFill = $('#progress-fill');
const progressLabel = $('#progress-label');
const soundToggle = $('#sound-toggle');
const openLetterBtn = $('#open-letter');
const makeWishBtn = $('#make-wish');
const replayBtn = $('#replay-btn');
const shareBtn = $('#share-btn');
const letterDialog = $('#letter-dialog');
const wishDialog = $('#wish-dialog');
const wishTitle = $('#wish-title');
const wishText = $('#wish-text');
const wishHint = $('#wish-hint');
const wishProgress = $('.wish-progress');
const candle = $('#candle');
const toastEl = $('#toast');
const announcer = $('#announcer');

const timerEls = {
  days: $('[data-unit="days"]'),
  hours: $('[data-unit="hours"]'),
  minutes: $('[data-unit="minutes"]'),
  seconds: $('[data-unit="seconds"]'),
};

/* ---------- Small helpers ---------- */
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function announce(text) {
  announcer.textContent = '';
  requestAnimationFrame(() => { announcer.textContent = text; });
}

let toastTimer = null;
function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

/* ---------- Sound (synthesised, no files needed) ---------- */
const Sound = (() => {
  const NOTE = {
    G4: 392.0, A4: 440.0, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46,
    G5: 783.99, C6: 1046.5, E6: 1318.51, G6: 1567.98, C7: 2093.0,
  };
  const VOLUME = 0.5;
  let ctx = null;
  let master = null;
  let enabled = store.get('capsule:sound') !== 'off';

  function ensure() {
    if (!enabled) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = VOLUME;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, when, dur, type = 'sine', vol = 0.2) {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime + when;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // A soft music-box bell: fundamental plus two quiet overtones
  function bell(freq, when, dur = 1.6, vol = 0.12) {
    tone(freq, when, dur, 'sine', vol);
    tone(freq * 2, when, dur * 0.6, 'sine', vol * 0.3);
    tone(freq * 3.01, when, dur * 0.3, 'sine', vol * 0.1);
  }

  return {
    get enabled() { return enabled; },
    setEnabled(on) {
      enabled = on;
      store.set('capsule:sound', on ? 'on' : 'off');
      if (ctx && master) master.gain.setTargetAtTime(on ? VOLUME : 0, ctx.currentTime, 0.05);
      if (on) ensure();
    },
    chime() {
      ['C6', 'E6', 'G6', 'C7'].forEach((n, i) => bell(NOTE[n], i * 0.12, 2.2, 0.09));
    },
    sparkle() {
      bell(NOTE.G5, 0, 0.9, 0.05);
      bell(NOTE.C6, 0.08, 0.9, 0.045);
    },
    // "Happy Birthday to You" (public domain)
    melody() {
      const song = [
        ['G4', 0.75], ['G4', 0.25], ['A4', 1], ['G4', 1], ['C5', 1], ['B4', 2],
        ['G4', 0.75], ['G4', 0.25], ['A4', 1], ['G4', 1], ['D5', 1], ['C5', 2],
        ['G4', 0.75], ['G4', 0.25], ['G5', 1], ['E5', 1], ['C5', 1], ['B4', 1], ['A4', 2],
        ['F5', 0.75], ['F5', 0.25], ['E5', 1], ['C5', 1], ['D5', 1], ['C5', 2.5],
      ];
      const beat = 0.42;
      let t = 0.15;
      for (const [note, beats] of song) {
        bell(NOTE[note], t, Math.max(beats * beat * 2.2, 0.8), 0.12);
        tone(NOTE[note] / 2, t, beats * beat * 1.3, 'triangle', 0.035);
        t += beats * beat;
      }
    },
  };
})();

function renderSoundToggle() {
  const on = Sound.enabled;
  soundToggle.classList.toggle('is-muted', !on);
  soundToggle.setAttribute('aria-pressed', String(on));
  soundToggle.setAttribute('aria-label', on ? 'Mute sound' : 'Turn sound on');
  soundToggle.title = on ? 'Sound on' : 'Sound off';
}

soundToggle.addEventListener('click', () => {
  Sound.setEnabled(!Sound.enabled);
  renderSoundToggle();
  if (Sound.enabled) Sound.sparkle();
  showToast(Sound.enabled ? 'Sound on' : 'Sound off');
});
renderSoundToggle();

/* ---------- Canvas ---------- */
const canvas = $('#sky-canvas');
const ctx = canvas.getContext('2d');
let dpr = 1;
let width = window.innerWidth;
let height = window.innerHeight;

function resizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  // setTransform (not scale) so repeated resizes don't stack up
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

const GOLD_COLORS = [
  'rgba(255, 215, 0, ',
  'rgba(212, 175, 55, ',
  'rgba(255, 245, 179, ',
  'rgba(255, 170, 0, ',
  'rgba(255, 255, 255, ',
];
const CONFETTI_COLORS = ['#ffd700', '#fff5b3', '#d4af37', '#ffffff', '#ff9fb2', '#9fd3ff', '#ffb347'];

const stars = [];
const ambientDust = [];
const shootingStars = [];
const effects = []; // fireworks sparks + confetti
let particles = [];
let targetPoints = [];

// 'ambient' | 'explosion' | 'gathering' | 'formed'
let particleState = 'ambient';
let stateElapsed = 0;

function initAmbientSky() {
  stars.length = 0;
  ambientDust.length = 0;

  const starCount = Math.min(Math.floor((width * height) / 8000), 250);
  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height * 0.85,
      size: rand(0.5, 2),
      opacity: Math.random(),
      twinkleSpeed: rand(0.005, 0.02),
      phase: Math.random() * Math.PI,
    });
  }

  const dustCount = Math.min(Math.floor((width * height) / 15000), 90);
  for (let i = 0; i < dustCount; i++) {
    ambientDust.push({
      x: Math.random() * width,
      y: Math.random() * height, // start spread out so the sky isn't empty on load
      size: rand(0.8, 3),
      speedY: rand(0.2, 0.6),
      speedX: rand(-0.15, 0.15),
      opacity: rand(0.1, 0.6),
      angle: Math.random() * Math.PI * 2,
      wobbleSpeed: rand(0.01, 0.03),
      color: pick(GOLD_COLORS),
    });
  }
}

function drawDot(x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function updateAndDrawStars(f) {
  for (const star of stars) {
    star.phase += star.twinkleSpeed * f;
    const a = Math.abs(Math.sin(star.phase)) * star.opacity;
    ctx.fillStyle = `rgba(255, 255, 255, ${a.toFixed(2)})`;
    drawDot(star.x, star.y, star.size);
  }
}

function updateAndDrawAmbientDust(f) {
  const speed = reducedMotion ? 0.3 : 1;
  for (const dust of ambientDust) {
    dust.y -= dust.speedY * f * speed;
    dust.angle += dust.wobbleSpeed * f;
    dust.x += (dust.speedX + Math.sin(dust.angle) * 0.25) * f * speed;

    if (dust.y < -10 || dust.x < -10 || dust.x > width + 10) {
      dust.y = height + 10;
      dust.x = Math.random() * width;
    }
    ctx.fillStyle = dust.color + dust.opacity.toFixed(2) + ')';
    drawDot(dust.x, dust.y, dust.size);
  }
}

function handleShootingStars(f) {
  if (!reducedMotion && Math.random() < 0.006 * f && shootingStars.length < 2) {
    shootingStars.push({
      x: Math.random() * width * 0.6,
      y: Math.random() * height * 0.3,
      length: rand(80, 180),
      dx: rand(4, 8),
      dy: rand(1.5, 3.5),
      opacity: 0,
      fadingIn: true,
    });
  }

  for (let i = shootingStars.length - 1; i >= 0; i--) {
    const ss = shootingStars[i];
    if (ss.fadingIn) {
      ss.opacity = Math.min(1, ss.opacity + 0.08 * f);
      if (ss.opacity >= 1) ss.fadingIn = false;
    } else {
      ss.opacity -= 0.05 * f;
      if (ss.opacity <= 0) { shootingStars.splice(i, 1); continue; }
    }
    ss.x += ss.dx * f;
    ss.y += ss.dy * f;

    const tailX = ss.x - ss.length;
    const tailY = ss.y - ss.length * (ss.dy / ss.dx);
    const grad = ctx.createLinearGradient(ss.x, ss.y, tailX, tailY);
    grad.addColorStop(0, `rgba(255, 255, 255, ${ss.opacity.toFixed(2)})`);
    grad.addColorStop(0.3, `rgba(255, 215, 0, ${(ss.opacity * 0.5).toFixed(2)})`);
    grad.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ss.x, ss.y);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();
  }
}

/* ---------- The particle "19" ---------- */
const fontReady = document.fonts
  ? document.fonts.load("700 300px 'Cinzel'").catch(() => {})
  : Promise.resolve();
let numberShape = null;

// Draw the number offscreen and keep a grid of points that fall inside it
function sampleNumberShape() {
  const W = 600;
  const H = 400;
  const off = document.createElement('canvas');
  off.width = W;
  off.height = H;
  const octx = off.getContext('2d', { willReadFrequently: true });
  octx.font = "700 300px 'Cinzel', Georgia, serif";
  octx.fillStyle = '#fff';
  octx.textAlign = 'center';
  octx.textBaseline = 'middle';
  octx.fillText(String(CONFIG.age), W / 2, H / 2);

  const data = octx.getImageData(0, 0, W, H).data;
  const step = width < 600 ? 6 : 5;
  const points = [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      if (data[(y * W + x) * 4 + 3] > 130) {
        points.push({ x, y });
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { points, minX, maxX, minY, maxY };
}

// Fit the sampled shape into the #number-slot box on screen
function updateParticleTargets() {
  if (!numberShape || !numberShape.points.length) return;
  const r = numberSlot.getBoundingClientRect();
  const { points, minX, maxX, minY, maxY } = numberShape;
  const scale = Math.min(r.width / (maxX - minX || 1), r.height / (maxY - minY || 1));
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const bx = (minX + maxX) / 2;
  const by = (minY + maxY) / 2;
  targetPoints = points.map((p) => ({ x: cx + (p.x - bx) * scale, y: cy + (p.y - by) * scale }));
}

function chestMouth() {
  const rect = chestContainer.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.53, scale: rect.width / 400 };
}

let openToken = 0; // bumps on replay so stale async work is ignored

async function triggerChestExplosion(token) {
  await fontReady;
  if (token !== openToken) return;
  if (!numberShape) numberShape = sampleNumberShape();
  updateParticleTargets();

  const origin = chestMouth();
  particles = targetPoints.map((target, i) => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
    const speed = rand(4, 16);
    return {
      x: reducedMotion ? target.x : origin.x,
      y: reducedMotion ? target.y : origin.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: rand(0.8, 3.2),
      opacity: rand(0.75, 1),
      targetIndex: i,
      color: pick(GOLD_COLORS),
      angleOffset: Math.random() * Math.PI * 2,
      oscillationSpeed: rand(0.02, 0.07),
      oscillationRadius: rand(1, 3),
    };
  });

  stateElapsed = 0;
  if (reducedMotion) {
    particleState = 'formed';
    setTimeout(() => { if (token === openToken) showRevealContent(); }, 400);
  } else {
    particleState = 'explosion';
  }
}

function updateAndDrawParticles(f, dt, time) {
  if (particleState === 'ambient') return;
  stateElapsed += dt;

  if (particleState === 'explosion' && stateElapsed > 1400) {
    particleState = 'gathering';
    stateElapsed = 0;
  } else if (particleState === 'gathering' && stateElapsed > 2400) {
    particleState = 'formed';
    showRevealContent();
  }

  const drag = Math.pow(0.97, f);
  const blend = 1 - Math.pow(0.93, f);

  for (const p of particles) {
    if (particleState === 'explosion') {
      p.vy += 0.08 * f;
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx * f;
      p.y += p.vy * f;
    } else {
      const target = targetPoints[p.targetIndex];
      if (!target) continue;
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 3) {
        const factor = Math.min(dist / 150, 1);
        p.vx += ((dx / dist) * 12 * factor - p.vx) * blend;
        p.vy += ((dy / dist) * 12 * factor - p.vy) * blend;
        p.x += p.vx * f;
        p.y += p.vy * f;
      } else {
        // Gentle breathing once docked
        const t = time * p.oscillationSpeed;
        p.x = target.x + Math.sin(t + p.angleOffset) * p.oscillationRadius;
        p.y = target.y + Math.cos(t + p.angleOffset) * p.oscillationRadius;
      }
    }
    ctx.fillStyle = p.color + p.opacity.toFixed(2) + ')';
    drawDot(p.x, p.y, p.size);
  }

  // Warm light rising from the open chest
  if (isChestOpened) {
    const { x, y, scale } = chestMouth();
    const w = 60 * scale;
    const h = 150 * scale;
    const grad = ctx.createLinearGradient(x, y, x, y - h);
    grad.addColorStop(0, 'rgba(255, 215, 0, 0.16)');
    grad.addColorStop(0.6, 'rgba(255, 215, 0, 0.05)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x - w, y + 10 * scale);
    ctx.quadraticCurveTo(x - w / 2, y - h * 0.93, x, y - h);
    ctx.quadraticCurveTo(x + w / 2, y - h * 0.93, x + w, y + 10 * scale);
    ctx.closePath();
    ctx.fill();
  }
}

/* ---------- Fireworks & confetti ---------- */
function burstFirework(x, y) {
  const count = reducedMotion ? 24 : 70;
  const hueColors = pick([
    ['#ffd700', '#fff5b3', '#ffffff'],
    ['#ff9fb2', '#ffd1dc', '#ffffff'],
    ['#9fd3ff', '#e0f2ff', '#ffffff'],
    ['#ffb347', '#ffd700', '#fff5b3'],
  ]);
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + rand(-0.05, 0.05);
    const speed = rand(1.5, 6);
    effects.push({
      kind: 'spark',
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: rand(0.010, 0.02),
      size: rand(1, 2.4),
      color: pick(hueColors),
    });
  }
}

function launchConfetti(count) {
  const n = reducedMotion ? Math.floor(count / 3) : count;
  for (let i = 0; i < n; i++) {
    effects.push({
      kind: 'confetti',
      x: Math.random() * width,
      y: -20 - Math.random() * height * 0.6,
      vx: rand(-1, 1),
      vy: rand(1.5, 3.5),
      rot: Math.random() * Math.PI,
      vr: rand(-0.15, 0.15),
      sway: Math.random() * Math.PI * 2,
      w: rand(6, 11),
      h: rand(3, 6),
      life: 1,
      color: pick(CONFETTI_COLORS),
    });
  }
}

function celebrate() {
  const bursts = reducedMotion ? 2 : 7;
  for (let i = 0; i < bursts; i++) {
    setTimeout(() => burstFirework(rand(0.15, 0.85) * width, rand(0.12, 0.45) * height), i * 380);
  }
  launchConfetti(170);
}

function updateAndDrawEffects(f) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    if (e.kind === 'spark') {
      e.vx *= Math.pow(0.96, f);
      e.vy = e.vy * Math.pow(0.96, f) + 0.05 * f;
      e.x += e.vx * f;
      e.y += e.vy * f;
      e.life -= e.decay * f;
      if (e.life <= 0) { effects.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(e.life, 0);
      ctx.fillStyle = e.color;
      drawDot(e.x, e.y, e.size);
    } else {
      e.sway += 0.05 * f;
      e.x += (e.vx + Math.sin(e.sway) * 0.8) * f;
      e.y += e.vy * f;
      e.rot += e.vr * f;
      if (e.y > height * 0.7) e.life -= 0.012 * f;
      if (e.life <= 0 || e.y > height + 20) { effects.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(e.life, 0);
      ctx.fillStyle = e.color;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.rot);
      ctx.scale(1, Math.cos(e.sway * 2)); // flip effect
      ctx.fillRect(-e.w / 2, -e.h / 2, e.w, e.h);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

/* ---------- Main loop ---------- */
let lastFrame = performance.now();
let animationTime = 0;

function animate(now) {
  const dt = Math.min(now - lastFrame, 50); // cap so a background tab doesn't jump
  lastFrame = now;
  const f = dt / (1000 / 60); // 1.0 at 60fps
  animationTime += 0.5 * f;

  ctx.fillStyle = 'rgba(3, 4, 8, 0.42)'; // soft trails
  ctx.fillRect(0, 0, width, height);

  updateAndDrawStars(f);
  updateAndDrawAmbientDust(f);
  handleShootingStars(f);
  updateAndDrawParticles(f, dt, animationTime);
  updateAndDrawEffects(f);

  requestAnimationFrame(animate);
}

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    resizeCanvas();
    initAmbientSky();
    if (particleState === 'gathering' || particleState === 'formed') updateParticleTargets();
  }, 120);
});

/* ---------- Countdown ---------- */
let isUnlockedState = false;
let isChestOpened = false;
let countdownTimer = null;
const lastValues = {};

function setUnit(key, value) {
  const str = String(value).padStart(2, '0');
  if (lastValues[key] === str) return;
  const isFirst = lastValues[key] === undefined;
  lastValues[key] = str;
  const el = timerEls[key];
  el.textContent = str;
  if (!isFirst && !reducedMotion && el.animate) {
    el.animate(
      [
        { transform: 'translateY(-45%)', opacity: 0, filter: 'blur(3px)' },
        { transform: 'none', opacity: 1, filter: 'blur(0)' },
      ],
      { duration: 550, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
  }
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function updateCountdown() {
  const now = Date.now();
  const diff = TARGET_DATE - now;

  if (diff <= 0) {
    if (!isUnlockedState) showUnlocked(true);
    return;
  }

  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff / 3_600_000) % 24);
  const minutes = Math.floor((diff / 60_000) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  setUnit('days', days);
  setUnit('hours', hours);
  setUnit('minutes', minutes);
  setUnit('seconds', seconds);

  countdownCard.setAttribute('aria-label',
    `Opens in ${plural(days, 'day')}, ${plural(hours, 'hour')} and ${plural(minutes, 'minute')}`);

  const total = TARGET_DATE - COUNT_START;
  const pct = Math.max(0, Math.min(100, ((now - COUNT_START) / total) * 100));
  progressFill.style.width = `${pct}%`;
  progressTrack.setAttribute('aria-valuenow', pct.toFixed(0));
  progressLabel.textContent = `${pct.toFixed(1)}% of the way there`;

  const pad = (n) => String(n).padStart(2, '0');
  document.title = `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)} · ${CONFIG.name}'s capsule`;

  // Tick right after each whole second for a steady display
  countdownTimer = setTimeout(updateCountdown, 1000 - (now % 1000) + 15);
}

/* ---------- Views ---------- */
let nudgeTimer = null;
function scheduleNudge() {
  clearTimeout(nudgeTimer);
  chestContainer.classList.remove('nudge');
  nudgeTimer = setTimeout(() => {
    if (!isChestOpened) chestContainer.classList.add('nudge');
  }, 6000);
}

function showUnlocked(animated) {
  isUnlockedState = true;
  clearTimeout(countdownTimer);
  document.title = BASE_TITLE;

  const swap = () => {
    countdownView.classList.remove('active');
    unlockedView.classList.add('active');
    resetChest(false);
    announce('The capsule is ready. Open it when you are.');
  };

  if (!animated) {
    swap();
    return;
  }
  flashOverlay.classList.add('active');
  setTimeout(() => {
    swap();
    Sound.sparkle();
    setTimeout(() => flashOverlay.classList.remove('active'), 300);
  }, 1200);
}

function openChest() {
  if (!isUnlockedState || isChestOpened) return;
  isChestOpened = true;
  clearTimeout(nudgeTimer);
  chestContainer.classList.remove('nudge');
  chestContainer.classList.add('opened');
  chestSvg.classList.add('opened');
  chestContainer.setAttribute('aria-disabled', 'true');
  chestContainer.setAttribute('aria-label', 'The capsule is open');
  Sound.chime();

  const token = ++openToken;
  setTimeout(() => {
    if (token === openToken) triggerChestExplosion(token);
  }, 400);
}

function showRevealContent() {
  unlockedContent.classList.add('visible');
  announce(`Happy birthday, ${CONFIG.name}! ${CONFIG.age} years of memories.`);
  launchConfetti(90);
  Sound.sparkle();
  // Keyboard users: move focus to the next thing to do
  if (document.activeElement === chestContainer) {
    setTimeout(() => openLetterBtn.focus({ preventScroll: true }), 1000);
  }
}

function resetChest(focusChest) {
  openToken++;
  isChestOpened = false;
  particleState = 'ambient';
  particles = [];
  targetPoints = [];
  unlockedContent.classList.remove('visible');
  chestContainer.classList.remove('opened');
  chestSvg.classList.remove('opened');
  chestContainer.removeAttribute('aria-disabled');
  chestContainer.setAttribute('aria-label', 'Open the time capsule');
  scheduleNudge();
  if (focusChest) chestContainer.focus({ preventScroll: true });
}

chestContainer.addEventListener('click', openChest);
replayBtn.addEventListener('click', () => resetChest(true));

/* ---------- Dialogs ---------- */
for (const dialog of [letterDialog, wishDialog]) {
  // Click outside the card closes it
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', () => dialog.close()));
}

openLetterBtn.addEventListener('click', () => {
  letterDialog.showModal();
  letterDialog.querySelector('.dialog-inner').scrollTop = 0;
  Sound.sparkle();
});

/* Make a wish: breathe → blow out the candle → fireworks + song */
const WISH_MS = 3200;
let wishTimers = [];
let wishState = 'idle'; // 'waiting' | 'ready' | 'blown'

function resetWish() {
  wishTimers.forEach(clearTimeout);
  wishTimers = [];
  wishState = 'waiting';
  candle.disabled = true;
  candle.classList.remove('out');
  wishTitle.textContent = 'Close your eyes…';
  wishText.textContent = 'Take a deep breath and make a wish.';
  wishHint.textContent = 'Hold that wish in your heart…';
  wishProgress.classList.remove('running', 'done');
}

makeWishBtn.addEventListener('click', () => {
  resetWish();
  wishDialog.showModal();
  const ms = reducedMotion ? 800 : WISH_MS;
  wishProgress.style.setProperty('--wish-ms', `${ms}ms`);
  void wishProgress.offsetWidth; // restart the bar transition
  wishProgress.classList.add('running');

  wishTimers.push(setTimeout(() => {
    wishState = 'ready';
    candle.disabled = false;
    wishProgress.classList.add('done');
    wishHint.textContent = 'Now tap the candle to blow it out';
    candle.focus({ preventScroll: true });
  }, ms));
});

candle.addEventListener('click', () => {
  if (wishState !== 'ready') return;
  wishState = 'blown';
  candle.classList.add('out');
  candle.disabled = true;
  wishTitle.textContent = 'Wish sent to the stars ✨';
  wishText.textContent = 'May every bit of it come true.';
  wishHint.textContent = '';
  Sound.melody();
  wishTimers.push(setTimeout(() => wishDialog.close(), 1500));
});

wishDialog.addEventListener('close', () => {
  wishTimers.forEach(clearTimeout);
  wishTimers = [];
  if (wishState === 'blown') {
    celebrate();
    wishTimers.push(setTimeout(() => { if (!reducedMotion) celebrate(); }, 4500));
    showToast(`Happy birthday, ${CONFIG.name}! 🎉`);
  }
  wishState = 'idle';
  makeWishBtn.focus({ preventScroll: true });
});

/* ---------- Share ---------- */
shareBtn.addEventListener('click', async () => {
  const url = location.origin + location.pathname;
  const data = { title: BASE_TITLE, text: `A birthday time capsule for ${CONFIG.name} ✨`, url };
  if (navigator.share) {
    try { await navigator.share(data); } catch { /* user cancelled */ }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast('Link copied to clipboard');
  } catch {
    showToast(url);
  }
});

/* ---------- Start ---------- */
resizeCanvas();
initAmbientSky();
requestAnimationFrame((t) => { lastFrame = t; animate(t); });

if (Date.now() >= TARGET_DATE) {
  showUnlocked(false);
} else {
  countdownView.classList.add('active');
  updateCountdown();
}
