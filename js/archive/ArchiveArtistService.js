/**
 * ArchiveArtistService
 *
 * Resolves artist spellings to stable canonical keys and matches them against
 * the default artist catalog. Display names remain untouched.
 */
(function attachArchiveArtistService(globalScope) {
  const aliases = Object.freeze({
    'هایده': 'hayedeh', 'هايده': 'hayedeh',
    'hayedeh': 'hayedeh', 'haydeh': 'hayedeh', 'hayede': 'hayedeh',
    'Hayedeh': 'hayedeh', 'Haydeh': 'hayedeh',
    'گوگوش': 'googoosh', 'googoosh': 'googoosh', 'googosh': 'googoosh',
    'gogoosh': 'googoosh', 'gogoush': 'googoosh',
    'Googoosh': 'googoosh', 'Googosh': 'googoosh',
    'داریوش': 'dariush', 'dariush': 'dariush', 'Dariush': 'dariush',
    'ابی': 'ebi', 'ebi': 'ebi', 'Ebi': 'ebi', 'EBI': 'ebi',
    'ابی ابراهیمی': 'ebi',
    'سیاوش قمیشی': 'siavash-ghomayshi',
    'siavash-ghomayshi': 'siavash-ghomayshi',
    'قمیشی': 'siavash-ghomayshi',
    'Siavash Ghomayshi': 'siavash-ghomayshi',
    'معین': 'moein', 'moein': 'moein', 'Moein': 'moein', 'کاشانی': 'moein',
    'حبیب': 'habib', 'habib': 'habib', 'Habib': 'habib', 'موحد': 'habib',
    'مهستی': 'mahasti', 'mahasti': 'mahasti', 'Mahasti': 'mahasti',
    'رضا صادقی': 'reza-sadeghi', 'reza sadeghi': 'reza-sadeghi',
    'Reza Sadeghi': 'reza-sadeghi', 'رضا_صادقی': 'reza-sadeghi'
  });

  function create(options = {}) {
    const normalizeText =
      options.normalizeText ||
      globalScope.ArchiveNormalizationService?.normalizeText ||
      (value => String(value ?? '').trim().toLowerCase());
    const getDefaultArtists = typeof options.getDefaultArtists === 'function'
      ? options.getDefaultArtists
      : () => options.defaultArtists || [];

    function artistKey(value) {
      const normalized = normalizeText(String(value == null ? '' : value));
      if (!normalized) return '_unknown';
      return aliases[normalized] || normalized;
    }

    function matchDefaultArtist(songArtist) {
      const key = artistKey(songArtist);
      if (key === '_unknown') return null;
      return getDefaultArtists().find(artist => {
        if (artistKey(artist.normalizedName) === key) return true;
        if (artistKey(artist.displayName) === key) return true;
        return Boolean(
          artist.aliases &&
          artist.aliases.some(alias => artistKey(alias) === key)
        );
      }) || null;
    }

    return Object.freeze({
      artistKey,
      matchDefaultArtist,
      aliases
    });
  }

  const service = Object.freeze({ create, aliases });
  globalScope.ArchiveArtistService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
