/**
 * ArchiveNormalizationService
 *
 * Normalizes imported archive records and builds the searchable text
 * projection. Artist alias resolution remains outside this service.
 */
(function attachArchiveNormalizationService(globalScope) {
  const FEEL_6_8_LABEL = '2/4 (حس 6/8)';
  const FEEL_6_8_ID = '2/4-feel-6/8';
  const GENRE_LABELS = Object.freeze({
    'heavy-6-8': '6/8 سنگین'
  });

  function getDisplayGenre(value) {
    const raw = String(value ?? '').trim();
    return GENRE_LABELS[raw] || raw;
  }

  function getSignatureIdentity(valueOrSong) {
    const isSong = valueOrSong && typeof valueOrSong === 'object';
    const raw = String(
      isSong ? valueOrSong.timeSignature : valueOrSong ?? ''
    ).trim();
    const preset = isSong
      ? String(valueOrSong.timeSignaturePreset || '').trim()
      : '';
    if (
      preset === FEEL_6_8_ID ||
      preset === FEEL_6_8_LABEL ||
      raw === FEEL_6_8_ID ||
      raw === FEEL_6_8_LABEL
    ) {
      return FEEL_6_8_ID;
    }
    return raw || '4/4';
  }

  function resolveTimeSignature(value, preset) {
    const raw = String(value ?? '').trim();
    const presetValue = String(preset ?? '').trim();
    if (
      presetValue === FEEL_6_8_ID ||
      presetValue === FEEL_6_8_LABEL ||
      raw === FEEL_6_8_ID ||
      raw === FEEL_6_8_LABEL
    ) {
      return {
        timeSignature: '2/4',
        timeSignaturePreset: FEEL_6_8_ID
      };
    }
    return {
      timeSignature: raw || '4/4',
      timeSignaturePreset: ''
    };
  }

  function getDisplayTimeSignature(song) {
    return getSignatureIdentity(song) === FEEL_6_8_ID
      ? FEEL_6_8_LABEL
      : String(song?.timeSignature || '4/4');
  }

  function normalizeText(value) {
    if (!value) return '';
    return value
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/\u200c/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function extractSearchText(song) {
    const timeSignature = getDisplayTimeSignature(song);
    const signatureParts = timeSignature.match(/\d+\s*\/\s*\d+/g) || [];
    const parts = [
      song.title,
      song.artist,
      song.album,
      song.key,
      song.genre,
      getDisplayGenre(song.genre),
      timeSignature,
      ...signatureParts,
      signatureParts.join(' '),
      song.sourceFileName,
      song.notes,
      (song.tags || []).join(' '),
      (song.categories || []).join(' ')
    ];
    if (song.lyrics) parts.push(song.lyrics);
    if (song.text) parts.push(song.text);
    if (Array.isArray(song.chords)) {
      parts.push(song.chords.map(chord => chord.name || chord).join(' '));
    }
    if (Array.isArray(song.lines)) {
      parts.push(song.lines.map(line => line.text || line.lyric || line).join(' '));
    }
    if (Array.isArray(song.sections)) {
      parts.push(
        song.sections
          .map(section => (section.text || '') + ' ' + (section.title || ''))
          .join(' ')
      );
    }
    if (song._dawSections) {
      parts.push(song._dawSections.map(section => section.label || '').join(' '));
    }
    return normalizeText(parts.filter(Boolean).join(' '));
  }

  function create(options = {}) {
    const t = options.t || globalScope.t || (k => k);
    const schemaVersion = options.schemaVersion ?? 1;
    const generateId = typeof options.generateId === 'function'
      ? options.generateId
      : () => `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const now = typeof options.now === 'function'
      ? options.now
      : () => new Date().toISOString();

    function normalizeSong(data, fileName) {
      const timestamp = now();
      const output = { ...data };
      output.id = String(data.id || generateId());
      output.title = data.title || t('untitled');
      output.artist = data.artist || '';
      output.album = data.album || '';
      output.key = data.key || 'C';
      output.keyMode = data.keyMode || 'maj';
      output.tempo = data.tempo || parseInt(data.bpm) || 120;
      output.bpm = output.tempo;
      const resolvedTimeSignature = resolveTimeSignature(
        data.timeSignature,
        data.timeSignaturePreset
      );
      output.timeSignature = resolvedTimeSignature.timeSignature;
      if (resolvedTimeSignature.timeSignaturePreset) {
        output.timeSignaturePreset = resolvedTimeSignature.timeSignaturePreset;
      } else {
        delete output.timeSignaturePreset;
      }
      output.genre = data.genre || '';
      output.tags = Array.isArray(data.tags) ? data.tags : [];
      output.categories = Array.isArray(data.categories) ? data.categories : [];
      output.favorite = !!data.favorite;
      output.status = 'active';
      output.createdAt = data.createdAt || timestamp;
      output.updatedAt = data.updatedAt || timestamp;
      output.lastOpenedAt = data.lastOpenedAt || null;
      output.importedAt = data.importedAt || timestamp;
      output.sourceFileName = fileName || data.sourceFileName || '';
      output.schemaVersion = schemaVersion;
      output.deletedAt = null;
      return output;
    }

    return Object.freeze({
      normalizeText,
      extractSearchText,
      normalizeSong,
      getSignatureIdentity,
      getDisplayTimeSignature,
      getDisplayGenre,
      resolveTimeSignature
    });
  }

  const service = Object.freeze({
    create,
    normalizeText,
    extractSearchText
  });
  globalScope.ArchiveNormalizationService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
