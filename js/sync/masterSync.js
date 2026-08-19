/**
 * sync/masterSync.js — کلاینت مستر (سمت لپ‌تاپ / مرورگر)
 *
 * کارها:
 *  1. به SyncHub وصل می‌شود و نقش Master را اعلام می‌کند.
 *  2. به PerformanceStore (منبع واحد state) subscribe می‌شود.
 *  3. تغییرات را طبق پروتکل می‌فرستد:
 *       - DOC / VIEW  → فقط وقتی ساختار یا viewState عوض شود (سنگین)
 *       - PLAYHEAD    → هر فریم پخش (سبک: فقط time + isPlaying)
 *       - HIGHLIGHT   → وقتی خط فعال یا خطوط خوانده‌شده عوض شود
 *  4. وقتی اسلیو تازه‌وارد می‌آید (peer-join)، snapshot کامل می‌فرستد
 *     تا گوشی بلافاصله ترانه را نشان دهد.
 *
 * اینجا هیچ رندری انجام نمی‌شود — فقط انتقال state.
 * (همین الگو در اپلیکیشن نیتیو آینده تکرار می‌شود.)
 */

(function attachMasterSync(globalScope) {
  'use strict';

  const Protocol = globalScope.AkordSyncProtocol;
  const MasterSyncEvents = globalScope.AkordMasterSyncEvents || {};
  globalScope.AkordMasterSyncEvents = MasterSyncEvents;

  function getStore() {
    return globalScope.PerformanceStore || null;
  }

  function buildTimeline() {
    const daw = globalScope.RuntimeStateAdapter?.getDAW?.() || null;
    const song = globalScope.EdCurAdapter?.getEdCur?.() || null;
    const sourceClips = Array.isArray(daw?.clips)
      ? daw.clips.filter(clip => clip && clip.type === 'chord')
      : [];
    const songClips = Array.isArray(song?.chordLineClips)
      ? song.chordLineClips
      : [];
    const clips = (sourceClips.length ? sourceClips : songClips)
      .map((clip, index) => ({
        id: String(clip.id || 'chord-' + index),
        type: 'chord',
        name: String(clip.name || clip.label || '').trim(),
        start: Math.max(0, Number(clip.start) || 0),
        duration: Math.max(0.05, Number(clip.duration) || 1),
        color: clip.color || '#9F7AEA'
      }))
      .filter(clip => clip.name);

    let duration = Number(daw?.timelineDuration) || 0;
    clips.forEach(clip => {
      duration = Math.max(duration, clip.start + clip.duration);
    });

    return {
      duration: Math.max(0, duration),
      pxPerSecond: Math.max(12, Math.min(260, Number(daw?.pxPerSecond) || 70)),
      tempo: Math.max(
        1,
        Number(song?.tempo) || Number(daw?.tempo) || 120
      ),
      timeSignature: song?.timeSignature || daw?.timeSignature || '4/4',
      clips
    };
  }

  // Mobile performers need the processed musical state, never the original
  // binary source bytes.  Broadcast only the part catalogue; note data is
  // returned privately to the requesting phone.
  function buildMidiScorePayload(scoreState, requestedPartId = null, includeTrack = false) {
    const score = scoreState?.score;
    const song = globalScope.EdCurAdapter?.getEdCur?.() || null;
    const playheadMode = song?.liveScoreSettings?.playheadMode === 'measure'
      ? 'measure'
      : 'line';
    if (!score || typeof score !== 'object') {
      return {
        score: null,
        activePartId: null,
        scoreVersion: 0,
        playheadMode
      };
    }
    const activePartId =
      requestedPartId ||
      scoreState.activePartId ||
      score.activePartId ||
      score.parts?.[0]?.id ||
      null;
    const activePart = score.parts?.find(part => part.id === activePartId) ||
      score.parts?.[0] ||
      null;
    const track = activePart
      ? score.tracks?.find(candidate => candidate.id === activePart.trackId)
      : score.tracks?.[0];
    const compactScore = {
      schemaVersion: score.schemaVersion || 1,
      format: score.format,
      division: score.division,
      endTick: score.endTick,
      durationSeconds: score.durationSeconds,
      tempoMap: score.tempoMap,
      meterMap: score.meterMap,
      keySignatures: score.keySignatures || [],
      markers: score.markers || [],
      parts: (score.parts || []).map(part => ({
        id: part.id,
        trackId: part.trackId,
        index: part.index,
        name: part.name,
        role: part.role,
        roleLabel: part.roleLabel,
        enabled: part.enabled,
        visible: part.visible,
        transpose: part.transpose || 0
      })),
      tracks: includeTrack && track ? [{
        id: track.id,
        index: track.index,
        name: track.name,
        instrumentName: track.instrumentName,
        channel: track.channel,
        channels: Array.isArray(track.channels) ? [...track.channels] : [],
        programs: Array.isArray(track.programs)
          ? track.programs.map(program => ({ ...program }))
          : [],
        durationTicks: track.durationTicks,
        notes: Array.isArray(track.notes)
          ? track.notes.map(note => ({ ...note }))
          : []
      }] : [],
      activePartId,
      source: score.source ? {
        fileName: score.source.fileName || '',
        mimeType: score.source.mimeType || 'audio/midi',
        size: Number(score.source.size) || 0,
        lastModified: score.source.lastModified || null,
        data: null
      } : null
    };
    if (compactScore.tracks[0]) delete compactScore.tracks[0].events;
    return {
      score: compactScore,
      activePartId,
      scoreVersion: Number(scoreState.scoreVersion || score.schemaVersion || 1),
      playheadMode
    };
  }

  // MusicXML is the notation/layout authority.  Broadcast only a compact
  // part catalogue by default; the requesting phone receives its own part's
  // measures/notes through the targeted payload below.
  function musicXmlSourceData(score) {
    const source = score?.source?.data;
    if (typeof source === 'string' && source.trim()) return source;
    if (source && typeof source === 'object' &&
        typeof XMLSerializer !== 'undefined' &&
        typeof source.documentElement !== 'undefined') {
      try {
        const serialized = new XMLSerializer().serializeToString(source);
        if (serialized.trim()) return serialized;
      } catch (_) {}
    }
    return [
      score?.sourceText,
      score?.musicXml,
      score?.xml,
      score?.rawMusicXml
    ].find(value => typeof value === 'string' && value.trim()) || null;
  }

  function buildMusicXmlScorePayload(scoreState, requestedPartId = null, includePart = false) {
    const score = scoreState?.score;
    const song = globalScope.EdCurAdapter?.getEdCur?.() || null;
    const projectTempo = Math.max(
      1,
      Number(song?.tempo) || Number(
        globalScope.RuntimeStateAdapter?.getDAW?.()?.tempo
      ) || 120
    );
    const chordLineVisibility =
      song?.liveScoreSettings?.chordLineVisibility &&
      typeof song.liveScoreSettings.chordLineVisibility === 'object'
        ? { ...song.liveScoreSettings.chordLineVisibility }
        : {};
    const playheadMode = song?.liveScoreSettings?.playheadMode === 'measure'
      ? 'measure'
      : 'line';
    if (!score || typeof score !== 'object') {
      return {
        score: null,
        activePartId: null,
        mappings: [],
        chordLineVisibility,
        projectTempo,
        scoreVersion: 0,
        playheadMode
      };
    }
    const activePartId =
      requestedPartId ||
      scoreState.activePartId ||
      score.activePartId ||
      score.parts?.[0]?.id ||
      null;
    const part = score.parts?.find(candidate => String(candidate.id) === String(activePartId)) || null;
    const compactPart = part ? {
      id: part.id,
      name: part.name,
      abbreviation: part.abbreviation,
      role: part.role,
      roleLabel: part.roleLabel,
      enabled: part.enabled,
      visible: part.visible,
      showChords: part.showChords,
      midiPartId: part.midiPartId || null,
      midiTrackId: part.midiTrackId || null,
      transposition: part.transposition || null,
      instruments: part.instruments || [],
      midiInstruments: part.midiInstruments || [],
      endTick: part.endTick || 0,
      measures: includePart
        ? (part.measures || []).map(measure => ({
            ...measure,
            notes: (measure.notes || []).map(note => ({ ...note }))
          }))
        : []
    } : null;
    const compactScore = {
      schemaVersion: score.schemaVersion || 1,
      format: score.format || 'score-partwise',
      title: score.title || '',
      creators: score.creators || {},
      ticksPerQuarter: score.ticksPerQuarter || 480,
      endTick: score.endTick || 0,
      measures: (score.measures || []).map(measure => ({
        index: measure.index,
        number: measure.number,
        startTick: measure.startTick,
        endTick: measure.endTick,
        durationTicks: measure.durationTicks,
        numerator: measure.numerator,
        denominator: measure.denominator,
        beatTicks: measure.beatTicks,
        time: measure.time,
        key: measure.key,
        clefs: measure.clefs,
        staves: measure.staves,
        width: measure.width,
        layout: measure.layout,
        barlines: measure.barlines
      })),
      meterMap: score.meterMap,
      keyMap: score.keyMap,
      tempoMap: score.tempoMap,
      parts: (score.parts || []).map(candidate => ({
        id: candidate.id,
        name: candidate.name,
        abbreviation: candidate.abbreviation,
        role: candidate.role,
        roleLabel: candidate.roleLabel,
        enabled: candidate.enabled,
        visible: candidate.visible,
        showChords: candidate.showChords,
        midiPartId: candidate.midiPartId || null,
        midiTrackId: candidate.midiTrackId || null,
        transposition: candidate.transposition || null,
        endTick: candidate.endTick || 0
      })),
      activePartId,
      source: score.source ? {
        fileName: score.source.fileName || '',
        mimeType: score.source.mimeType || 'application/vnd.recordare.musicxml+xml',
        size: Number(score.source.size) || 0,
        // The catalogue intentionally omits the raw XML.  It is included only
        // in the targeted part response so the phone can let OSMD parse the
        // original notation instead of trying to reconstruct MusicXML.
        data: includePart ? musicXmlSourceData(score) : null
      } : null
    };
    if (compactPart) {
      const targetIndex = compactScore.parts.findIndex(candidate => candidate.id === compactPart.id);
      if (targetIndex >= 0) compactScore.parts[targetIndex] = compactPart;
      else compactScore.parts.push(compactPart);
    }
    return {
      score: compactScore,
      activePartId,
      mappings: Array.isArray(scoreState.mappings)
        ? scoreState.mappings.map(mapping => ({ ...mapping, ip: null }))
        : (Array.isArray(score.mappings) ? score.mappings.map(mapping => ({ ...mapping, ip: null })) : []),
      chordLineVisibility,
      projectTempo,
      scoreVersion: Number(scoreState.scoreVersion || score.schemaVersion || 1),
      playheadMode
    };
  }

  function sanitizeDocumentForSync(doc) {
    if (!doc || typeof doc !== 'object') return doc;
    const safe = { ...doc };
    // The original MIDI byte stream is persisted locally/project-side only.
    // It is never needed by a lyric/chord client and must not cross the hub.
    if (Object.prototype.hasOwnProperty.call(safe, 'midiScore')) {
      safe.midiScore = undefined;
    }
    if (Object.prototype.hasOwnProperty.call(safe, 'musicXmlScore')) {
      safe.musicXmlScore = undefined;
    }
    if (Object.prototype.hasOwnProperty.call(safe, 'scorePartMappings')) {
      safe.scorePartMappings = undefined;
    }
    return safe;
  }

  function buildSnapshot() {
    const store = getStore();
    if (!store) return null;
    const st = store.getSerializableState();
    return {
      doc: sanitizeDocumentForSync(st.songDocument),
      keyState: st.keyState,
      view: st.viewStates && st.viewStates.playerView,
      playback: st.playbackState,
      midiScore: buildMidiScorePayload(st.midiScoreState, null, false),
      musicXmlScore: buildMusicXmlScorePayload(st.musicXmlScoreState, null, false),
      highlight: st.highlightState,
      timeline: buildTimeline()
    };
  }

  const MasterSync = (() => {
    let ws = null;
    let connected = false;
    let deviceName = 'Laptop';
    let _unsubs = [];
    let _lastHighlightKey = '';
    let _lastTimelineKey = '';
    let _lastMidiScoreKey = '';
    let _lastMusicXmlScoreKey = '';

    function url() {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      let origin;
      try { origin = location.origin; } catch (e) {}
      if (!origin || origin === 'null' || origin === 'file://') {
        origin = 'http://127.0.0.1:3000';
      }
      const wsOrigin = proto + '://' + origin.replace(/^https?:\/\//, '');
      return wsOrigin + '/sync';
     }

    function send(type, payload, meta) {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify(Protocol.pack(type, payload, meta)));
    }

    function pushDoc() {
      const store = getStore();
      if (!store) return;
      const st = store.getState();
      const timeline = buildTimeline();
      send(Protocol.MSG.DOC, {
        doc: sanitizeDocumentForSync(st.songDocument),
        keyState: st.keyState,
        midiScore: buildMidiScorePayload(st.midiScoreState, null, false),
        musicXmlScore: buildMusicXmlScorePayload(st.musicXmlScoreState, null, false),
        timeline
      });
      _lastTimelineKey = JSON.stringify(timeline);
      send(Protocol.MSG.VIEW, { view: st.viewStates && st.viewStates.playerView });
      pushMidiScore();
      pushMusicXmlScore();
    }

    function pushMidiScore(force = false) {
      const store = getStore();
      if (!store) return;
      const payload = buildMidiScorePayload(store.getState().midiScoreState);
      const key = JSON.stringify(payload);
      if (!force && key === _lastMidiScoreKey) return;
      _lastMidiScoreKey = key;
      send(Protocol.MSG.MIDI_SCORE, payload);
    }

    function pushMusicXmlScore(force = false) {
      const store = getStore();
      if (!store) return;
      const payload = buildMusicXmlScorePayload(store.getState().musicXmlScoreState);
      const key = JSON.stringify(payload);
      if (!force && key === _lastMusicXmlScoreKey) return;
      _lastMusicXmlScoreKey = key;
      send(Protocol.MSG.MUSICXML_SCORE, payload);
    }

    function pushMidiScoreForPeer(peerId, partId) {
      const store = getStore();
      if (!store || !peerId) return;
      const score = store.getState().midiScoreState?.score;
      if (!score?.parts?.some(part => String(part.id) === String(partId))) return;
      const payload = buildMidiScorePayload(
        store.getState().midiScoreState,
        partId,
        true
      );
      send(Protocol.MSG.MIDI_SCORE, payload, { targetPeerId: peerId });
    }

    function pushMusicXmlScoreForPeer(peerId, partId) {
      const store = getStore();
      if (!store || !peerId) return;
      const score = store.getState().musicXmlScoreState?.score;
      if (!score?.parts?.some(part => String(part.id) === String(partId))) return;
      const payload = buildMusicXmlScorePayload(
        store.getState().musicXmlScoreState,
        partId,
        true
      );
      send(Protocol.MSG.MUSICXML_SCORE, payload, { targetPeerId: peerId });
    }

    function pushTimelineIfChanged() {
      const timeline = buildTimeline();
      const key = JSON.stringify(timeline);
      if (key === _lastTimelineKey) return;
      _lastTimelineKey = key;
      send(Protocol.MSG.TIMELINE, timeline);
    }

    function pushPlayhead() {
      // PerformanceBridge already publishes at a bounded cadence.  Sending
      // directly here avoids tying mobile transport updates to the master's
      // (throttleable) RAF loop.
      const store = getStore();
      if (!store) return;
      const pb = store.getState().playbackState;
      pushTimelineIfChanged();
      send(Protocol.MSG.PLAYHEAD, {
        time: pb.time,
        isPlaying: pb.isPlaying,
        duration: pb.duration || 0
      });
    }

    function pushHighlight() {
      const store = getStore();
      if (!store) return;
      const hl = store.getState().highlightState;
      const key = JSON.stringify([
        hl.activeLineId, hl.activeTokenId, hl.activeChordId,
        Array.from(hl.doneLines || [])
      ]);
      if (key === _lastHighlightKey) return;
      _lastHighlightKey = key;
      send(Protocol.MSG.HIGHLIGHT, {
        activeLineId: hl.activeLineId,
        activeTokenId: hl.activeTokenId,
        activeChordId: hl.activeChordId,
        doneLines: Array.from(hl.doneLines || [])
      });
    }

    function onPeerJoin() {
      // یک اسلیو جدید وصل شد → snapshot کامل بفرست
      const snap = buildSnapshot();
      if (snap) {
        send(Protocol.MSG.SNAPSHOT, snap);
        pushMidiScore(true);
        pushMusicXmlScore(true);
      }
    }

    function wireStore() {
      const store = getStore();
      if (!store) return;
      _unsubs.push(store.subscribe('contentUpdated', pushDoc));
      _unsubs.push(store.subscribe('midiScoreChanged', () => pushMidiScore()));
      _unsubs.push(store.subscribe('musicXmlScoreChanged', () => pushMusicXmlScore()));
      _unsubs.push(store.subscribe('keyChanged', pushDoc));
      _unsubs.push(store.subscribe('viewStateChanged', (ev) => {
        if (!ev || ev.viewId === 'playerView' || !ev.viewId) pushDoc();
      }));
      _unsubs.push(store.subscribe('playbackStateChanged', pushPlayhead));
      _unsubs.push(store.subscribe('highlightChanged', pushHighlight));
    }

    function clearStore() {
      _unsubs.forEach(fn => { try { fn(); } catch (e) {} });
      _unsubs = [];
    }

    function connect(name) {
      if (typeof WebSocket === 'undefined' || !Protocol) {
        console.warn('[MasterSync] WebSocket یا Protocol در دسترس نیست');
        return;
      }
      deviceName = name || deviceName;
      // اگر قبلاً یه ws داشتیم که بسته شده، آن را پاک کنیم
      if (ws && (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING)) {
        try { ws.onclose = null; } catch (e) {}
        ws = null;
      }
      // اگر هنوز ws فعالی داریم، اتصال جدید نساز (از حلقه جلوگیری می‌کند)
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
      }

      let socket;
      try {
        const u = url();
        console.log('[MasterSync] connecting to', u);
        socket = new WebSocket(u);
        ws = socket;
        // Electron sometimes reports code 1006 without exposing the
        // underlying reason. Keep the socket identity and readyState in the
        // log so a stale socket cannot be mistaken for the current one.
        console.log('[MasterSync] socket created readyState=' + socket.readyState);
      } catch (e) {
        console.error('[MasterSync] connect error', e);
        return;
      }

      ws.onopen = () => {
        if (ws !== socket) return;
        console.log('[MasterSync] socket open readyState=' + socket.readyState);
        connected = true;
        send(Protocol.MSG.HELLO, { role: Protocol.ROLE.MASTER, name: deviceName, clientVersion: Protocol.PROTOCOL_VERSION });
        wireStore();
        // اولین snapshot بلافاصله بعد از welcome
      };

      ws.onmessage = (ev) => {
        const res = Protocol.unpack(ev.data);
        if (!res.ok) return;
        const t = res.message.t;
        if (t === Protocol.MSG.PING) {
          // Keep the master session alive. The hub terminates peers that do
          // not answer its heartbeat within two intervals.
          send(Protocol.MSG.PONG, {});
        } else if (t === Protocol.MSG.WELCOME && res.message.p.ok) {
          // مستر تایید شد؛ snapshot اولیه بفرست
          const snap = buildSnapshot();
          if (snap) send(Protocol.MSG.SNAPSHOT, snap);
        } else if (t === Protocol.MSG.PEER_JOIN) {
          try { MasterSyncEvents.onJoin?.(res.message.p || {}); } catch (_) {}
          onPeerJoin();
        } else if (t === Protocol.MSG.PEER_LEAVE) {
          try { MasterSyncEvents.onLeave?.(res.message.p || {}); } catch (_) {}
        } else if (t === Protocol.MSG.SEEK_REQUEST) {
          const time = Number(res.message.p && res.message.p.time);
          if (Number.isFinite(time) && typeof globalScope.seekTransport === 'function') {
            globalScope.seekTransport(time, false, true);
          }
      } else if (t === Protocol.MSG.TRANSPORT_REQUEST) {
          const action = res.message.p && res.message.p.action;
          if (action === 'play' && typeof globalScope.startTransport === 'function') {
            globalScope.startTransport();
          } else if (action === 'pause' && typeof globalScope.pauseTransport === 'function') {
            globalScope.pauseTransport();
          } else if (action === 'stop' && typeof globalScope.stopTransport === 'function') {
            globalScope.stopTransport();
          }
        } else if (t === Protocol.MSG.MIDI_SCORE_REQUEST) {
          const requesterId = res.message.m && res.message.m.requesterId;
          const partId = res.message.p && res.message.p.partId;
          if (requesterId && partId) {
            pushMidiScoreForPeer(requesterId, String(partId));
          }
        } else if (t === Protocol.MSG.MUSICXML_SCORE_REQUEST) {
          const requesterId = res.message.m && res.message.m.requesterId;
          const partId = res.message.p && res.message.p.partId;
          if (requesterId && partId) {
            pushMusicXmlScoreForPeer(requesterId, String(partId));
          }
        }
      };

      ws.onclose = (ev) => {
        if (ws !== socket) return;
        connected = false;
        clearStore();
        console.warn('[MasterSync] disconnected code=' + (ev && ev.code) +
          ' reason=' + (ev && ev.reason) +
          ' readyState=' + socket.readyState +
          ' wasClean=' + (ev && ev.wasClean));
        // تلاش مجدد پس از ۳ ثانیه (زمان بیشتر برای جلوگیری از حلقه)
        setTimeout(() => { if (!connected) connect(deviceName); }, 3000);
      };

      ws.onerror = (ev) => {
        if (ws === socket) {
          console.warn('[MasterSync] socket error', ev);
        }
      };
    }

    function isConnected() { return connected; }

    // اطمینان از اتصال بدون ایجاد اتصال دوم (جلوگیری از حلقه)
    function ensureConnected() {
      if (connected) return;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
      connect(deviceName);
    }

    function resendSnapshot() {
      const snap = buildSnapshot();
      if (snap) send(Protocol.MSG.SNAPSHOT, snap);
    }

    function disconnect() {
      clearStore();
      if (ws) { try { ws.close(); } catch (e) {} }
      ws = null;
      connected = false;
      _lastTimelineKey = '';
      _lastMidiScoreKey = '';
      _lastMusicXmlScoreKey = '';
    }

    return { connect, disconnect, isConnected, ensureConnected, resendSnapshot };
  })();

  globalScope.AkordMasterSync = MasterSync;

  // خودکار وصل شو وقتی DOM آماده شد (فقط اگر PerformanceStore هست)
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      if (globalScope.PerformanceStore && Protocol) {
        MasterSync.connect('Laptop');
      }
    });
  }

})(typeof window !== 'undefined' ? window : globalThis);
