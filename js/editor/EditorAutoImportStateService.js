/**
 * EditorAutoImportStateService
 *
 * Owns the transient state of the auto-import workflow. The state is kept
 * private and exposed through focused operations instead of window globals.
 */
(function attachEditorAutoImportStateService(globalScope) {
  'use strict';

  const createStats = () => ({
    total: 0,
    fetched: 0,
    archived: 0,
    filesSaved: 0,
    dupes: 0,
    errors: 0
  });

  function create() {
    let results = [];
    let artistMap = {};
    let stats = createStats();
    let failedSongs = [];
    let failedFiles = [];
    let directoryHandle = null;

    function reset() {
      results = [];
      artistMap = {};
      stats = createStats();
      failedSongs = [];
      failedFiles = [];
    }

    function getResults() {
      return results.slice();
    }

    function addResults(songs) {
      if (Array.isArray(songs) && songs.length > 0) {
        results.push(...songs);
      }
      return results.length;
    }

    function getArtistEntries() {
      return Object.entries(artistMap);
    }

    function setArtist(artistName, value) {
      artistMap[artistName] = value;
      return value;
    }

    function getStats() {
      return { ...stats };
    }

    function setStat(name, value) {
      if (Object.prototype.hasOwnProperty.call(stats, name)) {
        stats[name] = value;
      }
      return stats[name];
    }

    function updateStats(patch = {}) {
      Object.keys(patch).forEach(name => setStat(name, patch[name]));
      return getStats();
    }

    function incrementStats(patch = {}) {
      Object.entries(patch).forEach(([name, amount]) => {
        if (Object.prototype.hasOwnProperty.call(stats, name)) {
          stats[name] += Number(amount) || 0;
        }
      });
      return getStats();
    }

    function getFailedSongs() {
      return failedSongs.slice();
    }

    function setFailedSongs(songs) {
      failedSongs = Array.isArray(songs) ? songs.slice() : [];
      return getFailedSongs();
    }

    function addFailedSongs(songs) {
      if (Array.isArray(songs) && songs.length > 0) {
        failedSongs.push(...songs);
      }
      return failedSongs.length;
    }

    function getFailedFiles() {
      return failedFiles.slice();
    }

    function setFailedFiles(files) {
      failedFiles = Array.isArray(files) ? files.slice() : [];
      return getFailedFiles();
    }

    function getDirectoryHandle() {
      return directoryHandle;
    }

    function setDirectoryHandle(handle) {
      directoryHandle = handle || null;
      return directoryHandle;
    }

    return Object.freeze({
      reset,
      getResults,
      addResults,
      getArtistEntries,
      setArtist,
      getStats,
      setStat,
      updateStats,
      incrementStats,
      getFailedSongs,
      setFailedSongs,
      addFailedSongs,
      getFailedFiles,
      setFailedFiles,
      getDirectoryHandle,
      setDirectoryHandle
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorAutoImportStateService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
