// src/tabs/transit.js
import { state }                                                from '../state.js'
import { getActiveSession, defaultTransitUI }                   from '../sessions.js'
import { getTransitPositions, getTransitLagna }                 from '../core/transit.js'
import { getTransitToNatalAspects, getTransitToTransitAspects, getAspectedSigns } from '../core/aspects.js'
import { getSettings }                                          from '../core/settings.js'
import { toJulianDay }                                          from '../utils/time.js'
import { calcDivisional }                                       from '../core/divisional.js'
import { TransitToolbar }                                       from '../components/TransitToolbar.js'
import { TransitChartPane }                                     from '../components/TransitChartPane.js'
import { TransitTable }                                         from '../components/TransitTable.js'
import { findNextEvents }  from '../core/transitForecast.js'
import { PLANETS }         from '../core/swisseph.js'

// Set aspect sources to planets that aspect a given house number (1-12)
function applyAspectToHouse(houseNum, natalDiv, natalDivLagna, transitDiv) {
  if (!houseNum) return
  const targetSign = ((houseNum - 1 + natalDivLagna.sign - 1) % 12) + 1
  const isOverlay  = (getTransitUI().transitView ?? 'dual') === 'overlay'
  const natalSet   = new Set(natalDiv.filter(p => getAspectedSigns(p.sign, p.abbr).includes(targetSign)).map(p => p.abbr))
  const transitSet = new Set(transitDiv.filter(p => getAspectedSigns(p.sign, p.abbr).includes(targetSign)).map(p => p.abbr))
  if (isOverlay) {
    setTransitUI('overlayNatalAspectSource',   natalSet)
    setTransitUI('overlayTransitAspectSource', transitSet)
  } else {
    setTransitUI('natalAspectSource',   natalSet)
    setTransitUI('transitAspectSource', transitSet)
  }
}

// Apply divisional transform and recompute house relative to divisional lagna
function applyDivisional(planets, lagna, key) {
  if (!key || key === 'D1') return { planets, lagna }
  const { planets: dp, lagna: dl } = calcDivisional(planets, lagna, key)
  const dPlanets = dp.map(p => ({ ...p, house: ((p.sign - dl.sign + 12) % 12) + 1 }))
  return { planets: dPlanets, lagna: dl }
}

let _toolbar   = null
let _chartPane = null
let _table     = null
let _tooltip   = null

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
  if (ui.forecastCache) {
    ui.forecastCache = {}
    _tooltip?.clearForecasts()
    _table?.clearForecasts()
  }
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

  const uiNow = getTransitUI()
  const div = uiNow.transitDivisional ?? 'D1'
  const { planets: natalDiv, lagna: natalDivLagna }     = applyDivisional(state.planets, state.lagna, div)
  const { planets: transitDiv, lagna: transitDivLagna } = applyDivisional(transitPlanets, transitLagna, div)

  if (uiNow.aspectToHouse) applyAspectToHouse(uiNow.aspectToHouse, natalDiv, natalDivLagna, transitDiv)

  const t2n = getTransitToNatalAspects(transitDiv, natalDiv)
  const t2t = getTransitToTransitAspects(transitDiv)

  _toolbar?.render()
  _chartPane?.render(natalDiv, natalDivLagna, transitDiv, transitDivLagna)
  _table?.render(natalDiv, transitDiv, t2n, t2t, natalDivLagna, transitDivLagna, div)
}

function handleToolbarChange(key, value) {
  setTransitUI(key, value)
  if (key === 'showTooltip') {
    _chartPane?.setTooltipEnabled(value)
    _toolbar?.render()
    return
  }
  if (key === 'transitView' || key === 'transitChartStyle' || key === 'chartZoom' || key === 'dualActiveTab' || key === 'transitDivisional' || key === 'aspectToHouse') {
    const ui             = getTransitUI()
    const transitPlanets = ui.transitPlanets ?? []
    const transitLagna   = ui.transitLagna ?? state.lagna
    const div = ui.transitDivisional ?? 'D1'
    const { planets: natalDiv, lagna: natalDivLagna }     = applyDivisional(state.planets, state.lagna, div)
    const { planets: transitDiv, lagna: transitDivLagna } = applyDivisional(transitPlanets, transitLagna, div)
    if (key === 'aspectToHouse') {
      if (value) {
        applyAspectToHouse(value, natalDiv, natalDivLagna, transitDiv)
      } else {
        setTransitUI('natalAspectSource',          new Set())
        setTransitUI('transitAspectSource',        new Set())
        setTransitUI('overlayNatalAspectSource',   new Set())
        setTransitUI('overlayTransitAspectSource', new Set())
      }
    } else if (ui.aspectToHouse) {
      applyAspectToHouse(ui.aspectToHouse, natalDiv, natalDivLagna, transitDiv)
    }
    const t2n = getTransitToNatalAspects(transitDiv, natalDiv)
    const t2t = getTransitToTransitAspects(transitDiv)
    _toolbar?.render()
    _chartPane?.render(natalDiv, natalDivLagna, transitDiv, transitDivLagna)
    _table?.render(natalDiv, transitDiv, t2n, t2t, natalDivLagna, transitDivLagna, div)
  } else {
    if (key === 'transitDate' || key === 'transitTime') {
      const ui = getTransitUI()
      ui.forecastCache = {}
      _tooltip?.clearForecasts()
      _table?.clearForecasts()
    }
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
  setTransitUI('aspectToHouse', null)
  _reRenderChart()
}

function handleAspectToSign(chartType, sign) {
  const ui             = getTransitUI()
  const div            = ui.transitDivisional ?? 'D1'
  const transitPlanets = ui.transitPlanets ?? []
  const transitLagna   = ui.transitLagna ?? state.lagna
  const isOverlay      = (ui.transitView ?? 'dual') === 'overlay'
  const { planets: natalDiv }   = applyDivisional(state.planets, state.lagna, div)
  const { planets: transitDiv } = applyDivisional(transitPlanets, transitLagna, div)
  const planets   = chartType === 'transit' ? transitDiv : natalDiv
  const aspecting = new Set(planets.filter(p => getAspectedSigns(p.sign, p.abbr).includes(sign)).map(p => p.abbr))
  const sourceKey = isOverlay
    ? (chartType === 'transit' ? 'overlayTransitAspectSource' : 'overlayNatalAspectSource')
    : (chartType === 'transit' ? 'transitAspectSource'        : 'natalAspectSource')
  setTransitUI(sourceKey, aspecting)
  setTransitUI('aspectToHouse', null)
  _reRenderChart()
}

function handleClearAspects() {
  setTransitUI('natalAspectSource',          new Set())
  setTransitUI('transitAspectSource',        new Set())
  setTransitUI('overlayNatalAspectSource',   new Set())
  setTransitUI('overlayTransitAspectSource', new Set())
  setTransitUI('aspectToHouse', null)
  _reRenderChart()
}


function requestForecast(abbr) {
  const ui = getTransitUI()
  if (!state.planets || !state.lagna) return

  ui.forecastCache ??= {}
  if (ui.forecastCache[abbr]) {
    _tooltip?.setForecast(abbr, ui.forecastCache[abbr])
    _table?.setForecast(abbr, ui.forecastCache[abbr])
    return
  }

  const date = ui.transitDate ?? todayDate()
  const time = ui.transitTime ?? nowTime()
  const tz   = state.birth?.timezone ?? '+00:00'
  const jd   = toJulianDay(date, time, tz)

  const planet = PLANETS.find(p => p.abbr === abbr)
  if (!planet) return

  Promise.resolve().then(() => {
    const events = findNextEvents(planet, jd, state.planets, state.lagna.sign)
    ui.forecastCache[abbr] = events
    _tooltip?.setForecast(abbr, events)
    _table?.setForecast(abbr, events)
  })
}

function _reRenderChart() {
  const ui             = getTransitUI()
  const transitPlanets = ui.transitPlanets ?? []
  const div            = ui.transitDivisional ?? 'D1'
  const transitLagna   = ui.transitLagna ?? state.lagna
  const { planets: natalDiv, lagna: natalDivLagna }     = applyDivisional(state.planets, state.lagna, div)
  const { planets: transitDiv, lagna: transitDivLagna } = applyDivisional(transitPlanets, transitLagna, div)
  _chartPane?.render(natalDiv, natalDivLagna, transitDiv, transitDivLagna)
  _toolbar?.render()
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
  _chartPane = new TransitChartPane(document.getElementById('transit-chart-el'),  getTransitUI, handlePlanetClick, handleToolbarChange, handleAspectToSign)
  _table     = new TransitTable(document.getElementById('transit-table-el'),      getTransitUI)

  _tooltip = _chartPane.getTooltip()
  _tooltip?.setForecastProvider(requestForecast)
  _table.setForecastProvider(requestForecast)

  calcAndRender()
}
