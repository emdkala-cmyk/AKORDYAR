const assert = require('node:assert/strict');
const CoreArrangerManagerRendererService = require(
  '../app/CoreArrangerManagerRendererService.js'
);

function createElement() {
  return {
    style: {},
    children: [],
    className: '',
    innerHTML: '',
    appendChild(child) {
      this.children.push(child);
      return child;
    }
  };
}

const elements = {
  arrManager: createElement(),
  arrEditor: createElement()
};

const documentRef = {
  createElement: () => createElement()
};

let arrangers = [
  {
    id: 'arr-1',
    name: 'اجرای شب',
    items: ['song-1', 'song-2'],
    crossfade: 2,
    pauseBetween: true
  },
  {
    id: 'arr-2',
    name: 'تمرین',
    items: [],
    crossfade: 0,
    pauseBetween: false
  }
];
let editingArr = arrangers[0];
const calls = [];

const runtime = CoreArrangerManagerRendererService.create({
  documentRef,
  getElement: id => elements[id],
  getArrangers: () => arrangers,
  getEditingArr: () => editingArr,
  setArrangers: value => {
    arrangers = value;
  },
  setEditingArr: value => {
    editingArr = value;
  },
  openArrEditor: () => calls.push('open-editor'),
  saveArrangers: () => calls.push('save'),
  exportArranger: arr => calls.push(['export', arr.id]),
  confirmRef: () => true,
  translate: key => ({ untitled: 'بدون نام', songN: 'آهنگ' }[key] || key),
  toast: message => calls.push(['toast', message])
});

runtime.render();

assert.equal(elements.arrManager.children.length, 4);
assert.match(elements.arrManager.children[2].innerHTML, /اجرای شب/);
assert.match(elements.arrManager.children[2].innerHTML, /کراس‌فید: 2s/);
assert.match(elements.arrManager.children[2].innerHTML, /توقف بین آهنگ‌ها/);
assert.equal(elements.arrManager.children[2].className, 'arr-card arr-card-active');

elements.arrManager.children[2].onclick({ target: { dataset: { a: 'export' } } });
assert.deepEqual(calls.shift(), ['export', 'arr-1']);

elements.arrManager.children[3].onclick({ target: { dataset: {} } });
assert.equal(editingArr.id, 'arr-2');
assert.ok(calls.includes('open-editor'));

editingArr = arrangers[0];
elements.arrManager.children[2].onclick({ target: { dataset: { a: 'del' } } });
assert.deepEqual(arrangers.map(arr => arr.id), ['arr-2']);
assert.equal(editingArr, null);
assert.equal(elements.arrEditor.style.display, 'none');
assert.ok(calls.includes('save'));
assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'toast'));

console.log('CoreArrangerManagerRendererService tests passed');
