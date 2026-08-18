/**
 * sync/mobileClient.js — کلاینت گوشی (Slave) که روی مرورگر موبایل اجرا می‌شود
 *
 * این فایل روی صفحه sync-client.html لود می‌شود. کارها:
 *  1. به SyncHub وصل می‌شود و نقش Slave را اعلام می‌کند.
 *  2. پیام‌های DOC / VIEW / SNAPSHOT / PLAYHEAD / HIGHLIGHT را دریافت میکند.
 *  3. با همان PlayerViewRenderer برنامه (پنل F9 دسکتاپ) رندر میکند —
 *     یعنی دقیقاً همان نمای نوازنده روی گوشی تکرار می‌شود.
 *  4. اسلیو فقط تنظیمات محلی دارد: فونت، رنگ، زوم — که روی دستگاه خودش اعمال
 *     می‌شود و به مستر یا بقیه ارسال نمیشود (طبق درخواست: کنترل فقط از لپ‌تاپ).
 *
 * طراحی آینده‌نگر: این همان قراردادی است که اپلیکیشن نیتیو موبایل آینده پیاده
 * می‌کند؛ فقط لایه رندر (RendererBase / PlayerViewRenderer) با نسخه نیتیو جایگزین
 * می‌شود.
 */

(function attachMobileClient(globalScope) {
  'use strict';

  const Protocol = globalScope.AkordSyncProtocol;

  const MobileClient = (() => {
    const MOBILE_VIEW_STORAGE_KEY = 'akord_mobile_view_v3';
    const MOBILE_PART_STORAGE_KEY = 'akord_mobile_midi_part_v1';
    const MOBILE_MUSICXML_PART_STORAGE_KEY = 'akord_mobile_musicxml_part_v1';
    const DEFAULT_MOBILE_VIEW = {
      fontSize: 20,
      showQuantizeGrid: false,
      mobileLayout: true,
      textColor: '#0fa966',
      chordColor: '#e6aa28'
    };
    let ws = null;
    let connected = false;
    let container = null;
    let currentDoc = null;
    let currentKey = null;
    let timeline = null;
    let playback = { time: 0, isPlaying: false, duration: 0 };
    let playbackAnchor = {
      time: 0,
      receivedAt: performance.now(),
      isPlaying: false,
      duration: 0
    };
    let playbackRafId = null;
    let remoteView = null;          // viewState که از مستر آمده (پیش‌فرض)
    let highlight = {
      activeLineId: null, activeTokenId: null, activeChordId: null, doneLines: new Set()
    };
    let midiScoreState = {
      score: null,
      activePartId: null,
      scoreVersion: 0,
      scoreIdentity: ''
    };
    let normalizedScoreCache = { raw: null, version: 0, score: null };
    let musicXmlScoreState = {
      score: null,
      activePartId: null,
      mappings: [],
      scoreVersion: 0,
      scoreIdentity: ''
    };
    let normalizedMusicXmlCache = { raw: null, version: 0, score: null };
    let pendingPartRequest = null;
    let pendingMusicXmlPartRequest = null;
    let lastScorePositionKey = '';
    let lastScoreAutoScrollAt = 0;
    let scoreMode = false;
    let lastRenderedHighlightKey = '';
    let localOverride = Object.assign({}, DEFAULT_MOBILE_VIEW); // تنظیمات محلی گوشی
    let scorePlayheadService = null;

    function url() {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      return `${proto}://${location.host}/sync`;
    }

    function requestedPart() {
      try {
        const params = new URLSearchParams(globalScope.location?.search || '');
        return params.get('partId') || params.get('part') || null;
      } catch (_) {
        return null;
      }
    }

    const lockedPartId = requestedPart();

    function mergedView() {
      // ترکیب view مستر + تنظیمات محلی گوشی (محلی اولویت دارد)
      return Object.assign(
        {},
        remoteView || {},
        localOverride || {},
        // Match the default desktop Player View palette on the phone.
        {
          backgroundColor: '#0F131E',
          textColor: '#0fa966',
          chordColor: '#e6aa28',
          highlightColor: '#FF2E93',
          showQuantizeGrid: false,
          mobileLayout: true
        }
      );
    }

    function getRenderedPlayback(now = performance.now()) {
      const base = Object.assign({}, playback);
      if (!base.isPlaying) return base;

      const elapsed = Math.max(0, now - playbackAnchor.receivedAt) / 1000;
      const duration = Number(base.duration) || 0;
      const time = Math.max(0, playbackAnchor.time + elapsed);
      return Object.assign(base, {
        time: duration > 0 ? Math.min(duration, time) : time
      });
    }

    function normalizedMidiScore() {
      if (!midiScoreState?.score) return null;
      if (
        normalizedScoreCache.raw === midiScoreState.score &&
        normalizedScoreCache.version === midiScoreState.scoreVersion &&
        normalizedScoreCache.score
      ) {
        return normalizedScoreCache.score;
      }
      const score = globalScope.MidiScoreModel?.normalize?.(midiScoreState.score) ||
        midiScoreState.score;
      normalizedScoreCache = {
        raw: midiScoreState.score,
        version: midiScoreState.scoreVersion,
        score
      };
      return score;
    }

    function normalizedMusicXmlScore() {
      if (!musicXmlScoreState?.score) return null;
      if (
        normalizedMusicXmlCache.raw === musicXmlScoreState.score &&
        normalizedMusicXmlCache.version === musicXmlScoreState.scoreVersion &&
        normalizedMusicXmlCache.score
      ) {
        return normalizedMusicXmlCache.score;
      }
      const score = globalScope.MusicXmlScoreModel?.normalize?.(musicXmlScoreState.score) ||
        musicXmlScoreState.score;
      normalizedMusicXmlCache = {
        raw: musicXmlScoreState.score,
        version: musicXmlScoreState.scoreVersion,
        score
      };
      return score;
    }

    function scoreIdentity(score) {
      if (!score) return '';
      const source = score.source || {};
      const parts = (score.parts || [])
        .map(part => `${part.id}:${part.trackId}`)
        .join(',');
      return [
        source.fileName || '',
        source.lastModified || '',
        score.endTick || 0,
        parts
      ].join('|');
    }

    function musicXmlScoreIdentity(score) {
      if (!score) return '';
      const source = score.source || {};
      const parts = (score.parts || []).map(part => `${part.id}:${part.name || ''}`).join(',');
      return [source.fileName || '', source.size || '', score.endTick || 0, parts].join('|');
    }

    function readStoredPart(identity) {
      if (!identity) return null;
      try {
        const stored = JSON.parse(
          globalScope.localStorage?.getItem(MOBILE_PART_STORAGE_KEY) || '{}'
        );
        return stored && typeof stored === 'object'
          ? stored[identity] || null
          : null;
      } catch (_) {
        return null;
      }
    }

    function storePart(identity, partId) {
      if (!identity || !partId) return;
      try {
        const stored = JSON.parse(
          globalScope.localStorage?.getItem(MOBILE_PART_STORAGE_KEY) || '{}'
        );
        stored[identity] = partId;
        globalScope.localStorage?.setItem(
          MOBILE_PART_STORAGE_KEY,
          JSON.stringify(stored)
        );
      } catch (_) {}
    }

    function readStoredMusicXmlPart(identity) {
      if (!identity) return null;
      try {
        const stored = JSON.parse(
          globalScope.localStorage?.getItem(MOBILE_MUSICXML_PART_STORAGE_KEY) || '{}'
        );
        return stored && typeof stored === 'object' ? stored[identity] || null : null;
      } catch (_) {
        return null;
      }
    }

    function storeMusicXmlPart(identity, partId) {
      if (!identity || !partId) return;
      try {
        const stored = JSON.parse(
          globalScope.localStorage?.getItem(MOBILE_MUSICXML_PART_STORAGE_KEY) || '{}'
        );
        stored[identity] = partId;
        globalScope.localStorage?.setItem(
          MOBILE_MUSICXML_PART_STORAGE_KEY,
          JSON.stringify(stored)
        );
      } catch (_) {}
    }

    function hasPart(score, partId) {
      return Boolean(partId && score?.parts?.some(part => part.id === partId));
    }

    function hasPartTrack(score, partId) {
      const part = score?.parts?.find(candidate => candidate.id === partId);
      return Boolean(part && score?.tracks?.some(track => track.id === part.trackId));
    }

    function hasMusicXmlPart(score, partId) {
      return Boolean(partId && score?.parts?.some(part => String(part.id) === String(partId)));
    }

    function hasMusicXmlPartData(score, partId) {
      const part = score?.parts?.find(candidate => String(candidate.id) === String(partId));
      return Boolean(part?.measures?.some(measure => Array.isArray(measure.notes)));
    }

    function requestScorePart(partId) {
      const score = normalizedMidiScore();
      if (!score || !hasPart(score, partId)) return false;
      pendingPartRequest = partId;
      send(Protocol.MSG.MIDI_SCORE_REQUEST, {
        partId,
        scoreVersion: midiScoreState.scoreVersion,
        scoreIdentity: midiScoreState.scoreIdentity || scoreIdentity(score)
      });
      return true;
    }

    function requestMusicXmlPart(partId) {
      const score = normalizedMusicXmlScore();
      if (!score || !hasMusicXmlPart(score, partId)) return false;
      pendingMusicXmlPartRequest = partId;
      send(Protocol.MSG.MUSICXML_SCORE_REQUEST, {
        partId,
        scoreVersion: musicXmlScoreState.scoreVersion,
        scoreIdentity: musicXmlScoreState.scoreIdentity || musicXmlScoreIdentity(score)
      });
      return true;
    }

    function applyMidiScore(payload) {
      if (!payload) return;
      const rawScore = payload.score || null;
      const incomingVersion = Number(
        payload.scoreVersion || rawScore?.schemaVersion || 0
      );
      if (!rawScore) {
        midiScoreState = {
          score: null,
          activePartId: null,
          scoreVersion: incomingVersion,
          scoreIdentity: ''
        };
        normalizedScoreCache = { raw: null, version: 0, score: null };
        pendingPartRequest = null;
        if (scoreMode) renderFull();
        return;
      }
      normalizedScoreCache = { raw: null, version: 0, score: null };
      const normalized = globalScope.MidiScoreModel?.normalize?.(rawScore) || rawScore;
      const identity = scoreIdentity(normalized);
      const preservePrevious =
        midiScoreState.scoreIdentity === identity &&
        hasPart(normalized, midiScoreState.activePartId);
      const storedPartId = readStoredPart(identity);
      const activePartId = preservePrevious
        ? midiScoreState.activePartId
        : hasPart(normalized, storedPartId)
          ? storedPartId
          : [
              payload.activePartId,
              normalized.activePartId,
              normalized.parts?.[0]?.id
            ].find(partId => hasPart(normalized, partId)) || null;
      midiScoreState = {
        score: rawScore,
        activePartId,
        scoreVersion: incomingVersion,
        scoreIdentity: identity
      };
      normalizedScoreCache = {
        raw: rawScore,
        version: incomingVersion,
        score: normalized
      };
      storePart(identity, activePartId);
      if (activePartId && !hasPartTrack(normalized, activePartId)) {
        requestScorePart(activePartId);
      } else if (pendingPartRequest === activePartId) {
        pendingPartRequest = null;
      }
      if (scoreMode) renderFull();
    }

    function applyMusicXmlScore(payload) {
      if (!payload) return;
      const rawScore = payload.score || null;
      const incomingVersion = Number(
        payload.scoreVersion || rawScore?.schemaVersion || 0
      );
      if (!rawScore) {
        musicXmlScoreState = {
          score: null,
          activePartId: null,
          mappings: [],
          scoreVersion: incomingVersion,
          scoreIdentity: ''
        };
        normalizedMusicXmlCache = { raw: null, version: 0, score: null };
        pendingMusicXmlPartRequest = null;
        if (scoreMode) renderFull();
        return;
      }
      normalizedMusicXmlCache = { raw: null, version: 0, score: null };
      const normalized = globalScope.MusicXmlScoreModel?.normalize?.(rawScore) || rawScore;
      const identity = musicXmlScoreIdentity(normalized);
      const previousPart = musicXmlScoreState.activePartId;
      const storedPartId = readStoredMusicXmlPart(identity);
      const activePartId =
        identity === musicXmlScoreState.scoreIdentity && hasMusicXmlPart(normalized, previousPart)
          ? previousPart
          : hasMusicXmlPart(normalized, storedPartId)
            ? storedPartId
            : [
                payload.activePartId,
                normalized.activePartId,
                normalized.parts?.[0]?.id
              ].find(partId => hasMusicXmlPart(normalized, partId)) || null;
      musicXmlScoreState = {
        score: rawScore,
        activePartId,
        mappings: Array.isArray(payload.mappings) ? payload.mappings : (rawScore.mappings || []),
        scoreVersion: incomingVersion,
        scoreIdentity: identity
      };
      normalizedMusicXmlCache = {
        raw: rawScore,
        version: incomingVersion,
        score: normalized
      };
      storeMusicXmlPart(identity, activePartId);
      if (activePartId && !hasMusicXmlPartData(normalized, activePartId)) {
        requestMusicXmlPart(activePartId);
      } else if (pendingMusicXmlPartRequest === activePartId) {
        pendingMusicXmlPartRequest = null;
      }
      if (scoreMode) renderFull();
    }

    function selectMidiPart(partId) {
      const score = normalizedMidiScore();
      if (!hasPart(score, partId)) return false;
      midiScoreState.activePartId = partId;
      storePart(midiScoreState.scoreIdentity || scoreIdentity(score), partId);
      if (hasPartTrack(score, partId)) {
        pendingPartRequest = null;
      } else {
        requestScorePart(partId);
      }
      if (scoreMode) renderFull();
      return true;
    }

    function selectScorePart(partId) {
      if (normalizedMusicXmlScore() && hasMusicXmlPart(normalizedMusicXmlScore(), partId)) {
        musicXmlScoreState.activePartId = partId;
        storeMusicXmlPart(musicXmlScoreState.scoreIdentity || musicXmlScoreIdentity(normalizedMusicXmlScore()), partId);
        if (hasMusicXmlPartData(normalizedMusicXmlScore(), partId)) {
          pendingMusicXmlPartRequest = null;
        } else {
          requestMusicXmlPart(partId);
        }
        if (scoreMode) renderFull();
        return true;
      }
      return selectMidiPart(partId);
    }

    function applyLockedPart() {
      if (!lockedPartId) return;
      const score = normalizedMusicXmlScore() || normalizedMidiScore();
      const candidate = score?.parts?.find(part =>
        String(part.id) === String(lockedPartId) ||
        String(part.role || '').toLowerCase() === String(lockedPartId).toLowerCase()
      );
      if (candidate) selectScorePart(candidate.id);
    }

    function ensureScorePlayheadVisible(x) {
      if (!container || !scoreMode) return;
      const now = performance.now();
      if (now - lastScoreAutoScrollAt < 300) return;
      const canvas = container.querySelector('.mobile-midi-score-canvas');
      if (!canvas) return;
      const containerRect = container.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      const targetX = canvasRect.left + x;
      const margin = Math.min(120, container.clientWidth * 0.2);
      if (
        targetX >= containerRect.left + margin &&
        targetX <= containerRect.right - margin
      ) return;
      const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
      const desired = Math.max(
        0,
        Math.min(
          maxScroll,
          container.scrollLeft + targetX -
            (containerRect.left + container.clientWidth / 2)
        )
      );
      if (Math.abs(desired - container.scrollLeft) < 8) return;
      lastScoreAutoScrollAt = now;
      try {
        container.scrollTo({ left: desired, behavior: 'smooth' });
      } catch (_) {
        container.scrollLeft = desired;
      }
    }

    function renderScorePlayhead(time = getRenderedPlayback().time) {
      if (!scoreMode || !container) return;
      const xmlScore = normalizedMusicXmlScore();
      const midiScore = normalizedMidiScore();
      const useMusicXml = Boolean(xmlScore);
      const score = useMusicXml ? xmlScore : midiScore;
      const activeRenderer = useMusicXml
        ? (globalScope.ScoreRenderer || globalScope.MusicXmlScoreRenderer)
        : globalScope.MidiScoreRenderer;
      if (!score || (useMusicXml
        ? !activeRenderer?.getPlayheadPosition
        : !activeRenderer?.getPlayheadX)) return;
      const playhead = container.querySelector('[data-mobile-score-playhead]');
      const activePartId = useMusicXml
        ? (musicXmlScoreState.activePartId || score.activePartId)
        : (midiScoreState.activePartId || score.activePartId);
      const root = useMusicXml
        ? container.querySelector('.mobile-midi-score-canvas.score-viewer-root')
        : null;
      if (useMusicXml && !root) return;
      if (!useMusicXml && !playhead) return;
      if (useMusicXml && globalScope.EditorScorePlayheadService?.create) {
        if (!scorePlayheadService) {
          scorePlayheadService = globalScope.EditorScorePlayheadService.create({
            midiScore,
            musicXmlScore: score,
            partId: activePartId,
            renderer: activeRenderer
          });
        } else {
          scorePlayheadService.setScores?.({
            midiScore,
            musicXmlScore: score,
            partId: activePartId
          });
        }
      }
      const position = useMusicXml
        ? activeRenderer.getPlayheadPosition(score, activePartId, time, {
            root,
            midiScore,
            activeTick: midiScore?.conversions?.secondsToTick?.(time)
          })
        : {
            x: activeRenderer.getPlayheadX(score, activePartId, time, { midiScore }),
            yTop: null,
            yBottom: null,
            systemIndex: 0
          };
      const x = position.x;
      if (useMusicXml) {
        activeRenderer.updatePlayhead?.(root, position);
      } else {
        playhead.setAttribute('x1', String(x));
        playhead.setAttribute('x2', String(x));
        if (Number.isFinite(position.yTop)) playhead.setAttribute('y1', String(position.yTop));
        if (Number.isFinite(position.yBottom)) playhead.setAttribute('y2', String(position.yBottom));
        playhead.dataset.system = String(position.systemIndex || 0);
      }
      ensureScorePlayheadVisible(x);
      const barBeat = useMusicXml
        ? globalScope.MusicXmlScoreModel?.tickToMeasureBeat?.(
            score,
            midiScore?.conversions?.secondsToTick
              ? midiScore.conversions.secondsToTick(time)
              : 0,
            activePartId
          )
        : score.conversions?.tickToBarBeat &&
          score.conversions?.secondsToTick
          ? score.conversions.tickToBarBeat(score.conversions.secondsToTick(time))
          : null;
      const positionKey = barBeat ? `${barBeat.bar}:${barBeat.beat}` : '';
      if (positionKey !== lastScorePositionKey) {
        lastScorePositionKey = positionKey;
        const positionEl = container.querySelector('[data-mobile-score-position]');
        if (positionEl) {
          positionEl.textContent = barBeat
            ? `میزان ${barBeat.bar || barBeat.measureNumber} · ضرب ${barBeat.beat}`
            : '';
        }
      }
    }

    function renderLegacyMidiScoreFull() {
      const score = normalizedMidiScore();
      if (!container || !score || !globalScope.MidiScoreRenderer?.renderSvg) return false;
      const partId = midiScoreState.activePartId || score.activePartId || score.parts?.[0]?.id;
      if (!partId) return false;
      const time = getRenderedPlayback().time;
      const hasTrack = hasPartTrack(score, partId);
      const svg = hasTrack
        ? globalScope.MidiScoreRenderer.renderSvg(score, partId, {
            activeTime: time,
            ariaLabel: 'MIDI performer score'
          })
        : '';
      const documentRef = container.ownerDocument || globalScope.document;
      if (!documentRef) return false;
      const part = score.parts?.find(p => p.id === partId);
      const shell = documentRef.createElement('div');
      shell.className = 'mobile-midi-score-shell';
      container.classList.add('midi-score-active');
      const toolbar = documentRef.createElement('div');
      toolbar.className = 'mobile-midi-score-toolbar';
      const title = documentRef.createElement('span');
      title.textContent = '🎼 ' + String(part?.name || 'MIDI Score');
      const position = documentRef.createElement('span');
      position.dataset.mobileScorePosition = 'true';
      position.textContent = '';
      const partSelect = documentRef.createElement('select');
      partSelect.id = 'mobile-score-part';
      partSelect.className = 'mobile-midi-score-part-select';
      (score.parts || []).forEach(candidate => {
        const option = documentRef.createElement('option');
        option.value = candidate.id;
        option.textContent = `${candidate.name} · ${candidate.roleLabel}`;
        option.selected = candidate.id === partId;
        partSelect.appendChild(option);
      });
      partSelect.addEventListener('change', () => selectMidiPart(partSelect.value));
      if (lockedPartId) partSelect.hidden = true;
      const exitButton = documentRef.createElement('button');
      exitButton.type = 'button';
      exitButton.id = 'mobile-score-exit';
      exitButton.textContent = 'بازگشت';
      const canvas = documentRef.createElement('div');
      canvas.className = 'mobile-midi-score-canvas';
      // SVG is generated by MidiScoreRenderer and contains escaped model data.
      canvas.innerHTML = svg ||
        '<div class="mobile-midi-score-loading">در حال دریافت پارت نوازنده…</div>';
      toolbar.append(title, position, partSelect, exitButton);
      shell.append(toolbar, canvas);
      if (typeof container.replaceChildren === 'function') {
        container.replaceChildren(shell);
      } else {
        container.innerHTML = '';
        container.appendChild(shell);
      }
      const renderedPlayhead = container.querySelector('[data-score-playhead]');
      if (renderedPlayhead) {
        renderedPlayhead.setAttribute('data-mobile-score-playhead', 'true');
      }
      lastScorePositionKey = '';
      renderScorePlayhead(time);
      container.querySelector('#mobile-score-exit')?.addEventListener('click', () => {
        scoreMode = false;
        renderFull();
      });
      return true;
    }

    function renderScoreFull() {
      const xmlScore = normalizedMusicXmlScore();
      const midi = normalizedMidiScore();
      const useMusicXml = Boolean(xmlScore);
      const score = useMusicXml ? xmlScore : midi;
      const activeRenderer = useMusicXml
        ? (globalScope.ScoreRenderer || globalScope.MusicXmlScoreRenderer)
        : globalScope.MidiScoreRenderer;
      if (!container || !score || (useMusicXml
        ? !activeRenderer?.renderInto
        : !activeRenderer?.renderSvg)) return false;
      const partId = useMusicXml
        ? (musicXmlScoreState.activePartId || score.activePartId || score.parts?.[0]?.id)
        : (midiScoreState.activePartId || score.activePartId || score.parts?.[0]?.id);
      if (!partId) return false;
      const time = getRenderedPlayback().time;
      const hasData = useMusicXml
        ? hasMusicXmlPartData(score, partId)
        : hasPartTrack(score, partId);
      if (!hasData) return false;
      const documentRef = container.ownerDocument || globalScope.document;
      if (!documentRef) return false;
      const part = score.parts?.find(candidate => String(candidate.id) === String(partId));
      const shell = documentRef.createElement('div');
      shell.className = 'mobile-midi-score-shell';
      container.classList.add('midi-score-active');
      const toolbar = documentRef.createElement('div');
      toolbar.className = 'mobile-midi-score-toolbar';
      const title = documentRef.createElement('span');
      title.textContent = '🎼 ' + String(part?.name || (useMusicXml ? 'MusicXML Score' : 'MIDI Score'));
      const position = documentRef.createElement('span');
      position.dataset.mobileScorePosition = 'true';
      position.textContent = '';
      const partSelect = documentRef.createElement('select');
      partSelect.id = 'mobile-score-part';
      partSelect.className = 'mobile-midi-score-part-select';
      (score.parts || []).forEach(candidate => {
        const option = documentRef.createElement('option');
        option.value = candidate.id;
        option.textContent = `${candidate.name} · ${candidate.roleLabel || ''}`;
        option.selected = String(candidate.id) === String(partId);
        partSelect.appendChild(option);
      });
      partSelect.addEventListener('change', () => selectScorePart(partSelect.value));
      if (lockedPartId) partSelect.hidden = true;
      const exitButton = documentRef.createElement('button');
      exitButton.type = 'button';
      exitButton.id = 'mobile-score-exit';
      exitButton.textContent = 'بازگشت';
      const canvas = documentRef.createElement('div');
      canvas.className = 'mobile-midi-score-canvas';
      if (!useMusicXml) {
        canvas.innerHTML = activeRenderer.renderSvg(score, partId, {
          activeTime: time,
          midiScore: midi,
          ariaLabel: 'MIDI performer score'
        });
      } else {
        canvas.classList.add('score-viewer-root');
        const loading = documentRef.createElement('div');
        loading.className = 'mobile-midi-score-loading';
        loading.textContent = 'در حال آماده‌سازی نت استاندارد…';
        canvas.appendChild(loading);
      }
      toolbar.append(title, position, partSelect, exitButton);
      shell.append(toolbar, canvas);
      if (typeof container.replaceChildren === 'function') {
        container.replaceChildren(shell);
      } else {
        container.innerHTML = '';
        container.appendChild(shell);
      }
      if (useMusicXml) {
        activeRenderer.renderInto(canvas, score, partId, { zoom: 1 })
          .then(() => {
            const renderedPlayhead = canvas.querySelector('[data-score-playhead]');
            if (renderedPlayhead) renderedPlayhead.setAttribute('data-mobile-score-playhead', 'true');
            renderScorePlayhead(time);
          })
          .catch(error => {
            canvas.replaceChildren();
            const message = documentRef.createElement('div');
            message.className = 'mobile-midi-score-loading';
            message.textContent = `خطا در نمایش MusicXML: ${error?.message || 'رندر OSMD ناموفق بود'}`;
            canvas.appendChild(message);
          });
      } else {
        const renderedPlayhead = container.querySelector('[data-score-playhead]');
        if (renderedPlayhead) renderedPlayhead.setAttribute('data-mobile-score-playhead', 'true');
      }
      lastScorePositionKey = '';
      renderScorePlayhead(time);
      container.querySelector('#mobile-score-exit')?.addEventListener('click', () => {
        scoreMode = false;
        renderFull();
      });
      return true;
    }

    function setPlaybackState(next) {
      const now = performance.now();
      const incoming = Object.assign({}, playback, next || {});
      const incomingTime = Math.max(0, Number(incoming.time) || 0);
      const previous = getRenderedPlayback(now);
      const discontinuity =
        !playback.isPlaying ||
        !incoming.isPlaying ||
        Math.abs(incomingTime - (Number(playback.time) || 0)) > 0.75;

      // WebSocket packets carry the authoritative position, but they arrive
      // after network latency.  Keep a continuous local anchor between
      // packets and never move backwards because a newer packet describes an
      // earlier instant than our already-rendered prediction.
      const anchorTime = discontinuity
        ? incomingTime
        : Math.max(incomingTime, Number(previous.time) || 0);

      playback = incoming;
      playbackAnchor = {
        time: anchorTime,
        receivedAt: now,
        isPlaying: !!incoming.isPlaying,
        duration: Number(incoming.duration) || 0
      };
    }

    function highlightKey(value) {
      return JSON.stringify([
        value?.activeLineId || null,
        value?.activeTokenId || null,
        value?.activeChordId || null,
        Array.from(value?.doneLines || [])
      ]);
    }

    function getRenderedHighlight() {
      if (
        currentDoc &&
        globalScope.SharedEngine &&
        typeof globalScope.SharedEngine.computeHighlight === 'function'
      ) {
        return globalScope.SharedEngine.computeHighlight(
          getRenderedPlayback(),
          currentDoc
        );
      }
      return highlight;
    }

    function renderFull() {
      if (!container) return;
      if (scoreMode && renderScoreFull()) {
        lastRenderedHighlightKey = '';
        return;
      }
      container.classList.remove('midi-score-active');
      if (!currentDoc) {
        if (typeof dbg === 'function') dbg('renderFull skip: doc=' + !!currentDoc);
        return;
      }
      if (globalScope.PlayerViewRenderer) {
        try {
          globalScope.PlayerViewRenderer.renderPlayerView(
            currentDoc, highlight, mergedView(), container
          );
          if (typeof dbg === 'function') dbg('renderFull OK lines=' + (currentDoc.lines || []).length);
        } catch (e) {
          if (typeof dbg === 'function') dbg('renderFull ERROR: ' + e.message);
          console.error('[MobileClient] renderFull', e);
        }
      } else {
        if (typeof dbg === 'function') dbg('PlayerViewRenderer undefined!');
      }
      lastRenderedHighlightKey = '';
      renderHighlight(true);
    }

    function renderHighlight(force = false) {
      if (!container || scoreMode) return;
      const nextHighlight = getRenderedHighlight();
      const key = highlightKey(nextHighlight);
      if (!force && key === lastRenderedHighlightKey) return;
      lastRenderedHighlightKey = key;
      if (globalScope.PlayerViewRenderer) {
        globalScope.PlayerViewRenderer.updatePlayerHighlight(
          nextHighlight, mergedView(), container
        );
      }
    }

    function renderTimeline(nextPlayback = getRenderedPlayback()) {
      if (typeof updateMobileTimeline === 'function') {
        updateMobileTimeline(timeline, nextPlayback);
      }
      globalScope.updatePlaybackUI?.(nextPlayback);
    }

    function renderPlaybackFrame() {
      const nextPlayback = getRenderedPlayback();
      renderTimeline(nextPlayback);
      if (scoreMode) renderScorePlayhead(nextPlayback.time);
      else renderHighlight();
      playbackRafId = requestAnimationFrame(renderPlaybackFrame);
    }

    function startPlaybackRenderLoop() {
      if (playbackRafId) return;
      playbackRafId = requestAnimationFrame(renderPlaybackFrame);
    }

    function send(type, payload) {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify(Protocol.pack(type, payload)));
    }

    function connect() {
      if (typeof WebSocket === 'undefined' || !Protocol) return;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

      try { ws = new WebSocket(url()); }
      catch (e) { console.error('[MobileClient]', e); return; }

      ws.onopen = () => {
        connected = true;
        send(Protocol.MSG.HELLO, {
          role: Protocol.ROLE.SLAVE,
          name: 'Phone',
          partId: lockedPartId,
          clientVersion: Protocol.PROTOCOL_VERSION
        });
        if (typeof updateStatus === 'function') updateStatus(true);
      };

      ws.onmessage = (ev) => {
        try {
          const dm = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
          if (typeof dbg === 'function') dbg('RX ' + dm.t);
        } catch (e) {}
        const res = Protocol.unpack(ev.data);
        if (!res.ok) return;
        const msg = res.message;
        const p = msg.p || {};
        switch (msg.t) {
          case Protocol.MSG.WELCOME:
            if (p.ok && pendingPartRequest) {
              requestScorePart(pendingPartRequest);
            }
            if (p.ok && pendingMusicXmlPartRequest) {
              requestMusicXmlPart(pendingMusicXmlPartRequest);
            }
            break;
          case Protocol.MSG.PING:
            send(Protocol.MSG.PONG, {});
            break;
          case Protocol.MSG.SNAPSHOT:
            currentDoc = p.doc || null;
            currentKey = p.keyState || null;
            applyMidiScore(p.midiScore);
            applyMusicXmlScore(p.musicXmlScore || { score: null });
            remoteView = p.view || null;
            playback = { time: 0, isPlaying: false, duration: 0 };
            setPlaybackState(p.playback || {});
            timeline = p.timeline || timeline;
            if (p.highlight) applyHighlight(p.highlight);
            applyLockedPart();
            renderFull();
            renderTimeline();
            break;
          case Protocol.MSG.DOC:
            currentDoc = p.doc || null;
            currentKey = p.keyState || null;
            if (p.midiScore) applyMidiScore(p.midiScore);
            if (p.musicXmlScore) applyMusicXmlScore(p.musicXmlScore);
            if (p.timeline) timeline = p.timeline;
            applyLockedPart();
            renderFull();
            renderTimeline();
            break;
          case Protocol.MSG.VIEW:
            remoteView = p.view || null;
            renderFull();
            break;
          case Protocol.MSG.HIGHLIGHT:
            applyHighlight(p);
            renderHighlight(true);
            break;
          case Protocol.MSG.PLAYHEAD:
            setPlaybackState(p);
            renderTimeline();
            break;
          case Protocol.MSG.MIDI_SCORE:
            applyMidiScore(p);
            break;
          case Protocol.MSG.MUSICXML_SCORE:
            applyMusicXmlScore(p);
            applyLockedPart();
            break;
          case Protocol.MSG.TIMELINE:
            timeline = p;
            renderTimeline();
            break;
          case Protocol.MSG.PEER_LEAVE:
            break;
          default:
            break;
        }
      };

      ws.onclose = () => {
        connected = false;
        if (typeof updateStatus === 'function') updateStatus(false);
        setTimeout(connect, 2000);
      };
      ws.onerror = () => {};
    }

    function applyHighlight(p) {
      highlight = {
        activeLineId: p.activeLineId || null,
        activeTokenId: p.activeTokenId || null,
        activeChordId: p.activeChordId || null,
        doneLines: new Set(p.doneLines || [])
      };
    }

    function seek(time) {
      const duration = Number(playback.duration) || 0;
      const value = Math.max(0, Math.min(Number(time) || 0, duration || Number(time) || 0));
      send(Protocol.MSG.SEEK_REQUEST, { time: value });
    }

    function requestTransport(action) {
      if (!['play', 'pause', 'stop'].includes(action)) return;
      send(Protocol.MSG.TRANSPORT_REQUEST, { action });
    }

    function toggleScoreMode() {
      if (!normalizedMidiScore() && !normalizedMusicXmlScore()) return false;
      scoreMode = !scoreMode;
      renderFull();
      return scoreMode;
    }

    /**
     * تنظیمات محلی گوشی — فقط روی این دستگاه اعمال می‌شود.
     * @param {object} patch { fontSize, fontFamily, chordColor, textColor, highlightColor, backgroundColor, scale, showChords }
     */
    function setLocalView(patch) {
      localOverride = Object.assign({}, localOverride, patch || {});
      try {
        localStorage.setItem(
          MOBILE_VIEW_STORAGE_KEY,
          JSON.stringify(localOverride)
        );
      } catch (e) {}
      renderFull();
    }

    function loadLocalView() {
      try {
        const raw = localStorage.getItem(MOBILE_VIEW_STORAGE_KEY);
        if (raw) {
          localOverride = Object.assign({}, DEFAULT_MOBILE_VIEW, JSON.parse(raw));
        }
        localOverride.showQuantizeGrid = false;
        localOverride.mobileLayout = true;
      } catch (e) {}
    }

    function init(el) {
      container = el;
      loadLocalView();
      // A QR target is a performer-part route, not the shared lyric mirror.
      // Open directly in score mode and keep the part selector locked.
      scoreMode = Boolean(lockedPartId);
      startPlaybackRenderLoop();
      connect();
    }

    function isConnected() { return connected; }

    function getLocalView() {
      return Object.assign({}, localOverride);
    }

    return {
      init,
      connect,
      setLocalView,
      getLocalView,
      seek,
      requestTransport,
      toggleScoreMode,
      getMidiScoreState: () => midiScoreState,
      getMusicXmlScoreState: () => musicXmlScoreState,
      isConnected
    };
  })();

  globalScope.AkordMobileClient = MobileClient;

})(typeof window !== 'undefined' ? window : globalThis);
