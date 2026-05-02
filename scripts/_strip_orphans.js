/**
 * Surgically remove dead team/player-CRUD JS from Controller-offline.html.
 * Each target is a complete top-level `function NAME(...) { ... }` block
 * that was left over after the Dashboard became the single source of truth.
 * Critical: pushStateToServer() is intentionally NOT in this list.
 */
const fs   = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'Controller-offline.html');

const orphans = [
  'exportData',
  'importData',
  'handleLogoUpload',
  'handleCaptainUpload',
  'updateCaptainPreview',
  'clearCaptainPhoto',
  'switchLogoTab',
  'previewLogoUrl',
  'updateLogoPreview',
  'getLogoData',
  'addPlayerToForm',
  'setPlayerRole',
  'renderFormPlayers',
];

// Also drop these top-level variable declarations.
const orphanVars = [
  /^\s*let\s+editingTeamId\s*=.*;\s*$/m,
  /^\s*let\s+formPlayers\s*=.*;\s*$/m,
  /^\s*let\s+formLogoData\s*=.*;\s*$/m,
  /^\s*let\s+logoTab\s*=.*;\s*$/m,
  /^\s*let\s+formCaptainData\s*=.*;\s*$/m,
];

let src = fs.readFileSync(FILE, 'utf8');

/**
 * Find a function block starting with `^async? function NAME(` and return its
 * start index plus end index (just past its closing `}`) using brace matching.
 * Only considers string/comment boundaries well enough for this file's style.
 */
function findFunctionBlock(src, name) {
  // Find the "function NAME(" declaration at line start (allow leading whitespace).
  const re = new RegExp('(^|\\n)([ \\t]*)(?:async\\s+)?function\\s+' + name + '\\s*\\(', 'g');
  const m  = re.exec(src);
  if (!m) return null;
  const declStart = m.index + (m[1] ? m[1].length : 0);
  // Walk from declStart to find opening `{` then balance braces.
  const open = src.indexOf('{', declStart);
  if (open < 0) return null;
  let depth = 0, i = open;
  const len = src.length;
  let inStr = null;      // '"' | "'" | '`' | null
  let inLineComment = false;
  let inBlockComment = false;
  while (i < len) {
    const ch = src[i];
    const next = src[i + 1];
    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      i++; continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') { inBlockComment = false; i += 2; continue; }
      i++; continue;
    }
    if (inStr) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === inStr) inStr = null;
      // Template literal interpolation intentionally ignored (good enough here).
      i++; continue;
    }
    if (ch === '/' && next === '/') { inLineComment = true; i += 2; continue; }
    if (ch === '/' && next === '*') { inBlockComment = true; i += 2; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; i++; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        // Include trailing newline.
        let end = i + 1;
        if (src[end] === '\r') end++;
        if (src[end] === '\n') end++;
        return { start: declStart, end };
      }
    }
    i++;
  }
  return null;
}

let removed = 0;
for (const name of orphans) {
  const block = findFunctionBlock(src, name);
  if (!block) { console.warn('skip (not found):', name); continue; }
  src = src.slice(0, block.start) + src.slice(block.end);
  removed++;
  console.log('removed function:', name);
}

for (const rx of orphanVars) {
  const before = src.length;
  src = src.replace(rx, '');
  if (src.length !== before) console.log('removed var declaration:', rx.source);
}

fs.writeFileSync(FILE, src, 'utf8');
console.log('Stripped', removed, 'orphan functions. New size:', src.length, 'bytes.');
