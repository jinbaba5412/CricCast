'use strict';
// Run once: node scripts/migrate-to-saas.js

const fs   = require('fs');
const path = require('path');

const ROOT      = path.join(__dirname, '..');
const OLD_STATE = path.join(ROOT, 'score.json');
const OLD_REC   = path.join(ROOT, 'criccast_data', 'score.json');
const NEW_DIR   = path.join(ROOT, 'criccast_data', 'default');

if (!fs.existsSync(NEW_DIR)) {
  fs.mkdirSync(NEW_DIR, { recursive: true });
  console.log('Created:', NEW_DIR);
}

const candidates = [OLD_STATE, OLD_REC].filter(f => fs.existsSync(f));
if (candidates.length) {
  const src = candidates[0];
  const dst = path.join(NEW_DIR, 'score.json');
  if (!fs.existsSync(dst)) {
    fs.copyFileSync(src, dst);
    console.log('Migrated state:', src, '→', dst);
  } else {
    console.log('State already migrated — skipping');
  }
} else {
  console.log('No existing score.json found — starting fresh');
}

const OLD_UPLOADS = path.join(ROOT, 'criccast_uploads');
const NEW_UPLOADS = path.join(ROOT, 'criccast_uploads', 'default');
if (fs.existsSync(OLD_UPLOADS) && !fs.existsSync(NEW_UPLOADS)) {
  fs.mkdirSync(NEW_UPLOADS, { recursive: true });
  const files = fs.readdirSync(OLD_UPLOADS).filter(f => f.startsWith('img_'));
  files.forEach(f => {
    fs.copyFileSync(path.join(OLD_UPLOADS, f), path.join(NEW_UPLOADS, f));
    console.log('Moved upload:', f);
  });
}

const hta = path.join(NEW_DIR, '.htaccess');
if (!fs.existsSync(hta)) {
  fs.writeFileSync(hta, 'Deny from all\nOptions -Indexes\n');
  console.log('Created .htaccess');
}

console.log('\nMigration complete. Run the app with: node server.js');
