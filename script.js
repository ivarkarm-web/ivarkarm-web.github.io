// Load modules
// Note: These modules are now in separate files for better organization
// cursor.js - Custom cursor animation
// canvas.js - Canvas setup and resizing
// physics.js - Physics engine and game state
// terrain.js - Terrain generation
// controls.js - Keyboard and touch controls

// For now, keeping everything in this file for simplicity
// The modular files show the intended structure for future refactoring

// Custom cursor
const cursor = document.getElementById('cursor');
let mouseX = 0;
let mouseY = 0;
let cursorX = 0;
let cursorY = 0;

document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

function animateCursor() {
  cursorX += (mouseX - cursorX) * 0.15;
  cursorY += (mouseY - cursorY) * 0.15;
  cursor.style.left = cursorX - 5 + 'px';
  cursor.style.top = cursorY - 5 + 'px';
  requestAnimationFrame(animateCursor);
}
animateCursor();

// Canvas setup
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Physics variables
let x = 100;
let y = canvas.height / 2;
let vx = 0;
let vy = 0;
let rotation = 0;
const gravity = 0.6;
const jumpForce = 18;
const moveAccel = 0.8;
const maxSpeed = 15;
const airResist = 0.985;
const groundFriction = 0.92;
let onGround = false;
const ballRadius = 34;

let keys = {};
let currentSection = -1;
let contactIconsAnimated = false;

// Music player functionality
const tracks = [
  { name: 'Track 1', url: 'https://raw.githubusercontent.com/ivarkarm-web/music/main/audio.mp3' },
  { name: 'Track 2', url: 'https://raw.githubusercontent.com/ivarkarm-web/music/main/audio%20(1).mp3' }
];
let currentTrackIndex = 0;
let isPlaying = false;

const audioPlayer = document.getElementById('audioPlayer');
const playBtn = document.getElementById('playBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const volumeSlider = document.getElementById('volumeSlider');
const trackName = document.getElementById('trackName');
const trackTime = document.getElementById('trackTime');
const progressFill = document.getElementById('progressFill');

function loadTrack(index) {
  audioPlayer.src = tracks[index].url;
  trackName.textContent = tracks[index].name;
  audioPlayer.load();
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateProgress() {
  const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
  progressFill.style.width = `${progress}%`;
  trackTime.textContent = `${formatTime(audioPlayer.currentTime)} / ${formatTime(audioPlayer.duration || 0)}`;
}

playBtn.addEventListener('click', () => {
  if (isPlaying) {
    audioPlayer.pause();
    playBtn.querySelector('.play-icon').style.display = 'block';
    playBtn.querySelector('.pause-icon').style.display = 'none';
  } else {
    audioPlayer.play();
    playBtn.querySelector('.play-icon').style.display = 'none';
    playBtn.querySelector('.pause-icon').style.display = 'block';
  }
  isPlaying = !isPlaying;
});

prevBtn.addEventListener('click', () => {
  currentTrackIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
  loadTrack(currentTrackIndex);
  if (isPlaying) audioPlayer.play();
});

nextBtn.addEventListener('click', () => {
  currentTrackIndex = (currentTrackIndex + 1) % tracks.length;
  loadTrack(currentTrackIndex);
  if (isPlaying) audioPlayer.play();
});

volumeSlider.addEventListener('input', (e) => {
  audioPlayer.volume = e.target.value;
});

audioPlayer.addEventListener('timeupdate', updateProgress);
audioPlayer.addEventListener('ended', () => {
  currentTrackIndex = (currentTrackIndex + 1) % tracks.length;
  loadTrack(currentTrackIndex);
  if (isPlaying) audioPlayer.play();
});

// Initialize first track
loadTrack(0);
audioPlayer.volume = 0.7;

// Section positions for parallax scrolling
const sectionPositions = [
  { x: 500, index: 0 },
  { x: 2000, index: 1 },
  { x: 3800, index: 2 },
  { x: 5600, index: 3 },
  { x: 7400, index: 4 },
  { x: 9200, index: 5 },
  { x: 11000, index: 6 },
  { x: 11900, index: 7 },
  { x: 15000, index: 8 }
];

const parallaxSpeed = 0.3;

// Terrain generation
function getGround(worldX) {
  const base = canvas.height * 0.72;
  const wave1 = Math.sin(worldX * 0.0012) * 180;
  const wave2 = Math.sin(worldX * 0.0028) * 90;
  const wave3 = Math.sin(worldX * 0.005) * 40;
  const wave4 = Math.sin(worldX * 0.012) * 15;
  const wave5 = Math.sin(worldX * 0.025) * 5;
  
  let hillBarrier = 0;
  if (worldX > 15800) {
    const hillProgress = (worldX - 15800) / 500;
    hillBarrier = Math.pow(hillProgress, 2) * 800; // Mountain going UP
  }
  
  return base + wave1 + wave2 + wave3 + wave4 + wave5 - hillBarrier;
}

function getSlope(worldX) {
  const delta = 1;
  return (getGround(worldX + delta) - getGround(worldX - delta)) / (2 * delta);
}

// Controls
document.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;
  
  if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(e.code)) {
    e.preventDefault();
  }
  
  const visibleSection = document.querySelector('.section.visible.scrollable');
  if (visibleSection) {
    const scrollAmount = 60;
    if (e.key === 'w' || e.key === 'ArrowUp') {
      visibleSection.scrollTop -= scrollAmount;
    }
    if (e.key === 's' || e.key === 'ArrowDown') {
      visibleSection.scrollTop += scrollAmount;
    }
  }
});
document.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

// MOBILE RAGDOLL: Direct handpan grab & toss physics
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let isTouching = false;
let isGrabbingHandpan = false;
let grabFingerX = 0; // Current finger position
let grabHandpanOffsetX = 0; // Offset between finger and handpan center
let lastFingerX = 0;
let lastFingerTime = 0;
let fingerVelocityX = 0;

function isTouchOnHandpan(touchX, touchY) {
  const screenCenterX = canvas.width / 2;
  const handpanScreenX = screenCenterX + (x - canvas.width / 2) * 0.3; // Account for parallax
  const distance = Math.sqrt(Math.pow(touchX - handpanScreenX, 2) + Math.pow(touchY - y, 2));
  return distance < ballRadius * 2.0; // Generous hit area
}

function getHandpanScreenX() {
  const screenCenterX = canvas.width / 2;
  return screenCenterX + (x - canvas.width / 2) * 0.3; // Account for parallax
}

// Touch events - RAGDOLL style
document.addEventListener('touchstart', e => {
  const target = e.target;
  const isInteractive = target.closest('a, button, input, .btn, .qr-button, .social-btn, .nav-links, .qr-close, .qr-content, .qr-popup');
  if (isInteractive) return;
  
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  touchStartTime = Date.now();
  lastFingerX = touch.clientX;
  lastFingerTime = Date.now();
  fingerVelocityX = 0;
  
  // Check if touching the handpan directly
  if (isTouchOnHandpan(touchStartX, touchStartY)) {
    isGrabbingHandpan = true;
    isTouching = true;
    grabFingerX = touchStartX;
    grabHandpanOffsetX = getHandpanScreenX() - touchStartX;
    vx = 0; // Stop current movement when grabbed
    e.preventDefault();
    return;
  }
  
  // Otherwise handle as scroll or jump
  const visibleSection = document.querySelector('.section.visible.scrollable');
  if (visibleSection) {
    isTouching = true;
  }
}, { passive: false });

document.addEventListener('touchmove', e => {
  if (!isTouching && !isGrabbingHandpan) return;
  
  const target = e.target;
  const isInteractive = target.closest('a, button, input, .btn, .qr-button, .social-btn, .nav-links, .qr-close, .qr-content, .qr-popup');
  if (isInteractive) return;
  
  const touch = e.touches[0];
  const now = Date.now();
  
  // Track finger velocity for throw calculation
  const dt = now - lastFingerTime;
  if (dt > 0) {
    fingerVelocityX = (touch.clientX - lastFingerX) / dt;
  }
  lastFingerX = touch.clientX;
  lastFingerTime = now;
  
  // RAGDOLL: If grabbing handpan, it follows finger with some drag
  if (isGrabbingHandpan) {
    grabFingerX = touch.clientX;
    e.preventDefault();
    return;
  }
  
  // Handle scrollable sections
  const visibleSection = document.querySelector('.section.visible.scrollable');
  if (visibleSection && isTouching) {
    const deltaY = touchStartY - touch.clientY;
    visibleSection.scrollTop += deltaY * 0.5;
    touchStartY = touch.clientY;
  }
}, { passive: false });

document.addEventListener('touchend', e => {
  if (!isTouching && !isGrabbingHandpan) return;
  
  const touchEndTime = Date.now();
  const touchEndX = e.changedTouches[0].clientX;
  const touchEndY = e.changedTouches[0].clientY;
  const deltaX = touchEndX - touchStartX;
  const deltaY = Math.abs(touchEndY - touchStartY);
  const holdTime = touchEndTime - touchStartTime;
  
  // RAGDOLL TOSS: Release handpan with finger velocity
  if (isGrabbingHandpan) {
    // Apply throw based on tracked finger velocity + release flick
    const releaseVelocity = (touchEndX - lastFingerX) / Math.max(touchEndTime - lastFingerTime, 1);
    const tossVelocity = fingerVelocityX * 25 + releaseVelocity * 15;
    vx += tossVelocity;
    isGrabbingHandpan = false;
  }
  // Jump on quick tap (not grab, minimal movement)
  else if (holdTime < 200 && Math.abs(deltaX) < 30 && deltaY < 30 && onGround) {
    vy = -jumpForce;
    onGround = false;
  }
  
  isTouching = false;
  fingerVelocityX = 0;
}, { passive: false });

document.addEventListener('touchcancel', e => {
  if (isGrabbingHandpan) {
    isGrabbingHandpan = false;
  }
  isTouching = false;
  fingerVelocityX = 0;
});

// Navigation clicks
document.querySelectorAll('.nav-links a').forEach((link, index) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    if (index < sectionPositions.length) {
      x = sectionPositions[index].x;
      vx = 0;
      vy = 0;
    }
  });
});


// Cartoonish clouds (optimized - smaller and higher to avoid text)
const clouds = [];
const numClouds = 6; // Reduced from 12 for better performance

for (let i = 0; i < numClouds; i++) {
  clouds.push({
    x: Math.random() * 13300,
    y: 30 + Math.random() * 80, // Higher in sky (30-110px) to avoid text
    width: 80 + Math.random() * 80, // Smaller clouds (80-160px)
    height: 40 + Math.random() * 40, // Shorter (40-80px)
    speed: 0.2 + Math.random() * 0.3,
    puffs: 3 + Math.floor(Math.random() * 2) // Fewer puffs for smaller clouds
  });
}

// Trees removed - they looked horrible

// Street lamps positioned next to each section
const streetLamps = [
  { x: 2500, height: 300, hasLight: true },  // Near About
  { x: 4300, height: 320, hasLight: true },  // Near Story
  { x: 6100, height: 290, hasLight: true },  // Near Manifesto
  { x: 7900, height: 310, hasLight: true },  // Near Media
  { x: 9700, height: 300, hasLight: true },  // Near Music
  { x: 11500, height: 280, hasLight: true },  // Near Videos
  { x: 12400, height: 300, hasLight: true },  // Near Partners
  { x: 15500, height: 290, hasLight: true }   // Near Contact
];

function drawClouds(ctx, offset) {
  clouds.forEach(cloud => {
    // Cloud drift - reset when they go off screen
    if (cloud.x > 16500) cloud.x = -200;
    
    const screenX = cloud.x - offset * 0.1; // parallax - slower than ball
    
    if (screenX > -300 && screenX < canvas.width + 300) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
      ctx.lineWidth = 2;
      
      // Draw cloud as multiple puffs
      for (let i = 0; i < cloud.puffs; i++) {
        const puffX = screenX + (i * cloud.width * 0.25);
        const puffY = cloud.y + Math.sin(i) * 10;
        const puffRadius = cloud.height * (0.6 + i * 0.1);
        
        ctx.beginPath();
        ctx.arc(puffX, puffY, puffRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  });
}

function drawTrees(ctx, offset) {
  trees.forEach(tree => {
    const screenX = tree.x - offset;
    
    if (screenX < -200 || screenX > canvas.width + 200) return;
    
    const groundY = getGround(tree.x);
    
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (tree.type === 'pine') {
      // Organic pine tree with branch silhouettes
      const trunkHeight = tree.height * 0.4;
      const trunkWidth = tree.width * 0.15;
      
      // Main trunk - slightly curved
      ctx.lineWidth = trunkWidth;
      ctx.beginPath();
      ctx.moveTo(screenX, groundY);
      ctx.quadraticCurveTo(screenX + 5, groundY - trunkHeight * 0.5, screenX - 3, groundY - trunkHeight);
      ctx.stroke();
      
      // Branch layers - organic curves
      const layers = 4;
      for (let i = 0; i < layers; i++) {
        const layerY = groundY - trunkHeight * 0.3 - (i * tree.height * 0.2);
        const layerWidth = tree.width * (0.8 - i * 0.15);
        
        ctx.lineWidth = 2 + Math.random() * 2;
        
        // Left branch
        ctx.beginPath();
        ctx.moveTo(screenX - 3, layerY);
        ctx.quadraticCurveTo(screenX - layerWidth * 0.3, layerY - 20, screenX - layerWidth * 0.5, layerY - 30);
        ctx.stroke();
        
        // Right branch
        ctx.beginPath();
        ctx.moveTo(screenX - 3, layerY);
        ctx.quadraticCurveTo(screenX + layerWidth * 0.3, layerY - 20, screenX + layerWidth * 0.5, layerY - 30);
        ctx.stroke();
        
        // Small twig details
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(screenX - layerWidth * 0.3, layerY - 15);
        ctx.lineTo(screenX - layerWidth * 0.4, layerY - 25);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(screenX + layerWidth * 0.3, layerY - 15);
        ctx.lineTo(screenX + layerWidth * 0.4, layerY - 25);
        ctx.stroke();
      }
    } else {
      // Organic deciduous tree with spreading branches
      const trunkHeight = tree.height * 0.5;
      const trunkWidth = tree.width * 0.12;
      
      // Main trunk - curved and slightly tapered
      ctx.lineWidth = trunkWidth;
      ctx.beginPath();
      ctx.moveTo(screenX, groundY);
      ctx.quadraticCurveTo(screenX + 8, groundY - trunkHeight * 0.4, screenX - 5, groundY - trunkHeight);
      ctx.stroke();
      
      // Main branches spreading outward
      const branches = [
        { angle: -0.6, length: tree.height * 0.35 },
        { angle: -0.3, length: tree.height * 0.45 },
        { angle: 0.1, length: tree.height * 0.4 },
        { angle: 0.4, length: tree.height * 0.35 },
        { angle: 0.7, length: tree.height * 0.25 }
      ];
      
      branches.forEach((branch, i) => {
        const startX = screenX - 5;
        const startY = groundY - trunkHeight * (0.3 + i * 0.15);
        const endX = startX + Math.sin(branch.angle) * branch.length;
        const endY = startY - Math.cos(branch.angle) * branch.length;
        
        ctx.lineWidth = 3 - i * 0.4;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(
          startX + Math.sin(branch.angle) * branch.length * 0.5,
          startY - Math.cos(branch.angle) * branch.length * 0.5 - 10,
          endX, endY
        );
        ctx.stroke();
        
        // Small twigs on branches
        if (i < 3) {
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(endX, endY);
          ctx.lineTo(endX + Math.sin(branch.angle + 0.3) * 20, endY - Math.cos(branch.angle + 0.3) * 20);
          ctx.stroke();
          
          ctx.beginPath();
          ctx.moveTo(endX, endY);
          ctx.lineTo(endX + Math.sin(branch.angle - 0.3) * 15, endY - Math.cos(branch.angle - 0.3) * 15);
          ctx.stroke();
        }
      });
    }
  });
}

function drawStreetLamps(ctx, offset) {
  const isDarkMode = document.body.classList.contains('dark-mode');
  
  streetLamps.forEach(lamp => {
    const screenX = lamp.x - offset;
    
    if (screenX < -200 || screenX > canvas.width + 200) return;
    
    const groundY = getGround(lamp.x);
    const poleHeight = lamp.height;
    const poleWidth = 6;
    const armLength = 70;
    
    // Adjust color based on dark mode
    const strokeColor = isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';
    ctx.strokeStyle = strokeColor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Main pole - slightly tapered with ornate base
    ctx.lineWidth = poleWidth;
    ctx.beginPath();
    ctx.moveTo(screenX, groundY);
    ctx.lineTo(screenX, groundY - poleHeight);
    ctx.stroke();
    
    // Ornate base - curved flourish
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(screenX - poleWidth/2, groundY);
    ctx.quadraticCurveTo(screenX - 15, groundY - 10, screenX - poleWidth/2, groundY - 20);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(screenX + poleWidth/2, groundY);
    ctx.quadraticCurveTo(screenX + 15, groundY - 10, screenX + poleWidth/2, groundY - 20);
    ctx.stroke();
    
    // Decorative mid-section
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(screenX - 8, groundY - poleHeight * 0.6);
    ctx.lineTo(screenX + 8, groundY - poleHeight * 0.6);
    ctx.stroke();
    
    // Curved arm - elegant sweep
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(screenX, groundY - poleHeight);
    ctx.quadraticCurveTo(screenX + 20, groundY - poleHeight - 10, screenX + armLength, groundY - poleHeight + 5);
    ctx.stroke();
    
    // Ornate lamp head - Victorian style
    const lampHeadX = screenX + armLength;
    const lampHeadY = groundY - poleHeight + 5;
    
    // Main fixture body
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lampHeadX - 15, lampHeadY);
    ctx.lineTo(lampHeadX + 15, lampHeadY);
    ctx.lineTo(lampHeadX + 10, lampHeadY + 25);
    ctx.lineTo(lampHeadX - 10, lampHeadY + 25);
    ctx.closePath();
    ctx.stroke();
    
    // Decorative top flourish
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lampHeadX, lampHeadY);
    ctx.quadraticCurveTo(lampHeadX - 5, lampHeadY - 15, lampHeadX, lampHeadY - 20);
    ctx.quadraticCurveTo(lampHeadX + 5, lampHeadY - 15, lampHeadX, lampHeadY);
    ctx.stroke();
    
    // Light glow - only in dark mode, directional downward with blur
    if (lamp.hasLight && isDarkMode) {
      const glowOpacity = 0.4;
      const lightHeight = 250;
      const lightWidth = 180;
      
      // Apply blur for realistic light
      ctx.save();
      ctx.shadowBlur = 30;
      ctx.shadowColor = 'rgba(255, 255, 200, 0.5)';
      
      // Downward cone of light with gradient
      const gradient = ctx.createLinearGradient(
        lampHeadX, lampHeadY + 12,
        lampHeadX, groundY
      );
      gradient.addColorStop(0, `rgba(255, 255, 200, ${glowOpacity})`);
      gradient.addColorStop(0.3, `rgba(255, 255, 200, ${glowOpacity * 0.6})`);
      gradient.addColorStop(0.7, `rgba(255, 255, 200, ${glowOpacity * 0.3})`);
      gradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(lampHeadX, lampHeadY + 12);
      ctx.lineTo(lampHeadX - lightWidth * 0.5, groundY);
      ctx.lineTo(lampHeadX + lightWidth * 0.5, groundY);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
      
      // Small glow at the light source
      ctx.fillStyle = `rgba(255, 255, 200, ${glowOpacity * 0.8})`;
      ctx.beginPath();
      ctx.arc(lampHeadX, lampHeadY + 12, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// Firefly particles that follow the handpan
const fireflies = [];
const numFireflies = 15;

for (let i = 0; i < numFireflies; i++) {
  fireflies.push({
    offsetX: (Math.random() - 0.5) * 300,
    offsetY: (Math.random() - 0.5) * 200,
    phase: Math.random() * Math.PI * 2,
    speed: 0.008 + Math.random() * 0.012,
    size: 2 + Math.random() * 2,
    brightness: 0.5 + Math.random() * 0.5
  });
}

function drawFireflies(ctx, screenX, screenY) {
  const isDarkMode = document.body.classList.contains('dark-mode');
  
  // Only show fireflies in dark mode
  if (!isDarkMode) return;
  
  fireflies.forEach(firefly => {
    firefly.phase += firefly.speed;
    const orbitRadius = 100 + Math.sin(firefly.phase * 0.5) * 50;
    const angle = firefly.phase;
    const fx = screenX + Math.cos(angle) * orbitRadius + firefly.offsetX;
    const fy = screenY + Math.sin(angle) * orbitRadius * 0.6 + firefly.offsetY;
    const pulse = 0.5 + Math.sin(firefly.phase * 2) * 0.5;
    const alpha = firefly.brightness * pulse;
    
    // Different colors for light vs dark mode
    let color1, color2, color3;
    if (isDarkMode) {
      color1 = `rgba(255, 255, 150, ${alpha})`;
      color2 = `rgba(255, 255, 100, ${alpha * 0.3})`;
      color3 = `rgba(255, 255, 100, 0)`;
    } else {
      color1 = `rgba(100, 150, 255, ${alpha})`;
      color2 = `rgba(80, 130, 230, ${alpha * 0.3})`;
      color3 = `rgba(80, 130, 230, 0)`;
    }
    
    const gradient = ctx.createRadialGradient(fx, fy, 0, fx, fy, firefly.size * 4);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(0.5, color2);
    gradient.addColorStop(1, color3);
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(fx, fy, firefly.size * 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = isDarkMode ? `rgba(255, 255, 200, ${alpha})` : `rgba(150, 180, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(fx, fy, firefly.size, 0, Math.PI * 2);
    ctx.fill();
  });
}

// Subtle particles (optimized)
const particles = Array.from({ length: 30 }, () => ({ // Reduced from 60 for better performance
  x: Math.random() * 13300,
  y: Math.random() * window.innerHeight * 0.6,
  size: Math.random() * 1.5 + 0.5,
  opacity: Math.random() * 0.15 + 0.05,
  drift: Math.random() * 0.3 - 0.15
}));

function drawParticles(offset) {
  const isDarkMode = document.body.classList.contains('dark-mode');
  ctx.fillStyle = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  
  particles.forEach(p => {
    const screenX = p.x - offset * 0.05; // Very slow parallax
    if (screenX > -10 && screenX < canvas.width + 10) {
      ctx.globalAlpha = p.opacity;
      ctx.beginPath();
      ctx.arc(screenX, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.globalAlpha = 1;
}

// Draw terrain - clean black line with grass and clouds
function drawGround(offset) {
  ctx.save();
  
  // Draw clouds first (background)
  drawClouds(ctx, offset);
  
  // Draw street lamps (behind terrain line)
  drawStreetLamps(ctx, offset);
  
  // Draw terrain line
  ctx.beginPath();
  for (let i = 0; i <= canvas.width; i += 1) {
    let worldX = i + offset;
    let groundY = getGround(worldX);
    if (i === 0) {
      ctx.moveTo(i, groundY);
    } else {
      ctx.lineTo(i, groundY);
    }
  }
  
  // Terrain color - white in dark mode, black in light mode
  const isDarkMode = document.body.classList.contains('dark-mode');
  ctx.strokeStyle = isDarkMode ? '#fff' : '#000';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  
  ctx.restore();
}

function drawParticles(offset) {
  const isDarkMode = document.body.classList.contains('dark-mode');
  
  // Only show particles in dark mode
  if (!isDarkMode) return;
  
  particles.forEach(particle => {
    const screenX = particle.x - offset * 0.2;
    particle.y += particle.drift;
    
    if (particle.y > canvas.height || particle.y < 0) {
      particle.y = Math.random() * canvas.height * 0.6;
    }
    
    if (screenX > -10 && screenX < canvas.width + 10) {
      ctx.fillStyle = `rgba(0, 0, 0, ${particle.opacity})`;
      ctx.beginPath();
      ctx.arc(screenX, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// Update sections based on ball position with parallax
function updateSections() {
  const screenCenterX = canvas.width / 2;
  const offset = x - screenCenterX;
  
  sectionPositions.forEach((pos, index) => {
    const sectionEl = document.getElementById('s' + index);
    if (!sectionEl) return;
    
    // Calculate distance from ball to this section
    const sectionWorldX = pos.x;
    const distance = sectionWorldX - x;
    
    // Parallax: sections move slower than ball, creating depth
    const parallaxX = distance * parallaxSpeed;
    
    // Vertical offset based on terrain at that position for visual interest
    const terrainY = getGround(sectionWorldX);
    const verticalOffset = (canvas.height * 0.5 - terrainY) * 0.3;
    
    // Apply transform - text scrolls with ball at reduced speed
    sectionEl.style.transform = `translate(calc(-50% + ${parallaxX}px), calc(-50% + ${verticalOffset}px))`;
    
    // Visibility based on proximity
    const distanceAbs = Math.abs(distance);
    if (distanceAbs < 800) {
      sectionEl.classList.add('visible');
      // Fade based on distance (slower fade-in)
      const opacity = 1 - (distanceAbs / 800);
      sectionEl.style.opacity = Math.max(0, opacity);
      
      // Add visible class to contact icons when contact section becomes visible
      if (index === 8 && sectionEl.classList.contains('visible') && !contactIconsAnimated) {
        const contactIcons = sectionEl.querySelectorAll('.contact-icon');
        contactIcons.forEach((icon) => {
          icon.classList.add('visible');
        });
        contactIconsAnimated = true;
      }
    } else {
      sectionEl.classList.remove('visible');
      sectionEl.style.opacity = 0;
    }
  });
  
  // Update progress dots based on nearest section
  let nearestSection = 0;
  let minDistance = Infinity;
  sectionPositions.forEach((pos, index) => {
    const dist = Math.abs(x - pos.x);
    if (dist < minDistance) {
      minDistance = dist;
      nearestSection = index;
    }
  });
  
  if (currentSection !== nearestSection) {
    document.querySelectorAll('.progress-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === nearestSection);
    });
    currentSection = nearestSection;
  }
}

// Physics update - continuous movement for desktop, throw for mobile
function update() {
  // DESKTOP: Continuous movement with A/D keys
  if (keys['a'] || keys['arrowleft']) {
    vx -= moveAccel;
  }
  if (keys['d'] || keys['arrowright']) {
    vx += moveAccel;
  }
  
  // Speed cap
  vx = Math.max(-maxSpeed, Math.min(maxSpeed, vx));
  
  // Apply friction/resistance
  if (onGround) {
    vx *= groundFriction;
  } else {
    vx *= airResist;
  }
  
  // Gravity
  vy += gravity;
  
  // Update position
  x += vx;
  y += vy;
  
  // Update rotation - roll based on distance traveled
  rotation += vx / ballRadius;
  
  // Ground collision with smooth slope interaction
  const ground = getGround(x);
  
  if (y + ballRadius >= ground) {
    y = ground - ballRadius;
    
    // Bounce damping
    if (vy > 2) {
      vy = -vy * 0.3;
    } else {
      vy = 0;
      onGround = true;
    }
    
    // Slope influence - smoother
    const slope = getSlope(x);
    vx += slope * 0.5;
    
    // Extra resistance on ending hill (15800+) - makes it harder to climb
    if (x > 15800 && slope > 0.3) {
      vx *= 0.92; // Additional friction on steep uphill
    }
  } else {
    onGround = false;
  }
  
  // Jump with space only (clean separation from text scrolling)
  if (keys[' '] && onGround) {
    vy = -jumpForce;
    onGround = false;
  }
  
  // Continuous scroll for visible scrollable sections when holding W/S
  const visibleScrollable = document.querySelector('.section.visible.scrollable');
  if (visibleScrollable) {
    if (keys['w']) {
      visibleScrollable.scrollTop -= 5;
    }
    if (keys['s']) {
      visibleScrollable.scrollTop += 5;
    }
  }
  
  // Update sections with parallax scrolling
  updateSections();
  
  // Bounds - keep ball within world
  if (x < 100) {
    x = 100;
    vx = 0;
  }
  
  // End of world bound
  const maxWorldX = sectionPositions[sectionPositions.length - 1].x + 1000;
  if (x > maxWorldX) {
    x = maxWorldX;
    vx = 0;
  }
}

// Draw handpan instead of ball
function drawBall(screenX, screenY) {
  ctx.save();
  
  // Move to ball position and rotate
  ctx.translate(screenX, screenY);
  ctx.rotate(rotation);
  
  // Shadow beneath handpan (draw before rotation, at ground position)
  if (onGround) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform for shadow
    const shadowY = getGround(x) + 8;
    const shadowSize = ballRadius * 0.8;
    const gradient = ctx.createRadialGradient(screenX, shadowY, 0, screenX, shadowY, shadowSize);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.2)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(screenX, shadowY, shadowSize, shadowSize * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  
  // Draw handpan centered at origin (0,0) since we translated
  const r = ballRadius;
  const screenX_local = 0;
  const screenY_local = 0;
  
  // Handpan base - golden UFO shape
  const baseGrad = ctx.createRadialGradient(
    screenX_local, screenY_local - r * 0.3, 0,
    screenX_local, screenY_local, r
  );
  baseGrad.addColorStop(0, '#d4af37');
  baseGrad.addColorStop(0.5, '#b8941f');
  baseGrad.addColorStop(1, '#8a6f0f');
  
  ctx.fillStyle = baseGrad;
  ctx.beginPath();
  ctx.arc(screenX_local, screenY_local, r, 0, Math.PI * 2);
  ctx.fill();
  
  // Outer rim
  ctx.strokeStyle = '#e5c158';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(screenX_local, screenY_local, r * 0.95, 0, Math.PI * 2);
  ctx.stroke();
  
  // Central dome (ding) - golden
  const domeGrad = ctx.createRadialGradient(
    screenX_local - r * 0.2, screenY_local - r * 0.3, 0,
    screenX_local, screenY_local, r * 0.5
  );
  domeGrad.addColorStop(0, '#f4d03f');
  domeGrad.addColorStop(1, '#c9a227');
  
  ctx.fillStyle = domeGrad;
  ctx.beginPath();
  ctx.arc(screenX_local, screenY_local - r * 0.1, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
  
  // Note dimples around the dome (handpan notes)
  const noteCount = 7;
  const noteRadius = r * 0.15;
  const noteDist = r * 0.6;
  
  for (let i = 0; i < noteCount; i++) {
    const angle = (i / noteCount) * Math.PI * 2 - Math.PI / 2;
    const noteX = screenX_local + Math.cos(angle) * noteDist;
    const noteY = screenY_local + Math.sin(angle) * noteDist * 0.8 - r * 0.05;
    
    // Note indentation
    ctx.fillStyle = '#9a7b1f';
    ctx.beginPath();
    ctx.ellipse(noteX, noteY, noteRadius, noteRadius * 0.7, angle, 0, Math.PI * 2);
    ctx.fill();
    
    // Note highlight
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(noteX - 2, noteY - 2, noteRadius * 0.6, noteRadius * 0.4, angle, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Bottom port hole
  ctx.fillStyle = '#5a4a0a';
  ctx.beginPath();
  ctx.arc(screenX_local, screenY_local + r * 0.5, r * 0.15, 0, Math.PI * 2);
  ctx.fill();
  
  // Shine/highlight
  const shineGrad = ctx.createRadialGradient(
    screenX_local - r * 0.3, screenY_local - r * 0.4, 0,
    screenX_local - r * 0.3, screenY_local - r * 0.4, r * 0.3
  );
  shineGrad.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
  shineGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = shineGrad;
  ctx.beginPath();
  ctx.arc(screenX_local - r * 0.2, screenY_local - r * 0.2, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

// Main draw function
function draw(offset) {
  // Clear canvas with appropriate background color
  const isDarkMode = document.body.classList.contains('dark-mode');
  ctx.fillStyle = isDarkMode ? '#000' : '#fafbfc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw subtle particles
  drawParticles(offset);
  
  // Draw terrain
  drawGround(offset);
  
  // Draw ball at center of screen
  const screenX = canvas.width / 2;
  
  // Draw grab connection line if handpan is being held
  if (isGrabbingHandpan) {
    ctx.save();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.6)';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(grabFingerX, y - 100);
    ctx.lineTo(screenX, y);
    ctx.stroke();
    ctx.restore();
    
    // Draw glow around handpan when grabbed
    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#d4af37';
    drawBall(screenX, y);
    ctx.restore();
  } else {
    drawBall(screenX, y);
  }
  
  // Draw fireflies following handpan (only in dark mode)
  drawFireflies(ctx, screenX, y);
}

// Main loop with smooth timing
let lastTime = 0;
let isPaused = false;
let animationId = null;

function loop(currentTime) {
  if (isPaused) {
    animationId = requestAnimationFrame(loop);
    return;
  }
  
  const deltaTime = currentTime - lastTime;
  lastTime = currentTime;
  
  update();
  const offset = x - canvas.width / 2;
  draw(offset);
  animationId = requestAnimationFrame(loop);
}

// Pause animation when tab is inactive
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    isPaused = true;
  } else {
    isPaused = false;
    lastTime = performance.now();
  }
});

// Fade-in images when their section becomes visible
function updateFadeImages() {
  const sectionImages = document.querySelectorAll('.section-image');
  sectionImages.forEach(img => {
    const sectionIndex = parseInt(img.dataset.section);
    const sectionEl = document.getElementById('s' + sectionIndex);
    if (sectionEl && sectionEl.classList.contains('visible')) {
      img.classList.add('visible');
    } else {
      img.classList.remove('visible');
    }
  });
}

// Slideshow for Media section - random shuffle, slower transitions
let currentSlide = 0;
let isTransitioning = false;
let slides = [];
let slideOrder = [];
const fadeDuration = 1200; // slower fade
const displayDuration = 5000; // show each image longer

// Shuffle array function
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function initSlideshow() {
  slides = Array.from(document.querySelectorAll('.slideshow-image'));
  if (slides.length === 0) return;
  
  // Create random order
  slideOrder = shuffleArray([...Array(slides.length).keys()]);
  currentSlide = 0;
  
  // Set initial positions
  slides.forEach((slide, i) => {
    slide.style.position = 'absolute';
    slide.style.top = '10px';
    slide.style.left = '50%';
    slide.style.transform = 'translateX(120%)';
    slide.style.opacity = '0';
    slide.classList.remove('active');
  });
  
  // First random image visible
  const firstIndex = slideOrder[0];
  slides[firstIndex].style.transform = 'translateX(-50%)';
  slides[firstIndex].style.opacity = '1';
  slides[firstIndex].classList.add('active');
}

function cycleSlideshow() {
  if (slides.length === 0 || isTransitioning) return;
  isTransitioning = true;
  
  const currentIndex = slideOrder[currentSlide];
  const currentImg = slides[currentIndex];
  
  // Move to next in random order
  currentSlide = (currentSlide + 1) % slideOrder.length;
  
  // Reshuffle when we've shown all images
  if (currentSlide === 0) {
    slideOrder = shuffleArray([...Array(slides.length).keys()]);
  }
  
  const nextIndex = slideOrder[currentSlide];
  const nextImg = slides[nextIndex];
  
  // Step 1: Fade out current
  currentImg.classList.remove('active');
  currentImg.classList.add('fading-out');
  
  // Step 2: Position next image off-screen
  nextImg.style.transform = 'translateX(120%)';
  nextImg.style.opacity = '0';
  nextImg.classList.remove('fading-out');
  
  // Step 3: Fade in next
  setTimeout(() => {
    currentImg.classList.remove('fading-out');
    currentImg.style.transform = '';
    
    nextImg.style.transition = `transform ${fadeDuration}ms ease-out, opacity ${fadeDuration}ms ease-out`;
    nextImg.style.transform = 'translateX(-50%)';
    nextImg.style.opacity = '1';
    nextImg.classList.add('active');
    
    isTransitioning = false;
  }, fadeDuration);
}

// Start slideshow after a short delay to ensure DOM is ready
setTimeout(() => {
  initSlideshow();
  if (slides.length > 0) {
    setInterval(cycleSlideshow, displayDuration + fadeDuration);
  }
}, 500);

// Start
requestAnimationFrame(loop);

// Initial section update
setTimeout(() => {
  updateSections();
  updateFadeImages();
}, 100);

// Lazy load videos when they come into view
const videoObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const iframe = entry.target;
      const src = iframe.getAttribute('data-src');
      if (src) {
        iframe.setAttribute('src', src);
        videoObserver.unobserve(iframe);
      }
    }
  });
}, {
  rootMargin: '200px'
});

// Observe all iframes with data-src
document.querySelectorAll('iframe[data-src]').forEach(iframe => {
  videoObserver.observe(iframe);
});

// QR Code Popup Functions
function showQRPopup() {
  const popup = document.getElementById('qrPopup');
  popup.classList.add('visible');
}

function hideQRPopup() {
  const popup = document.getElementById('qrPopup');
  popup.classList.remove('visible');
}

// Add event listener for close button
document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.querySelector('.qr-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideQRPopup();
    });
  }
});

// Also close QR popup on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    hideQRPopup();
  }
});

// Auto-show QR popup when reaching Contact section
let qrPopupShown = false;
let qrPopupTimer = null;

// Auto-scroll functionality for scrollable sections
const autoScrollState = {
  s2: { scrolling: false, interval: null, speed: 0.5 }
};

function startAutoScroll(sectionId) {
  const section = document.getElementById(sectionId);
  const content = section.querySelector('.scroll-content');
  if (!content) return;
  
  if (autoScrollState[sectionId].interval) {
    clearInterval(autoScrollState[sectionId].interval);
  }
  
  autoScrollState[sectionId].scrolling = true;
  autoScrollState[sectionId].interval = setInterval(() => {
    if (autoScrollState[sectionId].scrolling) {
      content.scrollTop += autoScrollState[sectionId].speed;
      
      // Stop if reached bottom
      if (content.scrollTop >= content.scrollHeight - content.clientHeight) {
        content.scrollTop = 0; // Loop back to top
      }
    }
  }, 16); // ~60fps
}

function stopAutoScroll(sectionId) {
  autoScrollState[sectionId].scrolling = false;
  if (autoScrollState[sectionId].interval) {
    clearInterval(autoScrollState[sectionId].interval);
    autoScrollState[sectionId].interval = null;
  }
}

function toggleAutoScroll(sectionId) {
  const state = autoScrollState[sectionId];
  const button = document.querySelector(`.scroll-toggle[data-section="${sectionId}"]`);
  
  if (state.scrolling) {
    state.scrolling = false;
    if (button) button.textContent = 'Resume';
  } else {
    state.scrolling = true;
    if (button) button.textContent = 'Pause';
  }
}

// Add event listeners for scroll toggle buttons
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.scroll-toggle').forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const sectionId = button.getAttribute('data-section');
      toggleAutoScroll(sectionId);
    });
  });
  
  // Hamburger menu toggle
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      navLinks.classList.toggle('active');
    });
    
    // Close menu when clicking a link
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navLinks.classList.remove('active');
      });
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
        hamburger.classList.remove('active');
        navLinks.classList.remove('active');
      }
    });
  }
  
  // Dark mode toggle
  const darkModeToggle = document.getElementById('darkModeToggle');
  if (darkModeToggle) {
    darkModeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      document.documentElement.classList.toggle('dark-mode');
    });
  }
});

// Hook into updateSections to also update fade images and show QR popup
const originalUpdateSections = updateSections;
updateSections = function() {
  originalUpdateSections();
  updateFadeImages();
  
  // Hide instructions when moving past first section
  const instructions = document.querySelector('.instructions');
  if (instructions) {
    if (x > 600) {
      instructions.classList.add('hidden');
    } else {
      instructions.classList.remove('hidden');
    }
  }
  
  // Handle auto-scroll for scrollable sections
  ['s2'].forEach(sectionId => {
    const section = document.getElementById(sectionId);
    const button = document.querySelector(`.scroll-toggle[data-section="${sectionId}"]`);
    
    if (currentSection === parseInt(sectionId.slice(1))) {
      // Section is active - start auto-scroll
      if (!autoScrollState[sectionId].interval) {
        startAutoScroll(sectionId);
        if (button) button.textContent = 'Pause';
      }
    } else {
      // Section is not active - stop auto-scroll
      stopAutoScroll(sectionId);
      if (button) button.textContent = 'Pause';
    }
  });
  
  // Show QR popup when player actually reaches Contact section position
  if (currentSection === 8 && !qrPopupShown && x > 14700) {
    qrPopupTimer = setTimeout(() => {
      if (currentSection === 8 && !qrPopupShown) {
        const qrPopup = document.getElementById('qrPopup');
        qrPopup.classList.add('visible');
        qrPopupShown = true;
      }
    }, 2000);
  } else if (currentSection !== 8 || x <= 14700) {
    // Reset timer if player leaves the area
    if (qrPopupTimer) {
      clearTimeout(qrPopupTimer);
      qrPopupTimer = null;
    }
  }
};
