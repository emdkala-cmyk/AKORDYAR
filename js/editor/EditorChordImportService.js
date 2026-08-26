/**
 * EditorChordImportService
 *
 * Owns text/URL chord import, preview, and application to the current song.
 * Editor state mutation and rendering remain injected callbacks.
 */
(function attachEditorChordImportService(globalScope) {
  function create({
    documentRef = globalScope.document,
    windowRef = globalScope,
    getElement = id => documentRef?.getElementById?.(id),
    fetchRef = (...args) => globalScope.fetch?.(...args),
    domParserRef = globalScope.DOMParser,
    urlRef = globalScope.URL,
    getAutoImportResults = () => [],
    songUniqueId = song =>
      String(song?.url || `${song?.artist || ''}::${song?.title || ''}`)
        .replace(/\s+/g, '')
        .toLowerCase(),
    getImportParsed = () => undefined,
    setImportParsedExternal = () => {},
    normalizeRawText = value => value || '',
    hasPersian = () => false,
    isChordOnlyLine = () => false,
    parseRawSongToEdCur = () => null,
    parseChordLyricText = () => ({
      allChords: new Set(),
      sections: []
    }),
    getEditorSongImportService = () => null,
    getDAW = () => ({}),
    syncToolbar = () => {},
    renderEditor = () => {},
    saveSong = () => {},
    renderAll = () => {},
    toast = () => {},
    logger = console
  } = {}) {
    let importParsed = getImportParsed();

    function setImportParsed(value) {
      importParsed = value;
      setImportParsedExternal(value);
      return importParsed;
    }

    function readImportParsed() {
      const externalValue = getImportParsed();
      return externalValue === undefined ? importParsed : externalValue;
    }

    function openImportChordModal() {
      getElement('importChordModal')?.classList?.add?.('show');
      const importText = getElement('importText');
      const importUrl = getElement('importUrl');
      const importPreview = getElement('importPreview');
      if (importText) importText.value = '';
      if (importUrl) importUrl.value = '';
      if (importPreview) importPreview.style.display = 'none';
      setImportParsed(null);
    }

    function closeImportChordModal() {
      getElement('importChordModal')?.classList?.remove?.('show');
      setImportParsed(null);
    }

    function loadAutoImportSong(key) {
      const song = (getAutoImportResults() || []).find(
        item => songUniqueId(item) === key
      );
      if (!song || song.error) return;

      const autoFix = getElement('autoFixChords');
      const importAutoFix = getElement('importAutoFix');
      if (autoFix?.checked && importAutoFix) {
        importAutoFix.checked = true;
      }

      const parsed = {
        title: song.title,
        artist: song.artist,
        key: song.key,
        rhythm: song.rhythm,
        rawText: song.rawText,
        url: song.url
      };
      openImportChordModal();
      const importText = getElement('importText');
      const importUrl = getElement('importUrl');
      if (importText) importText.value = song.rawText || '';
      if (importUrl) importUrl.value = song.url || '';
      setImportParsed(parsed);
      showImportPreview(parsed);
    }

    async function fetchFromUrl() {
      const importUrl = getElement('importUrl');
      const url = (importUrl?.value || '').trim();
      if (!url) {
        toast('لینک را وارد کنید');
        return;
      }

      let parsedUrl;
      try {
        parsedUrl = new urlRef(url);
      } catch (_) {
        toast('لینک نامعتبر است');
        return;
      }

      const hostname = parsedUrl.hostname;
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        toast('پروتکل نامعتبر');
        return;
      }

      toast('در حال دریافت...');
      try {
        let html;
        const isLaminor =
          hostname === 'laminor.org' || hostname === 'www.laminor.org';
        const isAkord =
          hostname === 'akord.ir' || hostname === 'www.akord.ir';

        if (isAkord) {
          const response = await fetchRef(
            '/api/akord/fetch?url=' + encodeURIComponent(url)
          );
          const data = await response.json();
          if (data.error) throw new Error(data.error);
          html = data.html;
        } else if (isLaminor) {
          const response = await fetchRef(
            '/api/fetch?url=' + encodeURIComponent(url)
          );
          const data = await response.json();
          if (data.error) throw new Error(data.error);
          html = data.html;
        } else {
          const response = await fetchRef(url);
          if (!response.ok) throw new Error('HTTP ' + response.status);
          html = await response.text();
        }

        if (isLaminor) {
          try {
            const extraction = await windowRef.extractLaminorFromHtml(html);
            if (extraction?.lines?.length > 0) {
              const converted =
                windowRef.convertExtractedLinesToEdCur(extraction.lines);
              const parsed = {
                title: '',
                artist: '',
                key: extraction.key ? String(extraction.key).trim() : '',
                rhythm: extraction.rhythm
                  ? String(extraction.rhythm).trim()
                  : '',
                rawText: converted.lyrics,
                url,
                _extractedChords: converted.chords,
                _extractionWarnings: converted.warnings,
                _extractionValidation: extraction.validation
              };
              setImportParsed(parsed);
              showImportPreview(parsed);
              toast('متن و آکوردها با دقت پیکسلی استخراج شد!');
            } else {
              showParsedPageFallback(html, url, 'متن استخراج شد (روش متنی)');
            }
          } catch (extractError) {
            logger.warn?.(
              '[Laminor Extractor] Pixel extraction failed, falling back to text:',
              extractError
            );
            showParsedPageFallback(html, url, 'متن استخراج شد (روش متنی)');
          }
        } else {
          showParsedPageFallback(html, url, 'متن استخراج شد!');
        }
      } catch (error) {
        logger.error?.(error);
        toast('خطا در دریافت: ' + error.message);
      }
    }

    function showParsedPageFallback(html, url, successMessage) {
      const parsed = parseChordPage(html, url);
      if (parsed) {
        setImportParsed(parsed);
        showImportPreview(parsed);
        toast(successMessage);
      } else {
        toast('نتوانستم متن را استخراج کنم');
      }
    }

    function parseChordPage(html, url) {
      const parser = new domParserRef();
      const doc = parser.parseFromString(html, 'text/html');
      let title = '';
      let artist = '';
      let key = '';
      let rhythm = '';
      let lyrics = '';

      function isLaminorUrl(value) {
        try {
          const hostname = new urlRef(value).hostname;
          return hostname === 'laminor.org' || hostname === 'www.laminor.org';
        } catch (_) {
          return false;
        }
      }

      function isAkordUrl(value) {
        try {
          const hostname = new urlRef(value).hostname;
          return hostname === 'akord.ir' || hostname === 'www.akord.ir';
        } catch (_) {
          return false;
        }
      }

      if (url && isLaminorUrl(url)) {
        const titleElement = doc.querySelector('h1');
        title = titleElement
          ? titleElement.textContent
              .replace(/آکورد\s+آهنگ\s*/, '')
              .replace(/\s*-\s*لامینور.*$/, '')
              .trim()
          : '';
        const artistElement = doc.querySelector(
          'h6 a.color-light-blue, .smh-header-right-section a.color-light-blue'
        );
        artist = artistElement ? artistElement.textContent.trim() : '';
        const keyMatch = html.match(/گام اصلی:\s*([A-G][#b]?m?)/);
        key = keyMatch ? keyMatch[1] : '';
        const rhythmElement = doc.querySelector('a[href*="rhythms/"]');
        rhythm = rhythmElement ? rhythmElement.textContent.trim() : '';
        if (!rhythm) {
          const rhythmMatch = html.match(/ریتم\s+پیشنهادی[\s\S]*?(\d+\/\d+)/);
          rhythm = rhythmMatch ? rhythmMatch[1] : '';
        }
        const preElement = doc.querySelector('pre#main-chord, pre.chord');
        if (preElement) {
          lyrics = preElement.textContent;
        } else {
          const allPres = doc.querySelectorAll('pre');
          for (const pre of allPres) {
            const text = pre.textContent || '';
            const firstLine = text
              .split('\n')[0]
              .replace(/\s{2,}/g, ' ')
              .trim();
            if (
              text.length > 20 &&
              (isChordOnlyLine(firstLine) || hasPersian(text))
            ) {
              lyrics = text;
              break;
            }
          }
        }
      }

      if (url && isAkordUrl(url)) {
        const titleElement = doc.querySelector('.section-title h4');
        title = titleElement
          ? titleElement.textContent.replace(/^آکورد\s*/, '').trim()
          : '';
        const breadcrumbLinks = doc.querySelectorAll('.breadcrumbs a');
        breadcrumbLinks.forEach(link => {
          const href = link.getAttribute('href');
          if (
            href &&
            href.startsWith('/artists/') &&
            href.split('/').filter(Boolean).length === 1
          ) {
            artist = link.textContent.trim();
          }
        });
        const tags = doc.querySelectorAll('.tags');
        tags.forEach(tag => {
          const text = tag.textContent.trim();
          if (text.includes('گام:')) key = text.replace('گام:', '').trim();
          if (text.includes('ریتم:')) rhythm = text.replace('ریتم:', '').trim();
          if (text.includes('میزان:')) {
            // The legacy parser assigned this to an unused global.
          }
        });
        const preElement = doc.querySelector('pre#pre, pre');
        if (preElement) lyrics = preElement.textContent;
      }

      if (!lyrics) {
        const allPres = doc.querySelectorAll('pre');
        for (const pre of allPres) {
          const text = pre.textContent || '';
          if (text.length > 20) {
            lyrics = text;
            break;
          }
        }
      }

      if (!title) {
        const titleElement = doc.querySelector('h1');
        title = titleElement ? titleElement.textContent.trim() : '';
      }

      return {
        title,
        artist,
        key,
        rhythm,
        rawText: normalizeRawText(lyrics),
        url
      };
    }

    function showImportPreview(parsed) {
      const parsedResult = parseChordLyricText(parsed.rawText);
      let preview = `عنوان: ${parsed.title || 'نامشخص'}\n`;
      preview += `خواننده: ${parsed.artist || 'نامشخص'}\n`;
      preview += `گام: ${parsed.key || 'نامشخص'}\n`;
      preview += `ریتم: ${parsed.rhythm || 'نامشخص'}\n`;
      preview += `آکوردها: ${[...parsedResult.allChords].join(', ')}\n`;
      preview +=
        `تعداد خطوط: ${parsedResult.sections.length} ` +
        `(${parsedResult.sections.filter(section => section.type === 'chord').length} ` +
        `خط آکورد + ` +
        `${parsedResult.sections.filter(section => section.type === 'lyric').length} ` +
        'خط شعر)';
      const previewElement = getElement('importPreview');
      if (previewElement) {
        previewElement.textContent = preview;
        previewElement.style.display = 'block';
      }
      return preview;
    }

    function applyImportChords() {
      const textElement = getElement('importText');
      const text = (textElement?.value || '').trim();
      const currentImportParsed = readImportParsed();
      if (!text && !currentImportParsed) {
        toast('متنی وارد نشده');
        return null;
      }

      let parsed;
      if (currentImportParsed && text.length === 0) {
        parsed = currentImportParsed;
      } else {
        parsed = {
          title: '',
          artist: '',
          key: '',
          rhythm: '',
          rawText: text,
          url: ''
        };
        const firstLines = text.split('\n').slice(0, 5);
        for (const line of firstLines) {
          if (!parsed.title && line.match(/آهنگ|ترانه|song/i)) {
            parsed.title = line.replace(/.*[:：]\s*/, '').trim();
          }
          if (!parsed.artist && line.match(/خواننده|artist|از\s/i)) {
            parsed.artist = line
              .replace(/.*[:：]\s*/, '')
              .replace(/از\s+/, '')
              .trim();
          }
        }
      }

      const parsedResult = parseRawSongToEdCur(parsed);
      if (parsed._extractedChords?.length > 0) {
        parsedResult.chords = parsed._extractedChords;
        if (parsed._extractionWarnings) {
          parsedResult.warnings = (
            parsedResult.warnings || []
          ).concat(parsed._extractionWarnings);
        }
      }

      const imported =
        getEditorSongImportService()?.applyParsedResult(parsedResult);
      if (!imported) {
        toast('ترانه‌ای باز نیست');
        return null;
      }

      const daw = getDAW();
      if (Array.isArray(daw.clips)) {
        daw.clips = daw.clips.filter(clip => clip.type !== 'chord');
      }
      syncToolbar();
      renderEditor(true);
      saveSong();
      renderAll();
      closeImportChordModal();
      toast(
        'ترانه با ' +
          imported.chordCount +
          ' آکورد وارد شد: ' +
          (imported.title || 'بدون نام')
      );
      return imported;
    }

    return Object.freeze({
      openImportChordModal,
      closeImportChordModal,
      loadAutoImportSong,
      fetchFromUrl,
      parseChordPage,
      showImportPreview,
      applyImportChords,
      getImportParsed: readImportParsed
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorChordImportService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
