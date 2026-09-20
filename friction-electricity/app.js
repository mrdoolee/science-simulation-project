'use strict';

/* 실험 선택 메뉴: 실험 1(observe) / 실험 2(balloon) 전환 */
(() => {
  const tabs = [...document.querySelectorAll('.mode-tab')];
  const panes = {
    observe: document.getElementById('expObserve'),
    balloon: document.getElementById('expBalloon'),
  };

  // 실험마다 머리글(질문)이 바뀐다
  const HEADINGS = {
    observe: {
      title: '문지르면 왜 전기가 생길까?',
      lead: '면장갑으로 풍선을 문지른 뒤, 풍선이 어떻게 움직이는지 관찰하고 이유를 설명해 봅시다.',
    },
    balloon: {
      title: '풍선은 어떻게 전기를 띠게 될까?',
      lead: '풍선과 털가죽을 문지를 때 전자가 어떻게 이동하는지 살펴봅시다.',
    },
  };

  function setMode(mode) {
    if (!panes[mode]) mode = 'observe';
    tabs.forEach((b) => {
      const on = b.dataset.mode === mode;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', String(on));
    });
    for (const k in panes) panes[k].hidden = k !== mode;
    document.getElementById('pageTitle').textContent = HEADINGS[mode].title;
    document.getElementById('pageLead').textContent = HEADINGS[mode].lead;
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
