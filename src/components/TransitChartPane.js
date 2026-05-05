import { renderChartSVG } from '../ui/chart-svg.js'
import { getAspectedSigns, PLANET_COLORS } from '../core/aspects.js'

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

    const ui             = this.ui
    const view           = ui.transitView ?? 'dual'
    const aspectSource   = ui.transitAspectSource ?? null
    const chartStyle     = ui.chartStyle ?? 'north'
    const filter         = ui.transitFilter ?? new Set(['Ju','Sa'])

    // Compute active aspects for highlighting
    let activeAspects      = []
    let activePlanetColors = {}
    if (aspectSource) {
      const allPlanets = [...(natalPlanets || []), ...(transitPlanets || [])]
      const planet     = allPlanets.find(p => p.abbr === aspectSource)
      if (planet) {
        activeAspects      = getAspectedSigns(planet.sign, aspectSource)
        activePlanetColors = { [aspectSource]: PLANET_COLORS[aspectSource] ?? '#f59e0b' }
      }
    }

    if (view === 'dual') {
      this._renderDual(natalPlanets, natalLagna, transitPlanets, chartStyle, filter, activeAspects, activePlanetColors)
    } else {
      this._renderOverlay(natalPlanets, natalLagna, transitPlanets, chartStyle, filter, activeAspects, activePlanetColors)
    }

    this._bindEvents(natalPlanets, transitPlanets)
  }

  _renderDual(natalPlanets, natalLagna, transitPlanets, chartStyle, filter, activeAspects, activePlanetColors) {
    const filteredTransit = (transitPlanets || []).filter(p => filter.has(p.abbr))
    const natalSVG   = renderChartSVG(natalPlanets, natalLagna, chartStyle, undefined, undefined, activeAspects, activePlanetColors)
    const transitSVG = transitPlanets?.length
      ? renderChartSVG(filteredTransit, natalLagna, chartStyle, undefined, 'Transit', activeAspects, activePlanetColors)
      : '<div class="transit-loading">Calculating...</div>'

    this.el.innerHTML = `
      <div class="transit-dual-pane">
        <div class="transit-chart-wrap">
          <div class="transit-chart-label">Natal</div>
          ${natalSVG}
        </div>
        <div class="transit-chart-wrap">
          <div class="transit-chart-label">Transit</div>
          ${transitSVG}
        </div>
      </div>`
  }

  _renderOverlay(natalPlanets, natalLagna, transitPlanets, chartStyle, filter, activeAspects, activePlanetColors) {
    const filteredTransit = (transitPlanets || []).filter(p => filter.has(p.abbr))
    const natalSVG = renderChartSVG(natalPlanets, natalLagna, chartStyle, undefined, undefined, activeAspects, activePlanetColors)
    this.el.innerHTML = `
      <div class="transit-overlay-pane">
        <div class="transit-chart-label">Natal + Transit Overlay</div>
        ${natalSVG}
        <div class="transit-overlay-legend">
          ${filteredTransit.map(p =>
            `<span class="transit-overlay-chip" style="color:#f59e0b">(${p.abbr}${p.retrograde ? 'ʀ' : ''}) H${p.house}</span>`
          ).join('')}
        </div>
      </div>`
  }

  _bindEvents(natalPlanets, transitPlanets) {
    if (this._onClick) this.el.removeEventListener('click', this._onClick)
    this._onClick = (e) => {
      const btn = e.target.closest('[data-planet]')
      if (!btn) return
      this._onPlanetClick(btn.dataset.planet)
    }
    this.el.addEventListener('click', this._onClick)
  }
}
