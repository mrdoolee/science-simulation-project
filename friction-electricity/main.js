'use strict';

/* ============================================================
   마찰전기 대전 시뮬레이션
   - 왼쪽 Canvas: 풍선을 드래그해 털가죽에 문지른다 (마찰량 누적)
   - 오른쪽 SVG : 마찰량에 비례해 털가죽 → 풍선으로 전자가 이동한다
   ============================================================ */

/* ---------- 상수 ---------- */
const W = 640;
const H = 500;
const PAIRS = 6;          // 각 물체가 처음 가진 (+)/(−) 쌍의 수
const MAX_MOVE = 4;       // 이동 가능한 전자 최대 개수
const RUB_MAX = 1400;     // 이 거리(px)만큼 문지르면 최대 대전
const ATTRACT_K = 37.5;   // 인력 세기 계수: 순전하 4, 거리 150에서 세기 1
const ATTRACT_RANGE = 300;// 이 거리보다 멀면 인력 없음
const ATTRACT_MIN = 0.06; // 이보다 약하면 붙지 않음

const PAD = { x: 40, y: 270, w: 210, h: 170 };               // 털가죽
const HEAD = { x: 510, y: 410, r: 56 };                      // 머리
const BALLOON_START = { x: 330, y: 130 };
const BALLOON_RX = 46;
const BALLOON_RY = 58;

const COLOR = {
  plus: '#f43f5e',
  minus: '#10b981',
  balloon: '#3b82f6',
  fur: '#facc15',
  hair: '#fb923c',
  accent: '#a5b4fc',
};
const MINUS = '−';

/* ---------- 상태 ---------- */
const state = {
  rub: 0,
  balloon: { ...BALLOON_START },
  dragging: false,
  grab: { x: 0, y: 0 },
  lastRubAt: -1e9,
  everRubbed: false,
  tab: 'charge',
  progress: new Array(MAX_MOVE).fill(0), // 전자별 이동 진행도 0~1
};

const now = () => performance.now();
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/* ---------- 파생값 ---------- */
const movedTarget = () => Math.min(MAX_MOVE, Math.floor((state.rub / RUB_MAX) * MAX_MOVE + 1e-9));
const arrived = () => state.progress.filter((p) => p >= 1).length;
const inTransit = () => state.progress.some((p) => p > 0 && p < 1);

function phase() {
  if (now() - state.lastRubAt < 300 || inTransit()) return 'during';
  return arrived() > 0 ? 'after' : 'before';
}

// 인력 세기 0~1: 순전하량에 비례, 거리에 반비례
function attraction(charge, d) {
  if (charge <= 0) return 0;
  const near = clamp((ATTRACT_RANGE - d) / 60, 0, 1);
  const a = Math.min(1, (ATTRACT_K * charge) / Math.max(d, 1)) * near;
  return a < ATTRACT_MIN ? 0 : a;
}

// 전하 보존: 풍선 + 털가죽의 순전하 합은 항상 0
function netCharges() {
  const n = arrived();
  const balloon = PAIRS - (PAIRS + n); // (+) − (−)
  const fur = PAIRS - (PAIRS - n);
  console.assert(balloon + fur === 0, '전하 보존 위반');
  return { balloon, fur };
}

/* ============================================================
   왼쪽: Canvas
   ============================================================ */
const canvas = document.getElementById('rubCanvas');
const ctx = canvas.getContext('2d');

function setupCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function pointerPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
}

function hitBalloon(p) {
  const b = state.balloon;
  const dx = (p.x - b.x) / (BALLOON_RX + 10);
  const dy = (p.y - b.y) / (BALLOON_RY + 10);
  return dx * dx + dy * dy <= 1;
}

function overPad(b) {
  return b.x > PAD.x - 20 && b.x < PAD.x + PAD.w + 20 && b.y > PAD.y - 30 && b.y < PAD.y + PAD.h + 30;
}

canvas.addEventListener('pointerdown', (e) => {
  const p = pointerPos(e);
  if (!hitBalloon(p)) return;
  state.dragging = true;
  state.grab = { x: p.x - state.balloon.x, y: p.y - state.balloon.y };
  canvas.setPointerCapture(e.pointerId);
  canvas.style.cursor = 'grabbing';
  hideHint();
});

canvas.addEventListener('pointermove', (e) => {
  const p = pointerPos(e);
  if (!state.dragging) {
    canvas.style.cursor = hitBalloon(p) ? 'grab' : 'default';
    return;
  }
  const prev = { ...state.balloon };
  state.balloon.x = clamp(p.x - state.grab.x, BALLOON_RX, W - BALLOON_RX);
  state.balloon.y = clamp(p.y - state.grab.y, BALLOON_RY, H - BALLOON_RY - 40);

  if (overPad(state.balloon) && overPad(prev)) {
    const d = Math.min(dist(prev, state.balloon), 40);
    if (d > 0.5 && state.rub < RUB_MAX) {
      state.rub = Math.min(RUB_MAX, state.rub + d);
      state.lastRubAt = now();
      state.everRubbed = true;
      if (state.tab !== 'charge') setTab('charge');
    }
  }
});

function endDrag(e) {
  if (!state.dragging) return;
  state.dragging = false;
  canvas.style.cursor = 'grab';
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

/* ---------- 그리기 ---------- */
function drawFur(a, sway) {
  ctx.save();
  // 바탕
  const g = ctx.createLinearGradient(0, PAD.y, 0, PAD.y + PAD.h);
  g.addColorStop(0, '#fde68a');
  g.addColorStop(1, '#eab308');
  ctx.fillStyle = g;
  roundRect(PAD.x, PAD.y, PAD.w, PAD.h, 22);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 털 결
  const lean = (state.balloon.x > PAD.x + PAD.w / 2 ? 1 : -1) * a * 9;
  ctx.strokeStyle = 'rgba(161, 98, 7, 0.55)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 6; j++) {
      const x = PAD.x + 18 + i * 22 + (j % 2) * 8;
      const y = PAD.y + 16 + j * 26;
      const wob = Math.sin(sway * 3 + i + j) * a * 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + lean + wob, y + 14);
      ctx.stroke();
    }
  }

  // 남는 (+) 표시
  const n = arrived();
  for (let k = 0; k < n; k++) {
    drawChargeDot(PAD.x + 30 + k * 30, PAD.y + PAD.h - 24, 11, COLOR.plus, '+');
  }
  ctx.restore();

  ctx.fillStyle = 'rgba(241,245,249,0.85)';
  ctx.font = '700 18px "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('털가죽', PAD.x + PAD.w / 2, PAD.y - 10);
}

function drawHair(a, t) {
  const c = HEAD;
  ctx.save();
  // 머리(얼굴)
  ctx.fillStyle = '#fcd9b6';
  ctx.beginPath();
  ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#334155';
  ctx.beginPath(); ctx.arc(c.x - 20, c.y + 6, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(c.x + 20, c.y + 6, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(c.x, c.y + 20, 12, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();

  // 머리카락 가닥
  const N = 17;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#7c4a1e';
  ctx.lineWidth = 3;
  const L = 74;
  for (let i = 0; i < N; i++) {
    const th = lerp(-Math.PI * 0.97, -Math.PI * 0.03, i / (N - 1));
    const n = { x: Math.cos(th), y: Math.sin(th) };
    const root = { x: c.x + n.x * (c.r - 2), y: c.y + n.y * (c.r - 2) };
    const toB = norm({ x: state.balloon.x - root.x, y: state.balloon.y - root.y });
    const droop = norm({ x: n.x * 0.5, y: 1 });
    const wob = Math.sin(t * 9 + i * 1.7) * 0.06 * a;
    const up = { x: n.x + wob, y: n.y };
    const dir1 = norm({ x: lerp(up.x, toB.x, a), y: lerp(up.y, toB.y, a) });
    const dir2 = norm({ x: lerp(droop.x, toB.x, a), y: lerp(droop.y, toB.y, a) });
    const ctrl = { x: root.x + dir1.x * L * 0.6, y: root.y + dir1.y * L * 0.6 };
    const tip = { x: ctrl.x + dir2.x * L * 0.55, y: ctrl.y + dir2.y * L * 0.55 };
    ctx.beginPath();
    ctx.moveTo(root.x, root.y);
    ctx.quadraticCurveTo(ctrl.x, ctrl.y, tip.x, tip.y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = 'rgba(241,245,249,0.85)';
  ctx.font = '700 18px "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('머리카락', c.x, c.y + c.r + 22);
}

function drawBalloon() {
  const { x, y } = state.balloon;
  ctx.save();
  // 끈
  ctx.strokeStyle = 'rgba(203,213,225,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + BALLOON_RY + 8);
  ctx.bezierCurveTo(x - 14, y + BALLOON_RY + 30, x + 14, y + BALLOON_RY + 50, x, y + BALLOON_RY + 76);
  ctx.stroke();
  // 매듭
  ctx.fillStyle = '#2563eb';
  ctx.beginPath();
  ctx.moveTo(x, y + BALLOON_RY - 2);
  ctx.lineTo(x - 7, y + BALLOON_RY + 10);
  ctx.lineTo(x + 7, y + BALLOON_RY + 10);
  ctx.closePath();
  ctx.fill();
  // 몸통
  const g = ctx.createRadialGradient(x - 16, y - 22, 6, x, y, BALLOON_RY + 6);
  g.addColorStop(0, '#93c5fd');
  g.addColorStop(0.55, '#3b82f6');
  g.addColorStop(1, '#1d4ed8');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, BALLOON_RX, BALLOON_RY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // 하이라이트
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(x - 18, y - 26, 8, 15, -0.5, 0, Math.PI * 2);
  ctx.fill();
  // 남는 (−) 표시
  const n = arrived();
  for (let k = 0; k < n; k++) {
    const a = (k / MAX_MOVE) * Math.PI * 2 + 0.6;
    drawChargeDot(x + Math.cos(a) * 22, y + 6 + Math.sin(a) * 26, 10, COLOR.minus, MINUS);
  }
  ctx.restore();
}

function drawChargeDot(x, y, r, color, sign) {
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

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function norm(v) {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
}

/* 풍선-털가죽/머리카락 사이 인력 (현재 프레임 값) */
const pull = { fur: 0, hair: 0 };

function updatePull() {
  const Q = arrived();
  const padCenter = { x: PAD.x + PAD.w / 2, y: PAD.y + PAD.h / 2 };
  pull.fur = attraction(Q, dist(state.balloon, padCenter));
  pull.hair = attraction(Q, dist(state.balloon, HEAD));
}

// 놓은 풍선이 털가죽에 끌려가 붙는다
function driftBalloon(dt) {
  if (state.dragging || pull.fur <= 0) return;
  const padCenter = { x: PAD.x + PAD.w / 2, y: PAD.y + PAD.h / 2 };
  const d = dist(state.balloon, padCenter);
  if (d < 105) return;
  const v = norm({ x: padCenter.x - state.balloon.x, y: padCenter.y - state.balloon.y });
  const step = Math.min(d - 105, pull.fur * 160 * dt);
  state.balloon.x += v.x * step;
  state.balloon.y += v.y * step;
}

function drawLeft(t) {
  ctx.clearRect(0, 0, W, H);
  // 바닥
  ctx.fillStyle = 'rgba(148,163,184,0.10)';
  ctx.fillRect(0, H - 28, W, 28);

  drawFur(pull.fur, t);
  drawHair(pull.hair, t);
  drawBalloon();

  // 인력 표시(털가죽 쪽)
  if (pull.fur > 0.2 && !state.dragging) {
    ctx.fillStyle = COLOR.accent;
    ctx.font = '700 16px "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('끌려요!', state.balloon.x, state.balloon.y - BALLOON_RY - 12);
  }
  if (pull.hair > 0.2) {
    ctx.fillStyle = COLOR.accent;
    ctx.font = '700 16px "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('머리카락이 올라와요!', state.balloon.x, state.balloon.y - BALLOON_RY - 12);
  }
}

/* ============================================================
   오른쪽: SVG
   ============================================================ */
const svg = document.getElementById('rightSvg');
const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

function chargeMark(parent, sign, r) {
  const g = el('g', {}, parent);
  const isPlus = sign === '+';
  el('circle', { r, fill: isPlus ? COLOR.plus : COLOR.minus, stroke: 'rgba(255,255,255,0.85)', 'stroke-width': 1.5 }, g);
  const t = el('text', {
    'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#fff',
    'font-size': r * 1.5, 'font-weight': 800, y: 1,
  }, g);
  t.textContent = isPlus ? '+' : MINUS;
  return g;
}

function place(g, x, y, visible = true, opacity = 1) {
  g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
  g.style.display = visible ? '' : 'none';
  g.style.opacity = opacity;
}

const polar = (cx, cy, r, deg) => ({
  x: cx + r * Math.cos((deg * Math.PI) / 180),
  y: cy + r * Math.sin((deg * Math.PI) / 180),
});

/* --- 장면 1: 대전 과정 --- */
const CB = { x: 170, y: 215, r: 125 }; // 풍선 원
const CF = { x: 430, y: 215, r: 125 }; // 털가죽 원

const sceneCharge = el('g', {}, svg);
el('circle', { cx: CB.x, cy: CB.y, r: CB.r, fill: 'rgba(59,130,246,0.14)', stroke: COLOR.balloon, 'stroke-width': 3 }, sceneCharge);
el('circle', { cx: CF.x, cy: CF.y, r: CF.r, fill: 'rgba(250,204,21,0.12)', stroke: COLOR.fur, 'stroke-width': 3 }, sceneCharge);
labelPill(sceneCharge, CB.x, 62, '풍선', COLOR.balloon);
labelPill(sceneCharge, CF.x, 62, '털가죽', '#ca8a04');

function labelPill(parent, x, y, text, fill) {
  el('rect', { x: x - 34, y: y - 15, width: 68, height: 30, rx: 15, fill, stroke: 'rgba(255,255,255,0.4)' }, parent);
  const t = el('text', { x, y: y + 1, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#fff', 'font-size': 15, 'font-weight': 700 }, parent);
  t.textContent = text;
}

// (+) 고정 전하: 각 원 안쪽 육각형 배치
const plusB = [], plusF = [];
for (let k = 0; k < PAIRS; k++) {
  const pb = polar(CB.x, CB.y, 45, 30 + 60 * k);
  const pf = polar(CF.x, CF.y, 45, 30 + 60 * k);
  const gb = chargeMark(sceneCharge, '+', 11);
  const gf = chargeMark(sceneCharge, '+', 11);
  place(gb, pb.x, pb.y);
  place(gf, pf.x, pf.y);
  plusB.push(gb); plusF.push(gf);
}
// 풍선 (−) 고유 전자
for (let k = 0; k < PAIRS; k++) {
  const p = polar(CB.x, CB.y, 88, 60 * k);
  place(chargeMark(sceneCharge, '-', 10), p.x, p.y);
}
// 털가죽 (−) 전자: 왼쪽(풍선 쪽)부터 이동 대상 → 정렬 순서 [180,120,240,60,300,0]
const FUR_ORDER = [180, 120, 240, 60, 300, 0];
const BALLOON_SLOTS = [330, 30, 90, 270];
const furElectrons = FUR_ORDER.map((deg, i) => {
  const start = polar(CF.x, CF.y, 88, deg);
  const g = chargeMark(sceneCharge, '-', 10);
  place(g, start.x, start.y);
  const slot = i < MAX_MOVE ? polar(CB.x, CB.y, 88, BALLOON_SLOTS[i]) : null;
  return { g, start, slot, bow: i % 2 === 0 ? -55 : 55 };
});

/* --- 장면 2·3: 인력 --- */
const AB = { x: 150, y: 215, r: 100 };
const AT = { x: 450, y: 215, r: 100 };
const sceneAttract = el('g', {}, svg);
sceneAttract.style.display = 'none';

el('defs', {}, sceneAttract).innerHTML =
  '<marker id="arrowHead" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">' +
  '<path d="M0 0 L10 5 L0 10 z" fill="#a5b4fc"/></marker>';

const attractBalloonCircle = el('circle', { cx: AB.x, cy: AB.y, r: AB.r, fill: 'rgba(59,130,246,0.14)', stroke: COLOR.balloon, 'stroke-width': 3 }, sceneAttract);
const attractTargetCircle = el('circle', { cx: AT.x, cy: AT.y, r: AT.r, 'stroke-width': 3 }, sceneAttract);
labelPill(sceneAttract, AB.x, 78, '풍선', COLOR.balloon);
const targetLabel = el('g', {}, sceneAttract);
const targetLabelText = { rect: null, text: null };
{
  targetLabelText.rect = el('rect', { x: AT.x - 40, y: 63, width: 80, height: 30, rx: 15, stroke: 'rgba(255,255,255,0.4)' }, targetLabel);
  targetLabelText.text = el('text', { x: AT.x, y: 79, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#fff', 'font-size': 15, 'font-weight': 700 }, targetLabel);
}

const attractBalloonMarks = [];
for (let k = 0; k < MAX_MOVE; k++) {
  const g = chargeMark(sceneAttract, '-', 12);
  const p = { x: AB.x - 30 + (k % 2) * 60, y: AB.y - 22 + Math.floor(k / 2) * 52 };
  place(g, p.x, p.y, false);
  g.dataset.x = p.x; g.dataset.y = p.y;
  attractBalloonMarks.push(g);
}
// 대상 쪽 전하: (+)는 풍선과 가까운 왼쪽, (−)는 먼 오른쪽
const targetPlus = [], targetMinus = [];
const TARGET_SLOTS = [[-72, -32], [-72, 32], [-40, -64], [-40, 64]];
for (let k = 0; k < MAX_MOVE; k++) {
  const gp = chargeMark(sceneAttract, '+', 12);
  const gm = chargeMark(sceneAttract, '-', 12);
  const [dx, dy] = TARGET_SLOTS[k];
  place(gp, AT.x + dx, AT.y + dy, false);
  place(gm, AT.x - dx, AT.y + dy, false);
  targetPlus.push({ g: gp, x: AT.x + dx, y: AT.y + dy });
  targetMinus.push({ g: gm, x: AT.x - dx, y: AT.y + dy });
}

const arrowL = el('line', { y1: AB.y, y2: AB.y, stroke: COLOR.accent, 'stroke-width': 6, 'stroke-linecap': 'round', 'marker-end': 'url(#arrowHead)' }, sceneAttract);
const arrowR = el('line', { y1: AT.y, y2: AT.y, stroke: COLOR.accent, 'stroke-width': 6, 'stroke-linecap': 'round', 'marker-end': 'url(#arrowHead)' }, sceneAttract);
const pullText = el('text', { x: 300, y: 175, 'text-anchor': 'middle', fill: COLOR.accent, 'font-size': 16, 'font-weight': 800 }, sceneAttract);
pullText.textContent = '인력';

/* ---------- DOM 참조 ---------- */
const gaugeFill = document.getElementById('gaugeFill');
const gaugeLabel = document.getElementById('gaugeLabel');
const gaugeEl = document.getElementById('gauge');
const netBalloon = document.getElementById('netBalloon');
const netFur = document.getElementById('netFur');
const sumLine = document.getElementById('sumLine');
const caption = document.getElementById('caption');
const chips = [...document.querySelectorAll('#phaseChips .chip')];
const chipsBox = document.getElementById('phaseChips');
const tabs = [...document.querySelectorAll('.tab')];
const chargedBadge = document.getElementById('chargedBadge');
const hint = document.getElementById('hint');
const netCardsBox = document.getElementById('netCards');
const netCards = [...netCardsBox.querySelectorAll('.net-card .net-name')];

function hideHint() { hint.classList.add('is-hidden'); }

const fmtCharge = (n) => (n > 0 ? `+${n}` : n < 0 ? `${MINUS}${-n}` : '0');

/* ---------- 탭 ---------- */
function setTab(name) {
  state.tab = name;
  tabs.forEach((b) => {
    const on = b.dataset.tab === name;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', String(on));
  });
}
tabs.forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

/* ---------- 오른쪽 갱신 ---------- */
function updateRight(dt) {
  // 전자 이동 진행도 갱신
  const target = movedTarget();
  for (let k = 0; k < MAX_MOVE; k++) {
    const goal = k < target ? 1 : 0;
    const p = state.progress[k];
    if (p < goal) state.progress[k] = Math.min(goal, p + dt / 0.9);
    else if (p > goal) state.progress[k] = Math.max(goal, p - dt / 0.3);
  }

  const n = arrived();
  const net = netCharges();
  const ph = phase();

  // 공통 표시
  const pct = Math.round((state.rub / RUB_MAX) * 100);
  gaugeFill.style.width = `${pct}%`;
  gaugeLabel.textContent = `${pct}%`;
  gaugeEl.setAttribute('aria-valuenow', String(pct));
  chargedBadge.hidden = n < MAX_MOVE;

  const isCharge = state.tab === 'charge';
  sceneCharge.style.display = isCharge ? '' : 'none';
  sceneAttract.style.display = isCharge ? 'none' : '';
  chipsBox.classList.toggle('is-hidden', !isCharge);

  if (isCharge) renderCharge(ph, n, net);
  else renderAttract(n);
}

function renderCharge(ph, n, net) {
  // 전자 위치 (곡선 이동)
  furElectrons.forEach((e, i) => {
    const p = i < MAX_MOVE ? state.progress[i] : 0;
    if (!e.slot) { place(e.g, e.start.x, e.start.y); return; }
    const t = p * p * (3 - 2 * p);
    const cx = (e.start.x + e.slot.x) / 2;
    const cy = (e.start.y + e.slot.y) / 2 + e.bow;
    const x = (1 - t) * (1 - t) * e.start.x + 2 * (1 - t) * t * cx + t * t * e.slot.x;
    const y = (1 - t) * (1 - t) * e.start.y + 2 * (1 - t) * t * cy + t * t * e.slot.y;
    place(e.g, x, y);
  });

  chips.forEach((c) => c.classList.toggle('is-active', c.dataset.phase === ph));

  netCards[0].textContent = '풍선 순전하';
  netCards[1].textContent = '털가죽 순전하';
  setNet(net.balloon, net.fur);
  sumLine.textContent = `(${fmtCharge(-n)}) + (${fmtCharge(n)}) = 0  · 전하의 총량은 변하지 않아요`;

  caption.textContent =
    ph === 'before' ? '(+)전하와 (−)전하의 양이 같아서 두 물체는 전기를 띠지 않아요.'
    : ph === 'during' ? '풍선과 털가죽이 마찰하면 털가죽에서 풍선으로 전자(−)가 이동해요.'
    : '마찰한 후에 풍선은 (−)전하로 대전되고, 털가죽은 (+)전하로 대전돼요.';
}

function setNet(b, f) {
  netBalloon.textContent = fmtCharge(b);
  netFur.textContent = fmtCharge(f);
  netBalloon.className = 'net-val mono ' + (b < 0 ? 'neg' : b > 0 ? 'pos' : '');
  netFur.className = 'net-val mono ' + (f > 0 ? 'pos' : f < 0 ? 'neg' : '');
}

function renderAttract(n) {
  const isFur = state.tab === 'fur';
  const a = isFur ? pull.fur : pull.hair;

  attractTargetCircle.setAttribute('fill', isFur ? 'rgba(250,204,21,0.12)' : 'rgba(251,146,60,0.14)');
  attractTargetCircle.setAttribute('stroke', isFur ? COLOR.fur : COLOR.hair);
  targetLabelText.rect.setAttribute('fill', isFur ? '#ca8a04' : '#c2410c');
  targetLabelText.text.textContent = isFur ? '털가죽' : '머리카락';

  // 풍선 (−)
  attractBalloonMarks.forEach((g, k) => place(g, +g.dataset.x, +g.dataset.y, k < n));

  // 대상 전하
  const induced = isFur ? n : Math.round(a * MAX_MOVE);
  targetPlus.forEach((m, k) => place(m.g, m.x, m.y, k < induced));
  targetMinus.forEach((m, k) => place(m.g, m.x, m.y, !isFur && k < induced));

  // 화살표
  const len = 12 + 30 * a;
  arrowL.setAttribute('x1', AB.x + AB.r + 6);
  arrowL.setAttribute('x2', AB.x + AB.r + 6 + len);
  arrowR.setAttribute('x1', AT.x - AT.r - 6);
  arrowR.setAttribute('x2', AT.x - AT.r - 6 - len);
  arrowL.style.opacity = arrowR.style.opacity = a > 0 ? 0.35 + 0.65 * a : 0;
  pullText.style.opacity = a > 0 ? 1 : 0;

  setNet(-n, n);
  netCards[0].textContent = '풍선 순전하';
  netCards[1].textContent = isFur ? '털가죽 순전하' : '머리카락 순전하';
  if (!isFur) { netFur.textContent = '유도로 (+)/(−) 분리'; netFur.className = 'net-val mono'; }
  sumLine.textContent = `인력의 세기 ${Math.round(a * 100)}%`;

  if (n === 0) {
    caption.textContent = '풍선이 아직 대전되지 않았어요. 먼저 털가죽에 문질러 전자를 옮겨 보세요.';
  } else if (a === 0) {
    caption.textContent = `풍선을 ${isFur ? '털가죽' : '머리카락'} 가까이 가져가 보세요. 대전된 정도가 클수록, 가까울수록 힘이 세져요.`;
  } else if (isFur) {
    caption.textContent = '(−)전하로 대전된 풍선과 (+)전하로 대전된 털가죽은 서로 끌어당겨요.';
  } else {
    caption.textContent = '(−)로 대전된 풍선이 가까이 오면 머리카락의 (+)전하는 풍선 쪽으로 끌려오고 (−)전하는 멀어져요. 가까운 (+)가 더 세게 당겨서 머리카락이 풍선에 붙어요.';
  }
}

/* ============================================================
   초기화 / 메인 루프
   ============================================================ */
function reset() {
  state.rub = 0;
  state.balloon = { ...BALLOON_START };
  state.dragging = false;
  state.lastRubAt = -1e9;
  state.everRubbed = false;
  state.progress.fill(0);
  hint.classList.remove('is-hidden');
  setTab('charge');
}
document.getElementById('resetBtn').addEventListener('click', reset);

let last = now();
function tick() {
  const t = now();
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;

  updatePull();
  driftBalloon(dt);
  updatePull();
  updateRight(dt);
  drawLeft(t / 1000);
  requestAnimationFrame(tick);
}

setupCanvas();
window.addEventListener('resize', setupCanvas);
setTab('charge');
requestAnimationFrame(tick);
