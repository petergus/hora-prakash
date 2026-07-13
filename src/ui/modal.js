// src/ui/modal.js — single modal primitive for the whole app.
// DOM access happens only inside these functions (this module may end up in
// the Node test import graph via UI modules — never touch document at import).

/**
 * Open a modal dialog.
 * @param {object} opts
 * @param {string}  opts.title        heading text (plain text)
 * @param {string}  opts.content      HTML string for the body
 * @param {Array}   [opts.actions]    [{ id?, label, variant?: 'primary'|'secondary'|'ghost'|'danger', onClick?(close) }]
 * @param {string}  [opts.width]      css max-width override (e.g. '520px')
 * @param {boolean} [opts.closeOnScrim=true]
 * @param {Function}[opts.onClose]
 * @returns {{ el: HTMLElement, close: () => void }}
 */
export function openModal({ title, content, actions = [], width, closeOnScrim = true, onClose } = {}) {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true"${width ? ` style="max-width:${width}"` : ''}>
      <div class="modal-head">
        <div class="modal-title"></div>
        <button type="button" class="modal-close" aria-label="Close">✕</button>
      </div>
      <div class="modal-body"></div>
      ${actions.length ? '<div class="modal-actions"></div>' : ''}
    </div>
  `
  overlay.querySelector('.modal-title').textContent = title ?? ''
  overlay.querySelector('.modal-body').innerHTML = content ?? ''

  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    document.removeEventListener('keydown', onKey)
    overlay.classList.remove('open')
    setTimeout(() => overlay.remove(), 150)
    onClose?.()
  }
  const onKey = e => { if (e.key === 'Escape') close() }

  const actionsEl = overlay.querySelector('.modal-actions')
  const variantClass = { primary: 'btn btn-primary', secondary: 'btn btn-secondary', ghost: 'btn btn-ghost', danger: 'btn btn-secondary btn-danger' }
  for (const a of actions) {
    const btn = document.createElement('button')
    btn.type = 'button'
    if (a.id) btn.id = a.id
    btn.className = variantClass[a.variant ?? 'secondary']
    btn.textContent = a.label
    btn.addEventListener('click', () => (a.onClick ? a.onClick(close) : close()))
    actionsEl.appendChild(btn)
  }

  overlay.querySelector('.modal-close').addEventListener('click', close)
  if (closeOnScrim) overlay.addEventListener('click', e => { if (e.target === overlay) close() })
  document.addEventListener('keydown', onKey)

  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('open'))
  const firstInput = overlay.querySelector('input, select, textarea')
  if (firstInput) setTimeout(() => firstInput.focus(), 0)

  return { el: overlay, close }
}

/** Confirmation dialog. Resolves true on confirm, false otherwise. */
export function confirmModal(message, { title = 'Confirm', confirmLabel = 'OK', cancelLabel = 'Cancel', danger = false } = {}) {
  return new Promise(resolve => {
    let confirmed = false
    const body = document.createElement('p')
    body.textContent = message
    openModal({
      title,
      content: body.outerHTML,
      onClose: () => resolve(confirmed),
      actions: [
        { label: cancelLabel, variant: 'ghost' },
        { label: confirmLabel, variant: danger ? 'danger' : 'primary', onClick: close => { confirmed = true; close() } },
      ],
    })
  })
}

/** Prompt dialog. Resolves the entered string, or null on cancel. */
export function promptModal(message, defaultValue = '', { title = '', confirmLabel = 'OK' } = {}) {
  return new Promise(resolve => {
    let value = null
    const msg = document.createElement('p')
    msg.textContent = message
    const { el, close } = openModal({
      title,
      content: `${msg.outerHTML}<div class="modal-field"><input type="text" id="modal-prompt-input" /></div>`,
      onClose: () => resolve(value),
      actions: [
        { label: 'Cancel', variant: 'ghost' },
        { label: confirmLabel, variant: 'primary', onClick: c => { value = el.querySelector('#modal-prompt-input').value; c() } },
      ],
    })
    const input = el.querySelector('#modal-prompt-input')
    input.value = defaultValue
    input.select()
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { value = input.value; close() }
    })
  })
}
