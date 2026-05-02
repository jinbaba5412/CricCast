/**
 * scripts/copy-vendor.js — CricCast v13
 * Runs automatically after `npm install`.
 * Copies GSAP, EasePack, canvas-confetti, and tsParticles into vendor/
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT   = path.join(__dirname, '..');
const VENDOR = path.join(ROOT, 'vendor');
if (!fs.existsSync(VENDOR)) fs.mkdirSync(VENDOR, { recursive: true });

const TSP_CANDIDATES = [
  path.join(ROOT, 'node_modules', 'tsparticles', 'tsparticles.bundle.min.js'),
  path.join(ROOT, 'node_modules', 'tsparticles', 'dist', 'tsparticles.bundle.min.js'),
  path.join(ROOT, 'node_modules', 'tsparticles', 'dist', 'tsparticles.min.js'),
  path.join(ROOT, 'node_modules', 'tsparticles', 'tsparticles.min.js'),
];
function findTsParticles() {
  for (const p of TSP_CANDIDATES) { if (fs.existsSync(p)) return p; }
  return null;
}

const copies = [
  { src: path.join(ROOT, 'node_modules', 'gsap', 'dist', 'gsap.min.js'),
    dst: path.join(VENDOR, 'gsap.min.js'), label: 'GSAP 3' },
  { src: path.join(ROOT, 'node_modules', 'gsap', 'dist', 'EasePack.min.js'),
    dst: path.join(VENDOR, 'EasePack.min.js'), label: 'EasePack (rough ease)' },
  { src: path.join(ROOT, 'node_modules', 'canvas-confetti', 'dist', 'confetti.browser.min.js'),
    dst: path.join(VENDOR, 'confetti.min.js'), label: 'canvas-confetti' },
  { src: findTsParticles(), dst: path.join(VENDOR, 'tsparticles.min.js'), label: 'tsParticles 2' },
];

let ok = true;
copies.forEach(item => {
  if (!item.src) {
    console.warn('[CricCast] vendor: WARN — could not locate ' + item.label + ' in node_modules');
    ok = false; return;
  }
  try {
    fs.copyFileSync(item.src, item.dst);
    console.log('[CricCast] vendor: copied ' + item.label + ' → vendor/' + path.basename(item.dst));
  } catch (e) {
    console.warn('[CricCast] vendor: WARN — could not copy ' + item.label + ': ' + e.message);
    ok = false;
  }
});

if (ok) console.log('[CricCast] vendor: All libraries ready. Run `npm start`.');
else     console.warn('[CricCast] vendor: Some files missing — animations degrade gracefully.');
