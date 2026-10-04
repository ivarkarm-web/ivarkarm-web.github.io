/**
 * physics.js
 * Ball physics state, constants, dash, keys, camera state, and gameStarted flag.
 * Ground height functions live in content.js / scenes.js for now.
 * The main update(dt) lives in scenes.js (extracted with the world update logic).
 * Depends on: utilities.js, content.js, audio.js
 */

// Ball & movement state
let x = 100;
let y = 300;
let vx = 0;
let vy = 0;
let rotation = 0;
let angularVelocity = 0;
const gravity = 0.58;
const jumpForce = 17.5;
const moveAccel = 0.85;
const maxSpeed = 15;
const airResist = 0.988;
const groundFriction = 0.925;
let onGround = false;
const ballRadius = 34;

// Dash mechanic
let dashActive = false;
let dashTimeRemaining = 0;
let dashCooldown = 0;
const DASH_SPEED = 23;
const DASH_DURATION = 0.25;
const DASH_COOLDOWN_TIME = 0.9;
const dashTrail = [];

let keys = {};
let gameStarted = false;
let currentSection = -1;
let contactIconsAnimated = false;

// Cinematic camera
let cameraX = 500 - (typeof window !== "undefined" ? window.innerWidth / 2 : 200);
let cameraY = 0;
let zoomLevel = 1;
let _zoomTarget = 1;
