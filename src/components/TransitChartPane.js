import { renderChartSVG, renderTransitBorderSVG } from '../ui/chart-svg.js'
import { getAspectedSigns, PLANET_COLORS } from '../core/aspects.js'
import { TransitTooltip } from './TransitTooltip.js'

function buildAspects(planets, sources) {
  const src = sources instanceof Set ? sources : (sources ? new Set([sources]) : new Set())
  if (src.size === 0) return { activeAspects: [], activePlanetColors: {} }
  const activeAspects = [], activePlanetColors = {}
  for (const abbr of src) {
    const planet = (planets || []).find(p => p.abbr === abbr)
    if (!planet) continue
    const color = PLANET_COLORS[abbr] ?? '#f59e0b'
    activeAspects.push({ fromSign: planet.sign, toSigns: getAspectedSigns(planet.sign, abbr), color })
    activePlanetColors[abbr] = color
  }
  return { activeAspects, activePlanetColors }
}

export class TransitChartPane {
  constructor(el, getState, onPlanetClick, onChartControl, onAspectToSign) {
    this.el               = el
    this._getState        = getState
    this._onPlanetClick   = onPlanetClick
    this._onChartControl  = onChartControl
    this._onAspectToSign  = onAspectToSign
    this._onClick         = null
    this._onCtxMenu       = null
    this._natalLagna      = null
    this._transitLagna    = null
    this._natalPlanets    = null
    this._transitPlanets  = null
    this._lpTimer         = null
    this._tooltip         = new TransitTooltip()
    this._tooltip.mount()
  }

  get ui() { return this._getState() }

  setTooltipEnabled(v) { this._tooltip.setEnabled(v) }

  getTooltip() { return this._tooltip }

  destroy() {
    if (this._onClick)   this.el.removeEventListener('click',       this._onClick)
    if (this._onCtxMenu) this.el.removeEventListener('contextmenu', this._onCtxMenu)
    clearTimeout(this._lpTimer)
    this._onClick = this._onCtxMenu = null
    this._tooltip.destroy()
  }

  render(natalPlanets, natalLagna, transitPlanets, transitLagna) {
    this._natalPlanets   = natalPlanets
    this._natalLagna     = natalLagna
    this._transitPlanets = transitPlanets
    this._transitLagna   = transitLagna
    if (!natalPlanets || !natalLagna) {
      this.el.innerHTML = '<p class="transit-no-data">No birth chart loaded.</p>'
      return
    }

    const ui         = this.ui
    const view       = ui.transitView ?? 'dual'
    const chartStyle = ui.transitChartStyle ?? 'north'
    const filter     = ui.transitFilter ?? new Set()
    const tLagna     = transitLagna ?? natalLagna

    const isOverlay  = view === 'overlay'
    const natalSrc   = isOverlay ? ui.overlayNatalAspectSource   : ui.natalAspectSource
    const transitSrc = isOverlay ? ui.overlayTransitAspectSource : ui.transitAspectSource
    const natalAsp   = buildAspects(natalPlanets,   natalSrc)
    const transitAsp = buildAspects(transitPlanets, transitSrc)

    if (view === 'dual') {
      this._renderDual(natalPlanets, natalLagna, transitPlanets, tLagna, chartStyle, filter, natalAsp, transitAsp)
    } else {
      this._renderOverlay(natalPlanets, natalLagna, transitPlanets, tLagna, chartStyle, filter, natalAsp, transitAsp)
    }

    this._bindEvents()
    this._tooltip.setEnabled(ui.showTooltip ?? true)
    this._tooltip.attach(this.el)
  }

  _renderDual(natalPlanets, natalLagna, transitPlanets, transitLagna, chartStyle, filter, natalAsp, transitAsp) {
    const filteredTransit = (transitPlanets || []).filter(p => filter.has(p.abbr))
    const natalSVG   = renderChartSVG(natalPlanets, natalLagna, chartStyle, undefined, undefined,
                         natalAsp.activeAspects, natalAsp.activePlanetColors)
    const transitSVG = transitPlanets?.length
      ? renderChartSVG(filteredTransit, transitLagna, chartStyle, undefined, 'Transit',
          transitAsp.activeAspects, transitAsp.activePlanetColors)
      : '<div class="transit-loading">Calculating...</div>'

    const zoom        = this.ui.chartZoom ?? 3
    const maxW        = [380, 440, 500, 560, 640][zoom - 1]
    const wrapSt      = `style="width:${maxW}px;max-width:calc(50vw - 1.5rem)"`
    const activeTab   = this.ui.dualActiveTab ?? 'natal'

    this.el.innerHTML = `
      <div class="transit-dual-tabs">
        <button class="transit-dual-tab-btn${activeTab === 'natal' ? ' active' : ''}" data-dual-tab="natal">Natal</button>
        <button class="transit-dual-tab-btn${activeTab === 'transit' ? ' active' : ''}" data-dual-tab="transit">Transit</button>
      </div>
      <div class="transit-dual-pane transit-dual-pane--${activeTab}">
        <div class="transit-chart-wrap" data-chart="natal" data-dual-pane="natal" ${wrapSt}>
          <div class="transit-chart-label">Natal</div>
          ${natalSVG}
        </div>
        <div class="transit-chart-wrap" data-chart="transit" data-dual-pane="transit" ${wrapSt}>
          <div class="transit-chart-label">Transit</div>
          ${transitSVG}
        </div>
      </div>`
  }

  _renderOverlay(natalPlanets, natalLagna, transitPlanets, transitLagna, chartStyle, filter, natalAsp, transitAsp) {
    const allAspects = [...natalAsp.activeAspects, ...transitAsp.activeAspects]
    const zoom  = this.ui.chartZoom ?? 3
    const svg = renderTransitBorderSVG(
      natalPlanets, natalLagna,
      transitPlanets || [],
      chartStyle,
      filter,
      allAspects,
      natalAsp.activePlanetColors,
      transitLagna,
      transitAsp.activePlanetColors,
      zoom
    )
    const maxW  = [400, 520, 640, 760, 900][zoom - 1]
    this.el.innerHTML = `
      <div class="transit-overlay-pane">
        <div class="transit-chart-label">Natal + Transit</div>
        <div class="transit-border-chart" data-chart="natal" style="max-width:${maxW}px;margin:0 auto">${svg}</div>
      </div>`
  }

  _showCtxMenu(x, y, sign, chartType) {
    if (!this._onAspectToSign) return
    document.getElementById('transit-ctx-menu')?.remove()
    const isOverlay    = (this.ui.transitView ?? 'dual') === 'overlay'
    const natalHouse   = ((sign - (this._natalLagna?.sign ?? 1) + 12) % 12) + 1
    const transitHouse = ((sign - (this._transitLagna?.sign ?? 1) + 12) % 12) + 1
    const ITEM = `padding:0.35rem 0.9rem;cursor:pointer;color:var(--text);white-space:nowrap`
    const menu = document.createElement('div')
    menu.id = 'transit-ctx-menu'
    menu.style.cssText = `position:fixed;z-index:9999;background:var(--card-bg,#fff);border:1px solid var(--border,#e2e8f0);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.13);padding:0.3rem 0;min-width:210px;font-size:0.85rem`
    menu.style.left = Math.min(x, window.innerWidth  - 230) + 'px'
    menu.style.top  = Math.min(y, window.innerHeight - 80)  + 'px'
    menu.innerHTML = isOverlay ? `
      <div style="${ITEM}" data-ct="natal">Natal aspects to House ${natalHouse}</div>
      <div style="${ITEM}" data-ct="transit">Transit aspects to House ${natalHouse}</div>
    ` : `
      <div style="${ITEM}" data-ct="${chartType}">${chartType === 'transit' ? 'Transit' : 'Natal'} aspects to House ${chartType === 'transit' ? transitHouse : natalHouse}</div>
    `
    document.body.appendChild(menu)
    menu.querySelectorAll('[data-ct]').forEach(item => {
      item.addEventListener('click', () => {
        menu.remove()
        this._onAspectToSign(item.dataset.ct, sign)
      })
    })
    const close = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', close) } }
    setTimeout(() => document.addEventListener('click', close), 0)
  }

  _bindEvents() {
    if (this._onClick)   this.el.removeEventListener('click',       this._onClick)
    if (this._onCtxMenu) this.el.removeEventListener('contextmenu', this._onCtxMenu)

    this._onClick = (e) => {
      const tabBtn = e.target.closest('[data-dual-tab]')
      if (tabBtn) {
        this._onChartControl?.('dualActiveTab', tabBtn.dataset.dualTab)
        return
      }
      const planetEl = e.target.closest('[data-planet]')
      if (!planetEl) return
      const chartWrap = e.target.closest('[data-chart]')
      const chartType = chartWrap?.dataset.chart ?? 'natal'
      this._onPlanetClick(planetEl.dataset.planet, chartType)
    }

    this._onCtxMenu = (e) => {
      const cell = e.target.closest('[data-sign]')
      if (!cell) return
      e.preventDefault()
      const chartWrap = e.target.closest('[data-chart]')
      const chartType = chartWrap?.dataset.chart ?? 'natal'
      this._showCtxMenu(e.clientX, e.clientY, parseInt(cell.dataset.sign, 10), chartType)
    }

    this.el.addEventListener('click',       this._onClick)
    this.el.addEventListener('contextmenu', this._onCtxMenu)

    // Long-press for mobile
    this.el.addEventListener('touchstart', (e) => {
      const cell = e.target.closest('[data-sign]')
      if (!cell) return
      const t = e.touches[0]
      const chartWrap = e.target.closest('[data-chart]')
      const chartType = chartWrap?.dataset.chart ?? 'natal'
      const sign = parseInt(cell.dataset.sign, 10)
      clearTimeout(this._lpTimer)
      this._lpTimer = setTimeout(() => {
        this._lpTimer = null
        this._showCtxMenu(t.clientX, t.clientY, sign, chartType)
      }, 500)
    }, { passive: true })
    this.el.addEventListener('touchmove',   () => { clearTimeout(this._lpTimer); this._lpTimer = null }, { passive: true })
    this.el.addEventListener('touchend',    () => { clearTimeout(this._lpTimer); this._lpTimer = null }, { passive: true })
    this.el.addEventListener('touchcancel', () => { clearTimeout(this._lpTimer); this._lpTimer = null }, { passive: true })
  }
}
