/* ==========================================================================
   REPRODUCTOR DE VIDEO
   Controla la lista de 5 videos. No sabe nada de cámara ni de gestos.
   ========================================================================== */
const RG_PLAYER = (() => {
  const video = document.getElementById('player');
  const listeners = {};
  let index = 0;
  let missing = false;

  const emit = (name, data) => (listeners[name] || []).forEach(fn => fn(data));
  const on = (name, fn) => { (listeners[name] = listeners[name] || []).push(fn); };

  function list() { return RG_CONFIG.videos; }
  function currentIndex() { return index; }
  function current() { return RG_CONFIG.videos[index]; }
  function hasError() { return missing; }

  function load(i, autoplay = true) {
    const n = RG_CONFIG.videos.length;
    index = ((i % n) + n) % n;
    const v = current();
    missing = false;
    video.src = v.src;
    if (v.poster) video.poster = v.poster; else video.removeAttribute('poster');
    video.load();
    if (autoplay) play().catch(() => {});
    emit('change', { index, video: v });
  }

  function play() {
    if (missing) return Promise.resolve();
    const p = video.play();
    return p && p.catch ? p.catch(err => {
      // Autoplay bloqueado: se reproduce en silencio y se avisa a la interfaz
      if (err && err.name === 'NotAllowedError') {
        video.muted = true;
        emit('autoplay-blocked');
        return video.play().catch(() => {});
      }
    }) : Promise.resolve();
  }

  function pause() { video.pause(); }

  function togglePlay() {
    if (video.paused) play(); else pause();
    return !video.paused;
  }

  function next() { load(index + 1); }
  function prev() {
    // Si ya se avanzó más de 3 s, "anterior" reinicia el video actual
    if (video.currentTime > 3) { video.currentTime = 0; return; }
    load(index - 1);
  }

  function seekBy(seconds) {
    if (!isFinite(video.duration)) return;
    seek(video.currentTime + seconds);
  }

  function seek(t) {
    if (!isFinite(video.duration)) return;
    video.currentTime = Math.max(0, Math.min(video.duration, t));
  }

  function seekFraction(f) {
    if (!isFinite(video.duration)) return;
    seek(Math.max(0, Math.min(1, f)) * video.duration);
  }

  function setVolume(v) {
    video.volume = Math.max(0, Math.min(1, v));
    if (video.volume > 0 && video.muted) video.muted = false;
    emit('volume');
  }

  function volumeBy(delta) { setVolume(video.volume + delta); }

  function toggleMute() {
    video.muted = !video.muted;
    emit('volume');
    return video.muted;
  }

  function isFullscreen() { return !!document.fullscreenElement; }

  /* Pantalla completa del documento completo.
     Nota: algunos navegadores bloquean esto si no viene de un toque/clic real. */
  function toggleFullscreen() {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    try {
      if (isFullscreen() || document.webkitFullscreenElement) {
        exit && exit.call(document);
      } else if (req) {
        const p = req.call(el);
        if (p && p.catch) p.catch(() => emit('fullscreen-blocked'));
      } else {
        emit('fullscreen-blocked');
      }
    } catch (e) {
      emit('fullscreen-blocked');
    }
  }

  video.addEventListener('error', () => {
    missing = true;
    emit('missing', current());
  });
  ['timeupdate', 'play', 'pause', 'loadedmetadata', 'durationchange', 'ended'].forEach(ev =>
    video.addEventListener(ev, () => emit('tick', { ev }))
  );
  video.addEventListener('ended', () => {
    // Al terminar el video se pasa al siguiente automáticamente
    load(index + 1);
  });
  document.addEventListener('fullscreenchange', () => emit('fullscreen'));

  return {
    el: video, list, current, currentIndex, hasError, load, play, pause, togglePlay,
    next, prev, seek, seekBy, seekFraction, setVolume, volumeBy, toggleMute,
    toggleFullscreen, isFullscreen, on
  };
})();
