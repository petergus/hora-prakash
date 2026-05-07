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
  constructor(el, getState, onPlanetClick, onChartControl) {
    this.el               = el
    this._getState        = getState
    this._onPlanetClick   = onPlanetClick
    this._onChartControl  = onChartControl
    this._onClick         = null
    this._tooltip         = new TransitTooltip()
    this._tooltip.mount()
  }

  get ui() { return this._getState() }

  setTooltipEnabled(v) { this._tooltip.setEnabled(v) }

  destroy() {
    if (this._onClick) this.el.removeEventListener('click', this._onClick)
    this._onClick = null
    this._tooltip.destroy()
  }

  render(natalPlanets, natalLagna, transitPlanets, transitLagna) {
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
    const svg = renderTransitBorderSVG(
      natalPlanets, natalLagna,
      transitPlanets || [],
      chartStyle,
      filter,
      allAspects,
      natalAsp.activePlanetColors,
      transitLagna,
      transitAsp.activePlanetColors
    )
    const zoom  = this.ui.chartZoom ?? 3
    const maxW  = [400, 520, 640, 760, 900][zoom - 1]
    this.el.innerHTML = `
      <div class="transit-overlay-pane">
        <div class="transit-chart-label">Natal + Transit</div>
        <div class="transit-border-chart" data-chart="natal" style="max-width:${maxW}px;margin:0 auto">${svg}</div>
      </div>`
  }

  _bindEvents() {
    if (this._onClick) this.el.removeEventListener('click', this._onClick)
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
    this.el.addEventListener('click', this._onClick)
  }
}
