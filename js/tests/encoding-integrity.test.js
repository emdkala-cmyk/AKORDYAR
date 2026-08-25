const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const files = [
  'Akordyar.html',
  'js/app/AppI18nService.js',
  'js/app/MidiMonitorService.js',
  'js/app/CoreGridQuantizeService.js',
  'js/app/CoreMetronomeService.js',
  'js/app/CorePanelLayoutService.js',
  'js/app/CoreTimelineGeometryService.js',
  'js/app/CoreTimelineRendererService.js',
  'js/app/CoreClipService.js',
  'js/app/CoreAudioImportService.js',
  'js/app/CoreClipEditService.js',
  'js/app/CoreSelectionService.js',
  'js/app/CoreClipDragService.js',
  'js/app/CoreClipInteractionService.js',
  'js/app/CoreClipboardBridgeService.js',
  'js/app/CoreMixerBridgeService.js',
  'js/app/core.js',
  'js/app/editor.js',
  'js/app/search.js',
  'js/archive/ArchiveModule.js',
  'js/projecthub.js',
  'گزارش-کامل-روند-ویرایش-و-ساماندهی-پروژه.md'
];

for (const relativePath of files) {
  const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
  assert.equal(
    source.includes('\uFFFD'),
    false,
    `${relativePath} contains a Unicode replacement character`
  );
}

console.log('Encoding integrity tests passed');
