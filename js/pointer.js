/* ==========================================================================
   PUNTERO VIRTUAL (modo mouse con la mano)
   - El índice mueve el cursor (con suavizado y zona muerta de la cámara)
   - Pellizco = clic. Mantener el pellizco y mover = arrastrar sliders / desplazar listas
   - Dibuja la mano completa sobre la pantalla
   ========================================================================== */
const RG_POINTER = (() => {
  const canvas = document.getElementById('overlay');
  const ctx = canvas.getContext('2d');
  const cursorEl = document.getElementById('cursor');

  const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]
  ];

  const HIT = '[data-hit], button, input, label, a, select, textarea';
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  let settings = null;
  let target = null;
  let pos = null;
  let handPts = null;
  let lastSeen = 0;
  let visible = false;
  let hoverEl = null;
  let drag = null;
  let frame = 0;
  let onClick = () => {};
  let onRipple = () => {};

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function resize() {
    canvas.width = Math.round(innerWidth * DPR);
    canvas.height = Math.round(innerHeight * DPR);
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function toScreen(x, y) {
    const m = settings.margin;
    const u = clamp((x - m) / (1 - 2 * m), 0, 1);
    const v = clamp((y - m) / (1 - 2 * m), 0, 1);
    return { x: u * innerWidth, y: v * innerHeight };
  }

  function hitTest() {
    if (!pos) return null;
    const el = document.elementFromPoint(pos.x, pos.y);
    return el ? el.closest(HIT) || el.closest('[data-scroll]') || null : null;
  }

  function setHover(el) {
    if (el === hoverEl) return;
    if (hoverEl) hoverEl.classList.remove('hover');
    hoverEl = el;
    if (hoverEl) hoverEl.classList.add('hover');
  }

  function onCursor(x, y, landmarks) {
    lastSeen = performance.now();
    const p = toScreen(x, y);
    target = p;
    if (!pos) pos = { x: p.x, y: p.y };

    const pts = landmarks.map(l => toScreen(1 - l.x, l.y));
    if (!handPts) handPts = pts;
    else handPts = handPts.map((h, i) => ({
      x: h.x + (pts[i].x - h.x) * 0.6,
      y: h.y + (pts[i].y - h.y) * 0.6
    }));
  }

  function onPinchStart() {
    const el = hitTest();
    cursorEl.classList.add('pinch');
    if (!el) return;
    onRipple(pos.x, pos.y);

    if (el.dataset && el.dataset.slider) {
      drag = { type: 'slider', el };
      slide(el, pos.x);
      return;
    }
    if (el.hasAttribute && el.hasAttribute('data-scroll')) {
      drag = { type: 'scroll', el, lastY: pos.y };
      return;
    }
    if (el.tagName === 'INPUT' && el.type === 'range') {
      drag = { type: 'slider', el };
      slide(el, pos.x);
      return;
    }
    el.click();
    onClick(el);
  }

  function onPinchMove() {
    if (!drag) return;
    if (drag.type === 'slider') slide(drag.el, pos.x);
    if (drag.type === 'scroll') {
      drag.el.scrollTop += (drag.lastY - pos.y) * 2.2;
      drag.lastY = pos.y;
    }
  }

  function onPinchEnd() {
    cursorEl.classList.remove('pinch');
    drag = null;
  }

  function slide(el, x) {
    const r = el.getBoundingClientRect();
    const f = clamp((x - r.left) / (r.width || 1), 0, 1);
    if (el.tagName === 'INPUT') {
      const min = +el.min || 0, max = +el.max || 1, step = +el.step || 0.01;
      let v = min + f * (max - min);
      v = Math.round(v / step) * step;
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      el.dispatchEvent(new CustomEvent('rg-slide', { detail: f }));
    }
  }

  function drawHand(alpha) {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    if (!handPts || !settings.showHand || alpha <= 0) return;

    ctx.globalAlpha = alpha;
    const pinching = cursorEl.classList.contains('pinch');

    ctx.lineCap = 'round';
    ctx.strokeStyle = pinching ? 'rgba(251,191,36,.9)' : 'rgba(56,189,248,.75)';
    ctx.lineWidth = 6;
    ctx.shadowColor = pinching ? 'rgba(251,191,36,.8)' : 'rgba(56,189,248,.8)';
    ctx.shadowBlur = settings.effects === 'mínimos' ? 0 : 14;
    ctx.beginPath();
    HAND_CONNECTIONS.forEach(([a, b]) => {
      ctx.moveTo(handPts[a].x, handPts[a].y);
      ctx.lineTo(handPts[b].x, handPts[b].y);
    });
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    handPts.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, i === 0 ? 7 : 4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function tick(now) {
    requestAnimationFrame(tick);
    frame++;
    const seen = now - lastSeen < 250;
    visible = seen;

    if (target && pos) {
      const d = dist(pos, target);
      const base = 1 - settings.smoothing * 0.85;
      const a = Math.min(1, base + d / 140);
      pos.x += (target.x - pos.x) * a;
      pos.y += (target.y - pos.y) * a;
    }

    const shouldShowCursor = seen && settings.showCursor;
    cursorEl.style.opacity = shouldShowCursor ? '1' : '0';
    if (shouldShowCursor && pos) cursorEl.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;

    if (seen && frame % 2 === 0) {
      const el = hitTest();
      setHover(el);
    } else if (!seen) {
      setHover(null);
    }

    drawHand(seen ? 1 : 0);
    if (!seen && handPts) handPts = null;
  }

  function init(s, handlers) {
    settings = s;
    onClick = handlers && handlers.onClick || onClick;
    onRipple = handlers && handlers.onRipple || onRipple;
    resize();
    window.addEventListener('resize', resize);
    requestAnimationFrame(tick);
  }

  function applySettings(s) { settings = s; }

  function isVisible() { return visible; }
  function position() { return pos; }

  return {
    init, applySettings, onCursor, onPinchStart, onPinchMove, onPinchEnd,
    isVisible, position, drawHand
  };
})();
