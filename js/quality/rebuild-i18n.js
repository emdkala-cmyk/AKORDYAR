#!/usr/bin/env node
const fs = require('fs');
let content = fs.readFileSync('js/app/AppI18nService.js', 'utf8');
const lines = content.split('\n');
const faLine = lines[14];

// Extract all key:'value' pairs
const pairs = {};
const regex = /(\w+):\s*'((?:[^'\\]|\\.)*)'/g;
let m;
while ((m = regex.exec(faLine)) !== null) {
  pairs[m[1]] = m[2];
}
console.log('Found ' + Object.keys(pairs).length + ' FA keys');

// Rebuild as multi-line (4 entries per line)
let rebuilt = '';
const entries = Object.entries(pairs);
for (let i = 0; i < entries.length; i += 4) {
  const chunk = entries.slice(i, i + 4);
  rebuilt += '      ' + chunk.map(([k,v]) => k + ": '" + v + "'").join(', ') + ',\n';
}
rebuilt = rebuilt.trimEnd();
lines[14] = rebuilt;
content = lines.join('\n');
fs.writeFileSync('js/app/AppI18nService.js', content, 'utf8');
console.log('Done');
