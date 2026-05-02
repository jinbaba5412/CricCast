CricCast v13 — vendor/ directory
=================================
This folder is populated automatically when you run:

    npm install

Four files are copied here from node_modules/:

  gsap.min.js          GSAP 3 animation engine
  EasePack.min.js      GSAP EasePack — rough ease for glitch effect
  confetti.min.js      canvas-confetti (kept for compatibility)
  tsparticles.min.js   tsParticles 2 (kept for compatibility)

BroadcastEvents v13 uses only gsap + EasePack (no confetti/tsparticles).
The glitch overlay uses IBM Plex Mono italic + SVG scanline strips.

DO NOT commit these files to git — they are build artefacts.
