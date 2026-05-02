/**
 * L3 UI — remove the OPEN: Classic / SB 1..20 quick-launch bar from the
 * Controller's LIVE scoring panel. (The sidebar nav cluster at lines
 * ~486..504 is kept — it's the global navigation, not inside the live
 * scorer.) The scoreboard is auto-opened via /match/:id/overlay in the
 * SaaS flow, so the manual picker is redundant and distracting on the
 * live screen.
 */
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'Controller-offline.html');
let s = fs.readFileSync(FILE, 'utf8');

// Anchor on the unique comment marker above the block.
const START_MARK = '<!-- ── SCOREBOARD QUICK-LAUNCH ── -->';
const i = s.indexOf(START_MARK);
if (i < 0) { console.error('quick-launch marker not found'); process.exit(1); }

// The block lives inside a <div class="sb-quicklaunch"...>...</div>.
// Find the enclosing opening div on the line containing the comment and
// delete everything up to its matching </div>.
const divOpen = s.indexOf('<div class="sb-quicklaunch"', i);
if (divOpen < 0) { console.error('sb-quicklaunch div not found'); process.exit(1); }

// Walk forward from divOpen, balancing <div> and </div> tags.
let depth = 0, idx = divOpen;
const re = /<\/?div\b[^>]*>/g;
re.lastIndex = divOpen;
let end = -1;
let m;
while ((m = re.exec(s)) !== null) {
  if (m[0][1] === '/') {
    depth--;
    if (depth === 0) { end = m.index + m[0].length; break; }
  } else {
    depth++;
  }
}
if (end < 0) { console.error('failed to balance quick-launch div'); process.exit(1); }

// Remove the comment line + the div. Trim trailing whitespace / newline.
let removeStart = i;
// Absorb preceding newline/indent so we don't leave a blank line.
while (removeStart > 0 && (s[removeStart - 1] === ' ' || s[removeStart - 1] === '\t')) removeStart--;
if (removeStart > 0 && s[removeStart - 1] === '\n') removeStart--;

let removeEnd = end;
// Absorb trailing newline so the following </div> still lines up cleanly.
if (s[removeEnd] === '\n') removeEnd++;

const removed = s.substring(removeStart, removeEnd);
s = s.slice(0, removeStart) + s.slice(removeEnd);
fs.writeFileSync(FILE, s, 'utf8');
console.log('sb-quicklaunch block removed (' + removed.length + ' bytes)');
