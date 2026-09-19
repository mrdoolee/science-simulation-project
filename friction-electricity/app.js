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

/* 제작자 안내 모달: 표시 전용. 시뮬레이션 상태(main.js, observe.js)는 건드리지 않는다. */
(() => {
  const modal = document.getElementById('creditModal');
  const openBtn = document.getElementById('creditBtn');
  const closeBtn = document.getElementById('creditClose');

  function openModal() {
    modal.hidden = false;
    document.body.classList.add('modal-open');
    closeBtn.focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    openBtn.focus();
  }

  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  // 배경(오버레이) 클릭으로 닫기: 카드 안쪽 클릭은 무시
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
    // 모달이 열려 있는 동안 Tab 포커스를 모달 안에 가둔다
    if (e.key === 'Tab' && !modal.hidden) {
      const items = [...modal.querySelectorAll('button, a[href]')];
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
})();
