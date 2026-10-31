/* ==========================================================================
   RECONOCIMIENTO DE GESTOS
   - analyze(): calcula dedos extendidos, pellizco, dirección del pulgar y puntero
   - classify(): convierte eso en un nombre de gesto
   - GestureEngine: confirma gestos en el tiempo y dispara acciones
   ========================================================================== */
const RG_GESTURE = (() => {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function analyze(lm) {
    const wrist = lm[0];
    const scale = dist(wrist, lm[9]) || 0.001;
    const ext = (tip, pip) => dist(lm[tip], wrist) > dist(lm[pip], wrist) * 1.12;

    const fingers = {
      index: ext(8, 6),
      middle: ext(12, 10),
      ring: ext(16, 14),
      pinky: ext(20, 18)
    };

    const thumbNearIndex = dist(lm[4], lm[8]) < scale * 0.42;
    const heartSign = fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky && dist(lm[4], lm[8]) < scale * 0.42 && dist(lm[4], lm[3]) > scale * 0.2;

    return {
      fingers,
      thumbExt: dist(lm[4], wrist) > dist(lm[3], wrist) * 1.1,
      thumbDy: (lm[2].y - lm[4].y) / scale,
      pinchRatio: dist(lm[4], lm[8]) / scale,
      cursor: { x: 1 - lm[8].x, y: lm[8].y },
      wristX: 1 - wrist.x,
      openPalm: Object.values(fingers).filter(Boolean).length >= 3,
      palmWidth: dist(lm[5], lm[17]) || 0,
      handScale: scale,
      heartSign,
      thumbNearIndex
    };
  }

  function classify(a) {
    const { index, middle, ring, pinky } = a.fingers;
    const up = [index, middle, ring, pinky].filter(Boolean).length;

    if (a.heartSign) return 'heart';
    if (a.pinchRatio < 0.32) return 'pinch';
    if (up === 4 && a.openPalm && a.palmWidth > a.handScale * 0.38) return 'palm';
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

const RG_ACTION_MAP = {
  palm: 'toggle-play',
  fist: 'mute',
  next: 'next',
  prev: 'prev',
  menu: 'menu',
  fullscreen: 'fullscreen',
  vol_up: 'vol+',
  vol_down: 'vol-',
  heart: 'farewell'
};

class GestureEngine {
  constructor(handlers) {
    this.h = handlers;
    this.opts = {
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
      dominantHandMode: true
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
    this.rawHistory = [];
    this.moving = false;
  }

  setOptions(o) { Object.assign(this.opts, o); }

  mostFrequent(items) {
    if (!items.length) return 'none';
    const counts = new Map();
    let best = 'none';
    let bestCount = 0;
    for (const item of items) {
      const c = (counts.get(item) || 0) + 1;
      counts.set(item, c);
      if (c > bestCount || (c === bestCount && item === 'none')) {
        best = item;
        bestCount = c;
      }
    }
    return best;
  }

  update(hand, now) {
    if (!hand) { this.reset(); return null; }

    const a = RG_GESTURE.analyze(hand);
    const pinchThreshold = this.opts.pinchThreshold ?? 0.30;
    const adaptiveThreshold = this.opts.adaptiveThreshold !== false ? pinchThreshold * (1.05 + (0.05 - Math.min(0.05, Math.max(0, a.handScale - 0.1))) * 2) : pinchThreshold;

    const wasPinch = this.pinch;
    if (!this.pinch && a.pinchRatio < adaptiveThreshold) this.pinch = true;
    else if (this.pinch && a.pinchRatio > adaptiveThreshold + 0.12) this.pinch = false;

    this.h.onCursor(a.cursor.x, a.cursor.y, hand);

    if (this.pinch && !wasPinch) this.h.onPinchStart(a.cursor.x, a.cursor.y);
    else if (this.pinch && wasPinch) this.h.onPinchMove(a.cursor.x, a.cursor.y);
    else if (!this.pinch && wasPinch) this.h.onPinchEnd();

    if (this.pinch) {
      this.setStable('pinch', now);
      return 'pinch';
    }

    this.history.push({ x: a.cursor.x, t: now });
    this.history = this.history.filter(p => now - p.t <= 300);
    const xs = this.history.map(p => p.x);
    const deadzone = this.opts.movementDeadzone ?? 0.04;
    this.moving = xs.length > 1 && (Math.max(...xs) - Math.min(...xs)) > deadzone;

    let raw = RG_GESTURE.classify(a);
    this.rawHistory.push(raw);
    if (this.rawHistory.length > (this.opts.stabilityWindow ?? 6)) this.rawHistory.shift();
    const consensus = this.mostFrequent(this.rawHistory);
    const resolved = consensus === 'none' ? raw : consensus;

    if (resolved === 'palm' && this.history.length > 1 && now > this.swipeLockUntil) {
      const oldest = this.history[0];
      const dx = a.cursor.x - oldest.x;
      const threshold = (this.opts.swipeThreshold ?? 0.12) / Math.max(0.5, this.opts.gestureSensitivity || 1);
      if (Math.abs(dx) > threshold && now - oldest.t >= 100) {
        this.h.onAction(dx > 0 ? 'seek+' : 'seek-');
        this.h.onGesture('swipe');
        this.swipeLockUntil = now + 700;
        this.history = [];
        this.moving = false;
        this.rawHistory = [];
      }
    }

    this.setStable(resolved, now);
    return resolved;
  }

  reset() {
    if (this.pinch) { this.pinch = false; this.h.onPinchEnd(); }
    this.history = [];
    this.rawHistory = [];
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
    if (id !== this.stable && now - this.candidateSince >= (this.opts.confirmMs ?? 100)) {
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
      const repeatMs = this.opts.repeatMs ?? 220;
      if (held >= (this.opts.holdMs ?? 420) && now - this.lastRepeat >= repeatMs) {
        this.lastRepeat = now;
        this.h.onAction(act);
      }
      return;
    }

    if (s === 'heart') {
      if (held >= 950 && !this.fired && now - this.lastFire > 1800) {
        this.fired = true;
        this.lastFire = now;
        this.h.onAction(act);
      }
      return;
    }

    if (this.fired) return;
    if (held >= (this.opts.holdMs ?? 420) && now - this.lastFire > 600 && now > this.swipeLockUntil) {
      this.fired = true;
      this.lastFire = now;
      this.h.onAction(act);
    }
  }
}

