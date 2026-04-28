// src/tabs/dasha.js
import { state } from '../state.js'
import { getActiveSession, defaultDashaUI } from '../sessions.js'
import { DashaPanel } from '../components/dasha-panel.js'

function getState() {
  const s = getActiveSession()
  if (!s) return defaultDashaUI()
  s.uiState ??= {}
  s.uiState.dasha ??= defaultDashaUI()
  return s.uiState.dasha
}

let _panel = null

export async function renderDasha() {
  const el = document.getElementById('tab-dasha')
  if (!state.dasha || !state.birth || !el) return
  if (_panel) _panel.destroy()
  _panel = new DashaPanel(el, getState)
  await _panel.render(state.dasha, state.birth, {
    cards: ['vimshottari', 'age', 'progression'],
    draggable: true,
  })
}
