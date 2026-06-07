/**
 * Time Capsule - Cinematic Landing Page JavaScript
 * Includes high-performance Canvas Particle System (twinkling stars, drift dust, shooting stars, 
 * volcanic eruption, and shape gathering) and state management.
 */

// Target Lock Date: June 14, 2026, 00:00:00 (Local Time)
const TARGET_DATE = new Date(2026, 5, 14, 0, 0, 0); // Month is 0-indexed: 5 = June
let isUnlockedState = false; // System unlocked state (based on time or dev toggle)
let isChestOpened = false;

// DOM Elements
const countdownView = document.getElementById('countdown-view');
const unlockedView = document.getElementById('unlocked-view');
const unlockedContent = document.getElementById('unlocked-content');
const flashOverlay = document.getElementById('flash-overlay');
const chestContainer = document.getElementById('chest-container');
const chestSvg = document.getElementById('chest-svg');
const devStateToggle = document.getElementById('dev-state-toggle');

// Timer DOM Elements
const timerDays = document.querySelector('#unit-days .timer-val');
const timerHours = document.querySelector('#unit-hours .timer-val');
const timerMinutes = document.querySelector('#unit-minutes .timer-val');
const timerSeconds = document.querySelector('#unit-seconds .timer-val');

// --- Canvas & Particles Engine Setup ---
const canvas = document.getElementById('sky-canvas');
const ctx = canvas.getContext('2d');

let dpr = window.devicePixelRatio || 1;
let width = window.innerWidth;
let height = window.innerHeight;

// Adjust Canvas Resolution for Retina Displays
function resizeCanvas() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Ambient Elements Arrays
const stars = [];
const ambientDust = [];
const shootingStars = [];
// Eruption & Formed Particles
let particles = [];
let targetPoints = [];
let animationFrameId = null;

// Particle System State: 'ambient' | 'explosion' | 'gathering' | 'formed'
let particleState = 'ambient';
let transitionTimer = 0;

// Gold Color Palette for particles
const GOLD_COLORS = [
  'rgba(255, 215, 0, ',   // bright gold
  'rgba(212, 175, 55, ',  // metallic gold
  'rgba(255, 245, 179, ', // pale gold
  'rgba(255, 170, 0, ',   // amber orange
  'rgba(255, 255, 255, '  // pure white sparkle
];

// Initialize Stars and Ambient Dust
function initAmbientSky() {
  stars.length = 0;
  ambientDust.length = 0;

  // Create stars (background layer)
  const starCount = Math.floor((width * height) / 8000);
  for (let i = 0; i < Math.min(starCount, 250); i++) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height * 0.8, // keep mostly towards the top
      size: Math.random() * 1.5 + 0.5,
      opacity: Math.random(),
      twinkleSpeed: 0.005 + Math.random() * 0.015,
      phase: Math.random() * Math.PI
    });
  }

  // Create ambient gold dust (slow drifting particles)
  const dustCount = Math.floor((width * height) / 15000);
  for (let i = 0; i < Math.min(dustCount, 90); i++) {
    ambientDust.push({
      x: Math.random() * width,
      y: height + Math.random() * 100, // Spawn below viewport
      size: Math.random() * 2.2 + 0.8,
      speedY: 0.2 + Math.random() * 0.4,
      speedX: -0.15 + Math.random() * 0.3,
      opacity: 0.1 + Math.random() * 0.5,
      angle: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.01 + Math.random() * 0.02,
      color: GOLD_COLORS[Math.floor(Math.random() * GOLD_COLORS.length)]
    });
  }
}

// Draw Background Stars
function updateAndDrawStars() {
  ctx.fillStyle = '#ffffff';
  for (let star of stars) {
    star.phase += star.twinkleSpeed;
    const currentOpacity = Math.abs(Math.sin(star.phase)) * star.opacity;
    ctx.fillStyle = `rgba(255, 255, 255, ${currentOpacity.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Draw and Update Ambient Gold Dust
function updateAndDrawAmbientDust() {
  for (let dust of ambientDust) {
    dust.y -= dust.speedY;
    dust.angle += dust.wobbleSpeed;
    dust.x += dust.speedX + Math.sin(dust.angle) * 0.25;

    // Reset when moving off screen
    if (dust.y < -10 || dust.x < -10 || dust.x > width + 10) {
      dust.y = height + 10;
      dust.x = Math.random() * width;
    }

    ctx.fillStyle = dust.color + dust.opacity.toFixed(2) + ')';
    ctx.beginPath();
    ctx.arc(dust.x, dust.y, dust.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Spawn and Update Shooting Stars
function handleShootingStars() {
  // Occasional spawn probability (1 in 160 frames)
  if (Math.random() < 0.006 && shootingStars.length < 2) {
    shootingStars.push({
      x: Math.random() * width * 0.6,
      y: Math.random() * height * 0.3,
      length: 80 + Math.random() * 100,
      dx: 4 + Math.random() * 4,
      dy: 1.5 + Math.random() * 2,
      opacity: 0,
      state: 'fading-in' // fading-in -> fading-out -> dead
    });
  }

  for (let i = shootingStars.length - 1; i >= 0; i--) {
    let ss = shootingStars[i];

    if (ss.state === 'fading-in') {
      ss.opacity += 0.08;
      if (ss.opacity >= 1) {
        ss.opacity = 1;
        ss.state = 'fading-out';
      }
    } else if (ss.state === 'fading-out') {
      ss.opacity -= 0.05;
      if (ss.opacity <= 0) {
        shootingStars.splice(i, 1);
        continue;
      }
    }

    // Move star
    ss.x += ss.dx;
    ss.y += ss.dy;

    // Draw shooting star
    const grad = ctx.createLinearGradient(ss.x, ss.y, ss.x - ss.length, ss.y - (ss.length * (ss.dy / ss.dx)));
    grad.addColorStop(0, `rgba(255, 255, 255, ${ss.opacity.toFixed(2)})`);
    grad.addColorStop(0.3, `rgba(255, 215, 0, ${(ss.opacity * 0.5).toFixed(2)})`);
    grad.addColorStop(1, 'rgba(255, 215, 0, 0)');

    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ss.x, ss.y);
    ctx.lineTo(ss.x - ss.length, ss.y - (ss.length * (ss.dy / ss.dx)));
    ctx.stroke();
  }
}

// --- Dynamic Particle Gathering System ("19" shape) ---

// Offscreen rendering to map coordinates for the number "19"
function getNumberPoints() {
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');

  // Size the offscreen canvas appropriately
  const sampleWidth = 500;
  const sampleHeight = 350;
  tempCanvas.width = sampleWidth;
  tempCanvas.height = sampleHeight;

  tempCtx.clearRect(0, 0, sampleWidth, sampleHeight);

  // Render "19" in Serif font
  tempCtx.font = "bold 240px 'Cormorant Garamond', 'Cinzel', serif";
  tempCtx.fillStyle = '#ffffff';
  tempCtx.textAlign = 'center';
  tempCtx.textBaseline = 'middle';
  tempCtx.fillText('19', sampleWidth / 2, sampleHeight / 2);

  const imgData = tempCtx.getImageData(0, 0, sampleWidth, sampleHeight);
  const data = imgData.data;
  const points = [];

  // Scan pixels at a grid step depending on window width (finer on mobile, spaced on desktop)
  const step = width < 600 ? 5 : 4;
  for (let y = 0; y < sampleHeight; y += step) {
    for (let x = 0; x < sampleWidth; x += step) {
      const idx = (y * sampleWidth + x) * 4;
      const alpha = data[idx + 3];
      if (alpha > 130) {
        // Offset relative to center of box
        points.push({
          x: x - sampleWidth / 2,
          y: y - sampleHeight / 2
        });
      }
    }
  }
  return points;
}

// Recalculate physical screen targets for coordinates
function updateParticleTargets() {
  const sampled = getNumberPoints();

  // Scale factor based on display width
  let scale = 1.0;
  if (width < 480) scale = 0.65;
  else if (width < 768) scale = 0.85;
  else if (width > 1400) scale = 1.2;

  // Center vertical alignment of the "19" shape (slightly above center of screen)
  const centerX = width / 2;
  const centerY = height * 0.36;

  targetPoints = sampled.map(p => ({
    x: centerX + p.x * scale,
    y: centerY + p.y * scale
  }));
}

// Trigger particle fountain explosion from the chest
function triggerChestExplosion() {
  // Clear any existing particles
  particles = [];
  particleState = 'explosion';
  transitionTimer = 0;

  // Calculate chest core coordinate
  const rect = chestContainer.getBoundingClientRect();
  const chestX = rect.left + rect.width / 2;
  const chestY = rect.top + rect.height * 0.45; // point of opening

  updateParticleTargets();

  // Create exactly as many particles as we have targets for the "19"
  const totalParticles = targetPoints.length;

  for (let i = 0; i < totalParticles; i++) {
    // Eruption velocities: mostly upwards and outwards (polar distribution)
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5; // heading up, spread
    const speed = 4 + Math.random() * 12;

    particles.push({
      x: chestX,
      y: chestY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 2.5 + 0.8,
      opacity: 0.8 + Math.random() * 0.2,
      targetIndex: i,
      color: GOLD_COLORS[Math.floor(Math.random() * GOLD_COLORS.length)],
      angleOffset: Math.random() * Math.PI * 2,
      oscillationSpeed: 0.02 + Math.random() * 0.05,
      oscillationRadius: 1 + Math.random() * 2
    });
  }
}

// Update and Draw Exploded & Gathering Particles
function updateAndDrawParticles(time) {
  if (particleState === 'ambient') return;

  const rect = chestContainer.getBoundingClientRect();
  const chestX = rect.left + rect.width / 2;
  const chestY = rect.top + rect.height * 0.45;

  transitionTimer++;

  // After 90 frames (~1.5s), transition to gathering
  if (particleState === 'explosion' && transitionTimer > 85) {
    particleState = 'gathering';
    transitionTimer = 0;
  }

  // After 180 frames of gathering (~3s), fade in HTML texts
  if (particleState === 'gathering' && transitionTimer > 150) {
    particleState = 'formed';
    unlockedContent.classList.add('visible');
  }

  for (let p of particles) {
    if (particleState === 'explosion') {
      // Basic gravity and drag
      p.vy += 0.08; // slight gravity
      p.vx *= 0.97; // air drag
      p.vy *= 0.97;

      p.x += p.vx;
      p.y += p.vy;

      // Draw particle
      ctx.fillStyle = p.color + p.opacity.toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();

    } else if (particleState === 'gathering' || particleState === 'formed') {
      const target = targetPoints[p.targetIndex];
      if (!target) continue;

      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 3) {
        // Easing interpolation to pull particles home
        const speedLimit = 12;
        const easeDistance = 150;
        const factor = Math.min(dist / easeDistance, 1);

        const targetVx = (dx / dist) * speedLimit * factor;
        const targetVy = (dy / dist) * speedLimit * factor;

        // Blending current velocity towards target
        p.vx += (targetVx - p.vx) * 0.07;
        p.vy += (targetVy - p.vy) * 0.07;

        p.x += p.vx;
        p.y += p.vy;
      } else {
        // Micro oscillation once docked (breathing numbers)
        const timeFactor = time * p.oscillationSpeed;
        p.x = target.x + Math.sin(timeFactor + p.angleOffset) * p.oscillationRadius;
        p.y = target.y + Math.cos(timeFactor + p.angleOffset) * p.oscillationRadius;
      }

      // Render glowing particle
      ctx.fillStyle = p.color + p.opacity.toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw continuous golden glow rising from the chest base when open
  if (isChestOpened) {
    ctx.shadowBlur = 0; // reset shadow
    const grad = ctx.createLinearGradient(chestX - 60, chestY, chestX + 60, chestY - 140);
    grad.addColorStop(0, 'rgba(212, 175, 55, 0)');
    grad.addColorStop(0.3, 'rgba(212, 175, 55, 0.15)');
    grad.addColorStop(0.7, 'rgba(255, 215, 0, 0.05)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(chestX - 60, chestY + 10);
    ctx.quadraticCurveTo(chestX - 30, chestY - 140, chestX, chestY - 150);
    ctx.quadraticCurveTo(chestX + 30, chestY - 140, chestX + 60, chestY + 10);
    ctx.closePath();
    ctx.fill();
  }
}

// --- Main Animation Loop ---
let animationTime = 0;
function animate() {
  animationTime += 0.5;

  // Clear Canvas for next frame (cinematic backdrop overlay)
  ctx.fillStyle = 'rgba(3, 4, 8, 0.28)'; // persistent tail trail
  ctx.fillRect(0, 0, width, height);

  updateAndDrawStars();
  updateAndDrawAmbientDust();
  handleShootingStars();
  updateAndDrawParticles(animationTime);

  animationFrameId = requestAnimationFrame(animate);
}

// --- Countdown Logic ---
function updateCountdown() {
  const now = Date.now();
  const diff = TARGET_DATE - now;

  if (diff <= 0) {
    // Timer reached zero -> Trigger transition to Unlocked state automatically
    if (!isUnlockedState) {
      unlockSystem();
    }
    return;
  }

  // Calculate locked variables
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  // Set DOM Values (with leading zeros)
  timerDays.textContent = String(days).padStart(2, '0');
  timerHours.textContent = String(hours).padStart(2, '0');
  timerMinutes.textContent = String(minutes).padStart(2, '0');
  timerSeconds.textContent = String(seconds).padStart(2, '0');
}

// Interval variable to clear
let countdownInterval = setInterval(updateCountdown, 1000);
updateCountdown(); // Run immediately

// --- State Transitions & Locking ---

// Lock state (CountDown view active)
function lockSystem() {
  isUnlockedState = false;
  isChestOpened = false;
  particleState = 'ambient';
  particles = [];

  // UI classes
  devStateToggle.classList.remove('unlocked');
  devStateToggle.querySelector('.toggle-text').textContent = 'Preview Unlocked';

  unlockedContent.classList.remove('visible');
  unlockedView.classList.remove('active');
  chestSvg.classList.remove('opened');
  chestContainer.classList.remove('opened');

  countdownView.classList.add('active');

  // Re-establish update interval
  clearInterval(countdownInterval);
  countdownInterval = setInterval(updateCountdown, 1000);
  updateCountdown();
}

// Unlock state (Fades to black, then displays Mysterious Chest)
function unlockSystem() {
  isUnlockedState = true;
  clearInterval(countdownInterval);

  // Step 1: Fade screen to black
  flashOverlay.classList.add('active');

  setTimeout(() => {
    // Step 2: Swap sections in the dark
    countdownView.classList.remove('active');
    unlockedView.classList.add('active');

    // Reset chest elements just in case
    chestSvg.classList.remove('opened');
    chestContainer.classList.remove('opened');
    isChestOpened = false;
    particleState = 'ambient';
    particles = [];
    unlockedContent.classList.remove('visible');

    // Step 3: Fade screen back in
    setTimeout(() => {
      flashOverlay.classList.remove('active');
    }, 300);

  }, 1200); // matches the CSS transition length

  // Update dev toggle classes
  devStateToggle.classList.add('unlocked');
  devStateToggle.querySelector('.toggle-text').textContent = 'Preview Locked';
}

// --- Chest Interaction ---
chestContainer.addEventListener('click', () => {
  // Can only interact if we are actually in the unlocked state and chest is closed
  if (!isUnlockedState || isChestOpened) return;

  isChestOpened = true;
  chestContainer.classList.add('opened');
  chestSvg.classList.add('opened');

  // Spark cinematic explosion of gold particles
  setTimeout(() => {
    triggerChestExplosion();
  }, 400); // delay briefly as lid begins to rotate open
});

// --- Developer Preview Toggle ---
devStateToggle.addEventListener('click', () => {
  if (isUnlockedState) {
    lockSystem();
  } else {
    unlockSystem();
  }
});

// Window resize updates points configuration
window.addEventListener('resize', () => {
  if (particleState === 'gathering' || particleState === 'formed') {
    updateParticleTargets();
  }
});

// Init Background Sky
initAmbientSky();
animate();
