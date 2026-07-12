// src/tabs/people.js
// People directory — a configurable table of every saved profile with
// selector-list visibility toggles, reordering, and open/edit/delete actions.
// Astrological columns (ascendant / moon / sun / nakshatra) are computed on
// demand from the ephemeris and cached.
import {
  orderedProfiles, reorderProfiles, setProfileHidden, deleteProfile,
  exportProfiles, importProfiles, importJhdFiles,
} from './profile-store.js'
import { loadProfileById, editProfileById, renderInputTab } from './input.js'
import { switchTab } from '../ui/tabs.js'
import { initSwissEph } from '../core/swisseph.js'
import { getSettings, applyAyanamsa } from '../core/settings.js'
import { toJulianDay } from '../utils/time.js'
import { calcBirthChart } from '../core/calculations.js'
import { ianaToOffset } from '../utils/format.js'

const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
  'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']

// Configurable data columns (name is always shown). `astro` columns require an
// ephemeris calculation and are filled in asynchronously after first paint.
const ALL_COLUMNS = [
  { key: 'dob',       label: 'Date' },
  { key: 'tob',       label: 'Time' },
  { key: 'location',  label: 'Place' },
  { key: 'lagna',     label: 'Ascendant', astro: true },
  { key: 'moon',      label: 'Moon',      astro: true },
  { key: 'sun',       label: 'Sun',       astro: true },
  { key: 'nakshatra', label: 'Nakshatra', astro: true },
  { key: 'tz',        label: 'Timezone' },
]
const DEFAULT_COLS = ['dob', 'location', 'lagna']
const COLS_KEY = 'hora-prakash-people-columns'

function loadCols() {
  try {
    const v = JSON.parse(localStorage.getItem(COLS_KEY))
    return Array.isArray(v) ? v.filter(k => ALL_COLUMNS.some(c => c.key === k)) : [...DEFAULT_COLS]
  } catch { return [...DEFAULT_COLS] }
}
function saveCols(cols) { localStorage.setItem(COLS_KEY, JSON.stringify(cols)) }

// ── Astro computation (cached by birth signature + ayanamsa) ─────────────────
const astroCache = new Map()

async function computeAstro(p) {
  await initSwissEph()
  applyAyanamsa()
  const settings = getSettings()
  const key = `${p.dob}|${p.tob}|${p.timezone}|${p.lat}|${p.lon}|${settings.ayanamsa}|${settings.observerType}`
  if (astroCache.has(key)) return astroCache.get(key)
  const jd = toJulianDay(p.dob, p.tob, p.timezone)
  const { planets, lagna } = calcBirthChart(jd, p.lat, p.lon, settings)
  const moon = planets.find(pl => pl.name === 'Moon')
  const sun  = planets.find(pl => pl.name === 'Sun')
  const res = {
    lagna:     lagna ? SIGN_NAMES[lagna.sign - 1] : '—',
    moon:      moon ? SIGN_NAMES[moon.sign - 1] : '—',
    sun:       sun ? SIGN_NAMES[sun.sign - 1] : '—',
    nakshatra: moon ? moon.nakshatra : '—',
  }
  astroCache.set(key, res)
  return res
}

// ── Render ───────────────────────────────────────────────────────────────────
export function renderPeople() {
  const panel = document.getElementById('tab-people')
  if (!panel) return
  const profiles = orderedProfiles()
  const cols = loadCols()
  const activeCols = ALL_COLUMNS.filter(c => cols.includes(c.key))
  const needAstro = activeCols.some(c => c.astro)

  if (profiles.length === 0) {
    panel.innerHTML = `
      <div class="card people-empty">
        <h3 style="margin-bottom:0.2rem">People</h3>
        <p class="people-empty-text">No saved people yet. Add someone in the Birth Details tab, or import a file.</p>
        <div class="people-empty-actions">
          <button type="button" class="btn-secondary" id="people-add">+ Add Person</button>
          <label class="btn-secondary people-file">↑ Import<input type="file" id="people-import" accept=".json" hidden></label>
          <label class="btn-secondary people-file">↑ JHD<input type="file" id="people-jhd" accept=".jhd,.JHD" multiple hidden></label>
        </div>
      </div>`
    wireToolbar(panel)
    return
  }

  panel.innerHTML = `
    <div class="card">
      <div class="people-toolbar">
        <div class="people-title">People <span class="people-count">${profiles.length}</span></div>
        <div class="people-actions">
          <button type="button" class="btn-secondary" id="people-add">+ Add</button>
          <div class="people-cols-wrap">
            <button type="button" class="btn-secondary" id="people-cols-btn">Columns ▾</button>
            <div class="people-cols-pop" id="people-cols-pop" hidden>
              ${ALL_COLUMNS.map(c => `
                <label><input type="checkbox" data-col="${c.key}" ${cols.includes(c.key) ? 'checked' : ''}/> ${c.label}</label>
              `).join('')}
            </div>
          </div>
          <button type="button" class="btn-secondary" id="people-export">↓ Export</button>
          <label class="btn-secondary people-file">↑ Import<input type="file" id="people-import" accept=".json" hidden></label>
          <label class="btn-secondary people-file">↑ JHD<input type="file" id="people-jhd" accept=".jhd,.JHD" multiple hidden></label>
        </div>
      </div>
      <p class="people-hint">Toggle the <strong>List</strong> box to show or hide a person in the profile selector. Use ▲▼ to reorder.</p>
      <div class="table-scroll">
        <table class="people-table">
          <thead>
            <tr>
              <th class="pt-reorder"></th>
              <th class="pt-show" title="Show in the profile selector list">List</th>
              <th class="pt-name">Name</th>
              ${activeCols.map(c => `<th>${c.label}</th>`).join('')}
              <th class="pt-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${profiles.map((p, i) => rowHtml(p, i, profiles.length, activeCols)).join('')}
          </tbody>
        </table>
      </div>
    </div>`

  wireToolbar(panel)
  wireRows(panel, profiles)
  if (needAstro) fillAstro(panel, profiles).catch(err => console.error('People astro compute failed:', err))
}

function rowHtml(p, i, n, activeCols) {
  const dataCells = activeCols.map(c => {
    if (c.astro) return `<td data-label="${c.label}" data-astro="${c.key}"><span class="astro-pending">…</span></td>`
    return `<td data-label="${c.label}">${esc(cellValue(p, c.key))}</td>`
  }).join('')
  return `
    <tr data-pid="${esc(p.id)}">
      <td class="pt-reorder" data-label="Order">
        <button type="button" class="pt-move" data-move="up" ${i === 0 ? 'disabled' : ''} title="Move up">▲</button>
        <button type="button" class="pt-move" data-move="down" ${i === n - 1 ? 'disabled' : ''} title="Move down">▼</button>
      </td>
      <td class="pt-show" data-label="In list">
        <input type="checkbox" class="pt-show-cb" ${p.hidden ? '' : 'checked'} title="Show in the profile selector list"/>
      </td>
      <td class="pt-name" data-label="Name">${esc(p.name || '—')}</td>
      ${dataCells}
      <td class="pt-actions" data-label="Actions">
        <button type="button" class="pt-btn pt-open" title="Open chart">▶</button>
        <button type="button" class="pt-btn pt-edit" title="Edit details">✎</button>
        <button type="button" class="pt-btn pt-del" title="Delete">🗑</button>
      </td>
    </tr>`
}

function cellValue(p, key) {
  switch (key) {
    case 'dob':      return p.dob || '—'
    case 'tob':      return p.tob || '—'
    case 'location': return p.location || (p.lat != null && p.lon != null ? `${p.lat}°, ${p.lon}°` : '—')
    case 'tz':       return p.timezone
      ? ianaToOffset(p.timezone, p.dob ? new Date(`${p.dob}T${p.tob || '12:00'}:00Z`) : undefined)
      : '—'
    default:         return '—'
  }
}

async function fillAstro(panel, profiles) {
  const byId = new Map(profiles.map(p => [p.id, p]))
  for (const row of panel.querySelectorAll('tbody tr[data-pid]')) {
    const p = byId.get(row.dataset.pid)
    if (!p) continue
    let a = null
    try { a = await computeAstro(p) } catch { a = null }
    row.querySelectorAll('td[data-astro]').forEach(cell => {
      cell.textContent = (a && a[cell.dataset.astro]) || '—'
    })
  }
}

// ── Events ───────────────────────────────────────────────────────────────────
function wireToolbar(panel) {
  panel.querySelector('#people-add')?.addEventListener('click', () => {
    switchTab('input')
    renderInputTab()
    document.getElementById('btn-new-entry')?.click()
  })
  panel.querySelector('#people-export')?.addEventListener('click', exportProfiles)
  panel.querySelector('#people-import')?.addEventListener('change', e => {
    const file = e.target.files[0]
    if (file) { importProfiles(file, renderPeople); e.target.value = '' }
  })
  panel.querySelector('#people-jhd')?.addEventListener('change', e => {
    if (e.target.files.length) { importJhdFiles(e.target.files, renderPeople); e.target.value = '' }
  })

  const colsBtn = panel.querySelector('#people-cols-btn')
  const colsPop = panel.querySelector('#people-cols-pop')
  if (colsBtn && colsPop) {
    const onOutside = ev => {
      if (colsPop.contains(ev.target) || colsBtn.contains(ev.target)) return
      closePop()
    }
    const closePop = () => { colsPop.hidden = true; document.removeEventListener('click', onOutside) }
    colsBtn.addEventListener('click', () => {
      const open = colsPop.hidden
      colsPop.hidden = !open
      if (open) document.addEventListener('click', onOutside)
      else document.removeEventListener('click', onOutside)
    })
    colsPop.querySelectorAll('input[data-col]').forEach(cb => {
      cb.addEventListener('change', () => {
        const cols = [...colsPop.querySelectorAll('input[data-col]')]
          .filter(x => x.checked).map(x => x.dataset.col)
        document.removeEventListener('click', onOutside) // DOM is about to be replaced
        saveCols(cols)
        renderPeople()
      })
    })
  }
}

function wireRows(panel, profiles) {
  const tbody = panel.querySelector('tbody')
  if (!tbody) return
  tbody.addEventListener('click', e => {
    const row = e.target.closest('tr[data-pid]')
    if (!row) return
    const id = row.dataset.pid

    const moveBtn = e.target.closest('.pt-move')
    if (moveBtn) { moveProfile(profiles, id, moveBtn.dataset.move); return }

    if (e.target.closest('.pt-open')) { loadProfileById(id).catch(err => console.error(err)); return }
    if (e.target.closest('.pt-edit')) { editProfileById(id); return }
    if (e.target.closest('.pt-del')) {
      const p = profiles.find(q => q.id === id)
      const label = p ? `"${p.name}" (${p.dob})` : 'this person'
      if (confirm(`Delete ${label}? This cannot be undone.`)) { deleteProfile(id); renderPeople() }
    }
  })
  tbody.addEventListener('change', e => {
    const cb = e.target.closest('.pt-show-cb')
    if (!cb) return
    const row = e.target.closest('tr[data-pid]')
    if (row) setProfileHidden(row.dataset.pid, !cb.checked)
  })
}

function moveProfile(profiles, id, dir) {
  const ids = profiles.map(p => p.id)
  const idx = ids.indexOf(id)
  const swap = dir === 'up' ? idx - 1 : idx + 1
  if (idx < 0 || swap < 0 || swap >= ids.length) return
  ;[ids[idx], ids[swap]] = [ids[swap], ids[idx]]
  reorderProfiles(ids)
  renderPeople()
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))
}
