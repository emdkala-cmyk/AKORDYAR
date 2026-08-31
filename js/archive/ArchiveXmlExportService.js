/**
 * ArchiveXmlExportService
 *
 * Builds the legacy song XML representation and writes it through the native
 * file picker or the browser download fallback.
 */
(function attachArchiveXmlExportService(globalScope) {
  function create(context = {}) {
    const {
      getSong = () => null,
      syncMetadata = () => {},
      getShowSaveFilePicker = () => globalScope.showSaveFilePicker,
      documentRef = globalScope.document,
      BlobCtor = globalScope.Blob,
      URLRef = globalScope.URL,
      toast = () => {}
    } = context;

    function escapeXml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function buildXml(song) {
      const esc = escapeXml;
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<song>\n';
      xml += `  <title>${esc(song.title)}</title>\n`;
      xml += `  <artist>${esc(song.artist)}</artist>\n`;
      xml += `  <key>${esc(song.key)}${song.keyMode === 'min' ? 'm' : ''}</key>\n`;
      xml += `  <timeSignature>${esc(song.timeSignature)}</timeSignature>\n`;
      xml += `  <tempo>${song.tempo || 120}</tempo>\n`;
      xml += `  <genre>${esc(song.genre)}</genre>\n`;
      xml += `  <transpose>${song.transpose || 0}</transpose>\n`;

      xml += '  <chords>\n';
      (song.chords || []).forEach(chord => {
        xml += `    <chord name="${esc(chord.name)}" line="${chord.lineIndex}" char="${chord.charIndex}" anchor="${esc(chord.anchorType)}" />\n`;
      });
      xml += '  </chords>\n';

      xml += '  <lyrics>\n';
      (song.lyrics || '').split('\n').forEach((line, index) => {
        xml += `    <line index="${index}">${esc(line)}</line>\n`;
      });
      xml += '  </lyrics>\n';

      const styles = song.styles || {};
      xml += '  <styles>\n';
      xml += `    <text size="${styles.tSize || 23}" color="${esc(styles.tColor || '#0fa966')}" font="${esc(styles.tFont || 'Vazirmatn')}" bold="${styles.tBold ? 'true' : 'false'}" align="${esc(styles.align || 'center')}" />\n`;
      xml += `    <chord size="${styles.cSize || 23}" color="${esc(styles.cColor || '#e6aa28')}" font="${esc(styles.cFont || 'JetBrains Mono')}" />\n`;
      xml += '  </styles>\n';
      xml += '</song>';
      return xml;
    }

    async function exportXml() {
      const song = getSong();
      if (!song) {
        toast('ترانه‌ای باز نیست');
        return;
      }
      syncMetadata(song);

      const filename = (song.title || t('newSongDefault')) + '.xml';
      const blob = new BlobCtor([buildXml(song)], {
        type: 'application/xml'
      });
      const showSaveFilePicker = getShowSaveFilePicker?.();

      if (typeof showSaveFilePicker === 'function') {
        try {
          const handle = await showSaveFilePicker({
            suggestedName: filename,
            types: [{
              description: 'فایل XML',
              accept: { 'application/xml': ['.xml'] }
            }]
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          toast('خروجی XML ذخیره شد');
          return;
        } catch (error) {
          if (error?.name === 'AbortError') return;
        }
      }

      const url = URLRef.createObjectURL(blob);
      const anchor = documentRef.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URLRef.revokeObjectURL(url);
      toast('خروجی XML ذخیره شد');
    }

    return Object.freeze({ exportXml });
  }

  const service = Object.freeze({ create });
  globalScope.ArchiveXmlExportService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
