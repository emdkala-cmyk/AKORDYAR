const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(projectRoot, 'Akordyar.html'), 'utf8');
const archive = fs.readFileSync(
  path.join(projectRoot, 'js', 'archive', 'ArchiveModule.js'),
  'utf8'
);
const editor = fs.readFileSync(
  path.join(projectRoot, 'js', 'app', 'editor.js'),
  'utf8'
);
const projectHub = fs.readFileSync(
  path.join(projectRoot, 'js', 'projecthub.js'),
  'utf8'
);

function scriptIndex(sourceName) {
  let index = html.indexOf(`src="${sourceName}"`);
  if (index === -1 && !sourceName.includes('?')) {
    index = html.indexOf(`src="${sourceName}?`);
  }
  assert.notEqual(index, -1, `${sourceName} must be loaded`);
  return index;
}

// ArchiveModule is loaded after its explicit public-api factory and before
// consumers that use the frozen archive namespace.
assert.ok(scriptIndex('js/archive/ArchivePublicApi.js') < scriptIndex('js/archive/ArchiveModule.js'));
assert.ok(
  scriptIndex('js/archive/ArchiveRuntimeAdapter.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveCurrentSongService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveStorageService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveStorageFallbackService.js') <
    scriptIndex('js/archive/ArchiveStorageService.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveMigrationService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveNormalizationService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveArtistService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveUndoService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveConfirmService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveProjectPersistenceService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveBatchImportService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveTransferService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveXmlExportService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveLifecycleService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveSelectionFilterService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveMutationService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveArtistUiService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveArtistImageService.js') <
    scriptIndex('js/archive/ArchiveArtistUiService.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveRenderService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveRenderCoordinatorService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveSearchService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveListViewService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveStateService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveArtistCatalogService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveSongLoadService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveReadOnlyService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveMetadataEditService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveProjectAudioRecoveryService.js') <
    scriptIndex('js/archive/ArchiveProjectFileImportService.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveProjectFileImportService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/editor/EditorProjectImportRouteService.js') <
    scriptIndex('js/archive/ArchiveModule.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveModule.js') <
    scriptIndex('js/app/core.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveModule.js') <
    scriptIndex('js/app/editor.js')
);
assert.ok(
  scriptIndex('js/archive/ArchiveModule.js') <
    scriptIndex('js/projecthub.js')
);

const publicArchiveMethods = [
  'getAllSongs',
  'setAllSongs',
  'saveToArchive',
  'saveArchiveToFolder',
  'open',
  'close',
  'loadSong',
  'loadSongReadOnly',
  'deleteSong',
  'restoreSong',
  'permanentDelete',
  'newSong',
  'exportProject',
  'exportXml',
  'importProject',
  'importFiles',
  'importFolder',
  'importFullArchive',
  'exportAll',
  'bulkExport',
  'refresh',
  'artistKey',
  'pushUndo',
  'confirm',
  'resolveConfirm',
  'render',
  'renderArtists',
  'updateActiveFilters'
];

for (const methodName of publicArchiveMethods) {
  assert.match(
    archive,
    new RegExp(`\\b${methodName}\\s*:`),
    `Archive namespace method missing: ${methodName}`
  );
}

assert.match(archive, /archivePublicApi\.publish\(\{/);
assert.match(archive, /namespace:\s*['"]AkordyarArchiveApi['"]/);
assert.match(archive, /\(function attachArchiveModule\(globalScope\)/);
assert.match(archive, /edSyncToolbar:\s*archiveEditorSyncToolbar/);
assert.match(archive, /edRenderEditor:\s*archiveEditorRenderEditor/);
assert.doesNotMatch(projectHub, /typeof\s+(?:arch|ed)[A-Z]\w*\s*===\s*['"]function['"]/);
assert.match(projectHub, /window\.AkordyarArchiveApi/);
assert.match(editor, /editorArchiveCall\(['"]open['"]\)/);
assert.match(editor, /editorArchiveCall\(['"]saveToArchive['"]\)/);

console.log('ArchiveModule public contract tests passed');
