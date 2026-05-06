import { renderChartSVG, renderTransitBorderSVG } from '../ui/chart-svg.js'
import { getAspectedSigns, PLANET_COLORS } from '../core/aspects.js'

function buildAspects(planets, source) {
  if (!source) return { activeAspects: [], activePlanetColors: {} }
  const planet = (planets || []).find(p => p.abbr === source)
  if (!planet) return { activeAspects: [], activePlanetColors: {} }
  const color   = PLANET_COLORS[source] ?? '#f59e0b'
  const toSigns = getAspectedSigns(planet.sign, source)
  return {
    activeAspects:      [{ fromSign: planet.sign, toSigns, color }],
    activePlanetColors: { [source]: color },
  }
}

export class TransitChartPane {
  constructor(el, getState, onPlanetClick) {
    this.el             = el
    this._getState      = getState
    this._onPlanetClick = onPlanetClick
    this._onClick       = null
  }

  get ui() { return this._getState() }

  destroy() {
    if (this._onClick) this.el.removeEventListener('click', this._onClick)
    this._onClick = null
  }

  render(natalPlanets, natalLagna, transitPlanets) {
    if (!natalPlanets || !natalLagna) {
      this.el.innerHTML = '<p class="transit-no-data">No birth chart loaded.</p>'
      return
    }

    const ui         = this.ui
    const view       = ui.transitView ?? 'dual'
    const chartStyle = ui.transitChartStyle ?? 'north'
    const filter     = ui.transitFilter ?? new Set()

    const natalAsp   = buildAspects(natalPlanets,   ui.natalAspectSource)
    const transitAsp = buildAspects(transitPlanets, ui.transitAspectSource)

    if (view === 'dual') {
      this._renderDual(natalPlanets, natalLagna, transitPlanets, chartStyle, filter, natalAsp, transitAsp)
    } else {
      this._renderOverlay(natalPlanets, natalLagna, transitPlanets, chartStyle, filter, natalAsp, transitAsp)
    }

    this._bindEvents()
  }

  _renderDual(natalPlanets, natalLagna, transitPlanets, chartStyle, filter, natalAsp, transitAsp) {
    const filteredTransit = (transitPlanets || []).filter(p => filter.has(p.abbr))
    const natalSVG   = renderChartSVG(natalPlanets, natalLagna, chartStyle, undefined, undefined,
                         natalAsp.activeAspects, natalAsp.activePlanetColors)
    const transitSVG = transitPlanets?.length
      ? renderChartSVG(filteredTransit, natalLagna, chartStyle, undefined, 'Transit',
          transitAsp.activeAspects, transitAsp.activePlanetColors)
      : '<div class="transit-loading">Calculating...</div>'

    this.el.innerHTML = `
      <div class="transit-dual-pane">
        <div class="transit-chart-wrap" data-chart="natal">
          <div class="transit-chart-label">Natal</div>
          ${natalSVG}
        </div>
        <div class="transit-chart-wrap" data-chart="transit">
          <div class="transit-chart-label">Transit</div>
          ${transitSVG}
        </div>
      </div>`
  }

  _renderOverlay(natalPlanets, natalLagna, transitPlanets, chartStyle, filter, natalAsp, transitAsp) {
    const svg = renderTransitBorderSVG(
      natalPlanets, natalLagna,
      transitPlanets || [],
      chartStyle,
      filter,
      natalAsp.activeAspects,
      natalAsp.activePlanetColors
    )
    this.el.innerHTML = `
      <div class="transit-overlay-pane">
        <div class="transit-chart-label">Natal + Transit</div>
        <div class="transit-border-chart" data-chart="natal">${svg}</div>
      </div>`
  }

  _bindEvents() {
    if (this._onClick) this.el.removeEventListener('click', this._onClick)
    this._onClick = (e) => {
      const planetEl = e.target.closest('[data-planet]')
      if (!planetEl) return
      // Walk up to find which chart section was clicked
      const chartWrap = e.target.closest('[data-chart]')
      const chartType = chartWrap?.dataset.chart ?? 'natal'
      this._onPlanetClick(planetEl.dataset.planet, chartType)
    }
    this.el.addEventListener('click', this._onClick)
  }
}
