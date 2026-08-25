const assert = require('node:assert/strict');
const CorePlayerViewChordRendererService = require(
  '../app/CorePlayerViewChordRendererService.js'
);

const script = CorePlayerViewChordRendererService.createScript(
  {
    createElement: tag => ({
      tagName: tag,
      setAttribute(name, value) {
        this[name] = value;
      },
      textContent: ''
    })
  },
  [{ lineIndex: 0, charIndex: 2, anchorType: 'OnCharacter', _name: 'Am' }],
  { cSize: 20, cColor: '#e6aa28', cFont: 'JetBrains Mono' }
);

assert.equal(script.tagName, 'script');
assert.equal(script['data-pv'], 'chord');
assert.match(script.textContent, /_pRenderChords/);
assert.match(script.textContent, /_pScheduleChordRender/);
assert.match(script.textContent, /"Am"/);
assert.match(script.textContent, /"cSize":20/);

console.log('CorePlayerViewChordRendererService tests passed');
