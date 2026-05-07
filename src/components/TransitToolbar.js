// src/components/TransitToolbar.js
import { state } from '../state.js'
import { DIVISIONAL_OPTIONS } from '../core/divisional.js'
import { CLEAR_ASPECTS_SVG } from '../ui/icons.js'

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
    this._onInput2       = null
    this._menuOpen       = false
    this._dateMode       = 'picker' // 'picker' | 'text'
    this._dateTextVal    = ''
    this._timeTextVal    = ''
  }

  get ui() { return this._getState() }

  destroy() {
    if (this._onClick)   this.el.removeEventListener('click',  this._onClick)
    if (this._onChange2) this.el.removeEventListener('change', this._onChange2)
    if (this._onInput2)  this.el.removeEventListener('input',  this._onInput2)
    this._onClick = this._onChange2 = this._onInput2 = null
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
    const divKey        = ui.transitDivisional ?? 'D1'
    const aspectToHouse = ui.aspectToHouse ?? ''

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
          <select class="transit-div-select div-select" data-action="setDivisional" title="Divisional chart">
            ${DIVISIONAL_OPTIONS.map(o => `<option value="${o.value}"${o.value === divKey ? ' selected' : ''}>${o.value}</option>`).join('')}
          </select>
          ${!isDual ? `
          <div class="transit-aspect-group">
            <select class="transit-house-select" data-action="setAspectHouse" title="Aspects to house">
              <option value="">H—</option>
              ${Array.from({length:12},(_,i)=>`<option value="${i+1}"${aspectToHouse==i+1?' selected':''}>H${i+1}</option>`).join('')}
            </select>
            <button class="transit-aspect-clear${aspectCount > 0 ? ' has-aspects' : ''}" data-action="clearAspects" title="Clear aspects">${CLEAR_ASPECTS_SVG}</button>
          </div>` : `
          <button class="transit-aspect-clear${aspectCount > 0 ? ' has-aspects' : ''}" data-action="clearAspects" title="Clear aspects" style="border:1.5px solid var(--border);border-radius:7px;padding:0.3rem 0.5rem">${CLEAR_ASPECTS_SVG}</button>
          `}
          <button class="transit-view-toggle" data-action="toggleView" title="Switch chart view">
            ${isDual ? 'Dual ⇌' : 'Overlay ⇌'}
          </button>
          ${this._dateMode === 'picker' ? `
          <label class="transit-date-label transit-secondary-ctrl">
            <input type="date" class="transit-date" value="${dateVal}" />
          </label>
          <label class="transit-time-label transit-secondary-ctrl">
            <input type="time" class="transit-time" value="${timeVal}" />
          </label>` : `
          <input type="text" class="transit-date-text transit-secondary-ctrl" inputmode="numeric" placeholder="DD/MM/YYYY" maxlength="10" value="${this._dateTextVal}" />
          <input type="text" class="transit-time-text transit-secondary-ctrl" inputmode="numeric" placeholder="HH:MM" maxlength="5" value="${this._timeTextVal}" />
          `}
          <button class="transit-today-btn transit-secondary-ctrl" data-action="resetToday" title="Reset to today &amp; now">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </button>
          <button class="transit-today-btn transit-secondary-ctrl" data-action="toggleDateMode" title="${this._dateMode === 'picker' ? 'Type manually' : 'Use date/time picker'}">
            ${this._dateMode === 'picker'
              ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h4M14 14h4"/></svg>`
              : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`
            }
          </button>
          <div class="transit-zoom-group transit-secondary-ctrl transit-desktop-only" title="Chart size">
            <button class="transit-zoom-btn" data-action="zoomOut" ${zoom <= 1 ? 'disabled' : ''}>−</button>
            <span class="transit-zoom-label">⊙</span>
            <button class="transit-zoom-btn" data-action="zoomIn" ${zoom >= 5 ? 'disabled' : ''}>+</button>
          </div>
          <button class="transit-style-btn transit-secondary-ctrl transit-desktop-only${showTooltip ? ' active' : ''}" data-action="toggleTooltip" title="Planet info on hover">ℹ Info</button>
          <button id="btn-export-transit" class="chart-style-btn chart-icon-btn" title="Download transit chart"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v8M5 8l3 3 3-3"/><path d="M2 13h12"/></svg></button>
          <button class="transit-menu-btn${menuOpen ? ' active' : ''}" data-action="toggleMenu" title="More options">⋮</button>
        </div>
      </div>`

    this._bindEvents()
  }

  _parseDateText(str) {
    const m = str.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
    if (!m) return null
    const [, d, mo, y] = m
    return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`
  }

  _bindEvents() {
    if (this._onClick)   this.el.removeEventListener('click',  this._onClick)
    if (this._onChange2) this.el.removeEventListener('change', this._onChange2)
    if (this._onInput2)  this.el.removeEventListener('input',  this._onInput2)

    this._onInput2 = (e) => {
      if (e.target.classList.contains('transit-date-text')) {
        let v = e.target.value.replace(/[^\d]/g, '')
        if (v.length > 2) v = v.slice(0,2) + '/' + v.slice(2)
        if (v.length > 5) v = v.slice(0,5) + '/' + v.slice(5)
        e.target.value = v.slice(0, 10)
        this._dateTextVal = e.target.value
        const parsed = this._parseDateText(e.target.value)
        if (parsed) this._onChange('transitDate', parsed)
      } else if (e.target.classList.contains('transit-time-text')) {
        let v = e.target.value.replace(/[^\d]/g, '')
        if (v.length > 2) v = v.slice(0,2) + ':' + v.slice(2)
        e.target.value = v.slice(0, 5)
        this._timeTextVal = e.target.value
        if (/^\d{1,2}:\d{2}$/.test(e.target.value)) {
          this._onChange('transitTime', e.target.value.padStart(5, '0'))
        }
      }
    }

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
        const d = now.toISOString().slice(0,10)
        const t = now.toTimeString().slice(0,5)
        this._onChange('transitDate', d)
        this._onChange('transitTime', t)
        // sync text fields too
        const [y, mo, dd] = d.split('-')
        this._dateTextVal = `${dd}/${mo}/${y}`
        this._timeTextVal = t
        return
      }
      if (action === 'toggleDateMode') {
        const ui = this.ui
        if (this._dateMode === 'picker') {
          const dv = ui.transitDate ?? new Date().toISOString().slice(0,10)
          const tv = ui.transitTime ?? new Date().toTimeString().slice(0,5)
          const [y, mo, d] = dv.split('-')
          this._dateTextVal = `${d}/${mo}/${y}`
          this._timeTextVal = tv
          this._dateMode = 'text'
        } else {
          this._dateMode = 'picker'
        }
        this.render()
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
      } else if (e.target.classList.contains('transit-div-select')) {
        this._onChange('transitDivisional', e.target.value)
      } else if (e.target.classList.contains('transit-house-select')) {
        this._onChange('aspectToHouse', e.target.value ? parseInt(e.target.value, 10) : null)
      }
    }

    this.el.addEventListener('click',  this._onClick)
    this.el.addEventListener('change', this._onChange2)
    this.el.addEventListener('input',  this._onInput2)
  }
}
