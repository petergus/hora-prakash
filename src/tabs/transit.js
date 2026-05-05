// src/tabs/transit.js
import { state }                                                from '../state.js'
import { getActiveSession, defaultTransitUI }                   from '../sessions.js'
import { getTransitPositions }                                  from '../core/transit.js'
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
  setTransitUI('transitPlanets', transitPlanets)

  const t2n = getTransitToNatalAspects(transitPlanets, state.planets)
  const t2t = getTransitToTransitAspects(transitPlanets)

  _toolbar?.render()
  _chartPane?.render(state.planets, state.lagna, transitPlanets)
  _table?.render(state.planets, transitPlanets, t2n, t2t)
}

function handleToolbarChange(key, value) {
  setTransitUI(key, value)
  if (key === 'transitView' || key === 'transitFilter') {
    const ui             = getTransitUI()
    const transitPlanets = ui.transitPlanets ?? []
    const t2n = getTransitToNatalAspects(transitPlanets, state.planets)
    const t2t = getTransitToTransitAspects(transitPlanets)
    _toolbar?.render()
    _chartPane?.render(state.planets, state.lagna, transitPlanets)
    _table?.render(state.planets, transitPlanets, t2n, t2t)
  } else {
    calcAndRender()
  }
}

function handlePlanetClick(abbr) {
  const current = getTransitUI().transitAspectSource
  setTransitUI('transitAspectSource', current === abbr ? null : abbr)
  const transitPlanets = getTransitUI().transitPlanets ?? []
  _chartPane?.render(state.planets, state.lagna, transitPlanets)
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

  _toolbar   = new TransitToolbar(document.getElementById('transit-toolbar-el'), getTransitUI, handleToolbarChange)
  _chartPane = new TransitChartPane(document.getElementById('transit-chart-el'),  getTransitUI, handlePlanetClick)
  _table     = new TransitTable(document.getElementById('transit-table-el'),      getTransitUI)

  calcAndRender()
}
