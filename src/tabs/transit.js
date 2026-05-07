// src/tabs/transit.js
import { state }                                                from '../state.js'
import { getActiveSession, defaultTransitUI }                   from '../sessions.js'
import { getTransitPositions, getTransitLagna }                 from '../core/transit.js'
import { getTransitToNatalAspects, getTransitToTransitAspects } from '../core/aspects.js'
import { getSettings }                                          from '../core/settings.js'
import { toJulianDay }                                          from '../utils/time.js'
import { TransitToolbar }                                       from '../components/TransitToolbar.js'
import { TransitChartPane }                                     from '../components/TransitChartPane.js'
import { TransitTable }                                         from '../components/TransitTable.js'

let _toolbar   = null
let _chartPane = null
let _table     = null

function getTransitUI() {
  const s = getActiveSession()
  if (!s) return defaultTransitUI()
  s.uiState         ??= {}
  s.uiState.transit ??= defaultTransitUI()
  return s.uiState.transit
}

function setTransitUI(key, value) {
  const s = getActiveSession()
  if (!s) return
  s.uiState         ??= {}
  s.uiState.transit ??= defaultTransitUI()
  s.uiState.transit[key] = value
}

function todayDate() { return new Date().toISOString().slice(0, 10) }
function nowTime()   { return new Date().toTimeString().slice(0, 5) }

function calcAndRender() {
  if (!state.planets || !state.lagna) return

  const ui   = getTransitUI()
  const date = ui.transitDate ?? todayDate()
  const time = ui.transitTime ?? nowTime()
  const tz   = state.birth?.timezone ?? '+00:00'
  const jd   = toJulianDay(date, time, tz)

  const transitPlanets = getTransitPositions(jd, state.lagna.sign, getSettings())
  const lat = state.birth?.lat ?? 0
  const lon = state.birth?.lon ?? 0
  const transitLagna = getTransitLagna(jd, lat, lon)
  setTransitUI('transitPlanets', transitPlanets)
  setTransitUI('transitLagna', transitLagna)

  const t2n = getTransitToNatalAspects(transitPlanets, state.planets)
  const t2t = getTransitToTransitAspects(transitPlanets)

  _toolbar?.render()
  _chartPane?.render(state.planets, state.lagna, transitPlanets, transitLagna)
  _table?.render(state.planets, transitPlanets, t2n, t2t)
}

function handleToolbarChange(key, value) {
  setTransitUI(key, value)
  if (key === 'showTooltip') {
    _chartPane?.setTooltipEnabled(value)
    _toolbar?.render()
    return
  }
  if (key === 'transitView' || key === 'transitChartStyle' || key === 'chartZoom' || key === 'dualActiveTab') {
    const ui             = getTransitUI()
    const transitPlanets = ui.transitPlanets ?? []
    const transitLagna   = ui.transitLagna ?? state.lagna
    const t2n = getTransitToNatalAspects(transitPlanets, state.planets)
    const t2t = getTransitToTransitAspects(transitPlanets)
    _toolbar?.render()
    _chartPane?.render(state.planets, state.lagna, transitPlanets, transitLagna)
    _table?.render(state.planets, transitPlanets, t2n, t2t)
  } else {
    calcAndRender()
  }
}

function handlePlanetClick(abbr, chartType) {
  const ui   = getTransitUI()
  const view = ui.transitView ?? 'dual'
  let key
  if (view === 'overlay') {
    key = chartType === 'transit' ? 'overlayTransitAspectSource' : 'overlayNatalAspectSource'
  } else {
    key = chartType === 'transit' ? 'transitAspectSource' : 'natalAspectSource'
  }
  const src = new Set(ui[key] instanceof Set ? ui[key] : [])
  if (src.has(abbr)) src.delete(abbr)
  else src.add(abbr)
  setTransitUI(key, src)
  const transitPlanets = getTransitUI().transitPlanets ?? []
  const transitLagna   = getTransitUI().transitLagna ?? state.lagna
  _chartPane?.render(state.planets, state.lagna, transitPlanets, transitLagna)
}

function handleClearAspects() {
  setTransitUI('natalAspectSource',          new Set())
  setTransitUI('transitAspectSource',        new Set())
  setTransitUI('overlayNatalAspectSource',   new Set())
  setTransitUI('overlayTransitAspectSource', new Set())
  const transitPlanets = getTransitUI().transitPlanets ?? []
  const transitLagna   = getTransitUI().transitLagna ?? state.lagna
  _chartPane?.render(state.planets, state.lagna, transitPlanets, transitLagna)
}

export function renderTransit() {
  const el = document.getElementById('tab-transit')
  if (!el) return

  if (!state.planets) {
    el.innerHTML = '<p class="transit-no-data" style="padding:2rem">Load a birth chart first.</p>'
    return
  }

  const ui = getTransitUI()
  if (!ui.transitDate) setTransitUI('transitDate', todayDate())
  if (!ui.transitTime) setTransitUI('transitTime', nowTime())

  el.innerHTML = `
    <div class="transit-tab">
      <div id="transit-toolbar-el"></div>
      <div id="transit-chart-el"></div>
      <div id="transit-table-el"></div>
    </div>`

  _toolbar?.destroy()
  _chartPane?.destroy()
  _table?.destroy()

  _toolbar   = new TransitToolbar(document.getElementById('transit-toolbar-el'), getTransitUI, handleToolbarChange, handleClearAspects)
  _chartPane = new TransitChartPane(document.getElementById('transit-chart-el'),  getTransitUI, handlePlanetClick, handleToolbarChange)
  _table     = new TransitTable(document.getElementById('transit-table-el'),      getTransitUI)

  calcAndRender()
}
