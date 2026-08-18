/**
 * LiveScoreQrService
 *
 * Generates one scan target per performer part.  The payload is intentionally
 * a normal URL so a phone opens the existing sync-client shell with a locked
 * part selection.
 */
(function attachLiveScoreQrService(globalScope) {
  'use strict';

  const DEFAULT_ROLES = Object.freeze([
    'bass', 'saxophone', 'drums', 'guitar', 'piano', 'violin', 'flute', 'accordion'
  ]);

  function slug(value) {
    return String(value || 'part')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'part';
  }

  function buildPartUrl(baseUrl, part, { queryKey = 'part' } = {}) {
    const base = String(baseUrl || '');
    if (!base) return '';
    try {
      const url = new URL(base, globalScope.location?.href || 'http://127.0.0.1/');
      const value = part?.role || part?.id || part?.musicXmlPartId || 'part';
      url.searchParams.set(queryKey, slug(value));
      if (part?.id) url.searchParams.set('partId', String(part.id));
      return url.toString();
    } catch (_) {
      return `${base}${base.includes('?') ? '&' : '?'}${queryKey}=${encodeURIComponent(slug(part?.role || part?.id))}`;
    }
  }

  function draw(canvas, text, { size = 240, quietModules = 4 } = {}) {
    if (!canvas || !text || typeof globalScope.qrcode !== 'function') return false;
    try {
      const qr = globalScope.qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      const count = qr.getModuleCount();
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      const tile = Math.max(1, Math.floor(size / (count + quietModules * 2)));
      const codeSize = tile * count;
      const offset = Math.floor((size - codeSize) / 2);
      context.imageSmoothingEnabled = false;
      context.fillStyle = '#fff';
      context.fillRect(0, 0, size, size);
      context.fillStyle = '#000';
      for (let row = 0; row < count; row += 1) {
        for (let column = 0; column < count; column += 1) {
          if (qr.isDark(row, column)) {
            context.fillRect(offset + column * tile, offset + row * tile, tile, tile);
          }
        }
      }
      return true;
    } catch (error) {
      globalScope.console?.warn?.('[LiveScoreQrService]', error);
      return false;
    }
  }

  function buildPayloads({ baseUrl, parts = [], mappings = [] } = {}) {
    const mappingByPart = new Map((mappings || []).map(item => [
      String(item.musicXmlPartId || item.partId || ''), item
    ]));
    const source = parts.length ? parts : DEFAULT_ROLES.map(role => ({ id: role, role, name: role }));
    return source
      .filter(part => part && part.enabled !== false && part.visible !== false)
      .map(part => {
        const mapping = mappingByPart.get(String(part.id)) || {};
        const target = { ...part, ...mapping, id: part.id || mapping.musicXmlPartId };
        return {
          partId: String(target.id || target.musicXmlPartId || target.role),
          role: slug(target.role || target.instrument || target.id),
          label: target.name || target.roleLabel || target.role || target.id,
          url: buildPartUrl(baseUrl, target),
          mapping: target
        };
      });
  }

  function renderCards(container, payloads, {
    documentRef = globalScope.document,
    onScan = () => {},
    connectionService = null
  } = {}) {
    if (!container || !documentRef) return [];
    container.replaceChildren();
    return payloads.map(payload => {
      const card = documentRef.createElement('article');
      card.className = 'live-score-qr-card';
      card.dataset.partId = payload.partId;
      const canvas = documentRef.createElement('canvas');
      canvas.className = 'live-score-qr-canvas';
      canvas.setAttribute('aria-label', `QR code for ${payload.label}`);
      draw(canvas, payload.url);
      const label = documentRef.createElement('strong');
      label.textContent = payload.label;
      const url = documentRef.createElement('code');
      url.textContent = payload.url;
      const status = documentRef.createElement('span');
      status.className = 'live-score-connection-status disconnected';
      status.textContent = 'Disconnected';
      card.append(canvas, label, url, status);
      card.addEventListener('click', () => onScan(payload));
      container.appendChild(card);
      connectionService?.bindCard?.(payload.partId, status);
      return card;
    });
  }

  const api = Object.freeze({ DEFAULT_ROLES, slug, buildPartUrl, draw, buildPayloads, renderCards });
  globalScope.LiveScoreQrService = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
