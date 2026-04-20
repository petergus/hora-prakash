// src/tabs/input.js
import { searchLocation, getTimezone } from '../utils/geocoding.js'
import { toJulianDay } from '../utils/time.js'
import { calcBirthChart } from '../core/calculations.js'
import { calcDasha } from '../core/dasha.js'
import { calcPanchang } from '../core/panchang.js'
import { state } from '../state.js'
import { switchTab, enableTab } from '../ui/tabs.js'
import { decToDMS, dmsToDec, offsetParts, offsetStr, ianaToOffset, fmtLat, fmtLon } from '../utils/format.js'

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

  // Pre-fill from current session's state if available; else use DELHI defaults
  const b = state.birth
  const latDMS = decToDMS(b?.lat  ?? DELHI.lat)
  const lonDMS = decToDMS(b?.lon  ?? DELHI.lon)
  const latDir = (b?.lat  ?? DELHI.lat)  >= 0 ? 'N' : 'S'
  const lonDir = (b?.lon  ?? DELHI.lon)  >= 0 ? 'E' : 'W'
  const tzP    = offsetParts(b?.timezone ?? DELHI.timezone)
  const fill = {
    name:     b?.name     ?? '',
    dob:      b?.dob      ?? todayStr(),
    tob:      b?.tob      ?? nowTimeStr(),
    location: b?.location ?? DELHI.displayName,
  }

  panel.innerHTML = `
    <div id="saved-profiles-section"></div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.1rem">
        <h3 style="margin:0;font-size:0.95rem;font-weight:600;color:var(--muted);letter-spacing:0.03em;text-transform:uppercase">Birth Details</h3>
        <button type="button" id="btn-new-entry" class="btn-secondary" title="New entry — clear all fields" style="display:inline-flex;align-items:center;gap:0.35rem;padding:0.28rem 0.75rem;font-size:0.82rem">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 1.5H2.5A1 1 0 0 0 1.5 2.5v8A1 1 0 0 0 2.5 11.5h8A1 1 0 0 0 11.5 10.5V7"/>
            <path d="M10 1.2a1.1 1.1 0 0 1 1.6 1.6L7 7.5 5 8l.5-2 4.5-4.8z"/>
          </svg>
          New
        </button>
      </div>
      <form id="birth-form">
        <div class="form-group">
          <label>Name</label>
          <input type="text" id="inp-name" required placeholder="Full name" value="${escapeAttr(fill.name)}" />
        </div>
        <div class="form-group">
          <label>Date of Birth</label>
          <input type="date" id="inp-dob" required value="${fill.dob}" />
        </div>
        <div class="form-group">
          <label>Time of Birth</label>
          <input type="time" id="inp-tob" required value="${fill.tob}" />
        </div>
        <div class="form-group">
          <label>Birth Location <span class="label-hint">— search or enter manually</span></label>
          <input type="text" id="inp-location" placeholder="City, Country…" autocomplete="off" value="${escapeAttr(fill.location)}" />
          <ul id="location-suggestions"></ul>
        </div>
        <div class="form-group coords-row">
          <div>
            <label>Latitude</label>
            <div class="dms-input">
              <input type="number" id="inp-lat-d" class="dms-deg" min="0" max="90"  value="${latDMS.d}" />°
              <input type="number" id="inp-lat-m" class="dms-min" min="0" max="59"  value="${latDMS.m}" />'
              <input type="number" id="inp-lat-s" class="dms-sec" min="0" max="59"  value="${latDMS.s}" />"
              <select id="inp-lat-dir" class="dms-dir">
                <option value="N"${latDir === 'N' ? ' selected' : ''}>N</option>
                <option value="S"${latDir === 'S' ? ' selected' : ''}>S</option>
              </select>
            </div>
          </div>
          <div>
            <label>Longitude</label>
            <div class="dms-input">
              <input type="number" id="inp-lon-d" class="dms-deg" min="0" max="180" value="${lonDMS.d}" />°
              <input type="number" id="inp-lon-m" class="dms-min" min="0" max="59"  value="${lonDMS.m}" />'
              <input type="number" id="inp-lon-s" class="dms-sec" min="0" max="59"  value="${lonDMS.s}" />"
              <select id="inp-lon-dir" class="dms-dir">
                <option value="E"${lonDir === 'E' ? ' selected' : ''}>E</option>
                <option value="W"${lonDir === 'W' ? ' selected' : ''}>W</option>
              </select>
            </div>
          </div>
          <div>
            <label>Timezone (UTC offset)</label>
            <div class="dms-input">
              <select id="inp-tz-sign" class="dms-dir">
                <option value="+"${tzP.sign === '+' ? ' selected' : ''}>+</option>
                <option value="-"${tzP.sign === '-' ? ' selected' : ''}>−</option>
              </select>
              <input type="number" id="inp-tz-h" class="dms-deg" min="0" max="14" value="${tzP.h}" />:
              <input type="number" id="inp-tz-m" class="dms-min" min="0" max="59" value="${tzP.m}" />
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

  // Restore selectedLocation from state.birth or default to DELHI
  selectedLocation = b
    ? { displayName: b.location, lat: b.lat, lon: b.lon, timezone: b.timezone }
    : { ...DELHI }
  renderSavedProfiles()

  document.getElementById('inp-location').addEventListener('input', onLocationInput)
  document.getElementById('birth-form').addEventListener('submit', onFormSubmit)
  document.getElementById('location-suggestions').addEventListener('click', onSuggestionClick)
  document.getElementById('btn-save-profile').addEventListener('click', onSaveProfile)
  document.getElementById('btn-fetch-tz').addEventListener('click', onFetchTz)
  document.getElementById('btn-new-entry').addEventListener('click', () => {
    document.getElementById('inp-name').value = ''
    document.getElementById('inp-dob').value = todayStr()
    document.getElementById('inp-tob').value = nowTimeStr()
    document.getElementById('inp-location').value = ''
    ;['inp-lat-d','inp-lat-m','inp-lat-s','inp-lon-d','inp-lon-m','inp-lon-s','inp-tz-h','inp-tz-m']
      .forEach(id => { document.getElementById(id).value = '' })
    document.getElementById('inp-lat-dir').value = 'N'
    document.getElementById('inp-lon-dir').value = 'E'
    document.getElementById('inp-tz-sign').value = '+'
    selectedLocation = {}
    document.getElementById('inp-name').focus()
  })
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
      <div class="profile-row">
        <select id="profile-select" class="profile-select">
          <option value="">— Select a profile —</option>
          ${profiles.map(p => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.name)}</option>`).join('')}
        </select>
        <button type="button" id="btn-load-profile" class="btn-icon btn-icon-primary" title="Load &amp; calculate chart">&#9654;</button>
        <button type="button" id="btn-edit-profile" class="btn-icon btn-icon-muted" title="Load into form for editing">&#9998;</button>
        <button type="button" id="btn-delete-profile" class="btn-icon btn-icon-danger" title="Delete profile">&#128465;</button>
      </div>
      <div id="profile-preview" class="profile-preview" style="display:none"></div>
    </div>
  `

  const sel = section.querySelector('#profile-select')

  sel.addEventListener('change', () => {
    const id = sel.value
    const preview = section.querySelector('#profile-preview')
    if (!id) { preview.style.display = 'none'; return }
    const p = profiles.find(q => q.id === id)
    if (!p) { preview.style.display = 'none'; return }
    preview.style.display = 'flex'
    preview.innerHTML = `
      <span class="pp-name">${escapeHtml(p.name)}</span>
      <span class="pp-sep">·</span>
      <span class="pp-item">${p.dob}</span>
      <span class="pp-sep">·</span>
      <span class="pp-item">${p.tob}</span>
      <span class="pp-sep">·</span>
      <span class="pp-item pp-loc">${escapeHtml(p.location || p.lat + '°, ' + p.lon + '°')}</span>
    `
  })

  section.querySelector('#btn-clear-all').addEventListener('click', () => {
    if (confirm('Delete all saved profiles?')) { saveProfiles([]); renderSavedProfiles() }
  })

  section.querySelector('#btn-load-profile').addEventListener('click', () => {
    const id = sel.value
    if (!id) return
    const profile = profiles.find(p => p.id === id)
    if (profile) { fillForm(profile); document.getElementById('birth-form').requestSubmit() }
  })

  section.querySelector('#btn-edit-profile').addEventListener('click', () => {
    const id = sel.value
    if (!id) return
    const profile = profiles.find(p => p.id === id)
    if (profile) fillForm(profile)
  })

  section.querySelector('#btn-delete-profile').addEventListener('click', () => {
    const id = sel.value
    if (!id) return
    const profile = profiles.find(p => p.id === id)
    const label = profile ? `"${profile.name}" (${profile.dob})` : 'this profile'
    if (confirm(`Remove ${label}? This cannot be undone.`)) { deleteProfile(id); renderSavedProfiles() }
  })
}

function fillForm(p) {
  document.getElementById('inp-name').value     = p.name
  document.getElementById('inp-dob').value      = p.dob
  document.getElementById('inp-tob').value      = p.tob
  document.getElementById('inp-location').value = p.location || ''
  fillCoords(p.lat, p.lon, p.timezone)
  selectedLocation = { displayName: p.location, lat: p.lat, lon: p.lon, timezone: p.timezone }
}

function onSaveProfile() {
  const name     = document.getElementById('inp-name').value.trim()
  const dob      = document.getElementById('inp-dob').value
  const tob      = document.getElementById('inp-tob').value
  const lat      = Math.round(readLat() * 10000) / 10000
  const lon      = Math.round(readLon() * 10000) / 10000
  const timezone = readTz()
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
  const lat = readLat()
  const lon = readLon()
  const btn = document.getElementById('btn-fetch-tz')
  if (isNaN(lat) || isNaN(lon)) {
    document.getElementById('calc-error').textContent = 'Enter valid coordinates first.'
    return
  }
  btn.disabled = true
  btn.textContent = '…'
  try {
    const tz = await getTimezone(lat, lon)
    const p  = offsetParts(tz)
    document.getElementById('inp-tz-sign').value = p.sign
    document.getElementById('inp-tz-h').value    = p.h
    document.getElementById('inp-tz-m').value    = p.m
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
    fillCoords(lat, lon, tz)
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
  const lat  = Math.round(readLat() * 10000) / 10000
  const lon  = Math.round(readLon() * 10000) / 10000
  const tz   = readTz()

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

    // Update session label and profile tab bar
    const { updateActiveLabel } = await import('../sessions.js')
    const { renderProfileTabs } = await import('../ui/profile-tabs.js')
    updateActiveLabel(name)
    renderProfileTabs()

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

// ── Split-input readers ───────────────────────────────────────────────────────

function readLat() {
  const d   = parseFloat(document.getElementById('inp-lat-d').value) || 0
  const m   = parseFloat(document.getElementById('inp-lat-m').value) || 0
  const s   = parseFloat(document.getElementById('inp-lat-s').value) || 0
  const dir = document.getElementById('inp-lat-dir').value
  const dec = dmsToDec(d, m, s)
  return dir === 'S' ? -dec : dec
}

function readLon() {
  const d   = parseFloat(document.getElementById('inp-lon-d').value) || 0
  const m   = parseFloat(document.getElementById('inp-lon-m').value) || 0
  const s   = parseFloat(document.getElementById('inp-lon-s').value) || 0
  const dir = document.getElementById('inp-lon-dir').value
  const dec = dmsToDec(d, m, s)
  return dir === 'W' ? -dec : dec
}

function readTz() {
  const sign = document.getElementById('inp-tz-sign').value
  const h    = parseInt(document.getElementById('inp-tz-h').value) || 0
  const m    = parseInt(document.getElementById('inp-tz-m').value) || 0
  return offsetStr({ sign, h, m })
}

function fillCoords(lat, lon, timezone) {
  const ld = decToDMS(lat);  const lDir = lat  >= 0 ? 'N' : 'S'
  const od = decToDMS(lon);  const oDir = lon  >= 0 ? 'E' : 'W'
  const tzP = offsetParts(timezone)
  document.getElementById('inp-lat-d').value   = ld.d
  document.getElementById('inp-lat-m').value   = ld.m
  document.getElementById('inp-lat-s').value   = ld.s
  document.getElementById('inp-lat-dir').value = lDir
  document.getElementById('inp-lon-d').value   = od.d
  document.getElementById('inp-lon-m').value   = od.m
  document.getElementById('inp-lon-s').value   = od.s
  document.getElementById('inp-lon-dir').value = oDir
  document.getElementById('inp-tz-sign').value = tzP.sign
  document.getElementById('inp-tz-h').value    = tzP.h
  document.getElementById('inp-tz-m').value    = tzP.m
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function escapeAttr(str) {
  return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}
