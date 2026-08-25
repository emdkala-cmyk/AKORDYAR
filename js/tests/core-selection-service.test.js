const assert = require('node:assert/strict');
const Selection = require('../app/CoreSelectionService.js');

const calls = [];
const dom = {
  clips: [{ dataset: { clipId: 'c1' }, selected: false }],
  sections: [{ dataset: { sectionId: 's1' }, selected: false }],
  querySelectorAll(selector) {
    const elements = selector === '.clip' ? this.clips : this.sections;
    return elements.map(element => ({
      dataset: element.dataset,
      classList: {
        toggle(name, value) {
          if (name === 'selected') element.selected = value;
        }
      }
    }));
  }
};
const daw = {
  selectedIds: new Set(),
  selectedSectionIds: new Set()
};

const service = Selection.create({
  documentRef: dom,
  getDAW: () => daw,
  renderClips: () => calls.push('render'),
  updateHud: () => calls.push('hud')
});

service.setSelection(['c1']);
assert.deepEqual([...daw.selectedIds], ['c1']);
assert.equal(daw.selectedSectionIds.size, 0);
assert.deepEqual(calls, ['render', 'hud']);

service.toggleClipSelection('c2', { render: false });
assert.deepEqual([...daw.selectedIds], ['c1', 'c2']);
assert.equal(dom.clips[0].selected, true);

service.setSectionSelection(['s1']);
assert.equal(daw.selectedSectionIds.has('s1'), true);
assert.equal(dom.sections[0].selected, true);

service.clearSectionSelection({ render: false });
assert.equal(daw.selectedSectionIds.size, 0);
assert.equal(dom.sections[0].selected, false);

service.clearSelection();
assert.equal(daw.selectedIds.size, 0);
assert.equal(daw.selectedSectionIds.size, 0);
assert.deepEqual(calls, ['render', 'hud', 'render', 'hud']);

console.log('CoreSelectionService tests passed');
