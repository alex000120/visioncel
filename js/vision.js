/* ==========================================================================
    VISIÓN: cámara + MediaPipe Hands + mini cámara de diagnóstico
    - Reduce la imagen según el perfil (menos píxeles = más fluidez)
    - Limita los FPS de detección para no saturar el equipo
    - Soporta dos manos, priorizando la más dominante para evitar conflictos
    ========================================================================== */
const RG_VISION = (() => {
  const cam = document.getElementById('cam');
  const prev = document.getElementById('preview');
  const pctx = prev.getContext('2d');
  const work = document.createElement('canvas');
  const wctx = work.getContext('2d');

  const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]
  ];

  let hands = null;
  let stream = null;
  let settings = null;
  let onFrame = () => {};
  let onStatus = () => {};
  let running = false;
  let busy = false;
  let lastSend = 0;
  let frames = 0;
  let fpsStart = 0;
  let fps = 0;
  let handsReady = false;
  let farewellHoldStart = 0;
  let farewellLastTriggeredAt = 0;

  const hasCamera = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
  }

  function scoreHand(lm) {
    if (!lm || !lm.length) return -Infinity;
    const wrist = lm[0];
    const center = lm.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    const cx = center.x / lm.length;
    const cy = center.y / lm.length;
    const area = lm.reduce((sum, p) => sum + Math.abs(p.x - wrist.x) + Math.abs(p.y - wrist.y), 0);
    const centrality = 1 - (Math.abs(cx - 0.5) + Math.abs(cy - 0.5)) * 1.5;
    return area + centrality * 0.5;
  }

  function selectPrimaryHand(list) {
    if (!list || !list.length) return null;
    if (list.length === 1) return list[0];
    let best = list[0];
    let bestScore = scoreHand(best);
    for (let i = 1; i < list.length; i++) {
      const score = scoreHand(list[i]);
      if (score > bestScore) {
        best = list[i];
        bestScore = score;
      }
    }
    return best;
  }

  function handHeartScore(hand) {
    if (!hand || hand.length < 21) return 0;
    const wrist = hand[0];
    const thumb = hand[4];
    const indexTip = hand[8];
    const middleTip = hand[12];
    const ringTip = hand[16];
    const pinkyTip = hand[20];
    const scale = dist(wrist, hand[9]) || 0.001;

    const thumbIndexDistance = dist(thumb, indexTip) / scale;
    const indexExtended = dist(indexTip, wrist) > dist(hand[5], wrist) * 1.2;
    const middleClosed = dist(middleTip, wrist) < dist(hand[9], wrist) * 0.9;
    const ringClosed = dist(ringTip, wrist) < dist(hand[9], wrist) * 0.9;
    const pinkyClosed = dist(pinkyTip, wrist) < dist(hand[9], wrist) * 0.9;

    if (thumbIndexDistance < 0.75 && indexExtended && middleClosed && ringClosed && pinkyClosed) {
      return 1;
    }
    return 0;
  }

  function detectDoubleHeartGesture(handList) {
    if (!Array.isArray(handList) || handList.length < 2) return false;
    const scores = handList.map(handHeartScore);
    if (!scores.every(score => score === 1)) return false;

    const centers = handList.map(hand => {
      const total = hand.reduce((sum, p) => ({ x: sum.x + p.x, y: sum.y + p.y }), { x: 0, y: 0 });
      return { x: total.x / hand.length, y: total.y / hand.length };
    });

    const dx = Math.abs(centers[0].x - centers[1].x);
    const dy = Math.abs(centers[0].y - centers[1].y);
    return dx > 0.12 && dx < 0.6 && dy < 0.45;
  }

  function triggerFarewell(now) {
    const cooldown = now - farewellLastTriggeredAt;
    if (cooldown < 5000) return;
    farewellLastTriggeredAt = now;
    document.dispatchEvent(new CustomEvent('rg-farewell'));
  }

  function maybeTriggerFarewell(now, handList) {
    if (!handList || handList.length < 2) {
      farewellHoldStart = 0;
      return;
    }

    if (detectDoubleHeartGesture(handList)) {
      if (!farewellHoldStart) farewellHoldStart = now;
      if (now - farewellHoldStart >= 900) {
        triggerFarewell(now);
        farewellHoldStart = 0;
      }
    } else {
      farewellHoldStart = 0;
    }
  }

  function loadMediapipe() {
    const base = `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${RG_CONFIG.mediapipeVersion}`;
    return new Promise((resolve, reject) => {
      if (window.Hands) return resolve();
      const s = document.createElement('script');
      s.src = `${base}/hands.js`;
      s.crossOrigin = 'anonymous';
      s.onload = resolve;
      s.onerror = () => reject(new Error('No se pudo cargar la IA de manos (revisa tu conexión).'));
      document.head.appendChild(s);
    }).then(() => {
      hands = new window.Hands({ locateFile: f => `${base}/${f}` });
      hands.setOptions({
        maxNumHands: Math.max(1, Number(settings.maxNumHands) || 2),
        modelComplexity: settings.complexity,
        minDetectionConfidence: settings.minDetect,
        minTrackingConfidence: settings.minTrack,
        selfieMode: false
      });
      hands.onResults(onResults);
      handsReady = true;
    });
  }

  async function startCamera() {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    cam.srcObject = stream;
    await cam.play();
  }

  function drawPreview(lm) {
    if (!settings.showPreview) return;
    const W = settings.previewSize;
    const H = Math.round(W * (work.height / Math.max(1, work.width)) || W * 0.75);
    if (prev.width !== W || prev.height !== H) { prev.width = W; prev.height = H; }

    pctx.save();
    pctx.clearRect(0, 0, W, H);
    pctx.translate(W, 0);
    pctx.scale(-1, 1);
    pctx.drawImage(work, 0, 0, W, H);
    pctx.restore();

    if (lm && settings.showLandmarks) {
      const P = p => [(1 - p.x) * W, p.y * H];
      pctx.lineWidth = 2;
      pctx.strokeStyle = 'rgba(56,189,248,.95)';
      pctx.beginPath();
      HAND_CONNECTIONS.forEach(([a, b]) => {
        const [x1, y1] = P(lm[a]);
        const [x2, y2] = P(lm[b]);
        pctx.moveTo(x1, y1);
        pctx.lineTo(x2, y2);
      });
      pctx.stroke();
      pctx.fillStyle = '#a78bfa';
      lm.forEach((p, i) => {
        const [x, y] = P(p);
        pctx.beginPath();
        pctx.arc(x, y, i === 8 ? 5 : 2.5, 0, Math.PI * 2);
        pctx.fill();
      });
    }
  }

  function onResults(res) {
    const now = performance.now();
    frames++;
    if (now - fpsStart >= 1000) {
      fps = Math.round(frames * 1000 / (now - fpsStart));
      frames = 0;
      fpsStart = now;
    }

    const handsList = (res && res.multiHandLandmarks) || [];
    if (handsList.length >= 2) {
      maybeTriggerFarewell(now, handsList);
    } else {
      farewellHoldStart = 0;
    }

    const lm = settings && settings.dominantHandMode !== false ? selectPrimaryHand(handsList) : (handsList[0] || null);
    drawPreview(lm);
    onFrame({ landmarks: lm, fps, now, handCount: handsList.length });
  }

  function sendFrame() {
    if (cam.readyState < 2 || !cam.videoWidth) return;
    const w = Math.min(settings.width, cam.videoWidth);
    const h = Math.round(w * cam.videoHeight / cam.videoWidth);
    if (work.width !== w || work.height !== h) { work.width = w; work.height = h; }
    wctx.drawImage(cam, 0, 0, w, h);

    if (handsReady && !busy) {
      busy = true;
      hands.send({ image: work })
        .catch(() => {})
        .finally(() => { busy = false; });
    } else if (!handsReady) {
      drawPreview(null);
    }
  }

  function loop(t) {
    if (!running) return;
    requestAnimationFrame(loop);
    const interval = 1000 / (settings.fps || 24);
    if (t - lastSend < interval) return;
    lastSend = t;
    sendFrame();
  }

  function applySettings(s) {
    settings = s;
    if (handsReady) {
      hands.setOptions({
        maxNumHands: Math.max(1, Number(s.maxNumHands) || 2),
        modelComplexity: s.complexity,
        minDetectionConfidence: s.minDetect,
        minTrackingConfidence: s.minTrack
      });
    }
    prev.style.display = s.showPreview ? 'block' : 'none';
  }

  async function start(s, handlers) {
    settings = s;
    onFrame = handlers.onFrame;
    onStatus = handlers.onStatus || onStatus;
    if (!hasCamera()) throw new Error('Este navegador no permite usar la cámara. Prueba con Chrome, Edge o Safari actualizado.');

    onStatus('Activando cámara…');
    await startCamera();
    onStatus('Cargando IA de manos…');
    try {
      await loadMediapipe();
      onStatus('Listo. Haz un corazón con dos manos para guardar la foto.');
    } catch (err) {
      onStatus(err.message);
    }
    running = true;
    fpsStart = performance.now();
    requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    farewellHoldStart = 0;
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  return { start, stop, applySettings, getFps: () => fps, isReady: () => handsReady };
})();
