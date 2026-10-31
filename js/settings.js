/* ==========================================================================
   AJUSTES POR DISPOSITIVO
   Cada navegador/dispositivo guarda su propia configuración.
   ========================================================================== */
const RG_SETTINGS = (() => {
  const DEVICE_KEY = 'rg-device-id';
  const PREFIX = 'rg-settings-';
  let current = null;
  let deviceId = null;
  let info = null;

  /* Identidad del dispositivo: un id aleatorio guardado en este navegador */
  function getDeviceId() {
    if (deviceId) return deviceId;
    try {
      deviceId = localStorage.getItem(DEVICE_KEY);
      if (!deviceId) {
        deviceId = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
        localStorage.setItem(DEVICE_KEY, deviceId);
      }
    } catch (e) {
      deviceId = 'temp-' + Date.now();
    }
    return deviceId;
  }

  /* Detecta el tipo de equipo y recomienda un perfil de rendimiento */
  function detectDevice() {
    if (info) return info;
    const ua = navigator.userAgent || '';
    const touch = (navigator.maxTouchPoints || 0) > 0;
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (touch && Math.min(innerWidth, innerHeight) < 820);
    const cores = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory || 4;

    let type = mobile ? 'Móvil' : (touch ? 'Tablet' : 'Escritorio');
    if (/iPad/i.test(ua)) type = 'Tablet';

    let preset;
    if (mobile) preset = (cores <= 4 || mem <= 3) ? 'bajo' : 'medio';
    else if (cores >= 8 && mem >= 8) preset = 'ultra';
    else if (cores >= 6) preset = 'alto';
    else preset = 'medio';

    info = {
      type,
      mobile,
      cores,
      mem,
      recommended: preset,
      label: `${type} · ${innerWidth}×${innerHeight} · ${cores} núcleos`
    };
    return info;
  }

  function presetValues(name) {
    const p = RG_CONFIG.presets[name];
    if (!p) return {};
    return {
      width: p.width, fps: p.fps, complexity: p.complexity, minDetect: p.minDetect,
      effects: p.effects, previewSize: p.previewSize, showLandmarks: p.showLandmarks
    };
  }

  function load() {
    const d = detectDevice();
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(PREFIX + getDeviceId()) || '{}');
    } catch (e) { saved = {}; }

    const preset = saved.preset || RG_CONFIG.defaults.preset;
    const resolvedPreset = preset === 'auto' ? d.recommended : preset;

    current = Object.assign({}, RG_CONFIG.defaults, presetValues(resolvedPreset), saved);
    current.preset = preset;
    return current;
  }

  function save() {
    try {
      localStorage.setItem(PREFIX + getDeviceId(), JSON.stringify(current));
    } catch (e) { /* almacenamiento lleno o bloqueado: se usa solo en memoria */ }
  }

  function get() { return current || load(); }

  /* Cambia uno o varios valores y guarda */
  function set(patch) {
    current = Object.assign({}, get(), patch);
    save();
    return current;
  }

  /* Aplica un perfil completo (sobrescribe los campos de rendimiento) */
  function applyPreset(name) {
    const resolved = name === 'auto' ? detectDevice().recommended : name;
    current = Object.assign({}, get(), presetValues(resolved), { preset: name });
    save();
    return current;
  }

  function reset() {
    current = Object.assign({}, RG_CONFIG.defaults, presetValues(detectDevice().recommended), { preset: 'auto' });
    save();
    return current;
  }

  return { load, get, set, save, applyPreset, reset, detectDevice, getDeviceId };
})();
