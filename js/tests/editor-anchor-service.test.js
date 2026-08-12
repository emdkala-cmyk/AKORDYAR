const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'editor', 'EditorAnchorService.js'),
  'utf8'
);

const textNodes = [
  { nodeType: 3, textContent: 'ab' },
  { nodeType: 3, textContent: 'cd' }
];
const line = {
  _textNodes: textNodes,
  textContent: 'abcd',
  parentEditor: null,
  closest(selector) {
    return selector === '.eline' ? this : selector === '#editor' ? this.parentEditor : null;
  },
  getBoundingClientRect: () => ({ left: 10, right: 110, top: 20 })
};
textNodes.forEach(node => {
  node.parentElement = line;
});
const ranges = [];
const documentRef = {
  createTreeWalker(target) {
    let index = 0;
    return {
      nextNode() {
        return target._textNodes[index++] || null;
      }
    };
  },
  createRange() {
    const range = {
      start: null,
      end: null,
      setStart(node, offset) {
        this.start = { node, offset };
      },
      setEnd(node, offset) {
        this.end = { node, offset };
      },
      collapse(value) {
        if (value) this.end = this.start;
      },
      getBoundingClientRect() {
        ranges.push(this);
        return this.start?.node === textNodes[1]
          ? { left: 70, right: 80, top: 25 }
          : { left: 30, right: 40, top: 25 };
      }
    };
    return range;
  },
  caretRangeFromPoint: () => ({ kind: 'range' })
};

const context = {
  document: documentRef,
  NodeFilter: { SHOW_TEXT: 4 },
  getComputedStyle: () => ({ direction: 'ltr' })
};
vm.runInNewContext(source, context);

const editor = {
  children: [line],
  _textNodes: textNodes
};
line.parentEditor = editor;
const service = context.EditorAnchorService.create({
  getEditor: () => editor
});

const start = service.anchorRectIn(editor, {
  lineIndex: 0,
  charIndex: 0,
  anchorType: 'LineStart'
});
assert.equal(start.type, 'LineStart');
assert.deepEqual(start.rect, { left: 30, right: 40, top: 25 });
assert.equal(ranges.at(-1).start.offset, 0);
assert.equal(ranges.at(-1).end.offset, 1);

service.anchorRectIn(editor, {
  lineIndex: 0,
  charIndex: 2,
  anchorType: 'OnCharacter'
});
assert.equal(ranges.at(-1).start.node, textNodes[1]);
assert.equal(ranges.at(-1).start.offset, 0);

service.anchorRectIn(editor, {
  lineIndex: 0,
  charIndex: 3,
  anchorType: 'LineEnd'
});
assert.equal(ranges.at(-1).start.node, textNodes[1]);
assert.equal(ranges.at(-1).start.offset, 1);

assert.deepEqual(service.caretFromPoint(10, 20), { kind: 'range' });
assert.equal(service.anchorRectIn(editor, { lineIndex: 5 }), null);

documentRef.caretRangeFromPoint = () => ({
  startContainer: textNodes[1],
  startOffset: 1
});
const anchor = service.anchorFromPoint(35, 25);
assert.equal(anchor.lineIndex, 0);
assert.equal(anchor.charIndex, 3);
assert.equal(anchor.anchorType, 'OnCharacter');

console.log('EditorAnchorService tests passed');
