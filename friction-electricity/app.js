'use strict';

/* 실험 선택 메뉴: 실험 1(observe) / 실험 2(balloon) 전환 */
(() => {
  const tabs = [...document.querySelectorAll('.mode-tab')];
  const panes = {
    observe: document.getElementById('expObserve'),
    balloon: document.getElementById('expBalloon'),
  };

  function setMode(mode) {
    if (!panes[mode]) mode = 'observe';
    tabs.forEach((b) => {
      const on = b.dataset.mode === mode;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', String(on));
    });
    for (const k in panes) panes[k].hidden = k !== mode;
    try { history.replaceState(null, '', '#' + mode); } catch (e) { /* file:// 등에서는 무시 */ }
  }

  tabs.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  setMode(location.hash.replace('#', '') || 'observe');
})();
