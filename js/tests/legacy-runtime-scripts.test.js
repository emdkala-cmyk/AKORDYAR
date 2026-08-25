const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(
  path.join(projectRoot, 'Akordyar.html'),
  'utf8'
);

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const legacyScripts = [
  'js/core/FileSystemBridge.js',
  'js/core/AudioManager.js',
  'js/core/AudioFileLoader.js',
  'js/core/ProjectStore.js'
];

for (const script of legacyScripts) {
  assert.doesNotMatch(
    html,
    new RegExp(`<script[^>]+src=["']${escapeRegExp(script)}["']`)
  );
}

for (const activeScript of [
  'js/core/ProjectAudioService.js',
  'js/core/PopupWindowService.js',
  'js/core/TimelineSectionRendererService.js',
  'js/editor/ArrangerMarkerService.js',
  'js/editor/ArrangerPlaybackPolicyService.js',
  'js/editor/AudioRecoveryService.js',
  'js/editor/EditorAudioStorageService.js',
  'js/editor/EditorAudioStorageFacadeService.js',
  'js/editor/EditorPopupTimelineSyncService.js',
  'js/editor/EditorSyncAnalysisUiService.js',
  'js/editor/EditorLyricsChordInteractionService.js',
  'js/app/AppI18nService.js',
  'js/app/MidiMonitorService.js',
  'js/app/CoreGridQuantizeService.js',
  'js/app/CoreMetronomeService.js',
  'js/app/CorePanelLayoutService.js',
  'js/app/CoreTimelineGeometryService.js',
  'js/app/CoreTimelineRendererService.js',
  'js/app/CoreClipService.js',
  'js/editor/EditorProjectFileService.js',
  'js/editor/EditorProjectExportRouteService.js',
  'js/editor/EditorProjectImportRouteService.js',
  'js/editor/EditorSongPersistenceService.js'
]) {
  assert.match(html, new RegExp(escapeRegExp(activeScript)));
}

console.log('Legacy runtime script contract tests passed');
