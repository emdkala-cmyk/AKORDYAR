const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'editor', 'EditorTextSelectionService.js'),
  'utf8'
);

const textNodes = [
  { nodeType: 3, textContent: 'ab' },
  { nodeType: 3, textContent: 'cd' }
];
const line = { _nodes: textNodes };
const editor = { children: [line], _nodes: textNodes };
const ranges = [];
const documentRef = {
  createTreeWalker(target) {
    let index = 0;
    return {
      nextNode() {
        return target._nodes[index++] || null;
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
      }
    };
    ranges.push(range);
    return range;
  }
};

const context = { document: documentRef, NodeFilter: { SHOW_TEXT: 4 } };
vm.runInNewContext(source, context);
const service = context.EditorTextSelectionService.create();

const numericRange = service.createRangeFromEditorOffsets(editor, 3, 4);
assert.equal(numericRange.start.node, textNodes[1]);
assert.equal(numericRange.start.offset, 1);
assert.equal(numericRange.end.node, textNodes[1]);
assert.equal(numericRange.end.offset, 2);

const lineRange = service.createRangeFromEditorOffsets(
  editor,
  { lineIndex: 0, charIndex: 1 },
  { lineIndex: 0, charIndex: 2 }
);
assert.equal(lineRange.start.node, textNodes[0]);
assert.equal(lineRange.start.offset, 1);
assert.equal(lineRange.end.node, textNodes[0]);
assert.equal(lineRange.end.offset, 2);

const selection = {
  removed: false,
  added: null,
  removeAllRanges() {
    this.removed = true;
  },
  addRange(range) {
    this.added = range;
  }
};
let focused = false;
editor.focus = () => {
  focused = true;
};
assert.equal(
  service.restore(
    editor,
    { start: { lineIndex: 0, charIndex: 0 }, end: { lineIndex: 0, charIndex: 1 } },
    selection
  ),
  true
);
assert.equal(selection.removed, true);
assert.equal(selection.added, ranges.at(-1));
assert.equal(focused, true);
assert.equal(service.restore(editor, null, selection), false);

console.log('EditorTextSelectionService tests passed');
