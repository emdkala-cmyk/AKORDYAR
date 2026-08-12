const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'editor', 'EditorSelectionService.js'),
  'utf8'
);

const elements = [0, 1, 2].map(index => ({
  dataset: { idx: String(index) },
  selected: false,
  classList: {
    toggle(name, value) {
      if (name === 'selected') this.owner.selected = value;
    },
    owner: null
  }
}));
elements.forEach(element => {
  element.classList.owner = element;
});

const context = {};
vm.runInNewContext(source, context);

let selected = [];
const service = context.EditorSelectionService.create({
  getSelected: () => selected,
  setSelected: next => {
    selected = next;
  },
  queryChordElements: () => elements
});

assert.deepEqual(Array.from(service.select(1)), [1]);
assert.deepEqual(Array.from(selected), [1]);
assert.equal(elements[1].selected, true);
assert.equal(elements[0].selected, false);

assert.deepEqual(Array.from(service.select(2, true)), [1, 2]);
assert.equal(elements[2].selected, true);

assert.deepEqual(Array.from(service.select(1, true)), [2]);
assert.equal(elements[1].selected, false);

assert.deepEqual(Array.from(service.set([0, 2])), [0, 2]);
assert.equal(elements[0].selected, true);
assert.equal(elements[2].selected, true);

assert.deepEqual(Array.from(service.clear()), []);
assert.equal(elements[0].selected, false);
assert.equal(elements[2].selected, false);

console.log('EditorSelectionService tests passed');
