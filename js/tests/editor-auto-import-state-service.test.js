const assert = require('node:assert/strict');
const AutoImportStateService = require(
  '../editor/EditorAutoImportStateService.js'
);

const service = AutoImportStateService.create();

assert.deepEqual(service.getResults(), []);
assert.deepEqual(service.getArtistEntries(), []);
assert.deepEqual(service.getStats(), {
  total: 0,
  fetched: 0,
  archived: 0,
  filesSaved: 0,
  dupes: 0,
  errors: 0
});

service.addResults([{ title: 'One' }, { title: 'Two' }]);
assert.deepEqual(service.getResults().map(song => song.title), ['One', 'Two']);
const resultsSnapshot = service.getResults();
resultsSnapshot.push({ title: 'External mutation' });
assert.equal(service.getResults().length, 2);

service.setArtist('Artist', {
  expected: 2,
  fetched: 2,
  status: 'done',
  songs: service.getResults()
});
assert.deepEqual(service.getArtistEntries(), [
  [
    'Artist',
    {
      expected: 2,
      fetched: 2,
      status: 'done',
      songs: service.getResults()
    }
  ]
]);

service.updateStats({ total: 2, fetched: 2 });
service.incrementStats({ archived: 1, dupes: 1, errors: 2 });
assert.deepEqual(service.getStats(), {
  total: 2,
  fetched: 2,
  archived: 1,
  filesSaved: 0,
  dupes: 1,
  errors: 2
});
assert.equal(service.setStat('filesSaved', 4), 4);

service.addFailedSongs([{ title: 'Failed' }]);
assert.deepEqual(service.getFailedSongs(), [{ title: 'Failed' }]);
service.setFailedFiles([{ title: 'File', error: 'write' }]);
assert.deepEqual(service.getFailedFiles(), [
  { title: 'File', error: 'write' }
]);

const directoryHandle = { name: 'songs' };
assert.equal(service.setDirectoryHandle(directoryHandle), directoryHandle);
assert.equal(service.getDirectoryHandle(), directoryHandle);

service.reset();
assert.deepEqual(service.getResults(), []);
assert.deepEqual(service.getArtistEntries(), []);
assert.deepEqual(service.getFailedSongs(), []);
assert.deepEqual(service.getFailedFiles(), []);
assert.equal(service.getDirectoryHandle(), directoryHandle);
assert.equal(service.getStats().filesSaved, 0);

console.log('EditorAutoImportStateService tests passed');
