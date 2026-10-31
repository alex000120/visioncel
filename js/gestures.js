/* ==========================================================================
   RECONOCIMIENTO DE GESTOS
   - analyze(): calcula dedos extendidos, pellizco, dirección del pulgar y puntero
   - classify(): convierte eso en un nombre de gesto
   - GestureEngine: confirma gestos en el tiempo y dispara acciones
   ========================================================================== */
const RG_GESTURE = (() => {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  /* Índices de MediaPipe Hands:
     0 muñeca · 2 pulgar MCP · 3 pulgar IP · 4 pulgar punta
     6/8 índice PIP/punta · 9 medio MCP · 10/12 medio · 14/16 anular · 18/20 meñique */
  function analyze(lm) {
    const wrist = lm[0];
    const scale = dist(wrist, lm[9]) || 0.001;
    const ext = (tip, pip) => dist(lm[tip], wrist) > dist(lm[pip], wrist) * 1.12;

    const fingers = {
      index:  ext(8, 6),
      middle: ext(12, 10),
      ring:   ext(16, 14),
      pinky:  ext(20, 18)
    };

    return {
      fingers,
      thumbExt: dist(lm[4], wrist) > dist(lm[3], wrist) * 1.1,
      thumbDy: (lm[2].y - lm[4].y) / scale,
      pinchRatio: dist(lm[4], lm[8]) / scale,
      cursor: { x: 1 - lm[8].x, y: lm[8].y },
      wristX: 1 - wrist.x,
      openPalm: Object.values(fingers).filter(Boolean).length >= 3,
      spread: Object.values(fingers).filter(Boolean).length
    };
  }

  function classify(a) {
    const { index, middle, ring, pinky } = a.fingers;
    const up = [index, middle, ring, pinky].filter(Boolean).length;

    if (a.pinchRatio < 0.32) return 'pinch';
    if (up === 4) return 'palm';
    if (up === 0) {
      if (a.thumbExt && a.thumbDy > 0.3) return 'vol_up';
      if (a.thumbExt && a.thumbDy < -0.3) return 'vol_down';
      return 'fist';
    }
    if (index && middle && ring && !pinky) return 'prev';
    if (index && middle && !ring && !pinky) return 'next';
    if (index && !middle && !ring && pinky) return 'menu';
    if (!index && !middle && !ring && pinky && a.thumbExt) return 'fullscreen';
    if (index && !middle && !ring && !pinky) return 'pointer';
    return 'none';
  }

  return { analyze, classify };
})();

/* Gestos que disparan una acción (una sola vez tras sostenerlos) */
const RG_ACTION_MAP = {
  palm: 'toggle-play',
  fist: 'mute',
  next: 'next',
  prev: 'prev',
  menu: 'menu',
  fullscreen: 'fullscreen',
  vol_up: 'vol+',
  vol_down: 'vol-'
};

class GestureEngine {
  constructor(handlers) {
    this.h = handlers;
    this.opts = {
      holdMs: 400,
      confirmMs: 120,
      repeatMs: 260,
      pinchThreshold: 0.30,
      swipeThreshold: 0.12,
      gestureSensitivity: 1
    };
    this.pinch = false;
    this.stable = 'none';
    this.candidate = 'none';
    this.candidateSince = 0;
    this.enteredAt = 0;
    this.fired = false;
    this.lastFire = 0;
    this.lastRepeat = 0;
    this.lastSwipeAt = 0;
    this.swipeLockUntil = 0;
    this.history = [];
    this.moving = false;
  }

  setOptions(o) { Object.assign(this.opts, o); }

  update(hand, now) {
    if (!hand) { this.reset(); return null; }

    const a = RG_GESTURE.analyze(hand);
    const pinchThreshold = this.opts.pinchThreshold ?? 0.30;
    const swipeThreshold = (this.opts.swipeThreshold ?? 0.12) / Math.max(0.5, this.opts.gestureSensitivity || 1);

    const wasPinch = this.pinch;
    if (!this.pinch && a.pinchRatio < pinchThreshold) this.pinch = true;
    else if (this.pinch && a.pinchRatio > pinchThreshold + 0.12) this.pinch = false;

    this.h.onCursor(a.cursor.x, a.cursor.y, hand);

    if (this.pinch && !wasPinch) this.h.onPinchStart(a.cursor.x, a.cursor.y);
    else if (this.pinch && wasPinch) this.h.onPinchMove(a.cursor.x, a.cursor.y);
    else if (!this.pinch && wasPinch) this.h.onPinchEnd();

    if (this.pinch) {
      this.setStable('pinch', now);
      return 'pinch';
    }

    this.history.push({ x: a.wristX, t: now });
    this.history = this.history.filter(p => now - p.t <= 300);
    const xs = this.history.map(p => p.x);
    this.moving = xs.length > 1 && (Math.max(...xs) - Math.min(...xs)) > 0.04;

    let raw = RG_GESTURE.classify(a);

    if (raw === 'palm' && this.history.length > 1 && now > this.swipeLockUntil) {
      const oldest = this.history[0];
      const dx = a.wristX - oldest.x;
      if (Math.abs(dx) > swipeThreshold && now - oldest.t >= 100) {
        this.h.onAction(dx > 0 ? 'seek+' : 'seek-');
        this.h.onGesture('swipe');
        this.swipeLockUntil = now + 700;
        this.history = [];
        this.moving = false;
      }
    }

    this.setStable(raw, now);
    return raw;
  }

  reset() {
    if (this.pinch) { this.pinch = false; this.h.onPinchEnd(); }
    this.history = [];
    this.moving = false;
    this.candidate = 'none';
    if (this.stable !== 'none') {
      this.stable = 'none';
      this.fired = false;
      this.h.onGesture('none');
    }
  }

  setStable(id, now) {
    if (id !== this.candidate) {
      this.candidate = id;
      this.candidateSince = now;
    }
    if (id !== this.stable && now - this.candidateSince >= (this.opts.confirmMs ?? 120)) {
      this.stable = id;
      this.fired = false;
      this.enteredAt = now;
      this.lastRepeat = 0;
      this.h.onGesture(id);
    }
    this.tick(now);
  }

  tick(now) {
    const s = this.stable;
    const act = RG_ACTION_MAP[s];
    if (!act) return;

    if (s === 'palm' && this.moving) this.enteredAt = now;

    const held = now - this.enteredAt;

    if (s === 'vol_up' || s === 'vol_down') {
      const repeatMs = this.opts.repeatMs ?? 260;
      if (held >= (this.opts.holdMs ?? 400) && now - this.lastRepeat >= repeatMs) {
        this.lastRepeat = now;
        this.h.onAction(act);
      }
      return;
    }

    if (this.fired) return;
    if (held >= (this.opts.holdMs ?? 400) && now - this.lastFire > 600 && now > this.swipeLockUntil) {
      this.fired = true;
      this.lastFire = now;
      this.h.onAction(act);
    }
  }
}
