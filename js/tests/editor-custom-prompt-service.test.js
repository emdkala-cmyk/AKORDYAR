const assert = require('node:assert/strict');
const EditorCustomPromptService = require(
  '../core/EditorCustomPromptService.js'
);

function createElement() {
  return {
    style: {},
    value: '',
    onclick: null,
    onkeydown: null,
    focusCalled: false,
    selectCalled: false,
    focus() {
      this.focusCalled = true;
    },
    select() {
      this.selectCalled = true;
    },
    click() {
      this.onclick?.();
    }
  };
}

const modal = createElement();
const title = createElement();
const input = createElement();
const ok = createElement();
const cancel = createElement();
const elements = new Map([
  ['customPromptModal', modal],
  ['customPromptTitle', title],
  ['customPromptInput', input],
  ['customPromptOk', ok],
  ['customPromptCancel', cancel]
]);
const documentRef = {
  getElementById: id => elements.get(id)
};
const scheduled = [];
const service = EditorCustomPromptService.create({
  documentRef,
  windowRef: { prompt: () => 'fallback' },
  schedule: callback => scheduled.push(callback)
});

(async () => {
  const answerPromise = service.prompt('نام پروژه', 'پیش‌فرض');
  assert.equal(title.textContent, 'نام پروژه');
  assert.equal(input.value, 'پیش‌فرض');
  assert.equal(modal.style.display, 'flex');
  scheduled.shift()();
  assert.equal(input.focusCalled, true);
  assert.equal(input.selectCalled, true);

  input.value = 'پروژه من';
  input.onkeydown({ key: 'Enter', preventDefault: () => {} });
  assert.equal(await answerPromise, 'پروژه من');
  assert.equal(modal.style.display, 'none');
  assert.equal(ok.onclick, null);
  assert.equal(cancel.onclick, null);
  assert.equal(input.onkeydown, null);

  const cancelledPromise = service.prompt('لغو', '');
  cancel.click();
  assert.equal(await cancelledPromise, null);
  assert.equal(modal.style.display, 'none');

  const fallbackService = EditorCustomPromptService.create({
    documentRef: {
      getElementById: () => null
    },
    windowRef: { prompt: (message, value) => `${message}:${value}` }
  });
  assert.equal(await fallbackService.prompt('سؤال', 'مقدار'), 'سؤال:مقدار');

  console.log('EditorCustomPromptService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
