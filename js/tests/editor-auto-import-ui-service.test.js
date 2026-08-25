const assert = require('node:assert/strict');
const UiService = require('../editor/EditorAutoImportUiService.js');

function node() {
  return {
    style: {},
    classList: {
      values: new Set(),
      add(value) { this.values.add(value); },
      remove(value) { this.values.delete(value); },
      contains(value) { return this.values.has(value); }
    },
    innerHTML: '',
    textContent: '',
    disabled: false
  };
}

const ids = [
  'autoProgressFill', 'autoProgressLabel', 'autoProgressPct',
  'autoProgressDetail', 'autoProgressBar', 'autoImportModal',
  'autoImportStatus', 'autoImportResults', 'autoImportDone',
  'autoImportForm', 'autoImportFooter', 'autoImportBtn',
  'autoArtistTags', 'autoImportSummary', 'autoImportFolderInput'
];
const elements = new Map(ids.map(id => [id, node()]));
const service = UiService.create({
  getElement: id => elements.get(id)
});

service.updateProgress(2, 5, '<span>در حال دریافت</span>');
assert.equal(elements.get('autoProgressFill').style.width, '40%');
assert.equal(elements.get('autoProgressLabel').textContent, '2 / 5');
assert.equal(elements.get('autoProgressPct').textContent, '40%');
assert.match(elements.get('autoProgressDetail').innerHTML, /در حال دریافت/);

service.showProgress();
assert.equal(elements.get('autoProgressBar').classList.contains('show'), true);
service.hideProgress();
assert.equal(elements.get('autoProgressBar').classList.contains('show'), false);

service.open();
assert.equal(elements.get('autoImportModal').classList.contains('show'), true);
assert.equal(elements.get('autoImportForm').style.display, 'block');
assert.equal(elements.get('autoImportResults').innerHTML, '');

service.resetRequest();
assert.equal(elements.get('autoImportSummary').textContent, '');
assert.equal(elements.get('autoImportFolderInput').style.display, 'none');
assert.equal(elements.get('autoImportBtn').textContent, '🚀 شروع ورودی اتومات');

service.close();
assert.equal(elements.get('autoImportModal').classList.contains('show'), false);

console.log('EditorAutoImportUiService tests passed');
