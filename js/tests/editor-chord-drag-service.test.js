const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'editor', 'EditorChordDragService.js'),
  'utf8'
);

const nodes = [{ textContent: 'ab', nodeType: 3 }];
const line = {
  textContent: 'ab',
  getBoundingClientRect: () => ({ left: 100, width: 200 }),
  _nodes: nodes
};
const documentRef = {
  createTreeWalker(target) {
    let index = 0;
    return { nextNode: () => target._nodes[index++] || null };
  },
  createRange() {
    let startOffset = 0;
    return {
      setStart(_, offset) {
        startOffset = offset;
      },
      setEnd() {},
      getBoundingClientRect() {
        return {
          left: startOffset === 0 ? 100 : 200,
          width: 100
        };
      }
    };
  }
};

const context = { document: documentRef, NodeFilter: { SHOW_TEXT: 4 } };
vm.runInNewContext(source, context);
const service = context.EditorChordDragService.create();

assert.equal(service.findNearestChar(line, 102), 0);
assert.equal(service.findNearestChar(line, 245), 1);
assert.equal(service.findNearestChar(line, 260), 1);
assert.equal(service.findNearestChar({ textContent: '' }, 100), 0);

assert.equal(service.anchorTypeForCharIndex(0, 2), 'LineStart');
assert.equal(service.anchorTypeForCharIndex(1, 2), 'OnCharacter');
assert.equal(service.anchorTypeForCharIndex(2, 2), 'LineEnd');

const movedToEnd = service.moveChord({ charIndex: 1 }, 3, 2);
assert.equal(movedToEnd.charIndex, 2);
assert.equal(movedToEnd.anchorType, 'LineEnd');
const movedToStart = service.moveChord({ charIndex: 0 }, -4, 2);
assert.equal(movedToStart.charIndex, 0);
assert.equal(movedToStart.anchorType, 'LineStart');

const chords = [
  { lineIndex: 0, charIndex: 0 },
  { lineIndex: 0, charIndex: 1 }
];
assert.equal(
  service.findAnchorSelectionPosition(
    [0, 1],
    chords,
    () => line,
    295
  ),
  1
);

console.log('EditorChordDragService tests passed');
