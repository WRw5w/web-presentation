(() => {
  'use strict';

  const STAGE_WIDTH = 1600;
  const STAGE_HEIGHT = 900;
  const shell = document.getElementById('deck-shell');
  const deck = document.getElementById('deck');
  const slides = [...document.querySelectorAll('.slide')];
  const ui = document.getElementById('deck-ui');
  const overview = document.getElementById('overview');
  const overviewGrid = document.getElementById('overview-grid');
  const qaReport = document.getElementById('qa-report');
  const params = new URLSearchParams(location.search);
  const cameraState = new WeakMap();
  const scrollState = new WeakMap();
  const revealState = new WeakMap();
  let currentSlide = clampNumber(Number(params.get('slide') || 1) - 1, 0, slides.length - 1);
  let uiTimer = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let reviewMode = false;
  let reviewTool = 'pen';
  const reviewStrokes = slides.map(() => []);
  const reviewCanvases = [];

  document.documentElement.dataset.reducedMotion = String(params.get('reducedMotion') === '1' || params.get('motion') === '0');
  document.documentElement.dataset.export = String(params.get('export') === '1');

  function clampNumber(value, min, max) {
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
  }

  function fitDeck() {
    const scale = Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT);
    document.documentElement.style.setProperty('--deck-scale', scale.toFixed(6));
    shell.dataset.scale = String(scale);
  }

  function buildChrome() {
    slides.forEach((slide, index) => {
      const chrome = document.createElement('div');
      chrome.className = 'slide-chrome';
      chrome.innerHTML = `
        <span class="chrome-section">${slide.dataset.section || ''}</span>
        <span class="chrome-title">${slide.dataset.title || ''}</span>
        <div class="chrome-footer">
          <span class="footer-brand">AUTO RESEARCH × FOREAGENT</span>
          <span class="footer-line"><i style="--progress:${((index + 1) / slides.length) * 100}%"></i></span>
          <span class="footer-page">${String(index + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}</span>
        </div>`;
      slide.appendChild(chrome);
    });
  }

  function buildOverview() {
    const fragment = document.createDocumentFragment();
    slides.forEach((slide, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'overview-item';
      button.dataset.slide = String(index);
      button.innerHTML = `<span>${String(index + 1).padStart(2, '0')} · ${slide.dataset.section || ''}</span><strong>${slide.dataset.title || ''}</strong>`;
      button.addEventListener('click', () => {
        showSlide(index, { resetCamera: true });
        toggleOverview(false);
      });
      fragment.appendChild(button);
    });
    overviewGrid.appendChild(fragment);
  }

  function initReviewMode() {
    const tools = document.getElementById('review-tools');
    const color = document.getElementById('review-color');
    const width = document.getElementById('review-width');
    slides.forEach((slide, slideIndex) => {
      const canvas = document.createElement('canvas');
      canvas.className = 'review-canvas'; canvas.width = STAGE_WIDTH; canvas.height = STAGE_HEIGHT;
      canvas.setAttribute('aria-label', `第 ${slideIndex + 1} 页批改画布`); slide.appendChild(canvas); reviewCanvases.push(canvas);
      let activeStroke = null;
      const point = event => { const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * STAGE_WIDTH / rect.width, y: (event.clientY - rect.top) * STAGE_HEIGHT / rect.height }; };
      canvas.addEventListener('pointerdown', event => { if (!reviewMode || event.button !== 0) return; event.preventDefault(); activeStroke = { tool: reviewTool, color: color.value, width: Number(width.value), points: [point(event)] }; reviewStrokes[slideIndex].push(activeStroke); canvas.setPointerCapture(event.pointerId); });
      canvas.addEventListener('pointermove', event => { if (!activeStroke || !canvas.hasPointerCapture(event.pointerId)) return; activeStroke.points.push(point(event)); renderReviewPage(slideIndex); });
      const finish = event => { if (!activeStroke) return; activeStroke.points.push(point(event)); activeStroke = null; renderReviewPage(slideIndex); };
      canvas.addEventListener('pointerup', finish); canvas.addEventListener('pointercancel', () => { activeStroke = null; });
    });
    tools.addEventListener('click', event => {
      const action = event.target.closest('button')?.dataset.reviewAction; if (!action) return;
      if (action === 'pen' || action === 'eraser') { reviewTool = action; tools.querySelectorAll('[data-review-action="pen"], [data-review-action="eraser"]').forEach(button => button.classList.toggle('active', button.dataset.reviewAction === action)); }
      else if (action === 'undo') { reviewStrokes[currentSlide].pop(); renderReviewPage(currentSlide); }
      else if (action === 'clear') { reviewStrokes[currentSlide] = []; renderReviewPage(currentSlide); }
    });
  }

  function renderReviewPage(slideIndex) {
    const canvas = reviewCanvases[slideIndex]; const context = canvas?.getContext('2d'); if (!context) return;
    context.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
    reviewStrokes[slideIndex].forEach(stroke => { if (stroke.points.length < 2) return; context.save(); context.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over'; context.strokeStyle = stroke.color; context.lineWidth = stroke.tool === 'eraser' ? stroke.width * 4 : stroke.width; context.lineCap = 'round'; context.lineJoin = 'round'; context.beginPath(); context.moveTo(stroke.points[0].x, stroke.points[0].y); stroke.points.slice(1).forEach(point => context.lineTo(point.x, point.y)); context.stroke(); context.restore(); });
  }

  function toggleReviewMode(force) {
    reviewMode = typeof force === 'boolean' ? force : !reviewMode; document.body.classList.toggle('review-mode', reviewMode); document.getElementById('review-tools').hidden = !reviewMode;
    const toggle = ui.querySelector('[data-action="review"]'); toggle.setAttribute('aria-pressed', String(reviewMode)); toggle.setAttribute('aria-label', reviewMode ? '关闭批改者模式' : '开启批改者模式'); announceUi();
  }

  function initZoomSurfaces() {
    document.querySelectorAll('[data-zoomable]').forEach(surface => {
      const world = surface.querySelector('.diagram-world');
      let cameras = [];
      try { cameras = JSON.parse(surface.dataset.cameras || '[]'); } catch (_) { cameras = []; }
      if (!cameras.length) cameras = [{ x: 0, y: 0, scale: 1, label: '全局' }];
      cameraState.set(surface, {
        cameras,
        cameraIndex: 0,
        x: cameras[0].x || 0,
        y: cameras[0].y || 0,
        scale: cameras[0].scale || 1,
        manual: false,
        pointerId: null,
        dragStart: null,
        world
      });
      applyCamera(surface, 0, false);
      world?.querySelectorAll('img').forEach(img => { img.draggable = false; });
      surface.addEventListener('dragstart', event => event.preventDefault());

      surface.addEventListener('wheel', event => {
        if (!surface.closest('.slide.active')) return;
        event.preventDefault();
        const state = cameraState.get(surface);
        const minScale = Number(surface.dataset.minScale) || .72;
        const maxScale = Number(surface.dataset.maxScale) || 2.75;
        const nextScale = clampNumber(state.scale * (event.deltaY > 0 ? .9 : 1.1), minScale, maxScale);
        const rect = surface.getBoundingClientRect();
        const deckScale = Number(shell.dataset.scale) || 1;
        const pointerX = (event.clientX - rect.left - rect.width / 2) / deckScale;
        const pointerY = (event.clientY - rect.top - rect.height / 2) / deckScale;
        const ratio = nextScale / state.scale;
        state.x = pointerX - (pointerX - state.x) * ratio;
        state.y = pointerY - (pointerY - state.y) * ratio;
        state.scale = nextScale;
        state.manual = true;
        renderCamera(surface);
      }, { passive: false });

      surface.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        event.preventDefault();
        const state = cameraState.get(surface);
        state.pointerId = event.pointerId;
        state.dragStart = { clientX: event.clientX, clientY: event.clientY, x: state.x, y: state.y };
        surface.setPointerCapture(event.pointerId);
        surface.classList.add('dragging');
      });
      surface.addEventListener('pointermove', event => {
        const state = cameraState.get(surface);
        if (state.pointerId !== event.pointerId || !state.dragStart) return;
        const deckScale = Number(shell.dataset.scale) || 1;
        state.x = state.dragStart.x + (event.clientX - state.dragStart.clientX) / deckScale;
        state.y = state.dragStart.y + (event.clientY - state.dragStart.clientY) / deckScale;
        state.manual = true;
        renderCamera(surface);
      });
      const releasePointer = event => {
        const state = cameraState.get(surface);
        if (state.pointerId !== event.pointerId) return;
        state.pointerId = null;
        state.dragStart = null;
        surface.classList.remove('dragging');
      };
      surface.addEventListener('pointerup', releasePointer);
      surface.addEventListener('pointercancel', releasePointer);

      surface.addEventListener('dblclick', event => {
        const state = cameraState.get(surface);
        const node = event.target.closest('.diagram-node, .action, .innovation-card, .arch-column, .match, .formula-node');
        if (!node) return;
        const focus = (node.dataset.focus || '').split(',').map(Number);
        if (focus.length === 3 && focus.every(Number.isFinite)) {
          state.x = focus[0]; state.y = focus[1]; state.scale = focus[2];
        } else {
          const surfaceRect = surface.getBoundingClientRect();
          const nodeRect = node.getBoundingClientRect();
          const deckScale = Number(shell.dataset.scale) || 1;
          state.x += ((surfaceRect.left + surfaceRect.width / 2) - (nodeRect.left + nodeRect.width / 2)) / deckScale;
          state.y += ((surfaceRect.top + surfaceRect.height / 2) - (nodeRect.top + nodeRect.height / 2)) / deckScale;
          state.scale = Math.max(1.65, Math.min(2.25, state.scale * 1.25));
        }
        state.manual = true;
        renderCamera(surface);
      });
    });
  }

  function currentZoomSurface() {
    return slides[currentSlide]?.querySelector('[data-zoomable]') || null;
  }

  function initScrollSurfaces() {
    document.querySelectorAll('[data-scrollable]').forEach(surface => {
      let stops = [];
      try { stops = JSON.parse(surface.dataset.scrollStops || '[]'); } catch (_) { stops = []; }
      if (!stops.length) stops = [...surface.querySelectorAll('[data-scroll-stop]')].map((stop, index) => ({
        top: stop.offsetTop,
        label: stop.dataset.label || `段落 ${index + 1}`
      }));
      if (!stops.length) stops = [{ top: 0, label: '全局' }];
      scrollState.set(surface, { stops, index: 0, userScrollTimer: 0 });
      surface.addEventListener('scroll', () => {
        const state = scrollState.get(surface);
        if (!state) return;
        clearTimeout(state.userScrollTimer);
        state.userScrollTimer = window.setTimeout(() => {
          const nearest = state.stops.reduce((best, stop, index) => {
            const distance = Math.abs(surface.scrollTop - stop.top);
            return distance < best.distance ? { index, distance } : best;
          }, { index: state.index, distance: Infinity });
          state.index = nearest.index;
          renderScrollBadge(surface);
          syncUrl();
        }, 90);
      }, { passive: true });
      applyScrollStop(surface, 0, false);
    });
  }

  function currentScrollSurface() {
    return slides[currentSlide]?.querySelector('[data-scrollable]') || null;
  }

  function applyScrollStop(surface, index, updateUrl = true) {
    const state = scrollState.get(surface);
    if (!state) return;
    state.index = clampNumber(index, 0, state.stops.length - 1);
    const stop = state.stops[state.index];
    surface.scrollTo({ top: stop.top || 0, behavior: document.documentElement.dataset.reducedMotion === 'true' ? 'auto' : 'smooth' });
    renderScrollBadge(surface);
    if (updateUrl) syncUrl();
  }

  function renderScrollBadge(surface) {
    const state = scrollState.get(surface);
    if (!state) return;
    const badge = surface.querySelector('.camera-badge');
    if (badge) {
      const stop = state.stops[state.index];
      badge.textContent = `段落 ${state.index + 1}/${state.stops.length} · ${stop.label || ''}`;
    }
  }

  function applyCamera(surface, index, updateUrl = true) {
    const state = cameraState.get(surface);
    if (!state) return;
    state.cameraIndex = clampNumber(index, 0, state.cameras.length - 1);
    const camera = state.cameras[state.cameraIndex];
    state.x = camera.x || 0;
    state.y = camera.y || 0;
    state.scale = camera.scale || 1;
    state.manual = false;
    renderCamera(surface);
    if (updateUrl) syncUrl();
  }

  function renderCamera(surface) {
    const state = cameraState.get(surface);
    if (!state) return;
    state.world.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) scale(${state.scale})`;
    surface.classList.toggle('camera-focused', state.cameraIndex > 0);
    const badge = surface.querySelector('.camera-badge');
    if (badge) {
      const camera = state.cameras[state.cameraIndex];
      badge.textContent = state.manual
        ? `自由镜头 · ${state.scale.toFixed(2)}×`
        : `镜头 ${state.cameraIndex + 1}/${state.cameras.length} · ${camera.label || ''}`;
    }
  }

  function replayForeAgent(surface) {
    if (!surface?.hasAttribute('data-foreagent')) return;
    surface.classList.remove('foreagent-ready');
    void surface.offsetWidth;
    if (document.documentElement.dataset.reducedMotion === 'true' || document.documentElement.dataset.export === 'true') {
      surface.classList.add('foreagent-ready');
      return;
    }
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => surface.classList.add('foreagent-ready')));
  }

  function advance() {
    const revealSlide = slides[currentSlide];
    if (revealSlide.hasAttribute('data-reveal') && !revealState.get(revealSlide)) {
      revealState.set(revealSlide, true);
      revealSlide.classList.add('is-revealed');
      return;
    }
    const scrollSurface = currentScrollSurface();
    if (scrollSurface) {
      const state = scrollState.get(scrollSurface);
      if (state.index < state.stops.length - 1) {
        applyScrollStop(scrollSurface, state.index + 1);
        return;
      }
    }
    const surface = currentZoomSurface();
    if (surface) {
      const state = cameraState.get(surface);
      if (state.cameraIndex < state.cameras.length - 1) {
        applyCamera(surface, state.cameraIndex + 1);
        return;
      }
    }
    showSlide(currentSlide + 1, { resetCamera: true });
  }

  function retreat() {
    const revealSlide = slides[currentSlide];
    if (revealSlide.hasAttribute('data-reveal') && revealState.get(revealSlide)) {
      revealState.set(revealSlide, false);
      revealSlide.classList.remove('is-revealed');
      return;
    }
    const scrollSurface = currentScrollSurface();
    if (scrollSurface) {
      const state = scrollState.get(scrollSurface);
      if (state.index > 0) {
        applyScrollStop(scrollSurface, state.index - 1);
        return;
      }
    }
    const surface = currentZoomSurface();
    if (surface) {
      const state = cameraState.get(surface);
      if (state.cameraIndex > 0) {
        applyCamera(surface, state.cameraIndex - 1);
        return;
      }
    }
    showSlide(currentSlide - 1, { resetCamera: true });
  }

  function showSlide(index, options = {}) {
    const next = clampNumber(index, 0, slides.length - 1);
    const old = currentSlide;
    currentSlide = next;
    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle('active', slideIndex === currentSlide);
      slide.classList.toggle('previous', slideIndex < currentSlide);
      slide.setAttribute('aria-hidden', String(slideIndex !== currentSlide));
    });
    if (slides[currentSlide].hasAttribute('data-reveal')) {
      const previewReveal = params.get('reveal') === '1';
      if (old !== currentSlide || previewReveal) {
        revealState.set(slides[currentSlide], previewReveal);
        slides[currentSlide].classList.toggle('is-revealed', previewReveal);
      }
    }
    if (slides[currentSlide].hasAttribute('data-whiteboard') && !reviewMode) toggleReviewMode(true);
    if (options.resetCamera) {
      const surface = currentZoomSurface();
      if (surface) applyCamera(surface, 0, false);
      const scrollSurface = currentScrollSurface();
      if (scrollSurface) applyScrollStop(scrollSurface, 0, false);
    }
    replayForeAgent(currentZoomSurface());
    document.title = `${String(currentSlide + 1).padStart(2, '0')} · ${slides[currentSlide].dataset.title}｜Auto Research`;
    deck.dataset.currentSlide = String(currentSlide + 1);
    updateOverviewSelection();
    syncUrl();
    if (old !== currentSlide) announceUi();
  }

  function resetCurrentCamera(global = false) {
    const scrollSurface = currentScrollSurface();
    if (scrollSurface) {
      const state = scrollState.get(scrollSurface);
      applyScrollStop(scrollSurface, global ? 0 : state.index);
      return;
    }
    const surface = currentZoomSurface();
    if (!surface) return;
    const state = cameraState.get(surface);
    applyCamera(surface, global ? 0 : state.cameraIndex);
  }

  function syncUrl() {
    if (params.get('noHistory') === '1') return;
    const next = new URLSearchParams(location.search);
    next.set('slide', String(currentSlide + 1));
    const surface = currentZoomSurface();
    if (surface) next.set('camera', String(cameraState.get(surface).cameraIndex + 1));
    else if (currentScrollSurface()) next.set('camera', String(scrollState.get(currentScrollSurface()).index + 1));
    else next.delete('camera');
    history.replaceState(null, '', `${location.pathname}?${next.toString()}${location.hash}`);
  }

  function toggleOverview(force) {
    const open = typeof force === 'boolean' ? force : overview.hidden;
    overview.hidden = !open;
    if (open) updateOverviewSelection();
  }

  function updateOverviewSelection() {
    overviewGrid.querySelectorAll('.overview-item').forEach((item, index) => item.classList.toggle('current', index === currentSlide));
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (_) { /* Browser may disallow fullscreen from file URLs. */ }
  }

  function announceUi() {
    if (document.documentElement.dataset.export === 'true') return;
    document.body.classList.add('ui-visible');
    clearTimeout(uiTimer);
    uiTimer = window.setTimeout(() => document.body.classList.remove('ui-visible'), 1400);
  }

  function handleKey(event) {
    if (!overview.hidden) {
      if (event.key === 'Escape' || event.key.toLowerCase() === 'o') {
        event.preventDefault();
        toggleOverview(false);
      }
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && reviewMode) {
      event.preventDefault(); reviewStrokes[currentSlide].pop(); renderReviewPage(currentSlide);
    } else if (event.key.toLowerCase() === 'd') {
      event.preventDefault(); toggleReviewMode();
    } else if (event.key === ' ' || event.key === 'ArrowRight' || event.key === 'PageDown') {
      event.preventDefault();
      if (event.shiftKey) retreat(); else advance();
    } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
      event.preventDefault();
      retreat();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      resetCurrentCamera(true);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      toggleFullscreen();
    } else if (event.key.toLowerCase() === 'o') {
      event.preventDefault();
      toggleOverview();
    } else if (event.key === 'Home') {
      event.preventDefault();
      showSlide(0, { resetCamera: true });
    } else if (event.key === 'End') {
      event.preventDefault();
      showSlide(slides.length - 1, { resetCamera: true });
    }
  }

  function bindUi() {
    ui.addEventListener('click', event => {
      const action = event.target.closest('button')?.dataset.action;
      if (action === 'prev') retreat();
      if (action === 'next') advance();
      if (action === 'overview') toggleOverview();
      if (action === 'fullscreen') toggleFullscreen();
      if (action === 'review') toggleReviewMode();
    });
    overview.addEventListener('click', event => {
      if (event.target === overview || event.target.closest('[data-action="overview-close"]')) toggleOverview(false);
    });
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousemove', announceUi, { passive: true });
    document.addEventListener('touchstart', event => {
      touchStartX = event.changedTouches[0].clientX;
      touchStartY = event.changedTouches[0].clientY;
    }, { passive: true });
    document.addEventListener('touchend', event => {
      const dx = event.changedTouches[0].clientX - touchStartX;
      const dy = event.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) dx < 0 ? advance() : retreat();
    }, { passive: true });
    window.addEventListener('resize', fitDeck, { passive: true });
    document.addEventListener('fullscreenchange', fitDeck);
  }

  function auditLayout() {
    const activeBefore = currentSlide;
    const issues = [];
    const scale = Number(shell.dataset.scale) || 1;
    slides.forEach((slide, slideIndex) => {
      const previousStyle = slide.getAttribute('style');
      slide.style.visibility = 'visible';
      slide.style.opacity = '0';
      slide.style.transform = 'none';
      slide.style.pointerEvents = 'none';
      const slideRect = slide.getBoundingClientRect();
      slide.querySelectorAll('[data-audit-bound]').forEach((element, elementIndex) => {
        const rect = element.getBoundingClientRect();
        const tolerance = 4 * scale;
        if (rect.left < slideRect.left - tolerance || rect.top < slideRect.top - tolerance || rect.right > slideRect.right + tolerance || rect.bottom > slideRect.bottom + tolerance) {
          issues.push({
            slide: slideIndex + 1,
            element: element.className || elementIndex,
            bounds: [rect.left, rect.top, rect.right, rect.bottom].map(value => Math.round(value)),
            stage: [slideRect.left, slideRect.top, slideRect.right, slideRect.bottom].map(value => Math.round(value))
          });
        }
      });
      if (previousStyle === null) slide.removeAttribute('style'); else slide.setAttribute('style', previousStyle);
    });
    const report = { status: issues.length ? 'fail' : 'pass', slideCount: slides.length, viewport: [innerWidth, innerHeight], stage: [STAGE_WIDTH, STAGE_HEIGHT], issues };
    document.documentElement.dataset.auditStatus = report.status;
    qaReport.textContent = JSON.stringify(report);
    showSlide(activeBefore, { resetCamera: false });
    return report;
  }

  async function boot() {
    fitDeck();
    buildChrome();
    buildOverview();
    initReviewMode();
    initZoomSurfaces();
    initScrollSurfaces();
    bindUi();
    const requestedCamera = clampNumber(Number(params.get('camera') || 1) - 1, 0, 99);
    showSlide(currentSlide, { resetCamera: true });
    const surface = currentZoomSurface();
    if (surface) applyCamera(surface, Math.min(requestedCamera, cameraState.get(surface).cameras.length - 1), false);
    const scrollSurface = currentScrollSurface();
    if (scrollSurface) applyScrollStop(scrollSurface, Math.min(requestedCamera, scrollState.get(scrollSurface).stops.length - 1), false);
    syncUrl();
    document.body.classList.add('show-help');
    window.setTimeout(() => document.body.classList.remove('show-help'), 3600);
    if (document.fonts?.ready) await document.fonts.ready;
    if (params.get('audit') === '1') auditLayout();
    document.documentElement.dataset.ready = 'true';
  }

  window.deckAudit = auditLayout;
  window.deckController = { showSlide, advance, retreat, applyCamera, currentSlide: () => currentSlide };
  boot();
})();
