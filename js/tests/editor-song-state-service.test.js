const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'core', 'EditorSongStateService.js'),
  'utf8'
);

const song = {
  title: 'آهنگ',
  artist: 'خواننده',
  lyrics: 'خط اول\nخط دوم',
  key: 'C',
  keyMode: 'maj',
  transpose: 2,
  tempo: 95,
  timeSignature: '6/8',
  syncTimes: [0, 1.2],
  seqPoints: [{ lineIndex: 0, charIndex: 1 }],
  chords: [{ name: 'C' }],
  chordLineClips: [{ name: 'Am' }],
  styles: { tSize: 44, highlightEffect: 'neon' }
};

const context = {};
vm.runInNewContext(source, context);
const service = context.EditorSongStateService.create({ getSong: () => song });

assert.equal(
  JSON.stringify(service.getTimingContext()),
  JSON.stringify({ tempo: 95, timeSignature: '6/8' })
);
assert.deepEqual(service.getSyncTimes(), [0, 1.2]);
assert.deepEqual(service.getSeqPoints(), [{ lineIndex: 0, charIndex: 1 }]);
assert.equal(service.getChords()[0].name, 'C');
assert.equal(service.getChordLineClips()[0].name, 'Am');

const snapshot = service.getPresentationSnapshot();
assert.equal(snapshot.title, 'آهنگ');
assert.equal(snapshot.styles.tSize, 44);
assert.equal(snapshot.styles.highlightEffect, 'neon');
assert.equal(snapshot.styles.tBold, 'normal');
assert.equal(snapshot.lyrics, 'خط اول\nخط دوم');

assert.equal(service.setTempo(120), true);
assert.equal(song.tempo, 120);
assert.equal(service.setLyrics('خط تازه'), true);
assert.equal(song.lyrics, 'خط تازه');
assert.equal(service.setTextColor('#123456'), true);
assert.equal(service.setChordColorStyle('#654321'), true);
assert.equal(service.setLineColor(1, '#abcdef'), true);
assert.equal(service.getLineColor(1), '#abcdef');
assert.equal(service.getLineColor(9, '#fallback'), '#123456');
assert.equal(service.setChordColor(0, '#fedcba'), true);
assert.equal(service.getChordColor(0), '#fedcba');
assert.equal(service.colorChordsByLine((lineIndex) => lineIndex ? '#222' : '#111'), true);
assert.equal(song.chords[0].color, '#111');
assert.equal(service.resetChordColors('#999999'), true);
assert.equal(song.chords[0].color, '#999999');
assert.equal(service.clearChordColors(), true);
assert.equal(song.chords[0].color, undefined);
assert.equal(service.replaceLineColors(['red', 'blue']), true);
assert.equal(
  JSON.stringify(service.getLineColors()),
  JSON.stringify(['red', 'blue'])
);
assert.equal(service.clearLineColors(), true);
assert.equal(JSON.stringify(service.getLineColors()), JSON.stringify([]));
assert.equal(service.setKey('D', 'min'), true);
assert.equal(song.key, 'D');
assert.equal(song.keyMode, 'min');
assert.equal(service.setHighlightEffect('frost', ['neon', 'frost']), true);
assert.equal(song.styles.highlightEffect, 'frost');
assert.equal(service.setHighlightEffect('invalid', ['neon', 'frost']), false);
assert.equal(service.markChordLineSynced(), true);
assert.equal(song.hasManualChordLineEdits, false);
assert.equal(service.setSyncTime(2, 2.4), true);
assert.equal(song.syncTimes[2], 2.4);
assert.equal(service.replaceSyncTimes([0, 3]), true);
assert.deepEqual(song.syncTimes, [0, 3]);
assert.equal(service.setSeqPoints([{ lineIndex: 1, charIndex: 0 }]), true);
assert.deepEqual(song.seqPoints, [{ lineIndex: 1, charIndex: 0 }]);
assert.equal(service.appendChords([{ name: 'G' }]), true);
assert.equal(song.chords.at(-1).name, 'G');
assert.equal(service.setChordName(0, 'Dm'), true);
assert.equal(song.chords[0].name, 'Dm');

const empty = context.EditorSongStateService.create();
assert.equal(empty.getPresentationSnapshot(), null);
assert.equal(empty.setTempo(100), false);
assert.equal(
  JSON.stringify(empty.getTimingContext()),
  JSON.stringify({ tempo: 120, timeSignature: '4/4' })
);

console.log('EditorSongStateService tests passed');
