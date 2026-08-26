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
  'js/app/CoreTransportService.js',
  'js/app/CorePerformanceModeService.js',
  'js/app/CorePanelLayoutService.js',
  'js/app/CoreTimelineGeometryService.js',
  'js/app/CoreTimelineRendererService.js',
  'js/app/CoreTimelineGridService.js',
  'js/app/CoreTimelineSectionBridgeService.js',
  'js/app/CoreTrackSetupService.js',
  'js/app/CoreClipService.js',
  'js/app/CoreAudioImportService.js',
  'js/app/CoreClipEditService.js',
  'js/app/CoreSelectionService.js',
  'js/app/CoreClipDragService.js',
  'js/app/CoreClipInteractionService.js',
  'js/app/CoreClipDeletionService.js',
  'js/app/CoreClipboardBridgeService.js',
  'js/app/CoreMixerBridgeService.js',
  'js/app/CoreRecordingService.js',
  'js/app/CoreSettingsService.js',
  'js/app/CoreHighlightService.js',
  'js/app/CoreMovableWindowBridgeService.js',
  'js/app/CoreLoopVisualService.js',
  'js/app/CoreLoopControlService.js',
  'js/app/CoreChordLineSyncService.js',
  'js/app/CorePopupWindowBridgeService.js',
  'js/app/CoreHistoryBridgeService.js',
  'js/app/CoreFocusModeService.js',
  'js/app/CoreSyncModeBridgeService.js',
  'js/editor/EditorProjectFileService.js',
  'js/editor/EditorProjectExportRouteService.js',
  'js/editor/EditorProjectImportRouteService.js',
  'js/editor/EditorSongPersistenceService.js'
]) {
  assert.match(html, new RegExp(escapeRegExp(activeScript)));
}

console.log('Legacy runtime script contract tests passed');
