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
  const index = html.indexOf(`src="${sourceName}"`);
  assert.notEqual(index, -1, `${sourceName} must be loaded`);
  return index;
}

// ArchiveModule is the provider of archive globals consumed by later chunks.
assert.ok(
  scriptIndex('js/archive/ArchiveRuntimeAdapter.js') <
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
  scriptIndex('js/archive/ArchiveLifecycleService.js') <
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

const publicArchiveFunctions = [
  'edGetAllSongs',
  'edSetAllSongs',
  'edSaveToArchive',
  'edSaveArchiveToFolder',
  'edOpenArchive',
  'archOpen',
  'archClose',
  'archLoadSong',
  'archLoadSongReadOnly',
  'edLoadFromArchive',
  'edDeleteFromArchive',
  'archTrashSong',
  'archRestoreSong',
  'archPermanentDelete',
  'edNewSong',
  'edExportProject',
  'edExportXML',
  'edImportProject',
  'archImportFiles',
  'archImportFolder',
  'archImportFullArchive',
  'archExportAll',
  'archBulkExport',
  'archRefresh',
  'archArtistKey',
  'archPushUndo',
  'archConfirm',
  'archConfirmResolve',
  'archRender',
  'archRenderArtists',
  'archUpdateActiveFilters'
];

for (const functionName of publicArchiveFunctions) {
  assert.match(
    archive,
    new RegExp(`\\b(?:async\\s+)?function\\s+${functionName}\\s*\\(`),
    `Archive public function missing: ${functionName}`
  );
}

// These are the high-risk consumers that must keep their names during facade
// extraction. The test intentionally checks source contracts, not implementation.
assert.match(editor, /['"]archiveOpen['"]:\s*edOpenArchive/);
assert.match(editor, /['"]archiveSave['"]:\s*\(\)\s*=>\s*edSaveToArchive\(\)/);
assert.match(projectHub, /typeof archLoadSong === ['"]function['"]/);
assert.match(projectHub, /typeof archOpen === ['"]function['"]/);
assert.match(projectHub, /typeof archTrashSong === ['"]function['"]/);

console.log('ArchiveModule public contract tests passed');
