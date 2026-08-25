const assert = require('node:assert/strict');
const I18nService = require('../app/AppI18nService.js');

const elements = {
  title: {
    id: 'edPrintTitle',
    textContent: '',
    getAttribute: () => null
  },
  play: {
    id: 'syncPlayBtn',
    textContent: '',
    getAttribute: () => null
  },
  label: {
    textContent: '',
    title: '',
    placeholder: '',
    getAttribute: name => name === 'data-i18n' ? 'play' : null
  }
};
const documentRef = {
  documentElement: { dir: '', lang: '' },
  querySelectorAll: selector => {
    if (selector === '[data-i18n]') return [elements.label];
    return [];
  },
  getElementById: id => id === 'edPrintTitle'
    ? elements.title
    : id === 'syncPlayBtn'
      ? elements.play
      : null
};
const values = new Map([['appLang', 'fa']]);
const storage = {
  getItem: key => values.get(key) || null,
  setItem: (key, value) => values.set(key, value)
};
const song = {
  getPresentationSnapshot: () => ({ title: 'ترانه آزمایشی' })
};
let playing = false;
const messages = [];
const service = I18nService.create({
  storage,
  documentRef,
  getSongState: () => song,
  getDAW: () => ({ isPlaying: playing }),
  toast: message => messages.push(message)
});

assert.equal(service.getCurrentLang(), 'fa');
assert.equal(service.t('untitled'), 'بدون نام');
service.applyI18n();
assert.equal(elements.label.textContent, 'پخش');
assert.equal(elements.title.textContent, 'ترانه آزمایشی');
assert.equal(elements.play.textContent, '▶ پخش');
assert.equal(documentRef.documentElement.dir, 'rtl');

playing = true;
service.toggleLang();
assert.equal(service.getCurrentLang(), 'en');
assert.equal(values.get('appLang'), 'en');
assert.equal(elements.label.textContent, 'Play');
assert.equal(elements.play.textContent, '⏸ توقف');
assert.equal(documentRef.documentElement.dir, 'ltr');
assert.equal(messages.at(-1), 'English');

console.log('AppI18nService tests passed');
