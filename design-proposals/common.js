'use strict';

/* 시안 공통 그림: 세 시안이 같은 장면(마찰전기 3단계 "장갑 가까이")을 그려서
   디자인 차이만 비교할 수 있게 한다. 색은 전부 CSS 클래스로 받아서 시안마다 바뀐다. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in (attrs || {})) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  const place = (g, x, y) => g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);

  /* 정사각 격자 자리: (i+j) 짝수는 양성자(+), 홀수는 전자(−) */
  function lattice(cx, cy, R, markR, needA, needB) {
    const rin = R - markR - 3;
    const minS = markR * 2 + 4;
    let found = null;
    for (let s = Math.floor(rin / 1.5); s >= minS; s--) {
      const A = [], B = [];
      const m = Math.floor(rin / s);
      for (let j = -m; j <= m; j++) {
        for (let i = -m; i <= m; i++) {
          const x = i * s, y = j * s, d = Math.hypot(x, y);
          if (d > rin) continue;
          ((i + j) % 2 === 0 ? A : B).push({ x: cx + x, y: cy + y, d, a: Math.atan2(y, x) });
        }
      }
      const byDist = (u, v) => u.d - v.d || u.a - v.a;
      A.sort(byDist); B.sort(byDist);
      found = { A, B };
      if (A.length >= needA && B.length >= needB) break;
    }
    return found;
  }

  function chargeMark(parent, sign, r) {
    const g = el('g', {}, parent);
    el('circle', { r, class: 'chg ' + (sign === '+' ? 'chg-plus' : 'chg-minus') }, g);
    const t = el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'chg-sign', 'font-size': r * 1.5, y: 1 }, g);
    t.textContent = sign === '+' ? '+' : '−';
    return g;
  }

  function pill(parent, x, y, text, cls) {
    const w = text.length * 19 + 40;
    el('rect', { x: x - w / 2, y: y - 18, width: w, height: 36, rx: 18, class: 'pill ' + cls }, parent);
    const t = el('text', { x, y: y + 1, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'pill-text', 'font-size': 19 }, parent);
    t.textContent = text;
  }

  /* 오른쪽 그림: 면장갑(왼쪽)과 초록 풍선(오른쪽), 서로 끌어당기는 상태 */
  function buildCharges(svg) {
    svg.setAttribute('viewBox', '0 0 600 400');
    const cy = 205, R = 100, left = 150, right = 450;
    el('circle', { cx: left, cy, r: R, class: 'obj obj-glove' }, svg);
    el('circle', { cx: right, cy, r: R, class: 'obj obj-balloon' }, svg);
    pill(svg, left, 62, '면장갑', 'pill-glove');
    pill(svg, right, 62, '초록 풍선', 'pill-balloon');

    const g = lattice(left, cy, R, 10, 10, 10);
    g.A.slice(0, 10).forEach((s) => place(chargeMark(svg, '+', 10), s.x, s.y));
    g.B.slice(0, 2).forEach((s) => place(chargeMark(svg, '-', 10), s.x, s.y));
    const b = lattice(right, cy, R, 10, 10, 10);
    b.A.slice(0, 6).forEach((s) => place(chargeMark(svg, '+', 10), s.x, s.y));
    b.B.slice(0, 10).forEach((s) => place(chargeMark(svg, '-', 10), s.x, s.y));

    // 서로 끌어당기는 화살표
    el('path', { d: 'M256 205 L292 205', class: 'force', 'marker-end': 'url(#head)' }, svg);
    el('path', { d: 'M344 205 L308 205', class: 'force', 'marker-end': 'url(#head)' }, svg);
    const defs = el('defs', {}, svg);
    defs.innerHTML = '<marker id="head" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="force-head"/></marker>';
    const t = el('text', { x: 300, y: 340, 'text-anchor': 'middle', class: 'svg-note', 'font-size': 22 }, svg);
    t.textContent = '다른 종류의 전하끼리 끌어당겨요';
  }

  /* 왼쪽 그림: 스탠드에 매달린 풍선이 장갑 쪽으로 끌려온 모습 */
  function buildStage(svg) {
    svg.setAttribute('viewBox', '0 0 640 440');
    el('rect', { x: 0, y: 404, width: 640, height: 36, class: 'floor' }, svg);
    el('rect', { x: 520, y: 396, width: 110, height: 16, rx: 5, class: 'stand' }, svg);
    el('rect', { x: 568, y: 40, width: 12, height: 360, class: 'stand' }, svg);
    el('rect', { x: 380, y: 40, width: 200, height: 12, rx: 5, class: 'stand' }, svg);
    el('circle', { cx: 396, cy: 46, r: 5, class: 'pivot' }, svg);

    // 진자: 왼쪽으로 14도 끌려온 풍선
    const grp = el('g', { transform: 'rotate(14 396 46)' }, svg);
    el('line', { x1: 396, y1: 46, x2: 396, y2: 250, class: 'string' }, grp);
    el('path', { d: 'M396 250 L389 261 L403 261 Z', class: 'knot' }, grp);
    el('ellipse', { cx: 396, cy: 310, rx: 42, ry: 54, class: 'balloon' }, grp);
    el('ellipse', { cx: 380, cy: 286, rx: 8, ry: 15, class: 'shine', transform: 'rotate(-30 380 286)' }, grp);
    const bm = [[-16, -16], [16, -16], [-16, 18], [16, 18]];
    bm.forEach(([dx, dy]) => place(chargeMark(grp, '-', 10), 396 + dx, 310 + dy));

    // 면장갑
    const gl = el('g', { transform: 'translate(170 300)' }, svg);
    for (let i = 0; i < 4; i++) el('rect', { x: -30 + i * 15.5, y: -58, width: 14, height: 34, rx: 7, class: 'glove' }, gl);
    el('ellipse', { cx: -36, cy: -4, rx: 9, ry: 22, transform: 'rotate(28 -36 -4)', class: 'glove' }, gl);
    el('rect', { x: -32, y: -34, width: 64, height: 64, rx: 12, class: 'glove' }, gl);
    el('rect', { x: -30, y: 30, width: 60, height: 26, rx: 6, class: 'cuff' }, gl);
    for (let k = 0; k < 8; k++) place(chargeMark(gl, '+', 7), -24 + (k % 4) * 16, -14 + Math.floor(k / 4) * 20);

    const l1 = el('text', { x: 170, y: 218, 'text-anchor': 'middle', class: 'stage-label', 'font-size': 24 }, svg);
    l1.textContent = '면장갑';
    const l2 = el('text', { x: 316, y: 396, 'text-anchor': 'middle', class: 'stage-label', 'font-size': 24 }, svg);
    l2.textContent = '초록 풍선';
  }

  /* 탭/단계 버튼: 하나만 활성. 시안 확인용 동작만 한다. */
  function bindSwitch(rootSelector, itemSelector) {
    document.querySelectorAll(rootSelector).forEach((root) => {
      const items = [...root.querySelectorAll(itemSelector)];
      items.forEach((b) => b.addEventListener('click', () => {
        items.forEach((x) => { x.classList.toggle('is-active', x === b); x.setAttribute('aria-selected', String(x === b)); });
      }));
    });
  }

  window.Demo = { buildCharges, buildStage, bindSwitch };
})();
