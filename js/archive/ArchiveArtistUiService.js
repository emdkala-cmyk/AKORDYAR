/**
 * ArchiveArtistUiService
 *
 * Owns the archive artist list, search/filter UI and 3D slider interactions.
 * Image persistence stays behind callbacks so it can be extracted safely in
 * a later stage without changing the public archive functions.
 */
(function attachArchiveArtistUiService(globalScope) {
  function create(context = {}) {
    const {
      getElement = id => globalScope.document?.getElementById(id),
      documentRef = globalScope.document,
      storage = globalScope.localStorage,
      getAllSongs = () => [],
      getDefaultArtists = () => [],
      artistKey = value => String(value || '').trim().toLowerCase(),
      matchDefaultArtist = () => null,
      normalizeText = value => String(value || '').trim().toLowerCase(),
      getArtistImage = () => null,
      avatarColor = () => '#3949AB',
      getInitials = () => '?',
      escapeHtml = value => String(value ?? ''),
      getArtistCache = () => null,
      setArtistCache = () => {},
      getArtistFilter = () => null,
      setArtistFilter = () => {},
      render = () => {},
      refreshArtists = () => {},
      updateActiveFilters = () => {},
      pickArtistImage = () => {},
      removeArtistImage = () => {},
      toast = () => {},
      getSectionCollapsed = () => false,
      setSectionCollapsed = () => {},
      getFullscreen = () => false,
      setFullscreen = () => {},
      requestFrame = callback =>
        (globalScope.requestAnimationFrame || (cb => globalScope.setTimeout(cb, 0)))(callback),
      cancelFrame = frame => globalScope.cancelAnimationFrame?.(frame),
      viewport = () => ({
        width: globalScope.innerWidth || documentRef?.documentElement?.clientWidth || 1000,
        height: globalScope.innerHeight || documentRef?.documentElement?.clientHeight || 800
      })
    } = context;

    let sliderAngle = 0;
    let sliderSpeed = 0.08;
    let sliderPaused = false;
    let sliderAnimFrame = null;
    let sliderResumeTimeout = null;
    let sliderCardCount = 0;
    let artistContextTarget = null;
    const sliderRadius = 460;

    function buildArtistList() {
      const songs = getAllSongs().filter(song => !song.deletedAt);
      const artists = new Map();

      for (const defaultArtist of getDefaultArtists()) {
        const key = artistKey(defaultArtist.normalizedName);
        if (!artists.has(key)) {
          artists.set(key, {
            normalizedName: key,
            displayName: defaultArtist.displayName,
            count: 0,
            lastDate: null,
            favorite: !!defaultArtist.favorite
          });
        }
      }

      for (const song of songs) {
        const raw = (song.artist || song.artistName || song.singer || '').trim();
        const matched = matchDefaultArtist(raw);
        const key = matched ? artistKey(matched.normalizedName) : artistKey(raw);
        if (!artists.has(key)) {
          artists.set(key, {
            normalizedName: key,
            displayName: matched ? matched.displayName : (raw || 'خواننده نامشخص'),
            count: 0,
            lastDate: null,
            favorite: false
          });
        }
        const artist = artists.get(key);
        artist.count++;
        if (song.updatedAt && (!artist.lastDate || song.updatedAt > artist.lastDate)) {
          artist.lastDate = song.updatedAt;
        }
      }

      return Array.from(artists.values()).sort((a, b) => b.count - a.count);
    }

    function positionCards3D() {
      const container = getElement('artistSliderContainer');
      if (!container) return;
      const cards = container.querySelectorAll('.artist-card');
      sliderCardCount = cards.length;
      if (!sliderCardCount) return;
      const angleStep = 360 / sliderCardCount;
      cards.forEach((card, index) => {
        card.style.transform =
          `rotateY(${angleStep * index}deg) translateZ(${sliderRadius}px)`;
      });
    }

    function sliderLoop() {
      const container = getElement('artistSliderContainer');
      if (!container || !sliderCardCount) {
        sliderAnimFrame = requestFrame(sliderLoop);
        return;
      }
      if (!sliderPaused) {
        sliderAngle += sliderSpeed;
        if (sliderAngle >= 360) sliderAngle -= 360;
        container.style.transform = `rotateY(${-sliderAngle}deg)`;
      }
      sliderAnimFrame = requestFrame(sliderLoop);
    }

    function startAutoScroll() {
      sliderPaused = false;
      if (!sliderAnimFrame) sliderAnimFrame = requestFrame(sliderLoop);
    }

    function stopAutoScroll() {
      sliderPaused = true;
      if (sliderAnimFrame) {
        cancelFrame(sliderAnimFrame);
        sliderAnimFrame = null;
      }
    }

    function resetAutoScroll() {
      sliderAngle = 0;
      sliderPaused = false;
      const container = getElement('artistSliderContainer');
      if (container) container.style.transform = 'rotateY(0deg)';
      if (sliderAnimFrame) {
        cancelFrame(sliderAnimFrame);
        sliderAnimFrame = null;
      }
      positionCards3D();
      sliderAnimFrame = requestFrame(sliderLoop);
    }

    function updateSliderNav() {
      const previous = getElement('artistPrevBtn');
      const next = getElement('artistNextBtn');
      if (previous) previous.disabled = false;
      if (next) next.disabled = false;
    }

    function slide(direction) {
      const step = 360 / Math.max(sliderCardCount, 1);
      sliderAngle += direction * step;
      sliderPaused = true;
      globalScope.clearTimeout(sliderResumeTimeout);
      sliderResumeTimeout = globalScope.setTimeout(() => {
        sliderPaused = false;
      }, 150);
    }

    function handleWheel(event) {
      if (Math.abs(event.deltaY) < 1) return;
      event.preventDefault();
      const step = 360 / Math.max(sliderCardCount, 1);
      sliderAngle += (event.deltaY > 0 ? 1 : -1) * step * 0.3;
      const container = getElement('artistSliderContainer');
      if (container) container.style.transform = `rotateY(${-sliderAngle}deg)`;
      sliderPaused = true;
      globalScope.clearTimeout(sliderResumeTimeout);
      sliderResumeTimeout = globalScope.setTimeout(() => {
        sliderPaused = false;
      }, 150);
    }

    function showArtistContext(event, normalizedName) {
      artistContextTarget = normalizedName;
      const menu = getElement('artistCtxMenu');
      if (!menu) return;
      const hasImage = !!getArtistImage(normalizedName);
      menu.querySelectorAll('.acm-item').forEach((item, index) => {
        item.style.display = index === 0
          ? (hasImage ? 'none' : '')
          : (hasImage ? '' : 'none');
      });
      const { width, height } = viewport();
      const x = event.clientX || event.pageX || 100;
      const y = event.clientY || event.pageY || 100;
      menu.style.left = Math.min(x, width - 200) + 'px';
      menu.style.top = Math.min(y, height - 200) + 'px';
      menu.classList.add('show');
      event.preventDefault();
      event.stopPropagation();
    }

    function artistContextAction(action) {
      getElement('artistCtxMenu')?.classList.remove('show');
      const normalizedName = artistContextTarget;
      if (!normalizedName) return;
      if (action === 'set-image' || action === 'change-image') {
        pickArtistImage(normalizedName);
      } else if (action === 'remove-image') {
        removeArtistImage(normalizedName);
        refreshArtists();
        toast('تصویر خواننده حذف شد');
      } else if (action === 'reset-image') {
        removeArtistImage(normalizedName);
        refreshArtists();
        toast('تصویر به حالت پیش‌فرض بازگشت');
      }
    }

    function filterArtists() {
      let cache = getArtistCache();
      if (!cache) {
        cache = buildArtistList();
        setArtistCache(cache);
      }
      const input = getElement('artistSearchInput');
      const query = normalizeText(input?.value || '');
      getElement('artistSearchClear')?.classList.toggle('show', !!input?.value);
      const filtered = query
        ? cache.filter(artist =>
          artist.normalizedName.includes(query) ||
          normalizeText(artist.displayName).includes(query) ||
          artist.aliases?.some(alias => normalizeText(alias).includes(query)))
        : cache;
      const container = getElement('artistSliderContainer');
      if (!container) return;

      stopAutoScroll();
      container.classList.remove('slider-running', 'slider-paused');
      container.innerHTML = '';
      const currentFilter = getArtistFilter();
      const allCard = documentRef.createElement('div');
      allCard.className = 'artist-card' + (!currentFilter ? ' active' : '');
      allCard.tabIndex = 0;
      allCard.setAttribute('role', 'option');
      allCard.setAttribute('aria-selected', !currentFilter);
      const totalSongs = cache.reduce((sum, artist) => sum + artist.count, 0);
      allCard.innerHTML =
        `<div class="artist-card-avatar" style="background:linear-gradient(135deg,#1a202c,#2d3748);"><div class="avatar-initials">♪</div></div><div class="artist-card-name">همه</div><div class="artist-card-count">${totalSongs} ترانه</div>`;
      allCard.onclick = () => {
        setArtistFilter(null);
        container.querySelectorAll('.artist-card').forEach(card => card.classList.remove('active'));
        allCard.classList.add('active');
        render();
        updateActiveFilters();
      };
      allCard.onkeydown = event => {
        if (event.key === 'Enter') allCard.onclick();
      };
      container.appendChild(allCard);

      for (const artist of filtered) {
        const card = documentRef.createElement('div');
        const key = artist.normalizedName;
        const active = currentFilter === key;
        card.className = 'artist-card' + (active ? ' active' : '');
        card.tabIndex = 0;
        card.setAttribute('role', 'option');
        card.setAttribute('aria-selected', active);
        card.setAttribute('aria-label', `${artist.displayName} - ${artist.count} ترانه`);
        card.dataset.artistKey = key;
        const image = getArtistImage(key);
        const color = avatarColor(key);
        const initials = getInitials(artist.displayName);
        const avatar = image
          ? `<img src="${image}" alt="${escapeHtml(artist.displayName)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=avatar-initials style=background:${color}>${initials}</div>'">`
          : `<div class="avatar-initials" style="background:${color}">${initials}</div>`;
        card.innerHTML =
          `<div class="artist-card-avatar">${avatar}</div><span class="artist-card-tooltip">${escapeHtml(artist.displayName)}</span><button class="artist-card-menu-btn" aria-label="عملیات خواننده">⋯</button>`;
        card.onmouseenter = () => { sliderPaused = true; };
        card.onmouseleave = () => { sliderPaused = false; };
        card.onclick = event => {
          if (event.target.closest('.artist-card-menu-btn')) {
            event.stopPropagation();
            showArtistContext(event, key);
            return;
          }
          card.classList.remove('clicked');
          void card.offsetWidth;
          card.classList.add('clicked');
          globalScope.setTimeout(() => card.classList.remove('clicked'), 600);
          setArtistFilter(getArtistFilter() === key ? null : key);
          container.querySelectorAll('.artist-card').forEach(item => item.classList.remove('active'));
          if (getArtistFilter()) card.classList.add('active');
          else container.querySelector('.artist-card')?.classList.add('active');
          render();
          updateActiveFilters();
        };
        card.onkeydown = event => {
          if (event.key === 'Enter') card.onclick(event);
        };
        container.appendChild(card);
      }

      if (!filtered.length && query) {
        container.innerHTML = '<div class="artist-slider-empty">خواننده مورد نظر یافت نشد</div>';
      }
      if (filtered.length) {
        requestFrame(() => {
          positionCards3D();
          if (query) {
            stopAutoScroll();
            const cards = container.querySelectorAll('.artist-card');
            const angleStep = 360 / Math.max(cards.length, 1);
            const targetAngle = angleStep;
            const diff = targetAngle - (sliderAngle % 360);
            const normalizedDiff = ((diff % 360) + 540) % 360 - 180;
            sliderAngle += normalizedDiff;
            container.style.transition =
              'transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            container.style.transform = `rotateY(${-sliderAngle}deg)`;
            globalScope.setTimeout(() => { container.style.transition = ''; }, 850);
          } else {
            startAutoScroll();
          }
        });
      } else {
        stopAutoScroll();
      }
      const countLabel = getElement('artistCountLabel');
      if (countLabel) countLabel.textContent = `(${filtered.length} خواننده)`;
      updateSliderNav();
    }

    function renderArtists() {
      const cache = buildArtistList();
      setArtistCache(cache);
      filterArtists();
    }

    function toggleArtistSection() {
      const collapsed = !getSectionCollapsed();
      setSectionCollapsed(collapsed);
      storage?.setItem('arch_artists_collapsed', collapsed);
      getElement('artistSliderSection')?.classList.toggle('collapsed', collapsed);
    }

    function toggleFullscreen() {
      const fullscreen = !getFullscreen();
      setFullscreen(fullscreen);
      const dialog = documentRef?.querySelector('.archive-modal-dialog');
      if (!dialog) return;
      if (fullscreen) {
        dialog.style.width = '100vw';
        dialog.style.height = '100vh';
        dialog.style.maxWidth = '100vw';
        dialog.style.maxHeight = '100vh';
        dialog.style.borderRadius = '0';
      } else {
        dialog.style.width = 'min(96vw,1600px)';
        dialog.style.height = 'min(92vh,1000px)';
        dialog.style.maxWidth = '';
        dialog.style.maxHeight = 'min(92vh,1000px)';
        dialog.style.borderRadius = '';
      }
    }

    function bindArtistSection() {
      const section = getElement('artistSliderSection');
      if (section) section.classList.toggle('collapsed', getSectionCollapsed());
      const searchInput = getElement('artistSearchInput');
      if (searchInput && !searchInput._archBound) {
        searchInput._archBound = true;
        let debounce = null;
        searchInput.addEventListener('input', () => {
          globalScope.clearTimeout(debounce);
          debounce = globalScope.setTimeout(filterArtists, 200);
        });
        const track = documentRef?.querySelector('.artist-slider-track');
        if (track) {
          track.addEventListener('wheel', handleWheel, { passive: false });
          track.addEventListener('mouseenter', () => { sliderPaused = true; });
          track.addEventListener('mouseleave', () => { sliderPaused = false; });
        }
        const container = getElement('artistSliderContainer');
        if (container) {
          container.addEventListener('keydown', event => {
            if (event.key === 'ArrowRight') {
              slide(1);
              event.preventDefault();
            }
            if (event.key === 'ArrowLeft') {
              slide(-1);
              event.preventDefault();
            }
          });
        }
        const modal = getElement('archiveModal');
        if (modal) {
          modal.addEventListener('click', event => {
            if (!event.target.closest('.artist-ctx-menu') &&
                !event.target.closest('.artist-card-menu-btn')) {
              getElement('artistCtxMenu')?.classList.remove('show');
            }
          });
        }
        const divider = getElement('artistResizeDivider');
        if (divider && !divider._archBound) {
          divider._archBound = true;
          divider.style.touchAction = 'none';
          let pointerId = null;
          let startY = 0;
          let startHeight = 0;
          const stopResize = () => {
            if (pointerId === null) return;
            pointerId = null;
            divider.classList.remove('active');
            if (documentRef?.body) {
              documentRef.body.style.cursor = '';
              documentRef.body.style.userSelect = '';
            }
          };
          divider.addEventListener('pointerdown', event => {
            pointerId = event.pointerId;
            startY = event.clientY;
            const artistSection = getElement('artistSliderSection');
            startHeight = artistSection ? artistSection.offsetHeight : 200;
            divider.classList.add('active');
            if (documentRef?.body) {
              documentRef.body.style.cursor = 'ns-resize';
              documentRef.body.style.userSelect = 'none';
            }
            divider.setPointerCapture?.(event.pointerId);
            event.preventDefault();
          });
          divider.addEventListener('pointermove', event => {
            if (pointerId !== event.pointerId) return;
            const height = Math.max(80, Math.min(500, startHeight + event.clientY - startY));
            const artistSection = getElement('artistSliderSection');
            if (!artistSection) return;
            artistSection.style.maxHeight = height + 'px';
            artistSection.style.height = height + 'px';
            const body = getElement('artistSliderBody');
            if (body) body.style.maxHeight = (height - 44) + 'px';
          });
          divider.addEventListener('pointerup', event => {
            if (pointerId !== event.pointerId) return;
            divider.releasePointerCapture?.(event.pointerId);
            stopResize();
          });
          divider.addEventListener('pointercancel', stopResize);
        }
      }
      resetAutoScroll();
    }

    return Object.freeze({
      buildArtistList,
      renderArtists,
      filterArtists,
      showArtistContext,
      artistContextAction,
      positionCards3D,
      slide,
      updateSliderNav,
      startAutoScroll,
      stopAutoScroll,
      resetAutoScroll,
      handleWheel,
      toggleArtistSection,
      toggleFullscreen,
      bindArtistSection
    });
  }

  const service = Object.freeze({ create });
  globalScope.ArchiveArtistUiService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
