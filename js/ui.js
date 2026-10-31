/* ==========================================================================
   INTERFAZ: barra de control, lista de videos, ajustes y guía de gestos
   ========================================================================== */
const RG_UI = (() => {
  const $ = id => document.getElementById(id);
  const fmt = s => {
    if (!isFinite(s) || s < 0) s = 0;
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
    const mm = String(m).padStart(h ? 2 : 1, '0');
    const ss = String(sec).padStart(2, '0');
    return (h ? h + ':' : '') + mm + ':' + ss;
  };

  let hideTimer = null;
  let settingsChange = () => {};
  let settingsOpen = false;
  let playlistOpen = false;

  function showControls() {
    document.body.classList.add('show-controls');
    clearTimeout(hideTimer);
    const ms = RG_SETTINGS.get().autoHideMs;
    hideTimer = setTimeout(() => {
      const keep = settingsOpen || playlistOpen || RG_PLAYER.el.paused;
      if (!keep) document.body.classList.remove('show-controls');
    }, ms);
  }

  function setFill(fillEl, knobEl, f) {
    const p = (Math.max(0, Math.min(1, f)) * 100).toFixed(3) + '%';
    if (fillEl) fillEl.style.width = p;
    if (knobEl) knobEl.style.left = p;
  }

  function updateProgress() {
    const v = RG_PLAYER.el;
    const dur = v.duration;
    const f = isFinite(dur) && dur > 0 ? v.currentTime / dur : 0;
    setFill($('seek-fill'), $('seek-knob'), f);
    $('time').textContent = fmt(v.currentTime) + ' / ' + fmt(dur);
  }

  function updateVolume() {
    const v = RG_PLAYER.el;
    const f = v.muted ? 0 : v.volume;
    setFill($('vol-fill'), $('vol-knob'), f);
    $('btn-mute').classList.toggle('active', v.muted);
    $('mute-icon').textContent = v.muted || v.volume === 0 ? '🔇' : (v.volume < 0.5 ? '🔉' : '🔊');
  }

  function updatePlayIcon() {
    $('play-icon').textContent = RG_PLAYER.el.paused ? '▶' : '❚❚';
    document.body.classList.toggle('is-paused', RG_PLAYER.el.paused);
  }

  function setTitle() {
    const v = RG_PLAYER.current();
    $('title').textContent = v.title;
    $('counter').textContent = (RG_PLAYER.currentIndex() + 1) + ' / ' + RG_PLAYER.list().length;
    renderPlaylist();
  }

  function renderPlaylist() {
    const box = $('playlist-list');
    box.innerHTML = '';
    RG_PLAYER.list().forEach((v, i) => {
      const b = document.createElement('button');
      b.className = 'list-item' + (i === RG_PLAYER.currentIndex() ? ' current' : '');
      b.dataset.hit = '';
      b.innerHTML = `<span class="li-num">${String(i + 1).padStart(2, '0')}</span><span class="li-title"></span>`;
      b.querySelector('.li-title').textContent = v.title;
      b.addEventListener('click', () => RG_PLAYER.load(i));
      box.appendChild(b);
    });
  }

  function togglePlaylist(force) {
    playlistOpen = typeof force === 'boolean' ? force : !playlistOpen;
    document.body.classList.toggle('playlist-open', playlistOpen);
    $('btn-playlist').classList.toggle('active', playlistOpen);
    showControls();
  }

  let toastTimer = null;
  function toast(icon, text) {
    const t = $('toast');
    t.innerHTML = '<span class="t-icon"></span><span class="t-text"></span>';
    t.querySelector('.t-icon').textContent = icon || '';
    t.querySelector('.t-text').textContent = text;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1400);
  }

  function ripple(x, y) {
    if (RG_SETTINGS.get().effects === 'mínimos') return;
    const r = document.createElement('div');
    r.className = 'ripple';
    r.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    $('ripples').appendChild(r);
    setTimeout(() => r.remove(), 600);
  }

  function highlightGesture(id) {
    const showGuide = RG_SETTINGS.get().showGestureGuide !== false;
    document.querySelectorAll('.guide-row').forEach(r => {
      r.classList.toggle('detected', showGuide && r.dataset.gesture === id);
    });
    const g = RG_CONFIG.gestures.find(x => x.id === id);
    $('det-gesture').textContent = g ? `${g.icon} ${g.name}` : '—';
    $('det-dot').classList.toggle('on', !!g && id !== 'none');
  }

  function field(label, control, hint) {
    const f = document.createElement('div');
    f.className = 'field';
    const head = document.createElement('div');
    head.className = 'field-head';
    head.innerHTML = `<span></span><em></em>`;
    head.querySelector('span').textContent = label;
    head.querySelector('em').textContent = hint || '';
    f.appendChild(head);
    f.appendChild(control);
    return f;
  }

  function segmented(key, options, current) {
    const wrap = document.createElement('div');
    wrap.className = 'seg';
    options.forEach(([val, text]) => {
      const b = document.createElement('button');
      b.dataset.hit = '';
      b.className = String(val) === String(current) ? 'active' : '';
      b.textContent = text;
      b.addEventListener('click', () => {
        const v = typeof val === 'number' ? val : (val === 'true' ? true : val === 'false' ? false : val);
        settingsChange(key, v);
        renderSettings();
      });
      wrap.appendChild(b);
    });
    return wrap;
  }

  function toggle(key, value) {
    const b = document.createElement('button');
    b.dataset.hit = '';
    b.className = 'switch' + (value ? ' on' : '');
    b.setAttribute('aria-pressed', String(!!value));
    b.innerHTML = '<i></i>';
    b.addEventListener('click', () => {
      settingsChange(key, !RG_SETTINGS.get()[key]);
      renderSettings();
    });
    return b;
  }

  function range(key, min, max, step, value, fmtFn) {
    const wrap = document.createElement('div');
    wrap.className = 'range-wrap';
    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'range';
    input.min = min; input.max = max; input.step = step;
    input.value = value;
    const out = document.createElement('output');
    out.textContent = fmtFn ? fmtFn(value) : value;
    const paint = () => {
      const pct = ((input.value - min) / (max - min)) * 100;
      input.style.setProperty('--p', pct + '%');
    };
    paint();
    input.addEventListener('input', () => {
      out.textContent = fmtFn ? fmtFn(input.value) : input.value;
      paint();
      settingsChange(key, +input.value);
    });
    wrap.appendChild(input);
    wrap.appendChild(out);
    return wrap;
  }

  function renderSettings() {
    const s = RG_SETTINGS.get();
    const d = RG_SETTINGS.detectDevice();
    const body = $('settings-body');
    body.innerHTML = '';

    const section = (title) => {
      const s = document.createElement('section');
      s.className = 'panel-section';
      s.innerHTML = `<h3></h3>`;
      s.querySelector('h3').textContent = title;
      body.appendChild(s);
      return s;
    };

    let sec = section('Dispositivo');
    const info = document.createElement('div');
    info.className = 'device-info';
    info.innerHTML = `<b></b><small></small>`;
    info.querySelector('b').textContent = d.type;
    info.querySelector('small').textContent = `${d.label} · recomendado: ${RG_CONFIG.presets[d.recommended].label}`;
    sec.appendChild(info);
    const presetOpts = [['auto', 'Auto']].concat(Object.keys(RG_CONFIG.presets).map(k => [k, RG_CONFIG.presets[k].label]));
    sec.appendChild(field('Perfil de rendimiento', segmented('preset', presetOpts, s.preset), 'se guarda para este dispositivo'));
    const reset = document.createElement('button');
    reset.className = 'btn-ghost';
    reset.dataset.hit = '';
    reset.textContent = 'Restablecer este dispositivo';
    reset.addEventListener('click', () => { RG_SETTINGS.reset(); renderSettings(); settingsChange('__reset'); toast('↺', 'Ajustes restablecidos'); });
    sec.appendChild(reset);

    sec = section('Rendimiento');
    sec.appendChild(field('Resolución de análisis', segmented('width', [[256, '256'], [320, '320'], [400, '400'], [480, '480'], [640, '640']], s.width), 'menos = más fluido'));
    sec.appendChild(field('Cuadros por segundo', segmented('fps', [[10, '10'], [15, '15'], [24, '24'], [30, '30']], s.fps)));
    sec.appendChild(field('Modelo de IA', segmented('complexity', [[0, 'Ligero'], [1, 'Preciso']], s.complexity)));
    sec.appendChild(field('Confianza de detección', range('minDetect', 0.3, 0.9, 0.05, s.minDetect, v => (+v).toFixed(2))));
    sec.appendChild(field('Sensibilidad de gestos', range('gestureSensitivity', 0.7, 1.5, 0.05, s.gestureSensitivity ?? 1, v => (+v).toFixed(2)), 'más alta = más reactiva'));
    sec.appendChild(field('Umbral de pellizco', range('pinchThreshold', 0.22, 0.42, 0.01, s.pinchThreshold ?? 0.3, v => (+v).toFixed(2)), 'evita clics accidentales'));
    sec.appendChild(field('Umbral de deslizamiento', range('swipeThreshold', 0.06, 0.25, 0.01, s.swipeThreshold ?? 0.12, v => (+v).toFixed(2)), 'controla rebotes al mover la mano'));
    sec.appendChild(field('Confirmación de gesto', range('confirmMs', 60, 250, 10, s.confirmMs ?? 120, v => v + ' ms')));
    sec.appendChild(field('Repetición de volumen', range('repeatMs', 150, 500, 10, s.repeatMs ?? 260, v => v + ' ms')));

    sec = section('Puntero (mouse con la mano)');
    sec.appendChild(field('Suavizado', range('smoothing', 0, 1, 0.05, s.smoothing, v => Math.round(v * 100) + '%'), 'más = más estable'));
    sec.appendChild(field('Zona de alcance', range('margin', 0, 0.3, 0.01, s.margin, v => Math.round(v * 100) + '%'), 'llega a las esquinas'));
    sec.appendChild(field('Tiempo para activar gestos', range('holdMs', 200, 900, 50, s.holdMs, v => v + ' ms')));
    sec.appendChild(field('Mostrar mano en pantalla', toggle('showHand', s.showHand)));
    sec.appendChild(field('Mostrar puntero virtual', toggle('showCursor', s.showCursor !== false)));

    sec = section('Comportamiento');
    sec.appendChild(field('Pausar al perder la mano', toggle('pauseOnNoHand', !!s.pauseOnNoHand)));
    sec.appendChild(field('Tiempo sin mano para pausar', range('noHandPauseMs', 800, 4000, 100, s.noHandPauseMs ?? 1800, v => v + ' ms')));

    sec = section('Interfaz');
    sec.appendChild(field('Mini cámara de diagnóstico', toggle('showPreview', s.showPreview)));
    sec.appendChild(field('Tamaño de la mini cámara', segmented('previewSize', [[160, 'S'], [200, 'M'], [240, 'L'], [280, 'XL']], s.previewSize)));
    sec.appendChild(field('Dibujar esqueleto en la cámara', toggle('showLandmarks', s.showLandmarks)));
    sec.appendChild(field('Mostrar guía de gestos', toggle('showGestureGuide', s.showGestureGuide !== false)));
    sec.appendChild(field('Efectos visuales', segmented('effects', [['completos', 'Completos'], ['reducidos', 'Reducidos'], ['mínimos', 'Mínimos']], s.effects), 'mínimos = más fluido'));
    sec.appendChild(field('Ocultar controles tras', range('autoHideMs', 1000, 6000, 500, s.autoHideMs, v => (v / 1000).toFixed(1) + ' s')));

    sec = section('Gestos y funciones');
    if (s.showGestureGuide !== false) {
      const box = document.createElement('div');
      box.className = 'guide';
      sec.appendChild(box);
      renderGuideInto(box);
    } else {
      const note = document.createElement('div');
      note.className = 'empty-note';
      note.textContent = 'La guía está oculta. Puedes activarla desde Interfaz.';
      sec.appendChild(note);
    }
  }

  function renderGuideInto(box) {
    box.innerHTML = '';
    RG_CONFIG.gestures.forEach(g => {
      const row = document.createElement('div');
      row.className = 'guide-row';
      row.dataset.gesture = g.id;
      row.innerHTML = `<span class="g-icon"></span><div class="g-text"><b></b><small></small></div>`;
      row.querySelector('.g-icon').textContent = g.icon;
      row.querySelector('b').textContent = g.name;
      row.querySelector('small').textContent = g.action;
      box.appendChild(row);
    });
  }

  function toggleSettings(force) {
    settingsOpen = typeof force === 'boolean' ? force : !settingsOpen;
    document.body.classList.toggle('settings-open', settingsOpen);
    $('btn-settings').classList.toggle('active', settingsOpen);
    if (settingsOpen) renderSettings();
    showControls();
  }

  function bindSliders() {
    document.querySelectorAll('[data-slider]').forEach(el => {
      let down = false;
      const set = e => {
        const r = el.getBoundingClientRect();
        const f = Math.max(0, Math.min(1, (e.clientX - r.left) / (r.width || 1)));
        el.dispatchEvent(new CustomEvent('rg-slide', { detail: f }));
      };
      el.addEventListener('pointerdown', e => { down = true; set(e); showControls(); });
      window.addEventListener('pointermove', e => { if (down) set(e); });
      window.addEventListener('pointerup', () => { down = false; });
      el.addEventListener('rg-slide', e => {
        if (el.dataset.slider === 'seek') RG_PLAYER.seekFraction(e.detail);
        if (el.dataset.slider === 'volume') { RG_PLAYER.setVolume(e.detail); }
      });
    });
  }

  function init(opts) {
    settingsChange = opts.onSettingsChange;
    renderPlaylist();
    bindSliders();

    RG_PLAYER.on('change', setTitle);
    RG_PLAYER.on('volume', updateVolume);
    RG_PLAYER.on('tick', () => { updatePlayIcon(); updateProgress(); });
    RG_PLAYER.on('missing', v => {
      $('missing').classList.add('show');
      $('missing-text').textContent = `No se encontró "${v.src}". Copia el video a la carpeta videos/.`;
    });
    RG_PLAYER.on('autoplay-blocked', () => toast('🔇', 'Toca la pantalla para activar el sonido'));
    RG_PLAYER.on('fullscreen-blocked', () => toast('⛶', 'Pantalla completa bloqueada por el navegador'));
    RG_PLAYER.on('fullscreen', () => document.body.classList.toggle('fs', RG_PLAYER.isFullscreen()));

    ['pointermove', 'pointerdown', 'touchstart', 'keydown'].forEach(ev =>
      window.addEventListener(ev, showControls, { passive: true }));

    const loop = () => { if (!RG_PLAYER.el.paused) updateProgress(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);

    setTitle();
    updateVolume();
    updatePlayIcon();
    showControls();
  }

  return {
    init, toast, ripple, highlightGesture, togglePlaylist, toggleSettings,
    showControls, renderSettings, updatePlayIcon, updateVolume, setTitle, isSettingsOpen: () => settingsOpen
  };
})();
