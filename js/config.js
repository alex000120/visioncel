/* ==========================================================================
   CONFIGURACIÓN GENERAL
   Aquí cambias los videos, los gestos y los perfiles de rendimiento.
   ========================================================================== */
const RG_CONFIG = {
  appName: 'Gesto Player',

  videos: [
    { title: 'Video 1 · Introducción',  src: 'videos/video1.mp4', poster: '' },
    { title: 'Video 2 · Demostración',  src: 'videos/video2.mp4', poster: '' },
    { title: 'Video 3 · Tecnología',    src: 'videos/video3.mp4', poster: '' },
    { title: 'Video 4 · Interacción',   src: 'videos/video4.mp4', poster: '' },
    { title: 'Video 5 · Cierre',        src: 'videos/video5.mp4', poster: '' }
  ],

  mediapipeVersion: '0.4.1675469240',

  gestures: [
    { id: 'pointer',    icon: '☝️',  name: 'Índice levantado',       action: 'Mueve el puntero (modo mouse)' },
    { id: 'pinch',      icon: '🤏', name: 'Pellizco',               action: 'Clic. Mantenerlo y mover arrastra barras y listas' },
    { id: 'palm',       icon: '✋',  name: 'Palma quieta',           action: 'Reproducir / pausar' },
    { id: 'swipe',      icon: '👋', name: 'Palma deslizando',       action: 'Adelantar (→) o retroceder (←) 10 s' },
    { id: 'fist',       icon: '✊',  name: 'Puño',                   action: 'Silenciar / activar sonido' },
    { id: 'next',       icon: '✌️',  name: 'Índice + medio',         action: 'Siguiente video' },
    { id: 'prev',       icon: '3️⃣', name: 'Índice + medio + anular', action: 'Video anterior' },
    { id: 'vol_up',     icon: '👍', name: 'Pulgar arriba',          action: 'Subir volumen (se repite)' },
    { id: 'vol_down',   icon: '👎', name: 'Pulgar abajo',           action: 'Bajar volumen (se repite)' },
    { id: 'menu',       icon: '🤘', name: 'Índice + meñique',       action: 'Abrir / cerrar ajustes' },
    { id: 'fullscreen', icon: '🤙', name: 'Pulgar + meñique',       action: 'Pantalla completa' }
  ],

  presets: {
    ultra:   { label: 'Ultra',   width: 640, fps: 30, complexity: 1, minDetect: 0.6,  effects: 'completos', previewSize: 280, showLandmarks: true,  desc: 'PC potente, máxima precisión' },
    alto:    { label: 'Alto',    width: 480, fps: 30, complexity: 1, minDetect: 0.6,  effects: 'completos', previewSize: 260, showLandmarks: true,  desc: 'Laptop o PC estándar' },
    medio:   { label: 'Medio',   width: 400, fps: 24, complexity: 0, minDetect: 0.6,  effects: 'reducidos', previewSize: 240, showLandmarks: true,  desc: 'Tablet o equipo intermedio' },
    bajo:    { label: 'Bajo',    width: 320, fps: 15, complexity: 0, minDetect: 0.65, effects: 'reducidos', previewSize: 200, showLandmarks: true,  desc: 'Celular o equipo modesto' },
    ahorro:  { label: 'Ahorro',  width: 256, fps: 10, complexity: 0, minDetect: 0.7,  effects: 'mínimos',   previewSize: 180, showLandmarks: false, desc: 'Máxima fluidez, menos precisión' }
  },

  defaults: {
    preset: 'auto',
    width: 480,
    fps: 24,
    complexity: 1,
    minDetect: 0.6,
    minTrack: 0.5,
    smoothing: 0.45,
    margin: 0.09,
    holdMs: 420,
    confirmMs: 100,
    repeatMs: 220,
    pinchThreshold: 0.30,
    swipeThreshold: 0.12,
    movementDeadzone: 0.04,
    gestureSensitivity: 1.15,
    stabilityWindow: 6,
    adaptiveThreshold: true,
    maxNumHands: 2,
    dominantHandMode: true,
    showHand: true,
    showCursor: true,
    showPreview: true,
    previewSize: 240,
    showLandmarks: true,
    showGestureGuide: true,
    effects: 'completos',
    mirror: true,
    autoHideMs: 3000,
    pauseOnNoHand: false,
    noHandPauseMs: 1800,
    seekStep: 10,
    volumeStep: 0.05
  }
};
