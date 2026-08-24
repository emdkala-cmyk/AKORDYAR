const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const AudioCompressionService = require('../core/AudioCompressionService.js');

const projectRoot = path.resolve(__dirname, '..', '..');
const editorSource = fs.readFileSync(
  path.join(projectRoot, 'js', 'app', 'editor.js'),
  'utf8'
);

assert.match(
  editorSource,
  /getEditorProjectExportService\(\)\?\.audioBufferToWav/
);
assert.match(
  editorSource,
  /getAudioCompressionService\(\)\?\.compressBytes/
);
assert.match(
  editorSource,
  /getAudioCompressionService\(\)\?\.decompressBytes/
);
assert.doesNotMatch(
  editorSource,
  /const wavBytes = audioBufferToWav\(buffer\)/
);

async function bytesOf(blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

(async () => {
  const input = new Uint8Array([0, 1, 2, 3, 4, 255]);
  const fallback = AudioCompressionService.create({
    CompressionStreamCtor: null,
    DecompressionStreamCtor: null,
    BlobCtor: Blob
  });

  const fallbackBlob = await fallback.compressBytes(input);
  assert.equal(fallbackBlob.format, 'wav');
  assert.deepEqual([...await bytesOf(fallbackBlob.blob)], [...input]);
  await assert.rejects(
    fallback.decompressBytes(input),
    /DecompressionStream is unavailable/
  );

  if (
    typeof CompressionStream === 'function' &&
    typeof DecompressionStream === 'function'
  ) {
    const service = AudioCompressionService.create();
    const compressed = await service.compressBytes(
      new Uint8Array([...input, ...input, ...input])
    );
    assert.equal(compressed.format, 'wav-deflate');
    const restored = await service.decompressBytes(
      await bytesOf(compressed.blob)
    );
    assert.deepEqual(
      [...restored],
      [...input, ...input, ...input]
    );
  }

  console.log('Audio compression service tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
