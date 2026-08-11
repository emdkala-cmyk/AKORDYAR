/**
 * Akordyar application bootstrap.
 *
 * The application is split into ordered, browser-compatible scripts so the
 * legacy global API and execution order remain unchanged:
 *
 *   core -> editor -> print -> search
 *
 * Keep this file as the compatibility entry point for pages that still load
 * `js/app.js` directly. The main HTML entry point loads the chunks explicitly
 * to keep dependency order visible.
 */
(function loadApplicationChunks() {
  if (typeof document === 'undefined') return;

  const currentScript = document.currentScript;
  const baseUrl = currentScript
    ? currentScript.src.slice(0, currentScript.src.lastIndexOf('/') + 1)
    : 'js/';

  const chunks = ['app/core.js', 'app/editor.js', 'app/print.js', 'app/search.js'];

  // When loaded by a parser-inserted <script>, document.write keeps the
  // historical synchronous order for any legacy page still using app.js.
  if (document.readyState === 'loading') {
    document.write(chunks
      .map((chunk) => `<script src="${new URL(chunk, baseUrl).href}"><\/script>`)
      .join(''));
    return;
  }

  const scripts = chunks.map((chunk) => {
    const script = document.createElement('script');
    script.src = new URL(chunk, baseUrl).href;
    script.async = false;
    return script;
  });

  let index = 0;
  const loadNext = () => {
    const script = scripts[index++];
    if (!script) return;
    script.onload = loadNext;
    script.onerror = () => {
      console.error(`[App] Failed to load application chunk: ${script.src}`);
    };
    document.head.appendChild(script);
  };

  loadNext();
})();
