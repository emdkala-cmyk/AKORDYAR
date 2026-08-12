const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'editor', 'EditorLyricsRenderer.js'),
  'utf8'
);

function element() {
  return {
    style: {},
    dataset: {},
    className: '',
    children: [],
    appendChild(child) {
      if (child?.isFragment) this.children.push(...child.children);
      else this.children.push(child);
    },
    querySelectorAll(selector) {
      return selector === '.eline' ? this.children : [];
    }
  };
}

const documentRef = {
  createDocumentFragment: () => ({ ...element(), isFragment: true }),
  createElement: () => element()
};
const context = { document: documentRef };
vm.runInNewContext(source, context);

const editor = element();
const printTitle = element();
const printSub = element();
const statChordCount = element();
const statLineCount = element();
const song = {
  title: 'Test',
  artist: 'Artist',
  lyrics: 'خط اول\nخط دوم',
  chords: [{ name: 'C' }, { name: '' }],
  lineColors: ['red'],
  styles: {
    tSize: 30,
    tColor: 'green',
    tFont: 'Vazirmatn',
    tBold: true,
    align: 'center'
  }
};
const renderer = context.EditorLyricsRenderer.create({
  documentRef,
  getState: () => ({
    song,
    editor,
    printTitle,
    printSub,
    statChordCount,
    statLineCount,
    titleFallback: 'Untitled',
    buildSubtext: current => current.artist
  })
});

assert.equal(renderer.render(true), true);
assert.equal(editor.children.length, 2);
assert.equal(editor.children[0].textContent, 'خط اول');
assert.equal(editor.children[0].style.color, 'red');
assert.equal(editor.children[1].style.color, 'green');
assert.equal(printTitle.textContent, 'Test');
assert.equal(printSub.textContent, 'Artist');
assert.equal(statChordCount.textContent, 1);
assert.equal(statLineCount.textContent, 2);

song.lineColors = ['blue', 'yellow'];
renderer.render(false);
assert.equal(editor.children[1].style.color, 'yellow');

console.log('EditorLyricsRenderer tests passed');
