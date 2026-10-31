/* ==========================================================================
   APP PRINCIPAL
   Une cámara → gestos → acciones del reproductor, y los botones de la interfaz.
   Cada gesto dispara una acción concreta (ver ACTIONS).
   ========================================================================== */
(() => {
  const $ = id => document.getElementById(id);
  let settings = null;
  let engine = null;

  /* ---------- Acciones: una función concreta por gesto/botón ---------- */
  const ACTIONS = {
    'toggle-play': () => {
      const playing = RG_PLAYER.togglePlay();
      RG_UI.toast(playing ? '▶' : '❚❚', playing ? 'Reproducir' : 'Pausa');
    },
    'mute': () => {
      const m = RG_PLAYER.toggleMute();
      RG_UI.toast(m ? '🔇' : '🔊', m ? 'Silenciado' : 'Sonido activado');
    },
    'next': () => { RG_PLAYER.next(); RG_UI.toast('⏭', 'Siguiente video'); },
    'prev': () => { RG_PLAYER.prev(); RG_UI.toast('⏮', 'Video anterior'); },
    'seek+': () => { RG_PLAYER.seekBy(settings.seekStep); RG_UI.toast('⏩', `+${settings.seekStep} s`); },
    'seek-': () => { RG_PLAYER.seekBy(-settings.seekStep); RG_UI.toast('⏪', `−${settings.seekStep} s`); },
    'vol+': () => {
      RG_PLAYER.volumeBy(settings.volumeStep);
      RG_UI.toast('🔊', Math.round(RG_PLAYER.el.volume * 100) + '%');
    },
    'vol-': () => {
      RG_PLAYER.volumeBy(-settings.volumeStep);
      RG_UI.toast('🔉', Math.round(RG_PLAYER.el.volume * 100) + '%');
    },
    'menu': () => {
      RG_UI.toggleSettings();
      RG_UI.toast('⚙', RG_UI.isSettingsOpen() ? 'Ajustes abiertos' : 'Ajustes cerrados');
    },
    'fullscreen': () => {
      RG_PLAYER.toggleFullscreen();
      RG_UI.toast('⛶', 'Pantalla completa');
    },
    'playlist': () => RG_UI.togglePlaylist()
  };

  function dispatch(name) {
    const fn = ACTIONS[name];
    if (!fn) return;
    fn();
    RG_UI.showControls();
  }

  /* ---------- Aplicar ajustes (globales y por dispositivo) ---------- */
  function applyVisual(s) {
    const b = document.body.classList;
    b.toggle('fx-reduced', s.effects === 'reducidos');
    b.toggle('fx-min', s.effects === 'mínimos');
    b.toggle('no-preview', !s.showPreview);
    document.documentElement.style.setProperty('--pip-w', s.previewSize + 'px');
    RG_POINTER.applySettings(s);
    RG_VISION.applySettings(s);
    engine.setOptions({ holdMs: s.holdMs });
  }

  function onSettingsChange(key, value) {
    if (key === '__reset') {
      settings = RG_SETTINGS.get();
    } else if (key === 'preset') {
      settings = RG_SETTINGS.applyPreset(value);
    } else {
      settings = RG_SETTINGS.set({ [key]: value });
    }
    applyVisual(settings);
    RG_UI.updateVolume();
  }

  /* ---------- Frames de la cámara → motor de gestos ---------- */
  function onFrame({ landmarks, fps, now }) {
    $('det-fps').textContent = fps + ' FPS';
    $('det-hand').textContent = landmarks ? 'Mano detectada' : 'Sin mano';
    if (landmarks) RG_UI.showControls();   // la mano también despierta la barra de control
    engine.update(landmarks, now);
  }

  /* ---------- Inicio: se necesita un toque para activar cámara y sonido ---------- */
  async function start() {
    $('btn-start').disabled = true;
    RG_PLAYER.load(0, true);
    try {
      await RG_VISION.start(settings, {
        onFrame,
        onStatus: t => { $('status').textContent = t; }
      });
      if (RG_VISION.isReady()) {
        $('status').textContent = 'Listo. Muestra tu mano.';
        setTimeout(hideStart, 600);
        RG_UI.toast('✋', 'Control por gestos activo');
      } else {
        $('btn-start').disabled = false;
        $('btn-skip').hidden = false;
        RG_UI.toast('⚠', 'IA de manos no disponible. Usa el mouse o el teclado.');
      }
    } catch (err) {
      $('status').textContent = err.message;
      $('btn-start').disabled = false;
      $('btn-skip').hidden = false;
    }
  }

  function hideStart() { $('start').classList.add('hidden'); }

  /* ---------- Teclado y botones (respaldo sin cámara) ---------- */
  const KEYS = {
    ' ': 'toggle-play', 'k': 'toggle-play',
    'ArrowRight': 'seek+', 'ArrowLeft': 'seek-',
    'ArrowUp': 'vol+', 'ArrowDown': 'vol-',
    'm': 'mute', 'n': 'next', 'b': 'prev',
    's': 'menu', 'f': 'fullscreen', 'l': 'playlist'
  };

  function bindUI() {
    $('btn-start').addEventListener('click', start);
    $('btn-skip').addEventListener('click', hideStart);
    $('btn-play').addEventListener('click', () => dispatch('toggle-play'));
    $('btn-prev').addEventListener('click', () => dispatch('prev'));
    $('btn-next').addEventListener('click', () => dispatch('next'));
    $('btn-mute').addEventListener('click', () => dispatch('mute'));
    $('btn-settings').addEventListener('click', () => dispatch('menu'));
    $('btn-playlist').addEventListener('click', () => dispatch('playlist'));
    $('btn-fs').addEventListener('click', () => dispatch('fullscreen'));
    $('btn-close-settings').addEventListener('click', () => RG_UI.toggleSettings(false));
    $('btn-close-playlist').addEventListener('click', () => RG_UI.togglePlaylist(false));
    $('btn-pip-toggle').addEventListener('click', () => onSettingsChange('showPreview', !settings.showPreview));
    $('missing-close').addEventListener('click', () => $('missing').classList.remove('show'));

    window.addEventListener('keydown', e => {
      if (e.target && e.target.tagName === 'INPUT') return;
      if (e.key === 'Escape') { RG_UI.toggleSettings(false); RG_UI.togglePlaylist(false); return; }
      const name = KEYS[e.key];
      if (name) { e.preventDefault(); dispatch(name); }
    });
  }

  function init() {
    settings = RG_SETTINGS.load();
    engine = new GestureEngine({
      onCursor: (x, y, lm) => RG_POINTER.onCursor(x, y, lm),
      onPinchStart: (x, y) => RG_POINTER.onPinchStart(x, y),
      onPinchMove: (x, y) => RG_POINTER.onPinchMove(x, y),
      onPinchEnd: () => RG_POINTER.onPinchEnd(),
      onAction: dispatch,
      onGesture: id => RG_UI.highlightGesture(id)
    });

    RG_POINTER.init(settings, {
      onRipple: (x, y) => RG_UI.ripple(x, y)
    });
    RG_UI.init({ onSettingsChange });
    RG_PLAYER.load(0, false);
    applyVisual(settings);
    bindUI();

    // Si el navegador bloquea el video o la cámara, la app sigue usable con mouse/teclado
    RG_PLAYER.on('autoplay-blocked', () => {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
