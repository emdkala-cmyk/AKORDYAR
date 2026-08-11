const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function executableLines(source) {
  return source
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith('//'))
    .join('\n');
}

const archive = executableLines(read('js/archive/ArchiveModule.js'));
const projectHub = executableLines(read('js/projecthub.js'));
const performanceBridge = executableLines(read('js/performanceBridge.js'));
const archiveRuntimeAdapter = read('js/archive/ArchiveRuntimeAdapter.js');

assert.doesNotMatch(archive, /window\.edCur/);
assert.doesNotMatch(archive, /\bPERF\b/);
assert.doesNotMatch(archive, /document\.addEventListener\(['"](?:click|mousemove|mouseup)['"]/);

assert.doesNotMatch(projectHub, /\bedCur\s*[.=]/);
assert.doesNotMatch(projectHub, /\bDAW\s*\./);
assert.doesNotMatch(projectHub, /typeof\s+DAW/);

assert.doesNotMatch(performanceBridge, /window\.edCur/);
assert.doesNotMatch(performanceBridge, /\bDAW\s*\./);
assert.doesNotMatch(performanceBridge, /\bPERF\s*\./);

assert.match(archiveRuntimeAdapter, /getSong\(\)/);
assert.match(archiveRuntimeAdapter, /getDAW\(\)/);
assert.match(archiveRuntimeAdapter, /getPERF\(\)/);

console.log('Runtime dependency budget tests passed');
