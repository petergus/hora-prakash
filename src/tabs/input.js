// src/tabs/input.js
import { searchLocation, getTimezone } from '../utils/geocoding.js'
import { toJulianDay } from '../utils/time.js'
import { calcBirthChart } from '../core/calculations.js'
import { calcDasha } from '../core/dasha.js'
import { calcPanchang } from '../core/panchang.js'
import { state } from '../state.js'
import { switchTab, enableTab } from '../ui/tabs.js'

const DELHI = { displayName: 'New Delhi, India', lat: 28.6139, lon: 77.209, timezone: 'Asia/Kolkata' }
const STORAGE_KEY = 'hora-prakash-profiles'

let selectedLocation = null
let autocompleteTimeout = null

// ── LocalStorage helpers ──────────────────────────────────────────────────────

function loadProfiles() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

function saveProfiles(profiles) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles))
}

function saveProfile(profile) {
  const profiles = loadProfiles()
  const existing = profiles.findIndex(p => p.id === profile.id)
  if (existing >= 0) profiles[existing] = profile
  else profiles.unshift(profile)
  saveProfiles(profiles)
}

function deleteProfile(id) {
  saveProfiles(loadProfiles().filter(p => p.id !== id))
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().slice(0, 10) }

function nowTimeStr() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

// ── Render ────────────────────────────────────────────────────────────────────

export function renderInputTab() {
  const panel = document.getElementById('tab-input')
  panel.innerHTML = `
    <div id="saved-profiles-section"></div>
    <div class="card">
      <form id="birth-form">
        <div class="form-group">
          <label>Name</label>
          <input type="text" id="inp-name" required placeholder="Full name" value="Unknown" />
        </div>
        <div class="form-group">
          <label>Date of Birth</label>
          <input type="date" id="inp-dob" required value="${todayStr()}" />
        </div>
        <div class="form-group">
          <label>Time of Birth</label>
          <input type="time" id="inp-tob" required value="${nowTimeStr()}" />
        </div>
        <div class="form-group">
          <label>Birth Location <span class="label-hint">— type to search, or enter manually below</span></label>
          <input type="text" id="inp-location" placeholder="City, Country…" autocomplete="off" value="${DELHI.displayName}" />
          <ul id="location-suggestions"></ul>
        </div>
        <div class="form-group coords-row">
          <div>
            <label>Latitude</label>
            <input type="number" id="inp-lat" step="any" value="${DELHI.lat}" />
          </div>
          <div>
            <label>Longitude</label>
            <input type="number" id="inp-lon" step="any" value="${DELHI.lon}" />
          </div>
          <div>
            <label>Timezone</label>
            <div style="display:flex;gap:0.4rem">
              <input type="text" id="inp-tz" value="${DELHI.timezone}" placeholder="e.g. Asia/Kolkata" style="flex:1" />
              <button type="button" id="btn-fetch-tz" class="btn-tz" title="Auto-detect timezone from coordinates">⟳</button>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:0.6rem;flex-wrap:wrap;align-items:center">
          <button type="submit" id="btn-calculate">Calculate Chart</button>
          <button type="button" id="btn-save-profile" class="btn-secondary">Save Profile</button>
        </div>
        <p id="calc-error" class="error"></p>
      </form>
    </div>
  `

  selectedLocation = { ...DELHI }
  renderSavedProfiles()

  document.getElementById('inp-location').addEventListener('input', onLocationInput)
  document.getElementById('birth-form').addEventListener('submit', onFormSubmit)
  document.getElementById('location-suggestions').addEventListener('click', onSuggestionClick)
  document.getElementById('btn-save-profile').addEventListener('click', onSaveProfile)
  document.getElementById('btn-fetch-tz').addEventListener('click', onFetchTz)
}

function renderSavedProfiles() {
  const section = document.getElementById('saved-profiles-section')
  const profiles = loadProfiles()
  if (profiles.length === 0) { section.innerHTML = ''; return }

  section.innerHTML = `
    <div class="card" style="margin-bottom:1rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
        <h3 style="margin:0">Saved Profiles</h3>
        <button type="button" id="btn-clear-all" class="btn-danger-sm">Clear All</button>
      </div>
      <div style="display:flex;gap:0.5rem;align-items:center">
        <select id="profile-select" class="profile-select">
          <option value="">— Select a profile —</option>
          ${profiles.map(p => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.name)} · ${p.dob} · ${escapeHtml(p.location || p.lat + '°, ' + p.lon + '°')}</option>`).join('')}
        </select>
        <button type="button" id="btn-load-profile" class="btn-load">Load</button>
        <button type="button" id="btn-delete-profile" class="btn-delete" title="Delete selected">✕</button>
      </div>
    </div>
  `

  section.querySelector('#btn-clear-all').addEventListener('click', () => {
    if (confirm('Delete all saved profiles?')) { saveProfiles([]); renderSavedProfiles() }
  })

  section.querySelector('#btn-load-profile').addEventListener('click', () => {
    const id = section.querySelector('#profile-select').value
    if (!id) return
    const profile = loadProfiles().find(p => p.id === id)
    if (profile) fillForm(profile)
  })

  section.querySelector('#btn-delete-profile').addEventListener('click', () => {
    const id = section.querySelector('#profile-select').value
    if (!id) return
    if (confirm('Delete this profile?')) { deleteProfile(id); renderSavedProfiles() }
  })
}

function fillForm(p) {
  document.getElementById('inp-name').value     = p.name
  document.getElementById('inp-dob').value      = p.dob
  document.getElementById('inp-tob').value      = p.tob
  document.getElementById('inp-location').value = p.location || ''
  document.getElementById('inp-lat').value      = p.lat
  document.getElementById('inp-lon').value      = p.lon
  document.getElementById('inp-tz').value       = p.timezone
  selectedLocation = { displayName: p.location, lat: p.lat, lon: p.lon, timezone: p.timezone }
}

function onSaveProfile() {
  const name     = document.getElementById('inp-name').value.trim()
  const dob      = document.getElementById('inp-dob').value
  const tob      = document.getElementById('inp-tob').value
  const lat      = Math.round(parseFloat(document.getElementById('inp-lat').value) * 10000) / 10000
  const lon      = Math.round(parseFloat(document.getElementById('inp-lon').value) * 10000) / 10000
  const timezone = document.getElementById('inp-tz').value.trim()
  const location = document.getElementById('inp-location').value.trim()

  if (!name || !dob || !tob || !timezone) {
    document.getElementById('calc-error').textContent = 'Fill Name, Date, Time and Location before saving.'
    return
  }

  // Use name+dob as a stable ID so re-saving the same person updates instead of duplicates
  const id = `${name.toLowerCase().replace(/\s+/g, '-')}-${dob}`
  saveProfile({ id, name, dob, tob, lat, lon, timezone, location, savedAt: new Date().toISOString() })
  renderSavedProfiles()

  const btn = document.getElementById('btn-save-profile')
  btn.textContent = 'Saved ✓'
  setTimeout(() => { btn.textContent = 'Save Profile' }, 1500)
}

async function onFetchTz() {
  const lat = parseFloat(document.getElementById('inp-lat').value)
  const lon = parseFloat(document.getElementById('inp-lon').value)
  const btn = document.getElementById('btn-fetch-tz')
  if (isNaN(lat) || isNaN(lon)) {
    document.getElementById('calc-error').textContent = 'Enter valid coordinates first.'
    return
  }
  btn.disabled = true
  btn.textContent = '…'
  try {
    const tz = await getTimezone(lat, lon)
    document.getElementById('inp-tz').value = tz
    document.getElementById('calc-error').textContent = ''
  } catch {
    document.getElementById('calc-error').textContent = 'Could not fetch timezone. Enter it manually.'
  } finally {
    btn.disabled = false
    btn.textContent = '⟳'
  }
}

// ── Location autocomplete ─────────────────────────────────────────────────────

async function onLocationInput(e) {
  clearTimeout(autocompleteTimeout)
  const q = e.target.value
  if (q.length < 3) { clearSuggestions(); return }
  autocompleteTimeout = setTimeout(async () => {
    try { renderSuggestions(await searchLocation(q)) } catch { clearSuggestions() }
  }, 400)
}

function renderSuggestions(results) {
  const ul = document.getElementById('location-suggestions')
  ul.innerHTML = results.map((r, i) =>
    `<li data-index="${i}" data-lat="${r.lat}" data-lon="${r.lon}" data-name="${escapeAttr(r.displayName)}">${escapeHtml(r.displayName)}</li>`
  ).join('')
}

function clearSuggestions() {
  const ul = document.getElementById('location-suggestions')
  if (ul) ul.innerHTML = ''
}

async function onSuggestionClick(e) {
  const li = e.target.closest('li')
  if (!li) return
  const lat = parseFloat(li.dataset.lat)
  const lon = parseFloat(li.dataset.lon)
  try {
    const tz = await getTimezone(lat, lon)
    selectedLocation = { displayName: li.dataset.name, lat, lon, timezone: tz }
    document.getElementById('inp-location').value = li.dataset.name
    document.getElementById('inp-lat').value = Math.round(lat * 10000) / 10000
    document.getElementById('inp-lon').value = Math.round(lon * 10000) / 10000
    document.getElementById('inp-tz').value = tz
    clearSuggestions()
  } catch {
    document.getElementById('calc-error').textContent = 'Could not fetch timezone. Please try again.'
  }
}

// ── Form submit ───────────────────────────────────────────────────────────────

async function onFormSubmit(e) {
  e.preventDefault()
  const errEl = document.getElementById('calc-error')
  errEl.textContent = ''
  const name = document.getElementById('inp-name').value.trim()
  const dob  = document.getElementById('inp-dob').value
  const tob  = document.getElementById('inp-tob').value
  const lat  = Math.round(parseFloat(document.getElementById('inp-lat').value) * 10000) / 10000
  const lon  = Math.round(parseFloat(document.getElementById('inp-lon').value) * 10000) / 10000
  const tz   = document.getElementById('inp-tz').value.trim()

  if (!name || !dob || !tob || !tz) {
    errEl.textContent = 'Please fill Name, Date, Time and select a location.'
    return
  }
  if (isNaN(lat) || lat < -90 || lat > 90) { errEl.textContent = 'Latitude must be between -90 and 90.'; return }
  if (isNaN(lon) || lon < -180 || lon > 180) { errEl.textContent = 'Longitude must be between -180 and 180.'; return }

  const btn = document.getElementById('btn-calculate')
  try {
    btn.disabled = true
    btn.textContent = 'Calculating…'

    const jd = toJulianDay(dob, tob, tz)
    const { planets, lagna, houses } = calcBirthChart(jd, lat, lon)
    const moon = planets.find(p => p.name === 'Moon')
    if (!moon) throw new Error('Moon position could not be calculated.')
    const dasha   = calcDasha(moon, dob)
    const panchang = calcPanchang(jd, lat, lon)

    const location = document.getElementById('inp-location').value.trim()
    state.birth    = { name, dob, tob, lat, lon, timezone: tz, location }
    state.planets  = planets
    state.lagna    = lagna
    state.houses   = houses
    state.dasha    = dasha
    state.panchang = panchang

    const { renderChart }    = await import('./chart.js')
    const { renderDasha }    = await import('./dasha.js')
    const { renderPanchang } = await import('./panchang.js')

    renderChart(); renderDasha(); renderPanchang()
    enableTab('chart'); enableTab('dasha'); enableTab('panchang')
    switchTab('chart')
  } catch (err) {
    errEl.textContent = `Calculation error: ${err.message}`
    console.error(err)
  } finally {
    btn.disabled = false
    btn.textContent = 'Calculate Chart'
  }
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function escapeAttr(str) {
  return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}
