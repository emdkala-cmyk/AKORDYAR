const express = require('express');
const { JSDOM } = require('jsdom');
const path = require('path');
const fs = require('fs');

// ---------- Text normalization (preserve internal whitespace) ----------
function normalizeServerText(text) {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');
}
const crypto = require('crypto');

function inspectRuntimeAppJs() {
  const appJsPath = path.join(__dirname, 'js', 'app.js');

  try {
    const buffer = fs.readFileSync(appJsPath);

    const hash = crypto
      .createHash('sha256')
      .update(buffer)
      .digest('hex');

    const text = buffer.toString('utf8');

    console.log('[APP.JS RUNTIME DIAGNOSTIC]', {
      path: appJsPath,
      bytes: buffer.length,
      sha256: hash,
      startsWith: text.slice(0, 280),
      hasHealthyMusicNote: text.includes('🎵'),
      hasMojibakeMusicNote: text.includes('ðŸŽµ'),
      hasHealthyPersian: text.includes('تشخیص صحیح محیط الکترون'),
      hasMojibakePersian: /Ø.|Ù./.test(text)
    });
  } catch (error) {
    console.error('[APP.JS RUNTIME DIAGNOSTIC FAILED]', error);
  }
}

inspectRuntimeAppJs();

// ---------- Laminor helpers ----------

// خواندن «تعداد ترانه‌ها: N» از صفحهٔ هنرمند
function parseDeclaredSongCount(document) {
  const bodyText = document.body ? document.body.textContent : '';
  if (!bodyText) return null;

  const match = bodyText.match(/تعداد\s+ترانه ها:\s*([0-9۰-۹]+)/);
  if (!match) return null;

  // تبدیل اعداد فارسی به انگلیسی
  const raw = match[1].replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

// استخراج لینک‌های ترانه از تمام تب‌های صفحهٔ هنرمند
function extractLaminorSongLinks(document, artistPageUrl) {
  const origin = artistPageUrl || 'https://laminor.org';
  const unique = new Map();

  // اول از کارت‌های .smh-chord استخراج کن (دقیق‌ترین روش)
  const cards = document.querySelectorAll('.smh-chord');
  for (const card of cards) {
    const a = card.querySelector('a.smh-chord-info, a[href*="/artists/"]');
    if (!a) continue;
    const href = a.getAttribute('href');
    if (!href) continue;

    let url;
    try { url = new URL(href, origin); } catch { continue; }
    if (url.hostname !== 'laminor.org') continue;

    const decodedPath = decodeURIComponent(url.pathname);
    const parts = decodedPath.split('/').filter(Boolean);
    if (parts[0] !== 'artists' || parts.length < 3) continue;

    url.search = '';
    url.hash = '';
    const normalized = url.href.replace(/\/+$/, '');
    if (unique.has(normalized)) continue;

    // عنوان تمیز از .smh-chord-name
    const titleEl = card.querySelector('.smh-chord-name');
    let title = titleEl ? titleEl.textContent.trim() : '';
    // حذف آیکون verify
    title = title.replace(/\s+/g, ' ').trim();

    unique.set(normalized, { title, url: normalized });
  }

  // اگه کارت پیدا نشد، fallback به جستجوی کلی
  if (unique.size === 0) {
    const container = document.querySelector('main') || document;
    const anchors = Array.from(container.querySelectorAll('a[href]'));

    for (const a of anchors) {
      const href = a.getAttribute('href');
      if (!href) continue;

      let url;
      try { url = new URL(href, origin); } catch { continue; }
      if (url.hostname !== 'laminor.org') continue;

      const decodedPath = decodeURIComponent(url.pathname);
      const parts = decodedPath.split('/').filter(Boolean);
      if (parts[0] !== 'artists' || parts.length < 3) continue;

      url.search = '';
      url.hash = '';
      const normalized = url.href.replace(/\/+$/, '');
      if (unique.has(normalized)) continue;

      // تلاش برای پیدا کردن عنوان تمیز
      let title = '';
      const parent = a.closest('.smh-chord');
      if (parent) {
        const titleEl = parent.querySelector('.smh-chord-name');
        title = titleEl ? titleEl.textContent.replace(/\s+/g, ' ').trim() : '';
      }
      if (!title) title = a.textContent.replace(/\s+/g, ' ').trim().substring(0, 60);

      unique.set(normalized, { title, url: normalized });
    }
  }

  return Array.from(unique.values());
}

const app = express();
const PORT = 3000;

// ===== Sync Hub (Master/Slave WebSocket) =====
let _syncHub = null;
function startSyncHub(server) {
  try {
    const { createSyncHub } = require('./server/syncHub.js');
    _syncHub = createSyncHub(server, { path: '/sync', port: PORT });
    console.log(`\x1b[35m[SyncHub]\x1b[0m WebSocket sync ready at ws://0.0.0.0:${PORT}/sync`);
    console.log(`\x1b[35m[SyncHub]\x1b[0m LAN address: http://${_syncHub.getLocalIp()}:${PORT}/sync-client.html`);
  } catch (e) {
    console.error('\x1b[35m[SyncHub]\x1b[0m failed to start:', e.message);
  }
}

// اطلاعات شبکه برای ساخت QR روی دسکتاپ (لپ‌تاپ = Master)
app.get('/api/sync/info', (req, res) => {
  try {
    const os = require('os');
    const ifaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
      }
    }
    // اولویت‌بندی: رنج هاتسپات/موبایل اول، بعد بقیه (رنجهای خصوصی محلی)
    const isHotspot = (ip) => /^192\.168\.(4[3-9]|5|1[0-9])/.test(ip) || /^192\.168\./.test(ip);
    const isPrivate = (ip) => /^(192\.168|10\.|172\.(1[6-9]|2[0-9]|3[0-1]))/.test(ip);
    const hotspot = ips.filter(isHotspot);
    const priv = ips.filter(isPrivate).filter(ip => !hotspot.includes(ip));
    const ordered = hotspot.concat(priv).concat(ips.filter(ip => !hotspot.includes(ip) && !priv.includes(ip)));
    const primary = ordered[0] || '127.0.0.1';
    res.json({
      lanIps: ordered,
      localIp: primary,
      port: PORT,
      clientUrl: `http://${primary}:${PORT}/sync-client.html`,
      slaves: _syncHub ? _syncHub.getSlaveCount() : 0,
      masters: _syncHub ? (_syncHub.getPeerCount() - _syncHub.getSlaveCount()) : 0,
      total: _syncHub ? _syncHub.getPeerCount() : 0
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use(express.json());
app.use(express.static(__dirname));
// ===== API برای خواندن و پخش فایل صوتی از روی هارد =====
app.get('/api/audio', (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'فایل صوتی یافت نشد' });
    }
    res.sendFile(path.resolve(filePath));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Proxy: fetch a URL from laminor.org (bypasses CORS)
app.get('/api/fetch', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Invalid URL' });
    // Safe hostname check
    let hostname;
    try { hostname = new URL(url).hostname; } catch(e) { return res.status(400).json({ error: 'Invalid URL format' }); }
    if (hostname !== 'laminor.org' && hostname !== 'www.laminor.org') {
      return res.status(400).json({ error: 'Invalid URL' });
    }
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fa,en;q=0.9'
      }
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const html = await resp.text();
    res.json({ html });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Search artist on laminor
app.get('/api/search', async (req, res) => {
  try {
    const artist = req.query.artist;
    if (!artist) return res.status(400).json({ error: 'No artist name' });

    const searchUrl = `https://laminor.org/search?keyword=${encodeURIComponent(artist)}&type=2`;
    const resp = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'fa,en;q=0.9'
      }
    });
    const html = await resp.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // Find artist links - they appear as search results
    const results = [];
    const links = doc.querySelectorAll('a[href*="/artists/"]');
    links.forEach(a => {
      const href = a.getAttribute('href');
      const name = a.textContent.trim();
      if (href && name && href.includes('/artists/') && !results.find(r => r.name === name)) {
        const fullHref = href.startsWith('http') ? href : 'https://laminor.org' + href;
        results.push({ name, href: fullHref });
      }
    });

    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get songs list from an artist page
app.get('/api/songs', async (req, res) => {
  try {
    const artistUrl = req.query.url;
    const sessionCookie = req.query.cookie || '';
    if (!artistUrl) return res.status(400).json({ error: 'No URL' });

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html',
      'Accept-Language': 'fa,en;q=0.9'
    };
    if (sessionCookie) headers['Cookie'] = `laravel_session=${sessionCookie}`;

    const resp = await fetch(artistUrl, { headers });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);

    const html = await resp.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    const declaredSongCount = parseDeclaredSongCount(doc);
    const songs = extractLaminorSongLinks(doc, artistUrl);

    res.json({
      artistUrl,
      declaredSongCount,
      extractedSongCount: songs.length,
      missingComparedToDeclared: declaredSongCount != null
        ? Math.max(0, declaredSongCount - songs.length)
        : null,
      hasCountMismatch: declaredSongCount != null && declaredSongCount !== songs.length,
      songs,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Fetch and parse a single song page
app.get('/api/song', async (req, res) => {
  try {
    const songUrl = req.query.url;
    if (!songUrl) return res.status(400).json({ error: 'No URL' });

    const resp = await fetch(songUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'fa,en;q=0.9'
      }
    });
    const html = await resp.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // Extract metadata
    const titleEl = doc.querySelector('h1');
    const title = titleEl ? titleEl.textContent.replace(/آکورد\s+آهنگ\s*/, '').replace(/\s*-\s*لامینور.*$/, '').trim() : '';
    const artistEl = doc.querySelector('h6 a.color-light-blue, .smh-header-right-section a.color-light-blue');
    const artist = artistEl ? artistEl.textContent.trim() : '';
    const keyMatch = html.match(/گام اصلی:\s*([A-G][#b]?m?)/);
    const key = keyMatch ? keyMatch[1] : '';
    const rhythmEl = doc.querySelector('a[href*="rhythms/"]');
    const rhythm = rhythmEl ? rhythmEl.textContent.trim() : '';

    // Extract lyrics from <pre id="main-chord">
    const preEl = doc.querySelector('pre#main-chord, pre.chord, pre');
    const rawText = preEl ? normalizeServerText(preEl.textContent) : '';

    // Get artist page URL for navigation
    const artistLink = doc.querySelector('h6 a[href*="/artists/"]');
    const artistPageUrl = artistLink ? 'https://laminor.org' + artistLink.getAttribute('href') : '';

    res.json({ title, artist, key, rhythm, rawText, artistPageUrl, url: songUrl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Auto-import: search, find artist, get N songs, return parsed data
// Auto-import: search, find artist, get N songs, return parsed data
app.post('/api/auto-import', async (req, res) => {
  try {
    const { artistName, count, savePath, sessionCookie } = req.body;
    if (!artistName) return res.status(400).json({ error: 'No artist name' });

    // Build cookie header for VIP access
    const cookieHeader = sessionCookie ? `laravel_session=${sessionCookie}` : '';

    // Step 1: Search for artist
    const searchUrl = `https://laminor.org/search?keyword=${encodeURIComponent(artistName)}&type=2`;
    const searchResp = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'fa,en;q=0.9'
      }
    });
    if (!searchResp.ok) throw new Error('HTTP ' + searchResp.status);

    const searchHtml = await searchResp.text();
    const searchDom = new JSDOM(searchHtml);
    const searchDoc = searchDom.window.document;

    // Find artist link - exact match preferred
    let artistUrl = null;
    const links = searchDoc.querySelectorAll('a[href*="/artists/"]');
    const candidates = [];
    links.forEach(a => {
      const href = a.getAttribute('href');
      const name = a.textContent.trim();
      if (href && name && href.split('/').length >= 3) {
        const fullHref = href.startsWith('http') ? href : 'https://laminor.org' + href;
        candidates.push({ name, href: fullHref });
      }
    });

    const exact = candidates.find(c => c.name === artistName);
    const partial = candidates.find(c => c.name.includes(artistName) || artistName.includes(c.name));
    artistUrl = exact ? exact.href : (partial ? partial.href : (candidates[0] ? candidates[0].href : null));

    if (!artistUrl) {
      return res.status(404).json({ error: 'Artist not found', candidates: candidates.map(c => c.name) });
    }

    // Step 2: Get songs list from artist page
    const artistResp = await fetch(artistUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'fa,en;q=0.9',
        ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
      }
    });
    if (!artistResp.ok) throw new Error('HTTP ' + artistResp.status);

    const artistHtml = await artistResp.text();
    const artistDom = new JSDOM(artistHtml);
    const artistDoc = artistDom.window.document;

    const declaredSongCount = parseDeclaredSongCount(artistDoc);
    const songs = extractLaminorSongLinks(artistDoc, artistUrl);

    // Step 3: Fetch ALL songs in a single request (no batching needed)
    const startIndex = Math.max(0, (parseInt(req.body.start) || 1) - 1);
    const maxAvailable = Math.max(0, songs.length - startIndex);

    console.log(`[SERVER] Artist: ${artistName} | declaredSongCount: ${declaredSongCount} | extractedSongCount: ${songs.length} | startIndex: ${startIndex}`);

    // اگر count نیومده بود، همه رو بگیر
    const requestedCount = (count == null || count === '' || count === 0 ? maxAvailable : parseInt(count, 10));
    const songCount = Math.min(
      Number.isNaN(requestedCount) ? maxAvailable : requestedCount,
      maxAvailable,
      1000
    );

    console.log(`[SERVER] Fetching ${songCount} songs starting from index ${startIndex} (total on page: ${songs.length})`);

    const results = [];
    let imported = 0;
    let failed = 0;

    for (let i = 0; i < songCount; i++) {
      const song = songs[startIndex + i];
      if (!song) { console.log(`[SERVER] i=${i}: no song at index ${startIndex + i}`); continue; }

      console.log(`[SERVER] i=${i}/${songCount}: fetching "${song.title}" from ${song.url}`);

      try {
        const songResp = await fetch(song.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html',
            'Accept-Language': 'fa,en;q=0.9',
            ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
          }
        });
        if (!songResp.ok) throw new Error('HTTP ' + songResp.status);

        const songHtml = await songResp.text();
        const songDom = new JSDOM(songHtml);
        const songDoc = songDom.window.document;

        const titleEl = songDoc.querySelector('h1');
        const songTitle = titleEl
          ? titleEl.textContent
              .replace(/آکورد\s+آهنگ\s*/, '')
              .replace(/\s*-\s*لامینور.*$/, '')
              .trim()
          : song.title;

        const artistEl = songDoc.querySelector('h6 a.color-light-blue, .smh-header-right-section a.color-light-blue');
        // Prefer user-provided artist name (supports Persian) over page-extracted name
        const songArtist = artistName || (artistEl ? artistEl.textContent.trim() : '');

        const keyMatch = songHtml.match(/گام اصلی:\s*([A-G][#b]?m?)/);
        const key = keyMatch ? keyMatch[1] : '';

        const rhythmEl = songDoc.querySelector('a[href*="rhythms/"]');
        const rhythm = rhythmEl ? rhythmEl.textContent.trim() : '';

        const preEl = songDoc.querySelector('pre#main-chord, pre.chord, pre');
        const rawText = preEl ? normalizeServerText(preEl.textContent) : '';

        results.push({
          title: songTitle,
          artist: songArtist,
          key,
          rhythm,
          rawText,
          url: song.url
        });
        imported++;

        if ((i + 1) % 10 === 0 || i === songCount - 1) {
          console.log(`[SERVER] Progress: ${i + 1}/${songCount} fetched (${imported} ok, ${failed} failed)`);
        }
      } catch (e) {
        results.push({ title: song.title, error: e.message, url: song.url });
        failed++;
      }

      // Small delay between requests
      if (i < songCount - 1) await new Promise(r => setTimeout(r, 500));
    }

    console.log(`[SERVER] DONE: artist=${artistName} | imported=${imported} | failed=${failed} | results.length=${results.length}`);

    // Step 4: Save to files if savePath provided
    if (savePath && results.length > 0) {
      const dir = savePath;
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      results.forEach(song => {
        if (song.error) return;
        const filename = `${song.artist} - ${song.title}.json`.replace(/[<>:"/\\|?*]/g, '_');
        const filepath = path.join(dir, filename);
        fs.writeFileSync(filepath, JSON.stringify(song, null, 2), 'utf8');
      });
    }

    const attempted = songCount;

    res.json({
      artistUrl,
      artistName: exact ? exact.name : (partial ? partial.name : candidates[0]?.name),
      declaredSongCount,
      extractedSongCount: songs.length,
      missingComparedToDeclared: declaredSongCount != null
        ? Math.max(0, declaredSongCount - songs.length)
        : null,
      hasCountMismatch: declaredSongCount != null && declaredSongCount !== songs.length,
      startIndex,
      attempted,
      imported,
      failed,
      totalSongs: songs.length,
      results
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== AKORD.IR API =====

// Fetch a page from akord.ir (proxy)
app.get('/api/akord/fetch', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url || !url.includes('akord.ir')) return res.status(400).json({ error: 'Invalid URL' });
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fa,en;q=0.9'
      }
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const html = await resp.text();
    res.json({ html });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Search artist on akord.ir
app.get('/api/akord/search', async (req, res) => {
  try {
    const artist = req.query.artist;
    if (!artist) return res.status(400).json({ error: 'No artist name' });

    // akord.ir uses direct URL pattern: /artists/نام خواننده
    const artistUrl = `https://akord.ir/artists/${encodeURIComponent(artist)}`;
    const resp = await fetch(artistUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'fa,en;q=0.9'
      }
    });

    if (resp.status === 404) {
      return res.json({ results: [], error: 'Artist not found' });
    }

    const html = await resp.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // Extract song links from artist page
    const links = doc.querySelectorAll('a[href*="/artists/"]');
    const results = [];
    links.forEach(a => {
      const href = a.getAttribute('href');
      if (!href) return;
      const parts = href.split('/').filter(Boolean);
      // Song links have 3 segments: artists/name/song-name
      if (parts.length === 3 && parts[0] === 'artists') {
        const songName = decodeURIComponent(parts[2]).replace(/-/g, ' ');
        const fullHref = 'https://akord.ir' + href;
        if (!results.find(r => r.href === fullHref)) {
          results.push({ name: songName, href: fullHref });
        }
      }
    });

    res.json({ results, artistUrl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get songs from akord.ir artist page
app.get('/api/akord/songs', async (req, res) => {
  try {
    const artistUrl = req.query.url;
    if (!artistUrl) return res.status(400).json({ error: 'No URL' });

    const resp = await fetch(artistUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'fa,en;q=0.9'
      }
    });
    const html = await resp.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    const songs = [];
    const links = doc.querySelectorAll('a[href*="/artists/"]');
    links.forEach(a => {
      const href = a.getAttribute('href');
      if (!href) return;
      const parts = href.split('/').filter(Boolean);
      if (parts.length === 3 && parts[0] === 'artists') {
        const title = decodeURIComponent(parts[2]).replace(/-/g, ' ');
        const fullUrl = 'https://akord.ir' + href;
        if (!songs.find(s => s.url === fullUrl)) {
          songs.push({ title, url: fullUrl });
        }
      }
    });

    res.json({ songs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Fetch and parse a single song from akord.ir
app.get('/api/akord/song', async (req, res) => {
  try {
    const songUrl = req.query.url;
    if (!songUrl) return res.status(400).json({ error: 'No URL' });

    const resp = await fetch(songUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'fa,en;q=0.9'
      }
    });
    const html = await resp.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // Title: from h4 in section-title
    const titleEl = doc.querySelector('.section-title h4');
    let title = titleEl ? titleEl.textContent.replace(/^آکورد\s*/, '').trim() : '';

    // Artist: from breadcrumb
    const breadcrumbLinks = doc.querySelectorAll('.breadcrumbs a');
    let artist = '';
    breadcrumbLinks.forEach(a => {
      const href = a.getAttribute('href');
      if (href && href.startsWith('/artists/') && href.split('/').filter(Boolean).length === 1) {
        artist = a.textContent.trim();
      }
    });

    // Key, rhythm, time signature from tags
    let key = '', rhythm = '', timeSignature = '';
    const tags = doc.querySelectorAll('.tags');
    tags.forEach(t => {
      const text = t.textContent.trim();
      if (text.includes('گام:')) key = text.replace('گام:', '').trim();
      if (text.includes('ریتم:')) rhythm = text.replace('ریتم:', '').trim();
      if (text.includes('میزان:')) timeSignature = text.replace('میزان:', '').trim();
    });

    // Raw chord text from <pre id="pre">
    const preEl = doc.querySelector('pre#pre, pre');
    const rawText = preEl ? normalizeServerText(preEl.textContent) : '';

    res.json({ title, artist, key, rhythm, timeSignature, rawText, url: songUrl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Auto-import from akord.ir
app.post('/api/akord/auto-import', async (req, res) => {
  try {
    const { artistName, count } = req.body;
    if (!artistName) return res.status(400).json({ error: 'No artist name' });

    // Step 1: Get artist page
    const artistUrl = `https://akord.ir/artists/${encodeURIComponent(artistName)}`;
    const artistResp = await fetch(artistUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'fa,en;q=0.9'
      }
    });

    if (artistResp.status === 404) {
      return res.status(404).json({ error: 'Artist not found on akord.ir' });
    }

    const artistHtml = await artistResp.text();
    const artistDom = new JSDOM(artistHtml);
    const artistDoc = artistDom.window.document;

    // Extract artist name from page
    const h1 = artistDoc.querySelector('h1');
    const realArtistName = h1 ? h1.textContent.replace(/^آکوردهای\s*/, '').trim() : artistName;

    // Get song links
    const songs = [];
    const links = artistDoc.querySelectorAll('a[href*="/artists/"]');
    links.forEach(a => {
      const href = a.getAttribute('href');
      if (!href) return;
      const parts = href.split('/').filter(Boolean);
      if (parts.length === 3 && parts[0] === 'artists') {
        const title = decodeURIComponent(parts[2]).replace(/-/g, ' ');
        const fullUrl = 'https://akord.ir' + href;
        if (!songs.find(s => s.url === fullUrl)) {
          songs.push({ title, url: fullUrl });
        }
      }
    });

    // Step 2: Fetch songs with start offset and higher limit
    const startIndex = Math.max(0, (parseInt(req.body.start) || 1) - 1);
    const songCount = Math.min(count || 5, songs.length - startIndex, 500);
    const results = [];

    for (let i = 0; i < songCount; i++) {
      const song = songs[startIndex + i];
      try {
        const songResp = await fetch(song.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html',
            'Accept-Language': 'fa,en;q=0.9'
          }
        });
        const songHtml = await songResp.text();
        const songDom = new JSDOM(songHtml);
        const songDoc = songDom.window.document;

        const titleEl = songDoc.querySelector('.section-title h4');
        const songTitle = titleEl ? titleEl.textContent.replace(/^آکورد\s*/, '').trim() : song.title;

        let key = '', rhythm = '', timeSignature = '';
        const tags = songDoc.querySelectorAll('.tags');
        tags.forEach(t => {
          const text = t.textContent.trim();
          if (text.includes('گام:')) key = text.replace('گام:', '').trim();
          if (text.includes('ریتم:')) rhythm = text.replace('ریتم:', '').trim();
          if (text.includes('میزان:')) timeSignature = text.replace('میزان:', '').trim();
        });

        const preEl = songDoc.querySelector('pre#pre, pre');
        const rawText = preEl ? normalizeServerText(preEl.textContent) : '';

        results.push({
          title: songTitle,
          artist: realArtistName,
          key, rhythm, timeSignature, rawText,
          url: song.url
        });
      } catch (e) {
        results.push({ title: song.title, error: e.message, url: song.url });
      }

      if (i < songCount - 1) await new Promise(r => setTimeout(r, 500));
    }

    res.json({
      artistUrl,
      artistName: realArtistName,
      totalSongs: songs.length,
      imported: results.length,
      results
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Save songs to a local folder (with per-artist subdirectories)
app.post('/api/save-to-folder', async (req, res) => {
  try {
    const { savePath, songs, groupByArtist } = req.body;
    if (!savePath || !songs || !songs.length) return res.status(400).json({ error: 'Missing path or songs' });

    const dir = savePath;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let saved = 0;
    let skipped = 0;
    let errors = 0;
    const savedPaths = [];
    const failedFiles = [];
    const perArtistMap = {}; // { artistName: { expected, saved, errors } }

    for (const song of songs) {
      const artistName = (song.artist || 'Unknown').trim();
      if (!perArtistMap[artistName]) perArtistMap[artistName] = { artist: artistName, expected: 0, saved: 0, errors: 0 };
      perArtistMap[artistName].expected++;

      if (song.error || !song.rawText) { skipped++; continue; }
      try {
        let targetDir = dir;
        if (groupByArtist) {
          const artistDirName = artistName.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim();
          targetDir = path.join(dir, artistDirName);
          if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        }
        const filename = `${song.artist || artistName} - ${song.title || 'Untitled'}.json`.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim();
        const filepath = path.join(targetDir, filename);
        fs.writeFileSync(filepath, JSON.stringify(song, null, 2), 'utf8');
        saved++;
        savedPaths.push(filepath);
        perArtistMap[artistName].saved++;
      } catch (e) {
        errors++;
        failedFiles.push({ artist: artistName, title: song.title, error: e.message });
        perArtistMap[artistName].errors++;
      }
    }

    const perArtist = Object.values(perArtistMap);
    res.json({ saved, skipped, errors, total: songs.length, path: dir, savedPaths, perArtist, failedFiles });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

if (!module.exports.__listening) {
  const server = app.listen(PORT, '0.0.0.0', () => {
    const url = `http://localhost:${PORT}/Akordyar.html`;
    console.log(`\x1b[36m[Akordyar]\x1b[0m Server running at http://localhost:${PORT}`);
    console.log(`\x1b[36m[Akordyar]\x1b[0m Open ${url} to use the app`);

    // راه‌اندازی WebSocket Sync Hub
    startSyncHub(server);

    // در حالت وب (نه Electron)، مرورگر رو خودکار باز کن
    const isElectron = !!(process.versions && process.versions.electron);
    const isDesktopLauncher = process.env.AKORDYAR_DESKTOP === '1';
    if (!isElectron && !isDesktopLauncher) {
      try {
        const { openBrowser } = require('./browser-opener.js');
        // 500ms صبر کن تا سرور مطمئن بشه آماده‌ست
        setTimeout(() => openBrowser(url), 500);
      } catch (e) {
        // اگر browser-opener.js وجود نداشت، بی‌خیال
      }
    }
  });
  module.exports.__listening = true;
  module.exports.__server = server;
}
module.exports = { app, PORT };
