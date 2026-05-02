const fs = require('fs');
const s  = fs.readFileSync(process.argv[2], 'utf8');
const rx = /<script>([\s\S]*?)<\/script>/g;
let m, i = 0, errors = 0;
while ((m = rx.exec(s)) !== null) {
  i++;
  try { new Function(m[1]); }
  catch (e) { errors++; console.log('script #' + i + ' SYNTAX ERROR:', e.message); }
}
console.log('checked ' + i + ' script blocks, errors: ' + errors);
process.exit(errors ? 1 : 0);
