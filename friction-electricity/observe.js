'use strict';

/* ============================================================
   실험 1: 마찰 전기 현상 관찰하기
   1) 면장갑으로 두 고무풍선을 각각 문지른다.
   2) 한 풍선을 스탠드에 매달고, 다른 풍선을 가까이 한다. → 밀어낸다(척력)
   3) 면장갑을 매달린 풍선에 가까이 한다. → 끌어당긴다(인력)
   main.js의 공용 도우미(el, chargeMark, place, clamp, lerp, dist, norm, COLOR, MINUS)를 재사용한다.
   ============================================================ */
(() => {
  const root = document.getElementById('expObserve');
  const canvas = document.getElementById('obsCanvas');
  const ctx = canvas.getContext('2d');
  const W = 640;
  const H = 500;

  /* ---------- 상수 ---------- */
  const PIVOT = { x: 400, y: 50 };  // 스탠드에 실이 걸린 곳
  const L = 230;                    // 실 길이(걸린 곳에서 풍선 중심까지)
  const RX = 42;
  const RY = 54;
  const RUB_MAX = 900;              // 이만큼 문지르면 풍선 최대 대전
  const MAX_Q = 4;                  // 풍선 최대 전하 개수
  const GRAV = 1400;
  const DAMP = 2.0;
  const FORCE = 650;                // 인력·척력 세기 배율
  const K = 6;                      // 힘 ∝ (전하 곱) / 거리
  const RANGE = 320;                // 이 거리보다 멀면 힘 없음
  const MIN_STRENGTH = 0.06;
  const CONTACT_BALLOON = 92;       // 풍선끼리 맞닿는 거리
  const CONTACT_GLOVE = 82;         // 장갑과 풍선이 맞닿는(문지르는) 거리

  const PRESET = {
    1: { glove: { x: 170, y: 400 }, red: { x: 170, y: 220 } },
    2: { glove: { x: 110, y: 420 }, red: { x: 240, y: 280 } },
    3: { glove: { x: 240, y: 285 }, red: { x: 110, y: 150 } },
  };
  const HINT = {
    1: '🧤 장갑을 잡고 풍선 위에서 문질러 보세요',
    2: '🎈 빨간 풍선을 잡고 초록 풍선에 가까이 가져가 보세요',
    3: '🧤 장갑을 초록 풍선에 가까이 가져가 보세요',
  };

  /* ---------- 상태 ---------- */
  const st = {
    step: 1,
    rub: { green: 0, red: 0 },
    red: { ...PRESET[1].red },
    glove: { ...PRESET[1].glove },
    theta: 0,
    omega: 0,
    drag: null,          // 'glove' | 'red' | null
    grab: { x: 0, y: 0 },
    lastRubAt: -1e9,
    obs: { repel: false, attract: false },
    a: { red: 0, glove: 0 }, // 현재 힘의 세기 0~1
  };

  const qOf = (key) => Math.min(MAX_Q, Math.floor((st.rub[key] / RUB_MAX) * MAX_Q + 1e-9));
  const charges = () => {
    const green = qOf('green');
    const red = qOf('red');
    const glove = green + red; // 풍선이 얻은 전자만큼 장갑은 (+)
    console.assert(glove - green - red === 0, '전하 보존 위반');
    return { green, red, glove };
  };
  const greenPos = () => ({
    x: PIVOT.x + L * Math.sin(st.theta),
    y: PIVOT.y + L * Math.cos(st.theta),
  });

  // 힘의 세기 0~1: 전하 곱에 비례, 거리에 반비례. 맞닿으면 0(문지르는 중)
  function strength(product, d, contact) {
    if (product <= 0) return 0;
    const touch = clamp((d - contact) / 25, 0, 1);
    const near = clamp((RANGE - d) / 60, 0, 1);
    const a = Math.min(1, (K * product) / Math.max(d, 1)) * near * touch;
    return a < MIN_STRENGTH ? 0 : a;
  }

  /* ---------- 물리 ---------- */
  function update(dt) {
    const q = charges();
    const g = greenPos();
    const aRed = strength(q.green * q.red, dist(g, st.red), CONTACT_BALLOON);
    const aGlove = strength(q.green * q.glove, dist(g, st.glove), CONTACT_GLOVE);
    st.a.red = aRed;
    st.a.glove = aGlove;
    if (aRed > 0.3) st.obs.repel = true;
    if (aGlove > 0.3) st.obs.attract = true;

    // 초록 풍선에 작용하는 힘: 빨간 풍선은 같은 (−)라서 척력, 장갑은 (+)라서 인력
    const away = norm({ x: g.x - st.red.x, y: g.y - st.red.y });
    const toward = norm({ x: st.glove.x - g.x, y: st.glove.y - g.y });
    const fx = away.x * aRed + toward.x * aGlove;
    const fy = away.y * aRed + toward.y * aGlove;

    const steps = 2;
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const tx = Math.cos(st.theta);
      const ty = -Math.sin(st.theta);
      const alpha = -(GRAV / L) * Math.sin(st.theta) + (FORCE * (fx * tx + fy * ty)) / L - DAMP * st.omega;
      st.omega += alpha * h;
      st.theta = clamp(st.theta + st.omega * h, -1.2, 1.2);
    }
  }

  /* ---------- 입력 ---------- */
  function pointerPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }
  const hitGlove = (p) => Math.abs(p.x - st.glove.x) < 46 && Math.abs(p.y - st.glove.y) < 62;
  const hitRed = (p) => {
    const dx = (p.x - st.red.x) / (RX + 8);
    const dy = (p.y - st.red.y) / (RY + 8);
    return dx * dx + dy * dy <= 1;
  };
  const inEllipse = (p, c) => {
    const dx = (p.x - c.x) / (RX + 40);
    const dy = (p.y - c.y) / (RY + 40);
    return dx * dx + dy * dy <= 1;
  };

  canvas.addEventListener('pointerdown', (e) => {
    const p = pointerPos(e);
    if (hitGlove(p)) { st.drag = 'glove'; st.grab = { x: p.x - st.glove.x, y: p.y - st.glove.y }; }
    else if (hitRed(p)) { st.drag = 'red'; st.grab = { x: p.x - st.red.x, y: p.y - st.red.y }; }
    else return;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
    hint.classList.add('is-hidden');
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = pointerPos(e);
    if (!st.drag) {
      canvas.style.cursor = hitGlove(p) || hitRed(p) ? 'grab' : 'default';
      return;
    }
    const obj = st.drag === 'glove' ? st.glove : st.red;
    const prev = { ...obj };
    obj.x = clamp(p.x - st.grab.x, 46, W - 46);
    obj.y = clamp(p.y - st.grab.y, 60, H - 60);

    if (st.drag === 'glove') {
      const d = Math.min(dist(prev, obj), 40);
      if (d < 0.5) return;
      for (const [key, pos] of [['green', greenPos()], ['red', st.red]]) {
        if (inEllipse(obj, pos) && st.rub[key] < RUB_MAX) {
          st.rub[key] = Math.min(RUB_MAX, st.rub[key] + d);
          st.lastRubAt = now();
        }
      }
    }
  });

  function endDrag(e) {
    if (!st.drag) return;
    st.drag = null;
    canvas.style.cursor = 'grab';
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  /* ---------- 왼쪽 그리기 ---------- */
  function dot(x, y, r, color, sign) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${r * 1.5}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sign, x, y + 0.5);
    ctx.restore();
  }

  function label(text, x, y) {
    ctx.save();
    ctx.fillStyle = 'rgba(241,245,249,0.85)';
    ctx.font = '700 16px "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function drawStand() {
    ctx.save();
    ctx.fillStyle = '#475569';
    ctx.beginPath(); ctx.roundRect(500, 468, 132, 20, 6); ctx.fill();
    ctx.fillStyle = '#64748b';
    ctx.fillRect(578, 44, 12, 430);
    ctx.beginPath(); ctx.roundRect(PIVOT.x - 12, 44, 590 - PIVOT.x + 12, 12, 5); ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath(); ctx.arc(PIVOT.x, PIVOT.y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function balloonBody(base) {
    const g = ctx.createRadialGradient(-14, -20, 6, 0, 0, RY + 6);
    g.addColorStop(0, base[0]);
    g.addColorStop(0.55, base[1]);
    g.addColorStop(1, base[2]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, RX, RY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(-17, -24, 8, 15, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function balloonMarks(n) {
    const slots = [[-16, -18], [16, -18], [-16, 16], [16, 16]];
    for (let k = 0; k < n; k++) dot(slots[k][0], slots[k][1], 10, COLOR.minus, MINUS);
  }

  const GREEN = ['#bbf7d0', '#22c55e', '#15803d'];
  const RED = ['#fecaca', '#ef4444', '#b91c1c'];

  function drawGreen(q) {
    const g = greenPos();
    const dirx = Math.sin(st.theta);
    const diry = Math.cos(st.theta);
    // 실
    ctx.save();
    ctx.strokeStyle = 'rgba(226,232,240,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PIVOT.x, PIVOT.y);
    ctx.lineTo(g.x - dirx * (RY + 8), g.y - diry * (RY + 8));
    ctx.stroke();
    // 풍선 (매듭이 위쪽)
    ctx.translate(g.x, g.y);
    ctx.rotate(-st.theta);
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.moveTo(0, -RY + 2); ctx.lineTo(-6, -RY - 9); ctx.lineTo(6, -RY - 9);
    ctx.closePath(); ctx.fill();
    balloonBody(GREEN);
    balloonMarks(q);
    ctx.restore();
    label('초록 풍선', g.x, g.y + RY + 26);
  }

  function drawRed(q) {
    const { x, y } = st.red;
    ctx.save();
    // 손과 소매
    ctx.translate(x, y);
    ctx.fillStyle = '#3b6fb0';
    ctx.beginPath(); ctx.roundRect(8, RY + 26, 84, 26, 10); ctx.fill();
    ctx.fillStyle = '#f2c9a5';
    ctx.beginPath(); ctx.arc(2, RY + 28, 14, 0, Math.PI * 2); ctx.fill();
    // 끈과 매듭
    ctx.strokeStyle = 'rgba(226,232,240,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, RY + 8);
    ctx.bezierCurveTo(-8, RY + 16, 8, RY + 22, 0, RY + 28);
    ctx.stroke();
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(0, RY - 2); ctx.lineTo(-6, RY + 9); ctx.lineTo(6, RY + 9);
    ctx.closePath(); ctx.fill();
    balloonBody(RED);
    balloonMarks(q);
    ctx.restore();
    label('빨간 풍선', x, y - RY - 12);
  }

  function drawGlove(n) {
    const { x, y } = st.glove;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#f1f5f9';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    // 손가락
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.roundRect(-30 + i * 15.5, -58, 14, 34, 7); ctx.fill(); ctx.stroke();
    }
    // 엄지
    ctx.beginPath(); ctx.ellipse(-36, -4, 9, 22, 0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // 손바닥
    ctx.beginPath(); ctx.roundRect(-32, -34, 64, 64, 12); ctx.fill(); ctx.stroke();
    // 소매(커프스)
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath(); ctx.roundRect(-30, 30, 60, 26, 6); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-30, 40); ctx.lineTo(30, 40); ctx.stroke();
    // (+) 전하
    for (let k = 0; k < n; k++) {
      dot(-24 + (k % 4) * 16, -14 + Math.floor(k / 4) * 20, 7, COLOR.plus, '+');
    }
    ctx.restore();
    label('면장갑', x, y - 70);
  }

  function drawLeft() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(148,163,184,0.10)';
    ctx.fillRect(0, H - 28, W, 28);
    drawStand();

    const q = charges();
    drawGreen(q.green);
    drawRed(q.red);
    drawGlove(q.glove);

    const g = greenPos();
    ctx.save();
    ctx.fillStyle = COLOR.accent;
    ctx.font = '700 16px "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    if (st.a.red > 0.25) ctx.fillText('서로 밀어내요!', g.x, g.y + RY + 48);
    else if (st.a.glove > 0.25) ctx.fillText('서로 끌어당겨요!', g.x, g.y + RY + 48);
    ctx.restore();
  }

  /* ============================================================
     오른쪽 SVG
     ============================================================ */
  const svg = document.getElementById('obSvg');

  el('defs', {}, svg).innerHTML =
    '<marker id="obArrowA" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#a5b4fc"/></marker>' +
    '<marker id="obArrowR" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#fbbf24"/></marker>';

  function pill(parent, x, y, text, fill, w = 84) {
    el('rect', { x: x - w / 2, y: y - 15, width: w, height: 30, rx: 15, fill, stroke: 'rgba(255,255,255,0.4)' }, parent);
    const t = el('text', { x, y: y + 1, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#fff', 'font-size': 14, 'font-weight': 700 }, parent);
    t.textContent = text;
    return t;
  }

  const CY = 215;
  const CIRCLE = {
    glove: { fill: 'rgba(226,232,240,0.10)', stroke: '#e2e8f0', pill: '#64748b', name: '면장갑' },
    green: { fill: 'rgba(34,197,94,0.14)', stroke: '#22c55e', pill: '#16a34a', name: '초록 풍선' },
    red: { fill: 'rgba(239,68,68,0.14)', stroke: '#ef4444', pill: '#dc2626', name: '빨간 풍선' },
  };
  // 처음(중성)에는 양성자와 전자의 수가 같다. 장갑은 원자가 더 많은 물체로 그린다.
  const P_GLOVE = 10;
  const P_BALLOON = 6;

  /* 장면 A (1단계): 면장갑 ─┬─ 초록 풍선
                            └─ 빨간 풍선  (모두 양성자(+)와 전자(−)를 무작위로 섞어서 그림) */
  const sceneA = el('g', {}, svg);
  const A = {
    glove: { x: 125, y: 200, r: 105, p: P_GLOVE, mark: 9 },
    green: { x: 345, y: 104, r: 76, p: P_BALLOON, mark: 8 },
    red: { x: 345, y: 296, r: 76, p: P_BALLOON, mark: 8 },
  };
  // 연결선(화살표 아님): 장갑에서 두 풍선으로 갈라지는 모양
  el('path', { d: 'M 230 200 H 250 M 250 104 V 296 M 250 104 H 269 M 250 296 H 269', fill: 'none', stroke: '#64748b', 'stroke-width': 3, 'stroke-linecap': 'round' }, sceneA);
  const aCharges = {};
  for (const key of ['glove', 'green', 'red']) {
    const c = CIRCLE[key];
    const o = A[key];
    el('circle', { cx: o.x, cy: o.y, r: o.r, fill: c.fill, stroke: c.stroke, 'stroke-width': 3 }, sceneA);
    if (key === 'glove') pill(sceneA, o.x, 62, c.name, c.pill);
    else pill(sceneA, 487, o.y, c.name, c.pill);
    aCharges[key] = createCharges(sceneA, o.x, o.y, o.r, o.p, 10, o.mark);
  }

  /* 전자(−)의 이동 애니메이션: 장갑의 오른쪽 전자부터 풍선의 빈 전자 자리로 옮겨 간다.
     각 풍선이 얻을 수 있는 전자는 MAX_Q개, 진행도 0~1 */
  const progress = { green: new Array(MAX_Q).fill(0), red: new Array(MAX_Q).fill(0) };
  const gloveOrder = aCharges.glove.ePos
    .map((_, i) => i)
    .sort((i, j) => aCharges.glove.ePos[j].x - aCharges.glove.ePos[i].x || aCharges.glove.ePos[i].y - aCharges.glove.ePos[j].y);
  const flights = [];
  for (const key of ['green', 'red']) {
    for (let k = 0; k < MAX_Q; k++) {
      flights.push({
        key,
        k,
        src: aCharges.glove.ePos[gloveOrder[key === 'green' ? 2 * k : 2 * k + 1]],
        srcIdx: gloveOrder[key === 'green' ? 2 * k : 2 * k + 1],
        dst: aCharges[key].ePos[P_BALLOON + k],
        bow: key === 'green' ? -45 : 45,
        g: chargeMark(sceneA, '-', A.glove.mark),
      });
    }
  }
  flights.forEach((f) => place(f.g, f.src.x, f.src.y, false));

  /* 장면 B (2, 3단계): 두 물체 사이의 힘 */
  const sceneB = el('g', {}, svg);
  const B = { left: 150, right: 450, r: 100 };
  const bLeftCircle = el('circle', { cx: B.left, cy: CY, r: B.r, 'stroke-width': 3 }, sceneB);
  const bRightCircle = el('circle', { cx: B.right, cy: CY, r: B.r, 'stroke-width': 3 }, sceneB);
  const bLeftPill = { rect: el('rect', { x: B.left - 42, y: 55, width: 84, height: 30, rx: 15, stroke: 'rgba(255,255,255,0.4)' }, sceneB) };
  bLeftPill.text = el('text', { x: B.left, y: 71, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#fff', 'font-size': 14, 'font-weight': 700 }, sceneB);
  const bRightPill = { rect: el('rect', { x: B.right - 42, y: 55, width: 84, height: 30, rx: 15, stroke: 'rgba(255,255,255,0.4)' }, sceneB) };
  bRightPill.text = el('text', { x: B.right, y: 71, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#fff', 'font-size': 14, 'font-weight': 700 }, sceneB);

  // 양쪽 모두 양성자(+)와 전자(−)를 격자로 그린다. 2단계: 초록 풍선 | 빨간 풍선, 3단계: 면장갑 | 초록 풍선
  const bLeftCharges = createCharges(sceneB, B.left, CY, B.r, P_GLOVE, 10, 10);
  const bRightCharges = createCharges(sceneB, B.right, CY, B.r, P_GLOVE, 10, 10);

  const mkArrow = (x1, x2, y) => el('line', { x1, x2, y1: y, y2: y, 'stroke-width': 6, 'stroke-linecap': 'round' }, sceneB);
  const arrows = [mkArrow(0, 0, CY), mkArrow(0, 0, CY)];
  const forceText = el('text', { x: 300, y: 350, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800 }, sceneB);

  /* ---------- DOM ---------- */
  const hint = document.getElementById('obHint');
  const stepTabs = [...document.querySelectorAll('.step-tab')];
  const fillG = document.getElementById('obFillG');
  const fillR = document.getElementById('obFillR');
  const labelG = document.getElementById('obLabelG');
  const labelR = document.getElementById('obLabelR');
  const netGlove = document.getElementById('obNetGlove');
  const netGreen = document.getElementById('obNetGreen');
  const netRed = document.getElementById('obNetRed');
  const sumLine = document.getElementById('obSum');
  const caption = document.getElementById('obCaption');
  const log2 = document.getElementById('obLog2');
  const log3 = document.getElementById('obLog3');
  const log2Text = document.getElementById('obLog2Text');
  const log3Text = document.getElementById('obLog3Text');

  function setNet(elm, n, pos) {
    elm.textContent = fmtCharge(n);
    elm.className = 'net-val mono ' + (n === 0 ? '' : pos ? 'pos' : 'neg');
  }

  function updateFlights(q, dt) {
    for (const key of ['green', 'red']) {
      for (let k = 0; k < MAX_Q; k++) {
        const goal = k < q[key] ? 1 : 0;
        const p = progress[key][k];
        if (p < goal) progress[key][k] = Math.min(goal, p + dt / 0.9);
        else if (p > goal) progress[key][k] = Math.max(goal, p - dt / 0.3);
      }
    }
  }

  // 1단계 그림: 이동 중인 전자는 곡선을 따라 날아가고, 도착하면 풍선의 전자로 들어간다
  function renderRub() {
    const hide = new Set();
    const arrivedBy = { green: 0, red: 0 };
    for (const f of flights) {
      const p = progress[f.key][f.k];
      if (p > 0) hide.add(f.srcIdx);
      if (p >= 1) arrivedBy[f.key]++;
      if (p > 0 && p < 1) {
        const t = p * p * (3 - 2 * p);
        const cx = (f.src.x + f.dst.x) / 2;
        const cy = (f.src.y + f.dst.y) / 2 + f.bow;
        const x = (1 - t) * (1 - t) * f.src.x + 2 * (1 - t) * t * cx + t * t * f.dst.x;
        const y = (1 - t) * (1 - t) * f.src.y + 2 * (1 - t) * t * cy + t * t * f.dst.y;
        place(f.g, x, y);
      } else {
        place(f.g, f.src.x, f.src.y, false);
      }
    }
    aCharges.glove.set(P_GLOVE, P_GLOVE, 0, hide);
    aCharges.green.set(P_BALLOON, P_BALLOON + arrivedBy.green);
    aCharges.red.set(P_BALLOON, P_BALLOON + arrivedBy.red);
  }

  function renderRight(dt = 0) {
    const q = charges();
    updateFlights(q, dt);

    sceneA.style.display = st.step === 1 ? '' : 'none';
    sceneB.style.display = st.step === 1 ? 'none' : '';

    if (st.step === 1) {
      renderRub();
    } else {
      // 2단계: 초록 풍선 | 빨간 풍선 (척력), 3단계: 면장갑 | 초록 풍선 (인력)
      const isRed = st.step === 2;
      const left = isRed ? CIRCLE.green : CIRCLE.glove;
      const right = isRed ? CIRCLE.red : CIRCLE.green;
      const a = isRed ? st.a.red : st.a.glove;

      bLeftCircle.setAttribute('fill', left.fill);
      bLeftCircle.setAttribute('stroke', left.stroke);
      bRightCircle.setAttribute('fill', right.fill);
      bRightCircle.setAttribute('stroke', right.stroke);
      bLeftPill.rect.setAttribute('fill', left.pill);
      bLeftPill.text.textContent = left.name;
      bRightPill.rect.setAttribute('fill', right.pill);
      bRightPill.text.textContent = right.name;

      if (isRed) {
        bLeftCharges.set(P_BALLOON, P_BALLOON + q.green);
        bRightCharges.set(P_BALLOON, P_BALLOON + q.red);
      } else {
        bLeftCharges.set(P_GLOVE, P_GLOVE - q.glove);
        bRightCharges.set(P_BALLOON, P_BALLOON + q.green);
      }

      // 화살표: 같은 부호는 밀어냄(가운데에서 바깥쪽), 다른 부호는 끌어당김(바깥에서 가운데)
      const len = 12 + 24 * a;
      const color = isRed ? '#fbbf24' : '#a5b4fc';
      const marker = isRed ? 'url(#obArrowR)' : 'url(#obArrowA)';
      const [l, r] = arrows;
      if (isRed) {
        l.setAttribute('x1', 292); l.setAttribute('x2', 292 - len);
        r.setAttribute('x1', 308); r.setAttribute('x2', 308 + len);
      } else {
        l.setAttribute('x1', B.left + B.r + 6); l.setAttribute('x2', B.left + B.r + 6 + len);
        r.setAttribute('x1', B.right - B.r - 6); r.setAttribute('x2', B.right - B.r - 6 - len);
      }
      for (const ar of arrows) {
        ar.setAttribute('stroke', color);
        ar.setAttribute('marker-end', marker);
        ar.style.opacity = a > 0 ? 0.35 + 0.65 * a : 0;
      }
      forceText.setAttribute('fill', color);
      forceText.textContent = isRed ? '밀어내는 힘 (척력)' : '끌어당기는 힘 (인력)';
      forceText.style.opacity = a > 0 ? 1 : 0;
    }

    // 전하 표시
    setNet(netGlove, q.glove, true);
    setNet(netGreen, -q.green, false);
    setNet(netRed, -q.red, false);
    sumLine.textContent = `(${fmtCharge(q.glove)}) + (${fmtCharge(-q.green)}) + (${fmtCharge(-q.red)}) = 0  · 전하의 총량은 변하지 않아요`;

    // 게이지
    const pg = Math.round((st.rub.green / RUB_MAX) * 100);
    const pr = Math.round((st.rub.red / RUB_MAX) * 100);
    fillG.style.width = `${pg}%`; labelG.textContent = `${pg}%`;
    fillR.style.width = `${pr}%`; labelR.textContent = `${pr}%`;

    // 관찰 기록
    log2.classList.toggle('is-done', st.obs.repel);
    log3.classList.toggle('is-done', st.obs.attract);
    log2.querySelector('.obs-mark').textContent = st.obs.repel ? '✔' : '○';
    log3.querySelector('.obs-mark').textContent = st.obs.attract ? '✔' : '○';
    log2Text.textContent = st.obs.repel ? '풍선이 멀어져요 (밀어냄)' : '관찰 전';
    log3Text.textContent = st.obs.attract ? '풍선이 다가와요 (끌어당김)' : '관찰 전';

    caption.textContent = captionText(q);
  }

  function captionText(q) {
    if (st.step === 1) {
      if (q.green + q.red === 0) return '면장갑으로 풍선을 문지르면 어떻게 될까요? 장갑을 잡고 두 풍선을 각각 문질러 보세요.';
      return '문지르면 전자(−)가 면장갑에서 풍선으로 이동해요. 풍선은 (−)전하로, 면장갑은 (+)전하로 대전돼요.';
    }
    if (st.step === 2) {
      if (q.green === 0 || q.red === 0) return '두 풍선이 모두 대전되어야 해요. 1단계에서 두 풍선을 각각 문질러 보세요.';
      if (st.a.red === 0) return '빨간 풍선을 초록 풍선에 가까이 가져가 보세요. 가까울수록 힘이 세져요.';
      return '두 풍선은 모두 (−)전하라서 같은 종류의 전하끼리 서로 밀어내요(척력). 그래서 매달린 풍선이 멀어져요.';
    }
    if (q.green === 0 || q.glove === 0) return '풍선이 대전되어야 해요. 1단계에서 풍선을 문질러 보세요.';
    if (st.a.glove === 0) return '장갑을 초록 풍선에 가까이 가져가 보세요. 가까울수록 힘이 세져요.';
    return '풍선은 (−), 면장갑은 (+)전하라서 다른 종류의 전하끼리 서로 끌어당겨요(인력). 그래서 매달린 풍선이 장갑 쪽으로 다가와요.';
  }

  /* ---------- 단계, 초기화 ---------- */
  function setStep(n, keepPos) {
    st.step = n;
    stepTabs.forEach((b) => {
      const on = +b.dataset.step === n;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', String(on));
    });
    if (!keepPos) {
      st.glove = { ...PRESET[n].glove };
      st.red = { ...PRESET[n].red };
    }
    hint.textContent = HINT[n];
    hint.classList.remove('is-hidden');
  }
  stepTabs.forEach((b) => b.addEventListener('click', () => setStep(+b.dataset.step)));

  function reset() {
    st.rub = { green: 0, red: 0 };
    st.theta = 0;
    st.omega = 0;
    st.drag = null;
    st.lastRubAt = -1e9;
    st.obs = { repel: false, attract: false };
    st.a = { red: 0, glove: 0 };
    for (const key of ['green', 'red']) progress[key].fill(0);
    setStep(1);
  }
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (!root.hidden) reset();
  });

  /* ---------- 메인 루프 ---------- */
  let last = now();
  function tick() {
    const t = now();
    const dt = Math.min(0.033, (t - last) / 1000);
    last = t;
    if (!root.hidden) {
      update(dt);
      drawLeft();
      renderRight(dt);
    }
    requestAnimationFrame(tick);
  }

  function setup() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  setup();
  window.addEventListener('resize', setup);
  setStep(1);
  requestAnimationFrame(tick);
})();
