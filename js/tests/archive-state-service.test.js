const assert = require('node:assert/strict');
const ArchiveStateService = require('../archive/ArchiveStateService.js');

const values = new Map([
  ['arch_view_mode', 'table'],
  ['arch_artists_collapsed', 'true']
]);
const service = ArchiveStateService.create({
  storage: {
    getItem: key => values.has(key) ? values.get(key) : null
  }
});

assert.equal(service.state.viewMode, 'table');
assert.equal(service.state.artistSectionCollapsed, true);
assert.equal(service.state.currentTab, 'all');
assert.equal(service.state.selectMode, false);
assert.ok(service.state.selectedIds instanceof Set);

service.state.selectedIds.add('song-1');
service.state.selectMode = true;
service.clearSelection();
assert.equal(service.state.selectedIds.size, 0);
assert.equal(service.state.selectMode, false);

service.state.artistCache = [{ normalizedName: 'artist' }];
service.state.artistFilter = 'artist';
service.resetCaches();
assert.equal(service.state.artistCache, null);
assert.equal(service.state.artistFilter, null);

console.log('ArchiveStateService tests passed');
