/*
 * CoreRecordingService
 *
 * Owns microphone/input recording lifecycle, live waveform preview and the
 * conversion of a completed recording into a normal audio clip. Runtime
 * behavior is injected so app/core.js only keeps the orchestration bridge.
 */
(function attachCoreRecordingService(globalScope) {
  'use strict';

  const MIME_TYPES = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4'
  ];

  function create({
    getDAW = () => globalScope.RuntimeStateAdapter?.getDAW?.() || null,
    documentRef = globalScope.document,
    getNavigator = () => globalScope.navigator,
    getMediaRecorder = () => globalScope.MediaRecorder,
    getBlob = () => globalScope.Blob,
    requestAnimationFrameRef = (...args) =>
      globalScope.requestAnimationFrame?.(...args),
    cancelAnimationFrameRef = (...args) =>
      globalScope.cancelAnimationFrame?.(...args),
    ensureAudioCtx = () => {},
    updateTrackMix = () => {},
    renderAll = () => {},
    startTransport = () => {},
    pauseTransport = () => {},
    timeToX = value => value,
    decodeFileToBuffer = () => null,
    peaksFromBuffer = () => [],
    refreshClipWaveImage = () => {},
    ensureTimelineFits = () => {},
    saveState = () => {},
    saveAudioBlobToDB = (...args) =>
      globalScope.EditorAudioStorageRuntime?.saveAudioBlobToDB?.(...args),
    uid = prefix => `${prefix || 'c'}${Date.now()}`,
    roundMs = value => value,
    formatTime = value => String(value),
    toast = () => {},
    logger = console
  } = {}) {
    function getState() {
      return getDAW?.();
    }

    function ensureRecLane() {
      const daw = getState();
      if (!daw) return null;

      let track = daw.tracks.find(item => item.id === 'tRec');
      if (!track) {
        ensureAudioCtx();
        track = {
          id: 'tRec',
          name: 'Rec',
          icon: '●',
          type: 'audio',
          isRec: true,
          muted: false,
          solo: false,
          vol: 0.8,
          pan: 0,
          transpose: 0,
          locked: false
        };
        const sectionIndex = daw.tracks.findIndex(
          item => item.type === 'section'
        );
        if (sectionIndex >= 0) {
          daw.tracks.splice(sectionIndex + 1, 0, track);
        } else {
          daw.tracks.push(track);
        }
      }

      if (track.type === 'audio' && !track._gainNode) {
        ensureAudioCtx();
        track._pannerNode = daw.audioCtx.createStereoPanner();
        track._gainNode = daw.audioCtx.createGain();
        track._pannerNode.connect(track._gainNode);
        track._gainNode.connect(daw.masterGain);
      }

      updateTrackMix(track.id);
      return track;
    }

    function updateRecUI() {
      const daw = getState();
      if (!daw || !documentRef) return;

      const recordButton = documentRef.getElementById?.('recBtn');
      if (recordButton) {
        recordButton.classList.toggle('rec-on', !!daw.isRecording);
      }

      const laneName = documentRef.querySelector?.(
        '.track-name[data-track-id="tRec"]'
      );
      if (laneName) {
        laneName.classList.toggle('rec-lane-name', !!daw.isRecording);
      }

      const lane = documentRef.querySelector?.(
        '.track-lane[data-track-id="tRec"]'
      );
      if (lane) lane.classList.toggle('rec-lane', !!daw.isRecording);
    }

    function recMimeType() {
      const MediaRecorder = getMediaRecorder?.();
      if (typeof MediaRecorder === 'undefined') return undefined;

      for (const type of MIME_TYPES) {
        try {
          if (MediaRecorder.isTypeSupported(type)) return type;
        } catch (_) {}
      }
      return undefined;
    }

    function cleanupRecResources() {
      const daw = getState();
      if (!daw) return;

      if (daw.recRafId) {
        cancelAnimationFrameRef(daw.recRafId);
        daw.recRafId = null;
      }

      try {
        if (
          daw.recMediaRecorder &&
          daw.recMediaRecorder.state !== 'inactive'
        ) {
          daw.recMediaRecorder.stop();
        }
      } catch (_) {}

      try {
        if (daw.recStream) {
          daw.recStream.getTracks().forEach(track => track.stop());
        }
      } catch (_) {}

      daw.recStream = null;
      daw.recMediaRecorder = null;
      daw.recAnalyser = null;
      daw.recPeaks = [];
      documentRef?.querySelectorAll?.('.rec-live-clip')
        .forEach(element => element.remove());
    }

    function recWaveDataUrl(peaks, width, height) {
      const canvas = documentRef.createElement('canvas');
      canvas.width = Math.max(2, width);
      canvas.height = Math.max(2, height);
      const context = canvas.getContext('2d');
      context.fillStyle = 'rgba(255,120,120,0.9)';
      const midpoint = height / 2;

      for (let index = 0; index < width; index++) {
        const peakIndex = Math.min(
          peaks.length - 1,
          Math.floor((index / width) * peaks.length)
        );
        const amplitude = Math.min(1, peaks[peakIndex] || 0);
        const barHeight = Math.max(1.5, amplitude * (height * 0.86));
        context.fillRect(index, midpoint - barHeight / 2, 1, barHeight);
      }

      return canvas.toDataURL('image/png');
    }

    function renderLiveRecWave() {
      const daw = getState();
      const lane = documentRef?.querySelector?.(
        `.track-lane[data-track-id="${daw?.recLaneId}"]`
      );
      if (!daw || !lane) return;

      const duration = Math.max(
        0.02,
        daw.playhead - daw.recStartTime
      );
      const width = Math.min(
        20000,
        Math.max(6, Math.floor(timeToX(duration)))
      );
      let element = documentRef.querySelector?.('.clip.rec-live-clip');
      if (!element) {
        element = documentRef.createElement('div');
        element.className = 'clip rec-live-clip';
        element.dataset.rec = '1';
        element.style.top = '6px';
        element.style.height = 'calc(var(--lane-h) - 12px)';
        element.style.pointerEvents = 'none';
        lane.appendChild(element);
      }

      element.style.left = `${timeToX(daw.recStartTime)}px`;
      element.style.width = `${width}px`;
      element.innerHTML =
        `<img class="clip-wave" src="${recWaveDataUrl(
          daw.recPeaks,
          width,
          52
        )}"><div class="clip-title">● ضبط زنده</div>`;
    }

    function finishRec(blob) {
      const daw = getState();
      if (!daw) return;

      const start = daw.recStartTime || 0;
      const end =
        daw.recEndTime != null && daw.recEndTime >= start
          ? daw.recEndTime
          : daw.playhead;
      const duration = Math.max(0.05, end - start);
      if (!blob || blob.size < 500) {
        toast('ضبط خالی بود');
        return;
      }

      (async () => {
        try {
          ensureAudioCtx();
          const { buffer } = await decodeFileToBuffer(blob);
          const bufferKey = `rec_${uid('b')}_${Date.now()}`;
          daw.bufferCache.set(bufferKey, buffer);
          const clip = {
            id: uid('c'),
            type: 'audio',
            trackId: daw.recLaneId || 'tRec',
            name: `Recording ${formatTime(start)}`,
            start: roundMs(start),
            duration: roundMs(duration),
            offset: 0,
            sourceDuration: buffer.duration,
            color: '#EF4444',
            bufferKey,
            _peaks: peaksFromBuffer(buffer, 2000),
            waveUrl: null,
            _embedded: true,
            _originalBlob: blob
          };
          refreshClipWaveImage(clip);
          daw.clips.push(clip);
          daw.selectedIds = new Set([clip.id]);
          ensureTimelineFits(clip.start + clip.duration + 5);
          saveState();
          renderAll();
          try {
            await saveAudioBlobToDB(bufferKey, blob, 'recording.webm');
          } catch (_) {}
          toast('✓ ضبط ذخیره شد');
        } catch (error) {
          logger.error?.(error);
          toast('خطا در ذخیره‌ی ضبط');
        }
      })();
    }

    async function startRec() {
      const daw = getState();
      if (!daw || daw.isRecording) return;

      const navigatorRef = getNavigator?.();
      if (
        !navigatorRef?.mediaDevices ||
        !navigatorRef.mediaDevices.getUserMedia
      ) {
        toast('ضبط صدا در این محیط پشتیبانی نمی‌شود');
        return;
      }

      let stream;
      try {
        stream = await navigatorRef.mediaDevices.getUserMedia({
          audio: true,
          video: false
        });
      } catch (error) {
        logger.error?.(error);
        toast('دسترسی به میکروفن/ورودی صوتی رد شد');
        return;
      }

      try {
        const context = ensureAudioCtx();
        const recordTrack = ensureRecLane();
        renderAll();
        const audioSource = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        const destination = context.createMediaStreamDestination();
        audioSource.connect(analyser);
        analyser.connect(destination);

        const chunks = [];
        const mimeType = recMimeType();
        const MediaRecorder = getMediaRecorder?.();
        const recorder = new MediaRecorder(
          destination.stream,
          mimeType ? { mimeType } : undefined
        );
        recorder.ondataavailable = event => {
          if (event.data && event.data.size > 0) chunks.push(event.data);
        };
        recorder.onstop = () => {
          const Blob = getBlob?.();
          const blob = new Blob(chunks, {
            type: mimeType || recorder.mimeType || 'audio/webm'
          });
          finishRec(blob);
        };

        daw.isRecording = true;
        daw.recLaneId = recordTrack ? recordTrack.id : 'tRec';
        daw.recStartTime = daw.playhead;
        daw.recEndTime = daw.playhead;
        daw.recPeaks = [];
        daw.recAnalyser = analyser;
        daw.recStream = stream;
        daw.recMediaRecorder = recorder;

        try {
          recorder.start(250);
        } catch (error) {
          logger.error?.(error);
          toast('خطا در شروع ضبط');
          daw.isRecording = false;
          cleanupRecResources();
          return;
        }

        renderAll();
        updateRecUI();
        if (!daw.isPlaying) startTransport();
        toast('● ضبط شروع شد — برای توقف R را بزنید');

        const tickRecWave = () => {
          if (!daw.isRecording) {
            daw.recRafId = null;
            return;
          }
          try {
            const data = new Float32Array(daw.recAnalyser.fftSize);
            daw.recAnalyser.getFloatTimeDomainData(data);
            let max = 0;
            for (let index = 0; index < data.length; index++) {
              const amplitude = Math.abs(data[index]);
              if (amplitude > max) max = amplitude;
            }
            daw.recPeaks.push(max);
          } catch (_) {}
          renderLiveRecWave();
          daw.recRafId = requestAnimationFrameRef(tickRecWave);
        };
        daw.recRafId = requestAnimationFrameRef(tickRecWave);
      } catch (error) {
        logger.error?.(error);
        toast('خطا در راه‌اندازی ضبط');
        daw.isRecording = false;
        cleanupRecResources();
      }
    }

    function endRec() {
      const daw = getState();
      if (!daw?.isRecording) return;
      daw.recEndTime = daw.playhead;
      cleanupRecResources();
      daw.isRecording = false;
      updateRecUI();
    }

    function toggleRec() {
      const daw = getState();
      if (!daw) return;
      if (daw.isRecording) {
        endRec();
        if (daw.isPlaying) pauseTransport();
      } else {
        startRec();
      }
    }

    return Object.freeze({
      ensureRecLane,
      updateRecUI,
      recMimeType,
      startRec,
      cleanupRecResources,
      endRec,
      toggleRec,
      renderLiveRecWave,
      finishRec
    });
  }

  const service = Object.freeze({ create });
  globalScope.CoreRecordingService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
