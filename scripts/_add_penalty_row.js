const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'Controller-offline.html');

let s = fs.readFileSync(FILE, 'utf8');
const marker = `<button class="extra-apply-btn" onclick="applyExtraVal('lb')">Apply</button>`;
const i = s.indexOf(marker);
if (i < 0) { console.error('marker not found'); process.exit(1); }

// Jump past the marker + its enclosing </div> (the lb row container).
const tail = s.indexOf('</div>', i) + '</div>'.length;

if (s.substring(tail, tail + 200).includes('p-extra-input')) {
  console.log('penalty row already present — no change');
  process.exit(0);
}

const insert = [
  '',
  '      <div class="extra-row">',
  '        <span class="extra-label">Penalty</span>',
  '        <input type="number" id="p-extra-input" class="extra-input" placeholder="5" min="-10" max="10" value="5" title="Positive adds to batting side; negative debits them.">',
  `        <button class="extra-apply-btn" onclick="applyExtraVal('p')">Apply</button>`,
  '      </div>',
].join('\n');

s = s.slice(0, tail) + insert + s.slice(tail);
fs.writeFileSync(FILE, s, 'utf8');
console.log('Penalty row inserted at', tail);
