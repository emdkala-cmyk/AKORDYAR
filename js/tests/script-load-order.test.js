const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'Akordyar.html'),
  'utf8'
);

const appBootstrap = fs.readFileSync(
  path.resolve(__dirname, '..', 'app.js'),
  'utf8'
);
const syncClientHtml = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'sync-client.html'),
  'utf8'
);

assert.match(appBootstrap, /createApplicationLoader/);
assert.match(appBootstrap, /data-loader-mode="document-write"/);
assert.match(appBootstrap, /loadWithDocumentWrite/);
assert.doesNotMatch(
  appBootstrap,
  /if\s*\(\s*document\.readyState\s*===\s*['"]loading['"]\s*\)\s*\{\s*document\.write/
);

function scriptIndex(sourceName) {
  const index = html.indexOf(`src="${sourceName}"`);
  assert.notEqual(index, -1, `${sourceName} must be loaded`);
  return index;
}

assert.ok(
  scriptIndex('js/core/RuntimeStateAdapter.js') <
    scriptIndex('js/archive/ArchiveRuntimeAdapter.js')
);
assert.ok(
  scriptIndex('js/core/TransposeService.js') <
    scriptIndex('js/editor/EditorNotationService.js')
);
assert.ok(
  scriptIndex('js/core/Meter.js') <
    scriptIndex('js/core/MusicTheory.js')
);
assert.ok(
  scriptIndex('js/core/MidiFileParser.js') <
    scriptIndex('js/core/MidiScoreModel.js')
);
assert.ok(
  scriptIndex('js/core/MidiScoreModel.js') <
    scriptIndex('js/core/MidiScoreRenderer.js')
);
assert.ok(
  scriptIndex('js/core/MidiScoreRenderer.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/Meter.js') <
  scriptIndex('js/playerViewRenderer.js?v=20260817-10')
);
assert.ok(
  syncClientHtml.indexOf('src="js/core/Meter.js"') <
    syncClientHtml.indexOf('src="js/playerViewRenderer.js')
);
assert.ok(
  syncClientHtml.indexOf('src="js/core/MidiFileParser.js"') <
    syncClientHtml.indexOf('src="js/core/MidiScoreRenderer.js"')
);
assert.ok(
  syncClientHtml.indexOf('src="js/core/Meter.js"') <
    syncClientHtml.indexOf('src="js/sync/mobileTimeline.js')
);
assert.ok(
  scriptIndex('js/editor/EditorNotationService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorChordRenderer.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorLyricsRenderer.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorToolbarService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorSongPersistenceService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/AudioRecoveryService.js') <
    scriptIndex('js/editor/EditorSongInitializationService.js')
);
assert.ok(
  scriptIndex('js/editor/EditorSongInitializationService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/DockablePanelLayoutService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorSongTransitionService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorProjectExportService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorSongImportService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/MidiScoreImportService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/MidiScoreController.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/EditorChordVersionService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorGlobalBindingsService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorCommitService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorChordStateService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorAnchorService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorSelectionService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorChordDragService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorChordInteractionService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorTextSelectionService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorMutationService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorChordQuantizeService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorChordCommandService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/KeyboardMappingService.js') <
    scriptIndex('js/editor/EditorKeyboardService.js')
);
assert.ok(
  scriptIndex('js/editor/EditorKeyCommandService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/EdCurAdapter.js') <
    scriptIndex('js/archive/ArchiveRuntimeAdapter.js')
);
assert.ok(
  scriptIndex('js/core/TextEncodingService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveRuntimeAdapter.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/editor/HistoryService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorLifecycleService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/editor/EditorHydrationService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/editor/SyncModeController.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/EditorRuntimeAdapter.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/EditorSongRuntimeService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/TimelineViewportService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/TimelineScrollbarsService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/core/TimelinePanelLayoutService.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/core/TimelineTrackRendererService.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/PlaybackTimelineController.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/core/EditorSongStateService.js') <
    scriptIndex('js/app/core.js')
);

console.log('Script load-order contract tests passed');
