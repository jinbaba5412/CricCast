'use strict';
const fs = require('fs'), path = require('path');
const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) process.exit(0);
const TIMESTAMP = new Date().toISOString().slice(0, 10), MAX_DAYS = 30;
fs.readdirSync(LOG_DIR).filter(f => f.endsWith('.log')).forEach(file => {
  const src = path.join(LOG_DIR, file), stat = fs.statSync(src);
  const ageDays = (Date.now() - stat.mtime.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays > MAX_DAYS) { fs.unlinkSync(src); console.log('[LOG-ROTATE] Deleted:', file); }
  else if (stat.size > 50 * 1024 * 1024) { const a = path.join(LOG_DIR, `${file}.${TIMESTAMP}.bak`); fs.renameSync(src, a); console.log('[LOG-ROTATE] Rotated:', file); }
});
