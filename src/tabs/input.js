// src/tabs/input.js
import { searchLocation, searchOnline, getTimezone } from '../utils/geocoding.js'
import { addToCache } from '../utils/location-cache.js'
import { toJulianDay, localToUTC, getTZOffsetMinutes } from '../utils/time.js'
import { calcBirthChart } from '../core/calculations.js'
import { calcDasha } from '../core/dasha.js'
import { calcPanchang } from '../core/panchang.js'
import { calcBhinnashtakavarga, calcSarvashtakavarga } from '../core/ashtakavarga.js'
import { calcShadbala } from '../core/shadbala.js'
import { applyAyanamsa, getSettings } from '../core/settings.js'
import { getSwe, initSwissEph } from '../core/swisseph.js'
import { state } from '../state.js'
import { syncPageNav } from '../ui/tabs.js'
import { navigate, routeFor, markRoute } from '../ui/router.js'
import { confirmModal } from '../ui/modal.js'
import { decToDMS, dmsToDec, offsetParts, offsetStr, ianaToOffset, parseTzInfo, fmtLat, fmtLon } from '../utils/format.js'
import { parseBirthPaste } from '../utils/paste-parse.js'
import { saveHoroscope } from '../cloud-store.js'
import {
  genId, loadProfiles, saveProfile, deleteProfile, clearAllProfiles,
  exportProfiles, importProfiles, importJhdFiles, visibleProfiles,
} from './profile-store.js'

const DELHI = { displayName: 'New Delhi, India', lat: 28.6139, lon: 77.209, timezone: 'Asia/Kolkata' }

let selectedLocation = null
let autocompleteTimeout = null
let editingProfileId = null
let datetimeMode = 'picker' // 'picker' | 'text'

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().slice(0, 10) }

function nowTimeStr() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

/**
 * Resolve the UTC-offset parts that actually apply to a given birth date/time in
 * a timezone. For a plain numeric offset ("+05:30") this is the offset itself.
 * For an IANA zone ("America/New_York") the offset is computed *at the birth
 * instant* — so it honours DST, including historical DST that has since been
 * abolished. This mirrors exactly what `toJulianDay` will use for the chart, so
 * the number shown in the form is the number used in the calculation.
 */
function offsetPartsAtBirth(timezone, dob, tob) {
  if (!timezone) return { sign: '+', h: 0, m: 0 }
  if (/^([+-])(\d{1,2}):(\d{2})$/.test(timezone)) return offsetParts(timezone)
  try {
    const utc = localToUTC(`${dob || todayStr()}T${tob || '12:00'}:00`, timezone)
    const min = getTZOffsetMinutes(utc, timezone)
    const sign = min >= 0 ? '+' : '-'
    const abs  = Math.abs(Math.round(min))
    return { sign, h: Math.floor(abs / 60), m: abs % 60 }
  } catch {
    return offsetParts(timezone)
  }
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
  const fill = {
    name:     b?.name     ?? '',
    dob:      b?.dob      ?? todayStr(),
    tob:      b?.tob      ?? nowTimeStr(),
    location: b?.location ?? DELHI.displayName,
  }
  const tzP    = offsetPartsAtBirth(b?.timezone ?? DELHI.timezone, fill.dob, fill.tob)

  panel.innerHTML = `
    <div id="saved-profiles-section"></div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.1rem">
        <h3 style="margin:0;font-size:0.95rem;font-weight:600;color:var(--muted);letter-spacing:0.03em;text-transform:uppercase">Birth Details</h3>
        <div style="display:flex;gap:0.4rem;align-items:center">
          <button type="button" id="btn-paste-details" class="btn-secondary" title="Paste birth details from text" style="display:inline-flex;align-items:center;gap:0.35rem;padding:0.28rem 0.75rem;font-size:0.82rem">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3.5" y="1" width="6" height="2.5" rx="0.6"/>
              <path d="M3 2.5H2.2A1.2 1.2 0 0 0 1 3.7v7.6A1.2 1.2 0 0 0 2.2 12.5h8.6A1.2 1.2 0 0 0 12 11.3V3.7A1.2 1.2 0 0 0 10.8 2.5H10"/>
              <line x1="4" y1="6.5" x2="9" y2="6.5"/><line x1="4" y1="8.5" x2="7.5" y2="8.5"/>
            </svg>
            Paste
          </button>
          <button type="button" id="btn-new-entry" class="btn-secondary" title="New entry — clear all fields" style="display:inline-flex;align-items:center;gap:0.35rem;padding:0.28rem 0.75rem;font-size:0.82rem">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 1.5H2.5A1 1 0 0 0 1.5 2.5v8A1 1 0 0 0 2.5 11.5h8A1 1 0 0 0 11.5 10.5V7"/>
              <path d="M10 1.2a1.1 1.1 0 0 1 1.6 1.6L7 7.5 5 8l.5-2 4.5-4.8z"/>
            </svg>
            New
          </button>
        </div>
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
        <div id="utc-preview" class="utc-preview" style="margin:0.6rem 0;padding:0.5rem 0.7rem;border:1px solid var(--border,#444);border-radius:6px;font-size:0.85rem;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;display:flex;flex-wrap:wrap;gap:0.8rem;align-items:center">
          <span style="opacity:0.7">UTC used for calculation:</span>
          <span id="utc-preview-text" style="font-weight:600">—</span>
          <span style="opacity:0.5">·</span>
          <span id="utc-preview-jd" style="opacity:0.85">JD —</span>
        </div>
        <div class="form-actions">
          <button type="submit" id="btn-calculate">Save &amp; Calculate</button>
        </div>
        <p id="calc-error" class="error"></p>
      </form>
    </div>
    <!-- Paste birth details modal -->
    <div id="paste-modal" class="paste-modal-overlay">
      <div class="paste-modal">
        <div class="paste-modal-header">
          <h3>Paste Birth Details</h3>
          <button type="button" id="paste-modal-close" class="paste-modal-close" title="Close">✕</button>
        </div>
        <p class="paste-modal-hint">Paste text containing birth information — name, date, time, place, coordinates, timezone. The parser will extract what it can.</p>
        <textarea id="paste-textarea" class="paste-textarea" rows="6" placeholder="e.g.\nName: Ramesh Kumar\nDOB: 15/03/1985\nTime: 14:30\nPlace: Mumbai, India\n\nor just free-form text…"></textarea>
        <div id="paste-preview" class="paste-preview"></div>
        <div class="paste-modal-actions">
          <button type="button" id="paste-apply" class="btn-primary" disabled>Fill Form</button>
          <button type="button" id="paste-cancel" class="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  `

  // Restore selectedLocation from state.birth or default to DELHI
  selectedLocation = b
    ? { displayName: b.location, lat: b.lat, lon: b.lon, timezone: b.timezone }
    : { ...DELHI }
  // Tie edits to the saved profile the active chart came from (if any), so
  // "Save & Calculate" updates that profile instead of creating a duplicate.
  editingProfileId = b?.profileId ?? null
  renderSavedProfiles()

  datetimeMode = 'picker'
  document.getElementById('btn-use-now').addEventListener('click', onUseNow)
  document.getElementById('btn-datetime-mode').addEventListener('click', toggleDatetimeMode)
  document.getElementById('inp-dob-text').addEventListener('input', autoSlashDate)
  document.getElementById('inp-tob-text').addEventListener('input', autoColonTime)
  document.getElementById('inp-location').addEventListener('input', onLocationInput)
  document.getElementById('birth-form').addEventListener('submit', onFormSubmit)
  document.getElementById('location-suggestions').addEventListener('click', onSuggestionClick)
  document.getElementById('btn-fetch-tz').addEventListener('click', onFetchTz)
  document.getElementById('btn-fetch-tz-dec').addEventListener('click', onFetchTz)
  document.getElementById('btn-coord-mode').addEventListener('click', toggleCoordMode)
  initPasteModal()
  attachUtcPreviewListeners()
  updateUtcPreview()
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
      if (file) { importProfiles(file, renderSavedProfiles); e.target.value = '' }
    })
    section.querySelector('#inp-import-jhd').addEventListener('change', e => {
      if (e.target.files.length) { importJhdFiles(e.target.files, renderSavedProfiles); e.target.value = '' }
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
          ${visibleProfiles(profiles).map(p => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.name)}</option>`).join('')}
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
    if (file) { importProfiles(file, renderSavedProfiles); e.target.value = '' }
  })
  section.querySelector('#inp-import-jhd').addEventListener('change', e => {
    if (e.target.files.length) { importJhdFiles(e.target.files, renderSavedProfiles); e.target.value = '' }
  })
  section.querySelector('#btn-clear-all').addEventListener('click', async () => {
    if (await confirmModal('Delete all saved profiles?', { title: 'Clear all profiles', confirmLabel: 'Delete all', danger: true })) {
      clearAllProfiles()
      renderSavedProfiles()
    }
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

  section.querySelector('#btn-delete-profile').addEventListener('click', async () => {
    const id = sel.value
    if (!id) return
    const profile = profiles.find(p => p.id === id)
    const label = profile ? `"${profile.name}" (${profile.dob})` : 'this profile'
    if (await confirmModal(`Remove ${label}? This cannot be undone.`, { title: 'Remove profile', confirmLabel: 'Remove', danger: true })) { deleteProfile(id); renderSavedProfiles() }
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

/**
 * Persist a birth record to the profile store and return the id it saved under.
 * Resolves which saved profile this targets, in priority order:
 *   1. a profile explicitly loaded for editing (dropdown / edit button)
 *   2. the profile the active chart was loaded from (survives reloads via state.birth)
 *   3. an existing profile that matches name+date+time (avoids duplicates)
 *   4. a brand-new profile
 * Shared by the "Save & Calculate" submit path.
 */
function saveProfileRecord({ name, dob, tob, lat, lon, timezone, location }) {
  let id = editingProfileId || state.birth?.profileId || null
  if (!id) {
    const match = loadProfiles().find(p => p.name === name && p.dob === dob && p.tob === tob)
    id = match ? match.id : genId()
  }
  const existing = loadProfiles().find(p => p.id === id)
  saveProfile({
    ...(existing || {}),
    id, name, dob, tob, lat, lon, timezone, location,
    savedAt: new Date().toISOString(),
  })
  editingProfileId = id
  if (state.birth) state.birth.profileId = id
  return id
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
    const p  = offsetPartsAtBirth(tz, readDob(), readTob())
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
    try { const { results, isLocal } = await searchLocation(q); renderSuggestions(results, isLocal, q) } catch { clearSuggestions() }
  }, 400)
}

function renderSuggestions(results, isLocal = false, query = '') {
  const ul = document.getElementById('location-suggestions')
  const items = results.map((r, i) =>
    `<li data-index="${i}" data-lat="${r.lat}" data-lon="${r.lon}" data-name="${escapeAttr(r.displayName)}" data-tz="${escapeAttr(r.tz || '')}">${escapeHtml(r.displayName)}</li>`
  ).join('')
  const onlineLink = isLocal && results.length > 0
    ? `<li data-online="1" data-query="${escapeAttr(query)}" class="suggestion-online">Search online →</li>`
    : ''
  ul.innerHTML = items + onlineLink
}

function clearSuggestions() {
  const ul = document.getElementById('location-suggestions')
  if (ul) ul.innerHTML = ''
}

async function onSuggestionClick(e) {
  const li = e.target.closest('li')
  if (!li) return

  if (li.dataset.online) {
    const q = li.dataset.query
    try {
      const results = await searchOnline(q)
      renderSuggestions(results, false, q)
    } catch {
      document.getElementById('calc-error').textContent = 'Online search failed. Please try again.'
    }
    return
  }

  const lat = parseFloat(li.dataset.lat)
  const lon = parseFloat(li.dataset.lon)
  try {
    // Derive the zone from coordinates (bundled DB, offline + deterministic) so
    // a stale cached tz can't shadow the correct one and flip the offset between
    // selections. Only if resolution fails do we fall back to the stored tz.
    const tz = (await getTimezone(lat, lon).catch(() => null)) || li.dataset.tz
    if (!tz) throw new Error('timezone unresolved')
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

  const location = document.getElementById('inp-location').value.trim()
  const btn = document.getElementById('btn-calculate')
  try {
    btn.disabled = true
    btn.textContent = 'Loading ephemeris…'
    // Save & Calculate: persist the (edited) details to the profile store first,
    // then recalculate the chart against them — so the saved profile and the
    // rendered chart never drift apart.
    const id = saveProfileRecord({ name, dob, tob, lat, lon, timezone: tz, location })
    renderSavedProfiles()
    await computeAndRenderChart(
      { name, dob, tob, lat, lon, timezone: tz, location },
      { profileId: id, onStatus: t => { btn.textContent = t } },
    )
  } catch (err) {
    errEl.textContent = `Calculation error: ${err.message}`
    console.error(err)
  } finally {
    btn.disabled = false
    btn.textContent = 'Save & Calculate'
  }
}

/**
 * Compute a full chart for a birth record and render every data tab. Shared by
 * the form submit path and by loading a saved profile from the People directory.
 * DOM-independent except for the optional `onStatus` progress callback.
 * @param {{name,dob,tob,lat,lon,timezone,location}} birth
 * @param {{ profileId?: string|null, onStatus?: (text:string)=>void }} [opts]
 */
export async function computeAndRenderChart(birth, { profileId = null, onStatus } = {}) {
  const { name, dob, tob, lat, lon, timezone: tz, location } = birth
  await initSwissEph()
  onStatus?.('Calculating…')
  applyAyanamsa()
  const jd = toJulianDay(dob, tob, tz)
  const settings = getSettings()
  const { planets, lagna, houses, sripatiHouses } = calcBirthChart(jd, lat, lon, settings)
  const moon = planets.find(p => p.name === 'Moon')
  if (!moon) throw new Error('Moon position could not be calculated.')
  const swe      = getSwe()
  const dasha    = await calcDasha(moon, dob, { settings, swe, jd })
  const panchang = calcPanchang(jd, lat, lon, { dateStr: dob, timezone: tz })

  state.birth         = { name, dob, tob, lat, lon, timezone: tz, location, profileId: profileId ?? null }
  state.planets       = planets
  state.lagna         = lagna
  state.houses        = houses
  state.sripatiHouses = sripatiHouses
  state.dasha    = dasha
  state.panchang = panchang

  const bhinna   = calcBhinnashtakavarga(planets, lagna)
  const sarva    = calcSarvashtakavarga(bhinna)
  const shadbala = calcShadbala(planets, lagna, houses, jd, panchang)
  state.strength = { bhinna, sarva, shadbala }

  // Fire off async cloud save if logged in. Generate a stable ID if none exists.
  const horoscopeId = profileId
    || `${name}-${dob}-${tob}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  saveHoroscope(horoscopeId, {
    birth: state.birth,
    planets: state.planets,
    lagna: state.lagna,
    houses: state.houses,
  }).catch(err => console.error('Cloud horoscope save failed:', err))

  // Update session label and the sidebar people list
  const { updateActiveLabel } = await import('../sessions.js')
  const { renderSidebar } = await import('../ui/app-shell.js')
  updateActiveLabel(name)
  renderSidebar()

  const { renderChart }    = await import('./chart.js')
  const { renderDasha }    = await import('./dasha.js')
  const { renderPanchang } = await import('./panchang.js')
  const { renderStrength } = await import('./strength.js')
  renderChart(); renderDasha().catch(console.error); renderPanchang(); renderStrength()
  syncPageNav()
  navigate(routeFor('chart'))
}

/**
 * Open a saved profile in a sidebar person tab and land on its chart. If the
 * person is already open, focus that tab; otherwise reuse the active tab when
 * it's an empty "New Profile", else open a fresh tab. (Used by the People
 * directory.)
 */
export async function loadProfileById(id) {
  const p = loadProfiles().find(q => q.id === id)
  if (!p) return
  const { findSessionByProfileId, getActiveSession, createSession, switchSession } =
    await import('../sessions.js')
  const { renderSidebar } = await import('../ui/app-shell.js')

  const existing = findSessionByProfileId(id)
  if (existing) {
    switchSession(existing.id)
    renderSidebar()
    if (state.planets) { navigate(routeFor('chart', existing.id)); return }
    // Restored-but-not-yet-computed tab: fall through and (re)compute in place.
  } else {
    // Reuse a fresh, empty tab; otherwise open a new one for this person.
    const active = getActiveSession()
    if (!active || state.birth) switchSession(createSession(p.name))
    renderSidebar()
  }

  editingProfileId = p.id
  await computeAndRenderChart(
    { name: p.name, dob: p.dob, tob: p.tob, lat: p.lat, lon: p.lon, timezone: p.timezone, location: p.location || '' },
    { profileId: p.id },
  )
}

/** Open the Birth Details tab with a saved profile loaded into the form for editing. */
export function editProfileById(id) {
  const p = loadProfiles().find(q => q.id === id)
  if (!p) return
  markRoute('input')
  renderInputTab()
  fillForm(p)
  editingProfileId = p.id
  document.getElementById('inp-name')?.focus()
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
  // No IANA zone resolved (manual entry, or an already-numeric zone) → the form
  // offset is the source of truth. This is also correct for JHora .jhd imports,
  // whose stored offset already bakes in whatever DST applied at birth.
  if (!selectedTz || /^([+-])(\d{1,2}):(\d{2})$/.test(selectedTz)) return offset
  // A stale zone (coords no longer match the selected place) can't be trusted.
  const lat = readLat()
  const lon = readLon()
  const sameCoords = Math.abs((selectedLocation.lat ?? NaN) - lat) < 0.01 &&
    Math.abs((selectedLocation.lon ?? NaN) - lon) < 0.01
  if (!sameCoords) return offset
  // Keep the IANA name whenever the form offset is just a read-out of the zone's
  // offset *at the birth date* — so the calculation derives the offset (and DST)
  // for the exact birth instant. If the user hand-edited the offset to something
  // the zone doesn't observe at that date, honour that manual override instead.
  const zoneOffset = offsetStr(offsetPartsAtBirth(selectedTz, readDob(), readTob()))
  return zoneOffset === offset ? selectedTz : offset
}

function readDob() {
  if (datetimeMode === 'text') {
    return parseDateText(document.getElementById('inp-dob-text').value.trim()) || ''
  }
  return document.getElementById('inp-dob').value
}

function readTob() {
  if (datetimeMode === 'text') {
    const raw = document.getElementById('inp-tob-text').value.trim()
    return /^\d{1,2}:\d{2}$/.test(raw) ? raw.padStart(5, '0') : ''
  }
  return document.getElementById('inp-tob').value
}

function updateUtcPreview() {
  const textEl = document.getElementById('utc-preview-text')
  const jdEl   = document.getElementById('utc-preview-jd')
  if (!textEl || !jdEl) return
  try {
    const dob = readDob()
    const tob = readTob()
    const tz  = readTimezone()
    if (!dob || !tob || !tz) {
      textEl.textContent = '—'
      jdEl.textContent = 'JD —'
      return
    }
    const utc = localToUTC(`${dob}T${tob}:00`, tz)
    const jd  = toJulianDay(dob, tob, tz)
    const pad = n => String(n).padStart(2, '0')
    const utcStr = `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())} ${pad(utc.getUTCHours())}:${pad(utc.getUTCMinutes())} UTC`
    // For an IANA zone, spell out the offset + abbreviation that applied at the
    // birth instant so it's visible that DST (incl. historical DST) was honoured.
    let tzLabel = tz
    if (!/^([+-])(\d{1,2}):(\d{2})$/.test(tz)) {
      const off  = offsetStr(offsetPartsAtBirth(tz, dob, tob))
      const abbr = parseTzInfo(tz, utc).abbr
      tzLabel = `${tz}, ${off}${abbr && abbr !== 'UTC' ? ' ' + abbr : ''}`
    }
    textEl.textContent = `${dob} ${tob} (${tzLabel})  →  ${utcStr}`
    jdEl.textContent = `JD ${jd.toFixed(6)}`
  } catch {
    textEl.textContent = '—'
    jdEl.textContent = 'JD —'
  }
}

/**
 * When the resolved place is an IANA zone and the coordinates still match, keep
 * the displayed UTC offset in sync with the entered birth date — so moving the
 * date across a DST boundary updates the offset the way the chart will use it.
 * Numeric/manual offsets and mismatched coords are left untouched.
 */
function refreshTzForDate() {
  const tz = selectedLocation?.timezone
  if (!tz || /^([+-])(\d{1,2}):(\d{2})$/.test(tz)) return
  const lat = readLat()
  const lon = readLon()
  const sameCoords = Math.abs((selectedLocation.lat ?? NaN) - lat) < 0.01 &&
    Math.abs((selectedLocation.lon ?? NaN) - lon) < 0.01
  if (!sameCoords) return
  const p = offsetPartsAtBirth(tz, readDob(), readTob())
  for (const suffix of ['', '-dec']) {
    const sign = document.getElementById(`inp-tz-sign${suffix}`)
    const h    = document.getElementById(`inp-tz-h${suffix}`)
    const m    = document.getElementById(`inp-tz-m${suffix}`)
    if (sign) sign.value = p.sign
    if (h)    h.value    = p.h
    if (m)    m.value    = p.m
  }
}

function attachUtcPreviewListeners() {
  // Date/time edits re-derive the zone's offset (DST) for the new date, then
  // refresh the preview. Everything else only refreshes the preview.
  const dateTimeIds = ['inp-dob', 'inp-tob', 'inp-dob-text', 'inp-tob-text']
  const previewOnlyIds = [
    'inp-tz-sign', 'inp-tz-h', 'inp-tz-m',
    'inp-tz-sign-dec', 'inp-tz-h-dec', 'inp-tz-m-dec',
    'inp-lat-d', 'inp-lat-m', 'inp-lat-s', 'inp-lat-dir',
    'inp-lon-d', 'inp-lon-m', 'inp-lon-s', 'inp-lon-dir',
    'inp-lat-dec', 'inp-lon-dec',
  ]
  const onDateTime = () => { refreshTzForDate(); updateUtcPreview() }
  dateTimeIds.forEach(id => {
    const el = document.getElementById(id)
    if (el) {
      el.addEventListener('input', onDateTime)
      el.addEventListener('change', onDateTime)
    }
  })
  previewOnlyIds.forEach(id => {
    const el = document.getElementById(id)
    if (el) {
      el.addEventListener('input', updateUtcPreview)
      el.addEventListener('change', updateUtcPreview)
    }
  })
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
  const tzP = offsetPartsAtBirth(timezone, readDob(), readTob())
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
  updateUtcPreview()
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
    const { planets, lagna, houses, sripatiHouses } = calcBirthChart(jd, state.birth.lat, state.birth.lon, settings)
    const moon = planets.find(p => p.name === 'Moon')
    if (!moon) throw new Error('Moon position could not be calculated.')
    const swe      = getSwe()
    const dasha    = await calcDasha(moon, state.birth.dob, { settings, swe, jd })
    const panchang = calcPanchang(jd, state.birth.lat, state.birth.lon, {
      dateStr: state.birth.dob,
      timezone: state.birth.timezone,
    })

    state.planets       = planets
    state.lagna         = lagna
    state.houses        = houses
    state.sripatiHouses = sripatiHouses
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
    syncPageNav()
  } catch (err) {
    const errEl = document.getElementById('calc-error')
    if (errEl) errEl.textContent = `Recalculation error: ${err.message}`
    console.error(err)
  } finally {
    const btn = document.getElementById('btn-calculate')
    if (btn) {
      btn.disabled = false
      btn.textContent = 'Save & Calculate'
    }
  }
}

// ── Paste modal ───────────────────────────────────────────────────────────────

function initPasteModal() {
  const openBtn    = document.getElementById('btn-paste-details')
  const overlay    = document.getElementById('paste-modal')
  const textarea   = document.getElementById('paste-textarea')
  const preview    = document.getElementById('paste-preview')
  const applyBtn   = document.getElementById('paste-apply')
  const cancelBtn  = document.getElementById('paste-cancel')
  const closeBtn   = document.getElementById('paste-modal-close')

  let lastParsed = {}

  const openModal = () => {
    textarea.value = ''
    preview.innerHTML = ''
    applyBtn.disabled = true
    lastParsed = {}
    overlay.classList.add('open')
    // Focus textarea after transition
    setTimeout(() => textarea.focus(), 80)
  }

  const closeModal = () => {
    overlay.classList.remove('open')
  }

  openBtn.addEventListener('click', openModal)
  closeBtn.addEventListener('click', closeModal)
  cancelBtn.addEventListener('click', closeModal)
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal() })

  textarea.addEventListener('input', () => {
    const text = textarea.value.trim()
    if (!text) {
      preview.innerHTML = ''
      applyBtn.disabled = true
      lastParsed = {}
      return
    }
    const parsed = parseBirthPaste(text)
    lastParsed = parsed
    renderPastePreview(preview, parsed)
    // Enable apply if we got at least one useful field
    const hasData = parsed.name || parsed.dob || parsed.tob || parsed.location ||
      (parsed.lat !== undefined && parsed.lon !== undefined)
    applyBtn.disabled = !hasData
  })

  applyBtn.addEventListener('click', async () => {
    if (!lastParsed || applyBtn.disabled) return
    editingProfileId = null
    await applyParsedData(lastParsed)
    closeModal()
  })
}

function renderPastePreview(container, parsed) {
  const fields = []
  if (parsed.name)     fields.push({ label: 'Name',     value: parsed.name })
  if (parsed.dob)      fields.push({ label: 'Date',     value: parsed.dob })
  if (parsed.tob)      fields.push({ label: 'Time',     value: parsed.tob })
  if (parsed.location) fields.push({ label: 'Location', value: parsed.location })
  if (parsed.lat !== undefined && parsed.lon !== undefined)
    fields.push({ label: 'Coords', value: `${parsed.lat.toFixed(4)}°, ${parsed.lon.toFixed(4)}°` })
  if (parsed.tz)       fields.push({ label: 'Timezone', value: 'UTC' + parsed.tz })

  if (fields.length === 0) {
    container.innerHTML = '<span class="paste-preview-empty">No birth details detected yet…</span>'
    return
  }

  container.innerHTML = `
    <div class="paste-preview-label">Detected fields:</div>
    <div class="paste-preview-fields">
      ${fields.map(f => `
        <span class="paste-field">
          <span class="paste-field-key">${f.label}</span>
          <span class="paste-field-val">${escapeHtml(f.value)}</span>
        </span>
      `).join('')}
    </div>
  `
}

async function applyParsedData(parsed) {
  // Name
  if (parsed.name) {
    document.getElementById('inp-name').value = parsed.name
  }

  // Date
  if (parsed.dob) {
    document.getElementById('inp-dob').value = parsed.dob
    const [y, mo, d] = parsed.dob.split('-')
    document.getElementById('inp-dob-text').value = `${d}/${mo}/${y}`
  }

  // Time
  if (parsed.tob) {
    document.getElementById('inp-tob').value = parsed.tob
    document.getElementById('inp-tob-text').value = parsed.tob
  }

  // Location — fill the text field and try to geocode
  if (parsed.location) {
    document.getElementById('inp-location').value = parsed.location
  }

  // Coordinates — if parser found them, fill directly
  if (parsed.lat !== undefined && parsed.lon !== undefined) {
    const lat = parsed.lat
    const lon = parsed.lon
    let tz = parsed.tz || null

    // Try to auto-detect timezone from coords if not parsed
    if (!tz) {
      try { tz = await getTimezone(lat, lon) } catch { /* leave tz null */ }
    }

    if (tz) {
      fillCoords(lat, lon, tz)
      selectedLocation = {
        displayName: parsed.location || `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`,
        lat, lon, timezone: tz,
      }
    } else {
      // Fill coords without timezone
      fillCoordsDMS(lat, lon)
      document.getElementById('inp-lat-dec').value = Math.round(lat * 10000) / 10000
      document.getElementById('inp-lon-dec').value = Math.round(lon * 10000) / 10000
    }
  } else if (parsed.location) {
    // No coords parsed — try geocoding the location text
    try {
      const { results } = await searchLocation(parsed.location)
      if (results.length > 0) {
        const r = results[0]
        const tz = r.tz || await getTimezone(r.lat, r.lon)
        selectedLocation = { displayName: r.displayName, lat: r.lat, lon: r.lon, timezone: tz }
        addToCache({ displayName: r.displayName, lat: r.lat, lon: r.lon, tz })
        document.getElementById('inp-location').value = r.displayName
        fillCoords(r.lat, r.lon, tz)
      }
    } catch { /* geocoding failed — user can fill manually */ }
  }

  // Timezone only (no coords)
  if (parsed.tz && parsed.lat === undefined) {
    const p = offsetParts(parsed.tz)
    document.getElementById('inp-tz-sign').value     = p.sign
    document.getElementById('inp-tz-h').value         = p.h
    document.getElementById('inp-tz-m').value         = p.m
    document.getElementById('inp-tz-sign-dec').value  = p.sign
    document.getElementById('inp-tz-h-dec').value     = p.h
    document.getElementById('inp-tz-m-dec').value     = p.m
  }
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function escapeAttr(str) {
  return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}
