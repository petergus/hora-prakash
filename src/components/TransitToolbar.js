// src/components/TransitToolbar.js
// Transit toolbar component for date/time selection and planet filtering.
// Follows the DashaPanel pattern: state lives in the session, not the instance.

const PLANET_ABBRS = ['Su','Mo','Ma','Me','Ju','Ve','Sa','Ra','Ke']

export class TransitToolbar {
  constructor(el, getState, onChange) {
    this.el         = el
    this._getState  = getState
    this._onChange  = onChange
    this._onClick   = null
    this._onChange2 = null
  }

  get ui() { return this._getState() }

  destroy() {
    if (this._onClick)   this.el.removeEventListener('click',  this._onClick)
    if (this._onChange2) this.el.removeEventListener('change', this._onChange2)
    this._onClick = this._onChange2 = null
  }

  render() {
    const ui = this.ui
    const filter = ui.transitFilter ?? new Set(['Ju','Sa'])

    const today    = new Date()
    const dateVal  = ui.transitDate ?? today.toISOString().slice(0,10)
    const timeVal  = ui.transitTime ?? today.toTimeString().slice(0,5)
    const isDual   = (ui.transitView ?? 'dual') === 'dual'

    const chipHtml = PLANET_ABBRS.map(a =>
      `<button class="transit-chip${filter.has(a) ? ' active' : ''}" data-chip="${a}">${a}</button>`
    ).join('')

    this.el.innerHTML = `
      <div class="transit-toolbar">
        <div class="transit-toolbar-row">
          <button class="transit-view-toggle" data-action="toggleView" title="Switch chart view">
            ${isDual ? 'Dual ⇌' : 'Overlay ⇌'}
          </button>
          <label class="transit-date-label">Date
            <input type="date" class="transit-date" value="${dateVal}" />
          </label>
          <label class="transit-time-label">Time
            <input type="time" class="transit-time" value="${timeVal}" />
          </label>
          <button class="transit-today-btn" data-action="resetToday" title="Reset to today">Today ↺</button>
        </div>
        <div class="transit-toolbar-row transit-chips-row">
          <span class="transit-chips-label">Planets:</span>
          ${chipHtml}
        </div>
      </div>`

    this._bindEvents()
  }

  _bindEvents() {
    this._onClick = (e) => {
      const btn = e.target.closest('[data-action],[data-chip]')
      if (!btn) return
      const action = btn.dataset.action
      const chip   = btn.dataset.chip

      if (action === 'toggleView') {
        const current = this.ui.transitView ?? 'dual'
        this._onChange('transitView', current === 'dual' ? 'overlay' : 'dual')
        return
      }
      if (action === 'resetToday') {
        const now = new Date()
        this._onChange('transitDate', now.toISOString().slice(0,10))
        this._onChange('transitTime', now.toTimeString().slice(0,5))
        return
      }
      if (chip) {
        const filter = new Set(this.ui.transitFilter ?? ['Ju','Sa'])
        if (filter.has(chip)) filter.delete(chip)
        else filter.add(chip)
        this._onChange('transitFilter', filter)
      }
    }

    this._onChange2 = (e) => {
      if (e.target.classList.contains('transit-date')) {
        this._onChange('transitDate', e.target.value)
      } else if (e.target.classList.contains('transit-time')) {
        this._onChange('transitTime', e.target.value)
      }
    }

    this.el.addEventListener('click',  this._onClick)
    this.el.addEventListener('change', this._onChange2)
  }
}
