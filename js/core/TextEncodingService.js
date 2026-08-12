/**
 * TextEncodingService — ترمیم محافظه‌کارانهٔ متن‌های UTF-8 خراب‌شده.
 *
 * بعضی پروژه‌های قدیمی ممکن است متن UTF-8 را یک‌بار به‌عنوان Latin-1
 * خوانده باشند و در نتیجه رشته‌هایی مثل «Ø§Ù…» تولید شده باشد. این سرویس
 * فقط در صورت تشخیص همین الگوها تلاش به ترمیم می‌کند و متن سالم را تغییر نمی‌دهد.
 */
(function attachTextEncodingService(globalScope) {
  const MOJIBAKE_MARKERS = /(?:Ã|Â|â|Ø|Ù|�)/g;

  function markerCount(value) {
    return (String(value).match(MOJIBAKE_MARKERS) || []).length;
  }

  function decodeUtf8FromLatin1(value) {
    const input = String(value);
    if (typeof TextDecoder === 'function') {
      const cp1252 = {
        0x20ac: 0x80, 0x201a: 0x82, 0x192: 0x83, 0x201e: 0x84,
        0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x2c6: 0x88,
        0x2030: 0x89, 0x160: 0x8a, 0x2039: 0x8b, 0x152: 0x8c,
        0x17d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
        0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
        0x2dc: 0x98, 0x2122: 0x99, 0x161: 0x9a, 0x203a: 0x9b,
        0x153: 0x9c, 0x17e: 0x9e, 0x178: 0x9f
      };
      const bytes = Uint8Array.from([...input], char => {
        const code = char.codePointAt(0);
        return cp1252[code] ?? (code <= 0xff ? code : 0x3f);
      });
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    }

    if (typeof decodeURIComponent === 'function') {
      return decodeURIComponent(escape(input));
    }

    return input;
  }

  function repairText(value) {
    if (typeof value !== 'string' || markerCount(value) === 0) return value;

    try {
      const candidate = decodeUtf8FromLatin1(value);
      return markerCount(candidate) < markerCount(value) ? candidate : value;
    } catch (_) {
      return value;
    }
  }

  function repairValue(value) {
    if (typeof value === 'string') return repairText(value);
    if (Array.isArray(value)) return value.map(repairValue);
    if (!value || typeof value !== 'object') return value;

    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, repairValue(entry)])
    );
  }

  const service = Object.freeze({
    repairText,
    repairValue,
    repairSong(song) {
      return song && typeof song === 'object' ? repairValue(song) : song;
    }
  });

  globalScope.TextEncodingService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
