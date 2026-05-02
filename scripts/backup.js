'use strict';
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), BACKUP_DIR = path.join(process.env.HOME || ROOT, 'criccast_backups');
const TIMESTAMP = new Date().toISOString().slice(0, 10);
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
const archivePath = path.join(BACKUP_DIR, `criccast_backup_${TIMESTAMP}.tar.gz`);
try {
  execSync(`tar -czf "${archivePath}" -C "${ROOT}" criccast_data criccast_uploads`, { stdio: 'inherit' });
  console.log('[BACKUP] Created:', archivePath);
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('criccast_backup_') && f.endsWith('.tar.gz'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime }))
    .sort((a, b) => a.mtime - b.mtime)
    .forEach(({ name, mtime }) => { if (mtime.getTime() < cutoff) { fs.unlinkSync(path.join(BACKUP_DIR, name)); console.log('[BACKUP] Pruned:', name); } });
} catch (err) { console.error('[BACKUP] Failed:', err.message); process.exit(1); }
