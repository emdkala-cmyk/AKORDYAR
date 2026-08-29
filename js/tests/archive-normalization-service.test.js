const assert = require('node:assert/strict');
const ArchiveNormalizationService = require('../archive/ArchiveNormalizationService.js');

const service = ArchiveNormalizationService.create({
  schemaVersion: 1,
  generateId: () => 'generated-id',
  now: () => '2026-08-24T00:00:00.000Z'
});

assert.equal(
  service.normalizeText('  كِتاب\u200c  ي  '),
  'کتاب ی'
);

const source = {
  id: 'song-1',
  title: 'عنوان',
  artist: 'خواننده',
  bpm: '90',
  tags: ['شاد'],
  categories: ['پاپ'],
  lyrics: 'متن ترانه',
  chords: [{ name: 'Am' }],
  sections: [{ title: 'بند', text: 'متن بخش' }]
};
const normalized = service.normalizeSong(source, 'song.json');

assert.equal(normalized.id, 'song-1');
assert.equal(normalized.title, 'عنوان');
assert.equal(normalized.tempo, 90);
assert.equal(normalized.bpm, 90);
assert.equal(normalized.timeSignature, '4/4');
assert.equal(normalized.sourceFileName, 'song.json');
assert.equal(normalized.schemaVersion, 1);
assert.equal(normalized.deletedAt, null);
assert.equal(normalized.createdAt, '2026-08-24T00:00:00.000Z');

assert.match(
  service.extractSearchText(source),
  /عنوان.*خواننده.*متن ترانه.*am.*متن بخش بند/s
);

const feelSearchText = service.extractSearchText({
  ...source,
  timeSignature: '2/4 (حس 6/8)'
});
assert.ok(feelSearchText.includes('2/4 (حس 6/8)'));
assert.ok(feelSearchText.includes('2/4 6/8'));
assert.ok(feelSearchText.includes('حس 6/8'));

const normalizedFeel = service.normalizeSong({
  ...source,
  timeSignature: '2/4 (\u062d\u0633 6/8)'
}, 'feel-song.json');
assert.equal(normalizedFeel.timeSignature, '2/4');
assert.equal(normalizedFeel.timeSignaturePreset, '2/4-feel-6/8');
assert.equal(
  service.getSignatureIdentity(normalizedFeel),
  '2/4-feel-6/8'
);
assert.equal(
  service.getSignatureIdentity({ timeSignature: '2/4' }),
  '2/4'
);

console.log('ArchiveNormalizationService tests passed');
