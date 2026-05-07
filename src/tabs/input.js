// src/tabs/input.js
import { searchLocation, getTimezone } from '../utils/geocoding.js'
import { addToCache } from '../utils/location-cache.js'
import { toJulianDay } from '../utils/time.js'
import { calcBirthChart } from '../core/calculations.js'
import { calcDasha } from '../core/dasha.js'
import { calcPanchang } from '../core/panchang.js'
import { calcBhinnashtakavarga, calcSarvashtakavarga } from '../core/ashtakavarga.js'
import { calcShadbala } from '../core/shadbala.js'
import { applyAyanamsa, getSettings } from '../core/settings.js'
import { getSwe, initSwissEph } from '../core/swisseph.js'
import { state } from '../state.js'
import { switchTab, enableTab } from '../ui/tabs.js'
import { decToDMS, dmsToDec, offsetParts, offsetStr, ianaToOffset, fmtLat, fmtLon } from '../utils/format.js'
import { parseJhdFile } from '../utils/jhd.js'

const DELHI = { displayName: 'New Delhi, India', lat: 28.6139, lon: 77.209, timezone: 'Asia/Kolkata' }
const STORAGE_KEY = 'hora-prakash-profiles'

let selectedLocation = null
let autocompleteTimeout = null
let editingProfileId = null
let datetimeMode = 'picker' // 'picker' | 'text'

// ── LocalStorage helpers ──────────────────────────────────────────────────────

function genId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
}

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

function exportProfiles() {
  const profiles = loadProfiles()
  if (!profiles.length) { alert('No saved profiles to export.'); return }
  // Strip id — reimported profiles get fresh ids
  const exportData = profiles.map(({ id: _id, ...rest }) => rest)
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `hora-prakash-profiles-${new Date().toISOString().slice(0,10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function importProfiles(file) {
  const reader = new FileReader()
  reader.onload = e => {
    try {
      const raw = JSON.parse(e.target.result)
      if (!Array.isArray(raw)) throw new Error('Expected a JSON array.')
      const existing = loadProfiles()
      // Deduplicate by name+dob+tob — skip exact matches already stored
      const existingKeys = new Set(existing.map(p => `${p.name}|${p.dob}|${p.tob}`))
      const toAdd = raw
        .filter(p => p.name && p.dob)
        .filter(p => !existingKeys.has(`${p.name}|${p.dob}|${p.tob}`))
        .map(({ id: _id, ...rest }) => ({ ...rest, id: genId() }))
      if (!toAdd.length) { alert('No new profiles found (all already exist).'); return }
      saveProfiles([...existing, ...toAdd])
      renderSavedProfiles()
      alert(`Imported ${toAdd.length} profile${toAdd.length > 1 ? 's' : ''}.`)
    } catch (err) {
      alert(`Import failed: ${err.message}`)
    }
  }
  reader.readAsText(file)
}

async function importJhdFiles(files) {
  const existing    = loadProfiles()
  const existingKeys = new Set(
    existing.map(p => `${p.name.toLowerCase()}|${p.dob}|${p.tob}|${(p.location||'').toLowerCase()}`)
  )
  const successes = []
  let failCount   = 0
  let dupCount    = 0

  for (const file of Array.from(files)) {
    try {
      const text    = await file.text()
      const profile = parseJhdFile(text, file.name)
      const key     = `${profile.name.toLowerCase()}|${profile.dob}|${profile.tob}|${(profile.location||'').toLowerCase()}`
      if (existingKeys.has(key)) { dupCount++; continue }
      existingKeys.add(key)
      successes.push(profile)
    } catch {
      failCount++
    }
  }

  if (successes.length > 0) {
    saveProfiles([...successes, ...existing])
    renderSavedProfiles()
  }

  const n = successes.length
  const m = failCount
  if (n > 0 && m === 0 && dupCount === 0) {
    alert(`Imported ${n} profile${n > 1 ? 's' : ''}.`)
  } else if (n > 0 && m > 0) {
    alert(`Imported ${n} profile${n > 1 ? 's' : ''}. ${m} file${m > 1 ? 's' : ''} were invalid and skipped.`)
  } else if (n > 0 && dupCount > 0 && m === 0) {
    alert(`Imported ${n} profile${n > 1 ? 's' : ''}. ${dupCount} already existed.`)
  } else if (n === 0 && dupCount > 0 && m === 0) {
    alert('All profiles already exist.')
  } else {
    alert('No valid JHD files found.')
  }
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
        <div class="datetime-section">
          <div class="datetime-section-header">
            <span></span>
            <div class="datetime-header-actions">
              <button type="button" id="btn-use-now" class="btn-icon-svg" title="Use current date &amp; time">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </button>
              <button type="button" id="btn-datetime-mode" class="btn-icon-svg" title="Type manually" data-mode="picker">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h4M14 14h4"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="form-row-2" id="datetime-picker">
            <div class="form-group">
              <label>Date of Birth</label>
              <input type="date" id="inp-dob" required value="${fill.dob}" />
            </div>
            <div class="form-group">
              <label>Time of Birth</label>
              <input type="time" id="inp-tob" required value="${fill.tob}" />
            </div>
          </div>
          <div class="form-row-2" id="datetime-text" style="display:none">
            <div class="form-group">
              <label>Date of Birth <span class="label-hint">DD/MM/YYYY</span></label>
              <input type="text" id="inp-dob-text" inputmode="numeric" placeholder="DD/MM/YYYY" maxlength="10" />
            </div>
            <div class="form-group">
              <label>Time of Birth <span class="label-hint">HH:MM</span></label>
              <input type="text" id="inp-tob-text" inputmode="numeric" placeholder="HH:MM" maxlength="5" />
            </div>
          </div>
        </div>
        <div class="form-group">
          <label>Birth Location <span class="label-hint">search or type manually</span></label>
          <input type="text" id="inp-location" placeholder="City, Country…" autocomplete="off" value="${escapeAttr(fill.location)}" />
          <ul id="location-suggestions"></ul>
        </div>
        <div class="coords-section">
          <div class="coords-section-header">
            <label style="margin:0">Coordinates &amp; Timezone</label>
            <button type="button" id="btn-coord-mode" class="btn-icon-svg" title="Toggle DMS / decimal input">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="17 4 21 4 21 8"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
                <polyline points="7 20 3 20 3 16"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
              </svg>
            </button>
          </div>
          <div class="form-group coords-row" id="coords-dms">
            <div>
              <label>Latitude</label>
              <div class="dms-group">
                <input type="number" id="inp-lat-d" class="dms-seg-d" min="0" max="90"  value="${latDMS.d}" placeholder="0" />
                <span class="dms-sep">°</span>
                <span class="dms-divider"></span>
                <input type="number" id="inp-lat-m" class="dms-seg"   min="0" max="59"  value="${latDMS.m}" placeholder="0" />
                <span class="dms-sep">'</span>
                <span class="dms-divider"></span>
                <input type="number" id="inp-lat-s" class="dms-seg"   min="0" max="59"  value="${latDMS.s}" placeholder="0" />
                <span class="dms-sep">"</span>
                <span class="dms-divider"></span>
                <select id="inp-lat-dir" class="dms-seg-dir">
                  <option value="N"${latDir === 'N' ? ' selected' : ''}>N</option>
                  <option value="S"${latDir === 'S' ? ' selected' : ''}>S</option>
                </select>
              </div>
            </div>
            <div>
              <label>Longitude</label>
              <div class="dms-group">
                <input type="number" id="inp-lon-d" class="dms-seg-d" min="0" max="180" value="${lonDMS.d}" placeholder="0" />
                <span class="dms-sep">°</span>
                <span class="dms-divider"></span>
                <input type="number" id="inp-lon-m" class="dms-seg"   min="0" max="59"  value="${lonDMS.m}" placeholder="0" />
                <span class="dms-sep">'</span>
                <span class="dms-divider"></span>
                <input type="number" id="inp-lon-s" class="dms-seg"   min="0" max="59"  value="${lonDMS.s}" placeholder="0" />
                <span class="dms-sep">"</span>
                <span class="dms-divider"></span>
                <select id="inp-lon-dir" class="dms-seg-dir">
                  <option value="E"${lonDir === 'E' ? ' selected' : ''}>E</option>
                  <option value="W"${lonDir === 'W' ? ' selected' : ''}>W</option>
                </select>
              </div>
            </div>
            <div>
              <label>UTC Offset</label>
              <div class="dms-group">
                <select id="inp-tz-sign" class="dms-seg-sign">
                  <option value="+"${tzP.sign === '+' ? ' selected' : ''}>+</option>
                  <option value="-"${tzP.sign === '-' ? ' selected' : ''}>−</option>
                </select>
                <span class="dms-divider"></span>
                <input type="number" id="inp-tz-h" class="dms-seg-tz-h" min="0" max="14" value="${tzP.h}" placeholder="0" />
                <span class="dms-sep">:</span>
                <input type="number" id="inp-tz-m" class="dms-seg-tz-m" min="0" max="59" value="${tzP.m}" placeholder="0" />
                <button type="button" id="btn-fetch-tz" class="btn-tz-inline" title="Auto-detect from coordinates">⟳</button>
              </div>
            </div>
          </div>
          <div class="form-group coords-row-dec" id="coords-dec" style="display:none">
            <div>
              <label>Latitude °</label>
              <input type="number" id="inp-lat-dec" step="0.0001" min="-90" max="90" placeholder="e.g. 28.6139" style="width:100%" />
            </div>
            <div>
              <label>Longitude °</label>
              <input type="number" id="inp-lon-dec" step="0.0001" min="-180" max="180" placeholder="e.g. 77.209" style="width:100%" />
            </div>
            <div>
              <label>UTC Offset</label>
              <div class="dms-group">
                <select id="inp-tz-sign-dec" class="dms-seg-sign">
                  <option value="+"${tzP.sign === '+' ? ' selected' : ''}>+</option>
                  <option value="-"${tzP.sign === '-' ? ' selected' : ''}>−</option>
                </select>
                <span class="dms-divider"></span>
                <input type="number" id="inp-tz-h-dec" class="dms-seg-tz-h" min="0" max="14" value="${tzP.h}" placeholder="0" />
                <span class="dms-sep">:</span>
                <input type="number" id="inp-tz-m-dec" class="dms-seg-tz-m" min="0" max="59" value="${tzP.m}" placeholder="0" />
                <button type="button" id="btn-fetch-tz-dec" class="btn-tz-inline" title="Auto-detect from coordinates">⟳</button>
              </div>
            </div>
          </div>
        </div>
        <div class="form-actions">
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

  datetimeMode = 'picker'
  document.getElementById('btn-use-now').addEventListener('click', onUseNow)
  document.getElementById('btn-datetime-mode').addEventListener('click', toggleDatetimeMode)
  document.getElementById('inp-dob-text').addEventListener('input', autoSlashDate)
  document.getElementById('inp-tob-text').addEventListener('input', autoColonTime)
  document.getElementById('inp-location').addEventListener('input', onLocationInput)
  document.getElementById('birth-form').addEventListener('submit', onFormSubmit)
  document.getElementById('location-suggestions').addEventListener('click', onSuggestionClick)
  document.getElementById('btn-save-profile').addEventListener('click', onSaveProfile)
  document.getElementById('btn-fetch-tz').addEventListener('click', onFetchTz)
  document.getElementById('btn-fetch-tz-dec').addEventListener('click', onFetchTz)
  document.getElementById('btn-coord-mode').addEventListener('click', toggleCoordMode)
  document.getElementById('btn-new-entry').addEventListener('click', () => {
    editingProfileId = null
    document.getElementById('inp-name').value = ''
    document.getElementById('inp-dob').value      = todayStr()
    document.getElementById('inp-tob').value      = nowTimeStr()
    document.getElementById('inp-dob-text').value = ''
    document.getElementById('inp-tob-text').value = ''
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
  if (profiles.length === 0) {
    section.innerHTML = `
      <div class="card" style="margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center">
        <span style="color:var(--muted);font-size:0.88rem">No saved profiles</span>
        <div style="display:flex;gap:0.4rem;align-items:center">
          <label class="btn-secondary" style="font-size:0.78rem;padding:0.25rem 0.65rem;cursor:pointer;margin:0">
            ↑ Import<input type="file" id="inp-import-file" accept=".json" style="display:none" />
          </label>
          <label class="btn-secondary" style="font-size:0.78rem;padding:0.25rem 0.65rem;cursor:pointer;margin:0">
            ↑ JHD<input type="file" id="inp-import-jhd" accept=".jhd,.JHD" multiple style="display:none" />
          </label>
        </div>
      </div>`
    section.querySelector('#inp-import-file').addEventListener('change', e => {
      const file = e.target.files[0]
      if (file) { importProfiles(file); e.target.value = '' }
    })
    section.querySelector('#inp-import-jhd').addEventListener('change', e => {
      if (e.target.files.length) { importJhdFiles(e.target.files); e.target.value = '' }
    })
    return
  }

  section.innerHTML = `
    <div class="card" style="margin-bottom:1rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;gap:0.5rem;flex-wrap:wrap">
        <h3 style="margin:0">Saved Profiles</h3>
        <div style="display:flex;gap:0.4rem;align-items:center">
          <button type="button" id="btn-export-profiles" class="btn-secondary" style="font-size:0.78rem;padding:0.25rem 0.65rem">↓ Export</button>
          <label id="lbl-import-profiles" class="btn-secondary" style="font-size:0.78rem;padding:0.25rem 0.65rem;cursor:pointer;margin:0">↑ Import<input type="file" id="inp-import-file" accept=".json" style="display:none" /></label>
          <label class="btn-secondary" style="font-size:0.78rem;padding:0.25rem 0.65rem;cursor:pointer;margin:0">↑ JHD<input type="file" id="inp-import-jhd" accept=".jhd,.JHD" multiple style="display:none" /></label>
          <button type="button" id="btn-clear-all" class="btn-danger-sm">Clear All</button>
        </div>
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
    if (!id) { preview.style.display = 'none'; editingProfileId = null; return }
    const p = profiles.find(q => q.id === id)
    if (!p) { preview.style.display = 'none'; editingProfileId = null; return }
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
    fillForm(p)
    editingProfileId = p.id
  })

  section.querySelector('#btn-export-profiles').addEventListener('click', exportProfiles)
  section.querySelector('#inp-import-file').addEventListener('change', e => {
    const file = e.target.files[0]
    if (file) { importProfiles(file); e.target.value = '' }
  })
  section.querySelector('#inp-import-jhd').addEventListener('change', e => {
    if (e.target.files.length) { importJhdFiles(e.target.files); e.target.value = '' }
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
    if (profile) { fillForm(profile); editingProfileId = profile.id }
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
  // keep text fields in sync too
  if (p.dob) {
    const [y, mo, d] = p.dob.split('-')
    document.getElementById('inp-dob-text').value = `${d}/${mo}/${y}`
  }
  document.getElementById('inp-tob-text').value  = p.tob || ''
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
  const timezone = readTimezone()
  const location = document.getElementById('inp-location').value.trim()

  if (!name || !dob || !tob || !timezone) {
    document.getElementById('calc-error').textContent = 'Fill Name, Date, Time and Location before saving.'
    return
  }

  const id = editingProfileId || genId()
  saveProfile({ id, name, dob, tob, lat, lon, timezone, location, savedAt: new Date().toISOString() })
  editingProfileId = id
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
    document.getElementById('inp-tz-sign').value    = p.sign
    document.getElementById('inp-tz-h').value        = p.h
    document.getElementById('inp-tz-m').value        = p.m
    document.getElementById('inp-tz-sign-dec').value = p.sign
    document.getElementById('inp-tz-h-dec').value    = p.h
    document.getElementById('inp-tz-m-dec').value    = p.m
    selectedLocation = {
      ...(selectedLocation || {}),
      displayName: document.getElementById('inp-location').value.trim(),
      lat,
      lon,
      timezone: tz,
    }
    document.getElementById('calc-error').textContent = ''
  } catch {
    document.getElementById('calc-error').textContent = 'Could not fetch timezone. Enter it manually.'
  } finally {
    btn.disabled = false
    btn.textContent = '⟳'
  }
}

// ── Date/time mode helpers ────────────────────────────────────────────────────

function onUseNow() {
  const dob = todayStr()
  const tob = nowTimeStr()
  document.getElementById('inp-dob').value      = dob
  document.getElementById('inp-tob').value      = tob
  // Also fill text fields so switching modes keeps values
  const [y, mo, d] = dob.split('-')
  document.getElementById('inp-dob-text').value = `${d}/${mo}/${y}`
  document.getElementById('inp-tob-text').value  = tob
}

function toggleDatetimeMode() {
  const toText = datetimeMode === 'picker'
  if (toText) {
    // copy picker values → text fields
    const dob = document.getElementById('inp-dob').value
    const tob = document.getElementById('inp-tob').value
    if (dob) {
      const [y, mo, d] = dob.split('-')
      document.getElementById('inp-dob-text').value = `${d}/${mo}/${y}`
    }
    document.getElementById('inp-tob-text').value = tob || ''
    datetimeMode = 'text'
  } else {
    // copy text values → picker fields (best-effort)
    const dobRaw = document.getElementById('inp-dob-text').value.trim()
    const tobRaw = document.getElementById('inp-tob-text').value.trim()
    const parsed = parseDateText(dobRaw)
    if (parsed) document.getElementById('inp-dob').value = parsed
    if (/^\d{1,2}:\d{2}$/.test(tobRaw)) {
      document.getElementById('inp-tob').value = tobRaw.padStart(5, '0')
    }
    datetimeMode = 'picker'
  }
  document.getElementById('datetime-picker').style.display = toText  ? 'none' : ''
  document.getElementById('datetime-text').style.display   = toText  ? ''     : 'none'
  const btn = document.getElementById('btn-datetime-mode')
  if (toText) {
    btn.title = 'Use date/time picker'
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`
  } else {
    btn.title = 'Type manually'
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h4M14 14h4"/></svg>`
  }
}

function parseDateText(str) {
  // accepts DD/MM/YYYY or DD-MM-YYYY
  const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (!m) return null
  const [, d, mo, y] = m
  return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`
}

function autoSlashDate(e) {
  let v = e.target.value.replace(/[^\d]/g, '')
  if (v.length > 2) v = v.slice(0,2) + '/' + v.slice(2)
  if (v.length > 5) v = v.slice(0,5) + '/' + v.slice(5)
  e.target.value = v.slice(0, 10)
}

function autoColonTime(e) {
  let v = e.target.value.replace(/[^\d]/g, '')
  if (v.length > 2) v = v.slice(0,2) + ':' + v.slice(2)
  e.target.value = v.slice(0, 5)
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
    `<li data-index="${i}" data-lat="${r.lat}" data-lon="${r.lon}" data-name="${escapeAttr(r.displayName)}" data-tz="${escapeAttr(r.tz || '')}">${escapeHtml(r.displayName)}</li>`
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
    const tz = li.dataset.tz || await getTimezone(lat, lon)
    selectedLocation = { displayName: li.dataset.name, lat, lon, timezone: tz }
    addToCache({ displayName: li.dataset.name, lat, lon, tz })
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
  let dob, tob
  if (datetimeMode === 'text') {
    const dobRaw = document.getElementById('inp-dob-text').value.trim()
    const tobRaw = document.getElementById('inp-tob-text').value.trim()
    dob = parseDateText(dobRaw)
    tob = /^\d{1,2}:\d{2}$/.test(tobRaw) ? tobRaw.padStart(5, '0') : ''
    if (!dob) { errEl.textContent = 'Date must be DD/MM/YYYY.'; return }
    if (!tob) { errEl.textContent = 'Time must be HH:MM.'; return }
  } else {
    dob = document.getElementById('inp-dob').value
    tob = document.getElementById('inp-tob').value
  }
  const lat  = Math.round(readLat() * 10000) / 10000
  const lon  = Math.round(readLon() * 10000) / 10000
  const tz   = readTimezone()

  if (!name || !dob || !tob || !tz) {
    errEl.textContent = 'Please fill Name, Date, Time and select a location.'
    return
  }
  if (isNaN(lat) || lat < -90 || lat > 90) { errEl.textContent = 'Latitude must be between -90 and 90.'; return }
  if (isNaN(lon) || lon < -180 || lon > 180) { errEl.textContent = 'Longitude must be between -180 and 180.'; return }

  const btn = document.getElementById('btn-calculate')
  try {
    btn.disabled = true
    btn.textContent = 'Loading ephemeris…'

    await initSwissEph()
    btn.textContent = 'Calculating…'
    applyAyanamsa()
    const jd = toJulianDay(dob, tob, tz)
    const settings = getSettings()
    const { planets, lagna, houses } = calcBirthChart(jd, lat, lon, settings)
    const moon = planets.find(p => p.name === 'Moon')
    if (!moon) throw new Error('Moon position could not be calculated.')
    const swe      = getSwe()
    const dasha    = await calcDasha(moon, dob, { settings, swe, jd })
    const panchang = calcPanchang(jd, lat, lon, { dateStr: dob, timezone: tz })

    const location = document.getElementById('inp-location').value.trim()
    state.birth    = { name, dob, tob, lat, lon, timezone: tz, location }
    state.planets  = planets
    state.lagna    = lagna
    state.houses   = houses
    state.dasha    = dasha
    state.panchang = panchang

    const bhinna   = calcBhinnashtakavarga(planets, lagna)
    const sarva    = calcSarvashtakavarga(bhinna)
    const shadbala = calcShadbala(planets, lagna, houses, jd, panchang)
    state.strength = { bhinna, sarva, shadbala }

    // Update session label and profile tab bar
    const { updateActiveLabel } = await import('../sessions.js')
    const { renderProfileTabs } = await import('../ui/profile-tabs.js')
    updateActiveLabel(name)
    renderProfileTabs()

    const { renderChart }    = await import('./chart.js')
    const { renderDasha }    = await import('./dasha.js')
    const { renderPanchang } = await import('./panchang.js')

    const { renderStrength } = await import('./strength.js')
    renderChart(); renderDasha().catch(console.error); renderPanchang(); renderStrength()
    enableTab('chart'); enableTab('dasha'); enableTab('panchang'); enableTab('strength'); enableTab('transit')
    switchTab('chart')
  } catch (err) {
    errEl.textContent = `Calculation error: ${err.message}`
    console.error(err)
  } finally {
    btn.disabled = false
    btn.textContent = 'Calculate Chart'
  }
}

// ── Coord mode toggle ─────────────────────────────────────────────────────────

let coordMode = 'dms' // 'dms' | 'dec'

function toggleCoordMode() {
  const isDec = coordMode === 'dms'
  if (isDec) {
    // switching dms → dec: copy current DMS values into decimal fields
    const lat = readLatDMS()
    const lon = readLonDMS()
    document.getElementById('inp-lat-dec').value = isNaN(lat) ? '' : lat
    document.getElementById('inp-lon-dec').value = isNaN(lon) ? '' : lon
    const tzH = document.getElementById('inp-tz-h').value
    const tzM = document.getElementById('inp-tz-m').value
    const tzS = document.getElementById('inp-tz-sign').value
    document.getElementById('inp-tz-h-dec').value    = tzH
    document.getElementById('inp-tz-m-dec').value    = tzM
    document.getElementById('inp-tz-sign-dec').value = tzS
    coordMode = 'dec'
  } else {
    // switching dec → dms: copy decimal into DMS fields
    const lat = parseFloat(document.getElementById('inp-lat-dec').value)
    const lon = parseFloat(document.getElementById('inp-lon-dec').value)
    const tzH = document.getElementById('inp-tz-h-dec').value
    const tzM = document.getElementById('inp-tz-m-dec').value
    const tzS = document.getElementById('inp-tz-sign-dec').value
    if (!isNaN(lat) && !isNaN(lon)) fillCoordsDMS(lat, lon)
    document.getElementById('inp-tz-h').value    = tzH
    document.getElementById('inp-tz-m').value    = tzM
    document.getElementById('inp-tz-sign').value = tzS
    coordMode = 'dms'
  }
  document.getElementById('coords-dms').style.display = coordMode === 'dms' ? '' : 'none'
  document.getElementById('coords-dec').style.display = coordMode === 'dec' ? '' : 'none'
  const btn = document.getElementById('btn-coord-mode')
  btn.title = coordMode === 'dms' ? 'Toggle DMS / decimal input' : 'Toggle decimal / DMS input'
}

// ── Split-input readers ───────────────────────────────────────────────────────

function readLatDMS() {
  const d   = parseFloat(document.getElementById('inp-lat-d').value) || 0
  const m   = parseFloat(document.getElementById('inp-lat-m').value) || 0
  const s   = parseFloat(document.getElementById('inp-lat-s').value) || 0
  const dir = document.getElementById('inp-lat-dir').value
  const dec = dmsToDec(d, m, s)
  return dir === 'S' ? -dec : dec
}

function readLonDMS() {
  const d   = parseFloat(document.getElementById('inp-lon-d').value) || 0
  const m   = parseFloat(document.getElementById('inp-lon-m').value) || 0
  const s   = parseFloat(document.getElementById('inp-lon-s').value) || 0
  const dir = document.getElementById('inp-lon-dir').value
  const dec = dmsToDec(d, m, s)
  return dir === 'W' ? -dec : dec
}

function readLat() {
  if (coordMode === 'dec') return parseFloat(document.getElementById('inp-lat-dec').value) || 0
  return readLatDMS()
}

function readLon() {
  if (coordMode === 'dec') return parseFloat(document.getElementById('inp-lon-dec').value) || 0
  return readLonDMS()
}

function readTz() {
  const suffix = coordMode === 'dec' ? '-dec' : ''
  const sign = document.getElementById(`inp-tz-sign${suffix}`).value
  const h    = parseInt(document.getElementById(`inp-tz-h${suffix}`).value) || 0
  const m    = parseInt(document.getElementById(`inp-tz-m${suffix}`).value) || 0
  return offsetStr({ sign, h, m })
}

function readTimezone() {
  const offset = readTz()
  const selectedTz = selectedLocation?.timezone
  if (!selectedTz || /^([+-])(\d{1,2}):(\d{2})$/.test(selectedTz)) return offset
  if (offsetStr(offsetParts(selectedTz)) !== offset) return offset
  const lat = readLat()
  const lon = readLon()
  const sameCoords = Math.abs((selectedLocation.lat ?? NaN) - lat) < 0.01 &&
    Math.abs((selectedLocation.lon ?? NaN) - lon) < 0.01
  return sameCoords ? selectedTz : offset
}

function fillCoordsDMS(lat, lon) {
  const ld = decToDMS(Math.abs(lat)); const lDir = lat >= 0 ? 'N' : 'S'
  const od = decToDMS(Math.abs(lon)); const oDir = lon >= 0 ? 'E' : 'W'
  document.getElementById('inp-lat-d').value   = ld.d
  document.getElementById('inp-lat-m').value   = ld.m
  document.getElementById('inp-lat-s').value   = ld.s
  document.getElementById('inp-lat-dir').value = lDir
  document.getElementById('inp-lon-d').value   = od.d
  document.getElementById('inp-lon-m').value   = od.m
  document.getElementById('inp-lon-s').value   = od.s
  document.getElementById('inp-lon-dir').value = oDir
}

function fillCoords(lat, lon, timezone) {
  const tzP = offsetParts(timezone)
  fillCoordsDMS(lat, lon)
  // Also keep decimal fields in sync
  document.getElementById('inp-lat-dec').value = Math.round(lat * 10000) / 10000
  document.getElementById('inp-lon-dec').value = Math.round(lon * 10000) / 10000
  document.getElementById('inp-tz-sign').value    = tzP.sign
  document.getElementById('inp-tz-h').value        = tzP.h
  document.getElementById('inp-tz-m').value        = tzP.m
  document.getElementById('inp-tz-sign-dec').value = tzP.sign
  document.getElementById('inp-tz-h-dec').value    = tzP.h
  document.getElementById('inp-tz-m-dec').value    = tzP.m
}

/** Recalculate all charts when settings change (e.g., ayanamsa). Only works if a birth chart already exists. */
export async function recalcAll() {
  if (!state.birth) return
  try {
    applyAyanamsa()
    const btn = document.getElementById('btn-calculate')
    if (btn) {
      btn.disabled = true
      btn.textContent = 'Recalculating…'
    }
    const jd = toJulianDay(state.birth.dob, state.birth.tob, state.birth.timezone)
    const settings = getSettings()
    const { planets, lagna, houses } = calcBirthChart(jd, state.birth.lat, state.birth.lon, settings)
    const moon = planets.find(p => p.name === 'Moon')
    if (!moon) throw new Error('Moon position could not be calculated.')
    const swe      = getSwe()
    const dasha    = await calcDasha(moon, state.birth.dob, { settings, swe, jd })
    const panchang = calcPanchang(jd, state.birth.lat, state.birth.lon, {
      dateStr: state.birth.dob,
      timezone: state.birth.timezone,
    })

    state.planets  = planets
    state.lagna    = lagna
    state.houses   = houses
    state.dasha    = dasha
    state.panchang = panchang

    const bhinna   = calcBhinnashtakavarga(planets, lagna)
    const sarva    = calcSarvashtakavarga(bhinna)
    const shadbala = calcShadbala(planets, lagna, houses, jd, panchang)
    state.strength = { bhinna, sarva, shadbala }

    const { renderChart }    = await import('./chart.js')
    const { renderDasha }    = await import('./dasha.js')
    const { renderPanchang } = await import('./panchang.js')
    const { renderStrength } = await import('./strength.js')

    renderChart(); renderDasha().catch(console.error); renderPanchang(); renderStrength()
    enableTab('chart'); enableTab('dasha'); enableTab('panchang'); enableTab('strength'); enableTab('transit')
  } catch (err) {
    const errEl = document.getElementById('calc-error')
    if (errEl) errEl.textContent = `Recalculation error: ${err.message}`
    console.error(err)
  } finally {
    const btn = document.getElementById('btn-calculate')
    if (btn) {
      btn.disabled = false
      btn.textContent = 'Calculate Chart'
    }
  }
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function escapeAttr(str) {
  return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}
