const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const productionRoot = path.join(projectRoot, 'js');
const forbiddenPatterns = [
  {
    name: 'global song adapter',
    pattern: /\b(?:EdCurAdapter|getEdCur|setEdCur|setEditorSong)\b|\b(?:window|globalThis|globalScope)\.edCur\b/
  },
  {
    name: 'global DAW state',
    pattern: /\b(?:window|globalThis|globalScope)\.DAW\b/
  },
  {
    name: 'global PERF state',
    pattern: /\b(?:window|globalThis|globalScope)\.PERF\b/
  },
  {
    name: 'global arranger state',
    pattern: /\b(?:window|globalThis|globalScope)\.arrangers\b/
  },
  {
    name: 'global audio storage methods',
    pattern:
      /\b(?:window|globalThis|globalScope)\.(?:getAudioCompressionService|openAudioDB|saveFileHandle|getFileHandle|saveAudioBlobToDB|getAudioBlobFromDB|saveAudioBlobsForProject|loadAudioBlobsForProject|deleteAudioBlobsForProject|formatBytes|base64ToUint8|decodeWebMToBuffer|resampleFloat32|refreshStorageInfo)\b/
  },
  {
    name: 'runtime alias export',
    pattern: /\b(?:getEditorDAW|getEditorPERF|getEditorSong|startEditorPointerDrag)\b/
  },
  {
    name: 'legacy performance bridge API',
    pattern: /\b(?:buildSongDocumentFromEdCur|writeToEdCur|rebuildSongDocumentFromEdCur|syncViewStylesFromEdCur|syncViewStylesToEdCur)\b/
  },
  {
    name: 'legacy parser API naming',
    pattern: /\b(?:parseRawSongToEdCur|convertExtractedLinesToEdCur)\b/
  }
];

function collectJavaScriptFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJavaScriptFiles(absolutePath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(absolutePath);
    }
  }
  return files;
}

const productionFiles = collectJavaScriptFiles(productionRoot).filter(file => {
  const relativePath = path.relative(productionRoot, file);
  return (
    !relativePath.split(path.sep).includes('tests') &&
    !relativePath.split(path.sep).includes('quality') &&
    !relativePath.split(path.sep).includes('vendor') &&
    !relativePath.endsWith('.min.js')
  );
});

let failed = false;
for (const absolutePath of productionFiles) {
  const relativePath = path.relative(projectRoot, absolutePath);
  const source = fs.readFileSync(absolutePath, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith('//'))
    .join('\n');
  for (const forbidden of forbiddenPatterns) {
    if (forbidden.pattern.test(source)) {
      failed = true;
      console.error(
        `[legacy-dependency-budget] FAIL ${relativePath}: ${forbidden.name}`
      );
    }
  }
}

if (failed) process.exitCode = 1;
else {
  console.log(
    `[legacy-dependency-budget] production runtime passed (${productionFiles.length} files)`
  );
}
