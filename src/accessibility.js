// Central modal lifecycle: pause time, move/trap focus, isolate the background,
// close on Escape and return focus to the control that opened the dialog.
const modalStack = [];
const modalOpeners = new WeakMap();
const originalInert = new Map();
function hasOpenModal() { return modalStack.length > 0; }
function modalFocusable(modal) {
  return [...modal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], summary, [tabindex="0"]')]
    .filter(element => element.getClientRects().length && !element.closest('[inert]'));
}
function updateModalBackground() {
  const top = modalStack.at(-1);
  for (const child of document.body.children) {
    if (!originalInert.has(child)) originalInert.set(child, child.inert);
    child.inert = top ? child !== top : originalInert.get(child);
  }
  document.body.style.overflow = top ? 'hidden' : '';
}
function openModal(modal) {
  if (!modal || modalStack.includes(modal)) return;
  pauseSimulation();
  modalOpeners.set(modal, document.activeElement);
  const heading = modal.querySelector('h1,h2,h3');
  if (heading) {
    heading.id ||= modal.id + 'Heading';
    modal.setAttribute('aria-labelledby', heading.id);
    modal.removeAttribute('aria-label');
  }
  modal.classList.remove('hidden');
  modalStack.push(modal);
  updateModalBackground();
  (modalFocusable(modal)[0] || modal).focus();
}
function closeModal(modal) {
  if (!modal) return;
  const index = modalStack.indexOf(modal);
  if (index !== -1) modalStack.splice(index, 1);
  modal.classList.add('hidden');
  updateModalBackground();
  const opener = modalOpeners.get(modal);
  if (opener?.isConnected && !opener.closest('[inert]')) opener.focus();
  else if (modalStack.length) (modalFocusable(modalStack.at(-1))[0] || modalStack.at(-1)).focus();
}
document.addEventListener('keydown', event => {
  const modal = modalStack.at(-1);
  if (!modal) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    // A dilemma requires an explicit choice; Escape must not dismiss it.
    if (modal.id !== 'dilemmaModal') closeModal(modal);
  } else if (event.key === 'Tab') {
    const controls = modalFocusable(modal);
    const first = controls[0] || modal;
    const last = controls.at(-1) || modal;
    if (!controls.length || !modal.contains(document.activeElement)
      || event.shiftKey && document.activeElement === first
      || !event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }
}, true);
document.addEventListener('focusin', event => {
  const modal = modalStack.at(-1);
  if (modal && !modal.contains(event.target)) (modalFocusable(modal)[0] || modal).focus();
});

// Generated lists retain their nodes (and keyboard focus) when unchanged.
const renderedMarkup = new WeakMap();
function setMarkup(element, html) {
  if (renderedMarkup.get(element) === html) return;
  // Keep market row buttons stable while their quotes change during playback.
  if (element.id === 'stockListContainer') {
    const template = document.createElement('template');
    template.innerHTML = html;
    const next = [...template.content.children];
    if (next.length && next.every(row => row.dataset.symbol)) {
      const previous = new Map([...element.children].map(row => [row.dataset.symbol, row]));
      const wanted = new Set(next.map(row => row.dataset.symbol));
      for (const child of [...element.children]) if (!wanted.has(child.dataset.symbol)) child.remove();
      let cursor = element.firstElementChild;
      for (const row of next) {
        const existing = previous.get(row.dataset.symbol);
        if (existing) {
          if (existing.className !== row.className) existing.className = row.className;
          if (existing.innerHTML !== row.innerHTML) existing.innerHTML = row.innerHTML;
          if (existing === cursor) cursor = cursor.nextElementSibling;
          else element.insertBefore(existing, cursor);
        } else element.insertBefore(row, cursor);
      }
    } else element.innerHTML = html;
  } else element.innerHTML = html;
  renderedMarkup.set(element, html);
}
