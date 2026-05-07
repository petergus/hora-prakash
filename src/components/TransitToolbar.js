// src/components/TransitToolbar.js
import { state } from '../state.js'

function _trimPlace(s, max = 28) {
  if (!s) return ''
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s
}

function _formatCoords(lat, lon) {
  if (lat == null || lon == null) return ''
  const la = Math.abs(lat).toFixed(2) + (lat >= 0 ? '°N' : '°S')
  const lo = Math.abs(lon).toFixed(2) + (lon >= 0 ? '°E' : '°W')
  return `${la} ${lo}`
}

function _initial(name) {
  return name ? name.trim()[0].toUpperCase() : '?'
}

export class TransitToolbar {
  constructor(el, getState, onChange, onClearAspects) {
    this.el              = el
    this._getState       = getState
    this._onChange       = onChange
    this._onClearAspects = onClearAspects
    this._onClick        = null
    this._onChange2      = null
    this._menuOpen       = false
  }

  get ui() { return this._getState() }

  destroy() {
    if (this._onClick)   this.el.removeEventListener('click',  this._onClick)
    if (this._onChange2) this.el.removeEventListener('change', this._onChange2)
    this._onClick = this._onChange2 = null
  }

  render() {
    const ui          = this.ui
    const today       = new Date()
    const dateVal     = ui.transitDate ?? today.toISOString().slice(0,10)
    const timeVal     = ui.transitTime ?? today.toTimeString().slice(0,5)
    const isDual      = (ui.transitView ?? 'dual') === 'dual'
    const chartStyle  = ui.transitChartStyle ?? 'north'
    const zoom        = ui.chartZoom ?? 3
    const showTooltip = ui.showTooltip ?? true

    const birth = state.birth ?? {}
    const name  = birth.name ?? 'Unknown'
    const place = _trimPlace(birth.location)
    const coords = _formatCoords(birth.lat, birth.lon)
    const dob   = birth.dob ?? ''
    const tob   = birth.tob ?? ''
    const init  = _initial(name)

    const menuOpen = this._menuOpen
    const aspectCount = [ui.natalAspectSource, ui.transitAspectSource,
                         ui.overlayNatalAspectSource, ui.overlayTransitAspectSource]
      .reduce((n, s) => n + (s instanceof Set ? s.size : 0), 0)
    const clearLabel = aspectCount > 0 ? `✕ Aspects (${aspectCount})` : '✕ Aspects'

    this.el.innerHTML = `
      <div class="transit-toolbar">
        <div class="transit-birth-card">
          <div class="tbc-avatar">${init}</div>
          <div class="tbc-name">${name}</div>
          <div class="tbc-divider"></div>
          ${place  ? `<div class="tbc-pill"><span class="tbc-icon">📍</span><span>${place}</span></div>` : ''}
          ${coords ? `<div class="tbc-pill"><span class="tbc-icon">🌐</span><span>${coords}</span></div>` : ''}
          ${dob    ? `<div class="tbc-pill"><span class="tbc-icon">📅</span><span>${dob}</span></div>` : ''}
          ${tob    ? `<div class="tbc-pill"><span class="tbc-icon">🕐</span><span>${tob}</span></div>` : ''}
        </div>
        <div class="transit-controls-row${menuOpen ? ' menu-open' : ''}">
          <div class="transit-style-group">
            <button class="transit-style-btn${chartStyle === 'north' ? ' active' : ''}" data-action="setStyle" data-style="north">N</button>
            <button class="transit-style-btn${chartStyle === 'south' ? ' active' : ''}" data-action="setStyle" data-style="south">S</button>
          </div>
          <button class="transit-view-toggle" data-action="toggleView" title="Switch chart view">
            ${isDual ? 'Dual ⇌' : 'Overlay ⇌'}
          </button>
          <label class="transit-date-label transit-secondary-ctrl">
            <input type="date" class="transit-date" value="${dateVal}" />
          </label>
          <label class="transit-time-label transit-secondary-ctrl">
            <input type="time" class="transit-time" value="${timeVal}" />
          </label>
          <button class="transit-today-btn transit-secondary-ctrl" data-action="resetToday" title="Reset to today">Today ↺</button>
          <div class="transit-zoom-group transit-secondary-ctrl" title="Chart size">
            <button class="transit-zoom-btn" data-action="zoomOut" ${zoom <= 1 ? 'disabled' : ''}>−</button>
            <span class="transit-zoom-label">⊙</span>
            <button class="transit-zoom-btn" data-action="zoomIn" ${zoom >= 5 ? 'disabled' : ''}>+</button>
          </div>
          <button class="transit-style-btn transit-secondary-ctrl${showTooltip ? ' active' : ''}" data-action="toggleTooltip" title="Planet info on hover">ℹ Info</button>
          <button class="transit-clear-aspects-btn${aspectCount > 0 ? ' has-aspects' : ''}" data-action="clearAspects" title="Clear all selected aspects">${clearLabel}</button>
          <button class="transit-menu-btn${menuOpen ? ' active' : ''}" data-action="toggleMenu" title="More options">⋮</button>
        </div>
      </div>`

    this._bindEvents()
  }

  _bindEvents() {
    if (this._onClick)   this.el.removeEventListener('click',  this._onClick)
    if (this._onChange2) this.el.removeEventListener('change', this._onChange2)
    this._onClick = (e) => {
      const btn = e.target.closest('[data-action]')
      if (!btn) return
      const action = btn.dataset.action

      if (action === 'setStyle') {
        this._onChange('transitChartStyle', btn.dataset.style)
        return
      }
      if (action === 'toggleView') {
        const current = this.ui.transitView ?? 'dual'
        this._onChange('transitView', current === 'dual' ? 'overlay' : 'dual')
        return
      }
      if (action === 'zoomIn') {
        const z = Math.min(5, (this.ui.chartZoom ?? 3) + 1)
        this._onChange('chartZoom', z)
        return
      }
      if (action === 'zoomOut') {
        const z = Math.max(1, (this.ui.chartZoom ?? 3) - 1)
        this._onChange('chartZoom', z)
        return
      }
      if (action === 'resetToday') {
        const now = new Date()
        this._onChange('transitDate', now.toISOString().slice(0,10))
        this._onChange('transitTime', now.toTimeString().slice(0,5))
        return
      }
      if (action === 'toggleTooltip') {
        this._onChange('showTooltip', !(this.ui.showTooltip ?? true))
        return
      }
      if (action === 'clearAspects') {
        this._onClearAspects?.()
        return
      }
      if (action === 'toggleMenu') {
        this._menuOpen = !this._menuOpen
        this.render()
        return
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
