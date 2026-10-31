(() => {
  const $ = id => document.getElementById(id);
  let settings = null;
  let engine = null;
  let noHandPauseTimer = null;

  const farewellSchool = 'CEJA LIDORO QUINTEROS\nSUBSEDE N°1 LOS RALOS';

  function drawHeartPath(ctx, x, y, size) {
    ctx.beginPath();
    ctx.moveTo(x, y + size * 0.3);
    ctx.bezierCurveTo(x - size, y - size * 0.4, x - size * 1.8, y + size * 0.1, x, y + size * 1.3);
    ctx.bezierCurveTo(x + size * 1.8, y + size * 0.1, x + size, y - size * 0.4, x, y + size * 0.3);
    ctx.closePath();
    ctx.fill();
  }

  function wrapText(ctx, text, maxWidth, lineHeight) {
    const paragraphs = text.split('\n');
    const lines = [];
    paragraphs.forEach(paragraph => {
      const words = paragraph.split(' ');
      let current = '';
      words.forEach(word => {
        const candidate = current ? current + ' ' + word : word;
        if (ctx.measureText(candidate).width > maxWidth && current) {
          lines.push(current);
          current = word;
        } else {
          current = candidate;
        }
      });
      if (current) lines.push(current);
    });
    return lines;
  }

  function renderFarewellPhoto() {
    const canvas = $('farewell-canvas');
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#fff8f4');
    bg.addColorStop(0.5, '#ffe0ee');
    bg.addColorStop(1, '#fdf0d8');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.arc(80 + i * 62, 90 + (i % 3) * 130, 24 + (i % 4) * 14, 0, Math.PI * 2);
      ctx.fill();
    }

    const frameX = 62;
    const frameY = 70;
    const frameW = w - 124;
    const frameH = h - 140;
    ctx.strokeStyle = '#dca7be';
    ctx.lineWidth = 16;
    ctx.strokeRect(frameX, frameY, frameW, frameH);

    ctx.strokeStyle = '#f4d58a';
    ctx.lineWidth = 8;
    ctx.strokeRect(frameX + 18, frameY + 18, frameW - 36, frameH - 36);

    ctx.fillStyle = '#f8dde9';
    ctx.beginPath();
    ctx.roundRect(frameX + 42, frameY + 40, frameW - 84, frameH - 18 - 180, 30);
    ctx.fill();

    ctx.fillStyle = '#ffbfd5';
    drawHeartPath(ctx, w * 0.5, h * 0.21, 86);

    ctx.fillStyle = '#5e2d42';
    ctx.textAlign = 'center';
    ctx.font = '700 42px "Outfit", sans-serif';
    const title = 'Gracias por visitar';
    ctx.fillText(title, w / 2, h * 0.31);

    ctx.font = '700 28px "Outfit", sans-serif';
    const titleSmall = 'nuestro stand';
    ctx.fillText(titleSmall, w / 2, h * 0.36);

    const schoolLines = wrapText(ctx, farewellSchool, frameW - 140, 34);
    ctx.font = '700 34px "Outfit", sans-serif';
    const schoolY = h * 0.52;
    const schoolLineHeight = 42;
    schoolLines.forEach((line, index) => {
      ctx.fillText(line, w / 2, schoolY + index * schoolLineHeight);
    });

    ctx.fillStyle = '#f9d67a';
    ctx.beginPath();
    ctx.arc(w * 0.2, h * 0.82, 18, 0, Math.PI * 2);
    ctx.arc(w * 0.8, h * 0.84, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#804c5d';
    ctx.font = '600 20px "Outfit", sans-serif';
    ctx.fillText('Con cariño ❤', w / 2, h * 0.9);

    ctx.strokeStyle = '#d9a2b8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(frameX + 30, h - 80);
    ctx.lineTo(w - frameX - 30, h - 80);
    ctx.stroke();
  }

  function openFarewellModal() {
    renderFarewellPhoto();
    $('farewell-modal').classList.remove('hidden');
    RG_UI.showControls();
    RG_UI.toast('💗', 'Foto de despedida lista');
  }

  function closeFarewellModal() {
    $('farewell-modal').classList.add('hidden');
  }

  function saveFarewellPhoto() {
    const canvas = $('farewell-canvas');
    const link = document.createElement('a');
    link.download = 'gracias-por-visitar-nuestro-stand.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    RG_UI.toast('💾', 'Foto guardada');
  }

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
    'playlist': () => RG_UI.togglePlaylist(),
    'preview': () => {
      const next = !settings.showPreview;
      onSettingsChange('showPreview', next);
      RG_UI.toast(next ? '📷' : '🕶️', next ? 'Mini cámara activada' : 'Mini cámara ocultada');
    },
    'farewell': () => {
      openFarewellModal();
    }
  };

  function dispatch(name) {
    const fn = ACTIONS[name];
    if (!fn) return;
    fn();
    RG_UI.showControls();
  }

  function applyVisual(s) {
    const b = document.body.classList;
    b.toggle('fx-reduced', s.effects === 'reducidos');
    b.toggle('fx-min', s.effects === 'mínimos');
    b.toggle('no-preview', !s.showPreview);
    document.documentElement.style.setProperty('--pip-w', s.previewSize + 'px');
    RG_POINTER.applySettings(s);
    RG_VISION.applySettings(s);
    engine.setOptions({
      holdMs: s.holdMs,
      confirmMs: s.confirmMs ?? 100,
      repeatMs: s.repeatMs ?? 220,
      pinchThreshold: s.pinchThreshold ?? 0.30,
      swipeThreshold: s.swipeThreshold ?? 0.12,
      movementDeadzone: s.movementDeadzone ?? 0.04,
      gestureSensitivity: s.gestureSensitivity ?? 1.15,
      stabilityWindow: s.stabilityWindow ?? 6,
      adaptiveThreshold: s.adaptiveThreshold !== false,
      maxNumHands: s.maxNumHands || 2,
      dominantHandMode: s.dominantHandMode !== false
    });
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

  function onFrame({ landmarks, fps, now }) {
    $('det-fps').textContent = fps + ' FPS';
    $('det-hand').textContent = landmarks ? 'Mano detectada' : 'Sin mano';
    if (landmarks) {
      RG_UI.showControls();
      if (noHandPauseTimer) {
        clearTimeout(noHandPauseTimer);
        noHandPauseTimer = null;
      }
    }
    engine.update(landmarks, now);
  }

  async function startCameraOnly() {
    $('btn-start').disabled = true;
    $('btn-demo').disabled = true;
    try {
      $('status').textContent = 'Preparando cámara…';
      await RG_VISION.start(settings, {
        onFrame,
        onStatus: t => { $('status').textContent = t; }
      });
      if (RG_VISION.isReady()) {
        $('status').textContent = 'Listo. Muestra tu mano cuando quieras.';
        setTimeout(hideStart, 600);
        RG_UI.toast('✋', 'Cámara lista');
      } else {
        $('status').textContent = 'Cámara lista, pero la IA no respondió.';
        $('btn-start').disabled = false;
        $('btn-demo').disabled = false;
      }
    } catch (err) {
      $('status').textContent = err.message;
      $('btn-start').disabled = false;
      $('btn-demo').disabled = false;
    }
  }

  function startDemo() {
    RG_PLAYER.load(0, false);
    hideStart();
    RG_UI.toast('▶', 'Modo demo abierto');
  }

  function hideStart() { $('start').classList.add('hidden'); }

  const KEYS = {
    ' ': 'toggle-play', 'k': 'toggle-play',
    'ArrowRight': 'seek+', 'ArrowLeft': 'seek-',
    'ArrowUp': 'vol+', 'ArrowDown': 'vol-',
    'm': 'mute', 'n': 'next', 'b': 'prev',
    's': 'menu', 'f': 'fullscreen', 'l': 'playlist', 'p': 'preview'
  };

  function bindUI() {
    $('btn-start').addEventListener('click', startCameraOnly);
    $('btn-demo').addEventListener('click', startDemo);
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
    $('btn-farewell-close').addEventListener('click', closeFarewellModal);
    $('btn-farewell-save').addEventListener('click', saveFarewellPhoto);

    window.addEventListener('keydown', e => {
      if (e.target && e.target.tagName === 'INPUT') return;
      if (e.key === 'Escape') {
        if (!$('farewell-modal').classList.contains('hidden')) {
          closeFarewellModal();
        } else {
          RG_UI.toggleSettings(false); RG_UI.togglePlaylist(false);
        }
        return;
      }
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
    renderFarewellPhoto();

    RG_PLAYER.on('autoplay-blocked', () => {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

