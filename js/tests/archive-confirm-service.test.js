const assert = require('node:assert/strict');
const ArchiveConfirmService = require('../archive/ArchiveConfirmService.js');

(async () => {
  function createElement() {
    return {
      textContent: '',
      innerHTML: '',
      className: '',
      classList: {
        values: new Set(),
        add(value) {
          this.values.add(value);
        },
        remove(value) {
          this.values.delete(value);
        }
      }
    };
  }

  const elements = new Map([
    ['archConfirmTitle', createElement()],
    ['archConfirmMsg', createElement()],
    ['archConfirmOk', createElement()],
    ['archiveConfirmOverlay', createElement()]
  ]);
  const service = ArchiveConfirmService.create({
    getElement: id => elements.get(id)
  });

  const firstConfirmation = service.open(
    'عنوان',
    '<strong>پیام</strong>',
    'ادامه',
    true
  );
  assert.equal(elements.get('archConfirmTitle').textContent, 'عنوان');
  assert.equal(elements.get('archConfirmMsg').innerHTML, '<strong>پیام</strong>');
  assert.equal(elements.get('archConfirmOk').textContent, 'ادامه');
  assert.equal(elements.get('archConfirmOk').className, 'confirm-danger');
  assert.equal(
    elements.get('archiveConfirmOverlay').classList.values.has('show'),
    true
  );
  service.close(true);
  assert.equal(await firstConfirmation, true);
  assert.equal(
    elements.get('archiveConfirmOverlay').classList.values.has('show'),
    false
  );

  const secondConfirmation = service.open('دوم', 'پیام دوم');
  assert.equal(elements.get('archConfirmOk').textContent, 'تأیید');
  assert.equal(elements.get('archConfirmOk').className, 'confirm-ok');
  service.close(false);
  assert.equal(await secondConfirmation, false);

  service.close('بدون پنجره');
  console.log('ArchiveConfirmService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
