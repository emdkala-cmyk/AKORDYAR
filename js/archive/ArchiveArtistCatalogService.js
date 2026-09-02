/**
 * ArchiveArtistCatalogService
 *
 * Provides the bundled artist catalog and stable display-name lookup used by
 * archive artist, image and filter services.
 */
(function attachArchiveArtistCatalogService(globalScope) {
  const ARTISTS = [
    {
      id: "hayedeh",
      displayName: "هایده",
      normalizedName: "hayedeh",
      aliases: ["هایده", "هايده", "Hayedeh", "hayedeh", "Haydeh", "haydeh", "حیدری"],
      image: { type: "bundled", src: "./assets/artists/hayedeh.jpg" },
      favorite: false
    },
    {
      id: "googoosh",
      displayName: "گوگوش",
      normalizedName: "googoosh",
      aliases: ["گوگوش", "Googoosh", "googoosh", "Googosh", "googosh", "بیژن"],
      image: { type: "bundled", src: "./assets/artists/googosh.jpg" },
      favorite: false
    },
    {
      id: "dariush",
      displayName: "داریوش",
      normalizedName: "dariush",
      aliases: ["داریوش", "Dariush", "dariush", "اقبال"],
      image: { type: "bundled", src: "./assets/artists/dariush.jpg" },
      favorite: false
    },
    {
      id: "ebi",
      displayName: "ابی",
      normalizedName: "ebi",
      aliases: ["ابی", "Ebi", "ebi", "EBI", "ابی ابراهیمی"],
      image: { type: "bundled", src: "./assets/artists/ebi.jpg" },
      favorite: false
    },
    {
      id: "siavash-ghomayshi",
      displayName: "سیاوش قمیشی",
      normalizedName: "siavash-ghomayshi",
      aliases: ["سیاوش قمیشی", "Siavash Ghomayshi", "siavash-ghomayshi", "قمیشی"],
      image: { type: "bundled", src: "./assets/artists/siavash-ghomayshi.jpg" },
      favorite: false
    },
    {
      id: "moein",
      displayName: "معین",
      normalizedName: "moein",
      aliases: ["معین", "Moein", "moein", "کاشانی"],
      image: { type: "bundled", src: "./assets/artists/moein.jpg" },
      favorite: false
    },
    {
      id: "habib",
      displayName: "حبیب",
      normalizedName: "habib",
      aliases: ["حبیب", "Habib", "habib", "موحد"],
      image: { type: "bundled", src: "./assets/artists/habib.jpg" },
      favorite: false
    },
    {
      id: "mahasti",
      displayName: "مهستی",
      normalizedName: "mahasti",
      aliases: ["هاشمی"],
      image: { type: "bundled", src: "./assets/artists/mahasti.jpg" },
      favorite: false
    },
    {
      id: "aref",
      displayName: "عارف",
      normalizedName: "aref",
      aliases: ["_avlazm"],
      image: { type: "bundled", src: "./assets/artists/aref.jpg" },
      favorite: false
    },
    {
      id: "farhamz-aslani",
      displayName: "فرامرز اصلانی",
      normalizedName: "farhamz-aslani",
      aliases: ["فرامرز", "اصلانی", "فرامرز اصلانی"],
      image: { type: "bundled", src: "./assets/artists/farhamz-aslani.jpg" },
      favorite: false
    },
    {
      id: "martik",
      displayName: "مارتیک",
      normalizedName: "martik",
      aliases: ["ترپتیان"],
      image: { type: "bundled", src: "./assets/artists/martik.jpg" },
      favorite: false
    },
    {
      id: "sheyad-ghambari",
      displayName: "شهیار قنبری",
      normalizedName: "sheyad-ghambari",
      aliases: ["قنبری"],
      image: { type: "bundled", src: "./assets/artists/sheyad-ghambari.jpg" },
      favorite: false
    },
    {
      id: "andy",
      displayName: "اندی",
      normalizedName: "andy",
      aliases: ["سیسجنگ"],
      image: { type: "bundled", src: "./assets/artists/andy.jpg" },
      favorite: false
    },
    {
      id: "leila-forouhar",
      displayName: "لیلا فروهر",
      normalizedName: "leila-forouhar",
      aliases: ["فروهر"],
      image: { type: "bundled", src: "./assets/artists/leila-forouhar.jpg" },
      favorite: false
    },
    {
      id: "sattar",
      displayName: "ستار",
      normalizedName: "sattar",
      aliases: ["صدرالدین"],
      image: { type: "bundled", src: "./assets/artists/sattar.jpg" },
      favorite: false
    },
    {
      id: "farhad",
      displayName: "فرهاد",
      normalizedName: "farhad",
      aliases: ["شکیبا"],
      image: { type: "bundled", src: "./assets/artists/farhad.jpg" },
      favorite: false
    },
    {
      id: "shohreh",
      displayName: "شهره",
      normalizedName: "shohreh",
      aliases: ["سعادتمند"],
      image: { type: "bundled", src: "./assets/artists/shohreh.jpg" },
      favorite: false
    },
    {
      id: "marjan",
      displayName: "مرجان",
      normalizedName: "marjan",
      aliases: ["سعادت‌مند"],
      image: { type: "bundled", src: "./assets/artists/marjan.jpg" },
      favorite: false
    },
    {
      id: "homaira",
      displayName: "حمیرا",
      normalizedName: "homaira",
      aliases: [],
      image: { type: "bundled", src: "./assets/artists/homaira.jpg" },
      favorite: false
    },
    {
      id: "vigen",
      displayName: "ویگن",
      normalizedName: "vigen",
      aliases: ["دردیریان"],
      image: { type: "bundled", src: "./assets/artists/vigen.jpg" },
      favorite: false
    },
    {
      id: "kourosh-yaghmaei",
      displayName: "کوروش یغمایی",
      normalizedName: "kourosh-yaghmaei",
      aliases: ["یغمایی"],
      image: { type: "bundled", src: "./assets/artists/kourosh-yaghmaei.jpg" },
      favorite: false
    },
    {
      id: "shahrokh",
      displayName: "\u0634\u0627\u0647\u0631\u0648\u062e",
      normalizedName: "shahrokh",
      aliases: ["\u0634\u0627\u0647\u0631\u0648\u062e", "Shahrokh", "shahrokh"],
      image: { type: "bundled", src: "./assets/artists/\u0634\u0627\u0647\u0631\u0648\u062e.jpg" },
      favorite: false
    },
    {
      id: "shadmehr-aghili",
      displayName: "\u0634\u0627\u062f\u0645\u0647\u0631 \u0639\u0642\u06cc\u0644\u06cc",
      normalizedName: "shadmehr-aghili",
      aliases: ["\u0634\u0627\u062f\u0645\u0647\u0631 \u0639\u0642\u06cc\u0644\u06cc", "Shadmehr Aghili", "shadmehr aghili"],
      image: { type: "bundled", src: "./assets/artists/\u0634\u0627\u062f\u0645\u0647\u0631 \u0639\u0642\u06cc\u0644\u06cc.jpg" },
      favorite: false
    }
  ];

  const MANUAL_DISPLAY_NAMES = Object.freeze({
    hayedeh: 'هایده',
    googoosh: 'گوگوش',
    dariush: 'داریوش',
    ebi: 'ابی',
    'siavash-ghomayshi': 'سیاوش قمیشی',
    moein: 'معین',
    habib: 'حبیب',
    mahasti: 'مهستی',
    aref: 'عارف',
    'farhamz-aslani': 'فرامرز اصلانی',
    martik: 'مارتیک',
    'sheyad-ghambari': 'شهیار قنبری',
    andy: 'اندی',
    'leila-forouhar': 'لیلا فروهر',
    sattar: 'ستار',
    farhad: 'فرهاد',
    shohreh: 'شهره',
    marjan: 'مرجان',
    homaira: 'حمیرا',
    vigen: 'ویگن',
    'kourosh-yaghmaei': 'کوروش یغمایی'
  });

  function getAll() {
    return ARTISTS;
  }

  function getDisplayName(artistKey) {
    if (!artistKey) return '';
    const normalizedKey = String(artistKey).trim().toLowerCase();
    const artist = ARTISTS.find(item =>
      String(item.id || '').trim().toLowerCase() === normalizedKey ||
      String(item.normalizedName || '').trim().toLowerCase() === normalizedKey ||
      (Array.isArray(item.aliases) && item.aliases.some(alias =>
        String(alias || '').trim().toLowerCase() === normalizedKey
      ))
    );
    return artist?.displayName || MANUAL_DISPLAY_NAMES[normalizedKey] || artistKey;
  }

  const service = Object.freeze({
    getAll,
    getDisplayName,
    artists: ARTISTS
  });
  globalScope.ArchiveArtistCatalogService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
