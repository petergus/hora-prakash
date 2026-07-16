// src/tabs/people.js
// People directory — a configurable table of every saved profile with
// selector-list visibility toggles, reordering, and open/edit/delete actions.
// Astrological columns (ascendant / moon / sun / nakshatra) are computed on
// demand from the ephemeris and cached.
import {
  orderedProfiles, reorderProfiles, setProfileHidden, deleteProfile,
  exportProfiles, importProfiles, importJhdFiles,
} from './profile-store.js'
import { loadProfileById, editProfileById } from './input.js'
import { newPerson } from '../ui/app-shell.js'
import { confirmModal } from '../ui/modal.js'
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
const SORT_KEY = 'hora-prakash-people-sort'

// Sort keys that are meaningful for each column ('name' + every data column).
const SORTABLE = new Set(['name', 'dob', 'tob', 'location', 'lagna', 'moon', 'sun', 'nakshatra', 'tz'])

function loadCols() {
  try {
    const v = JSON.parse(localStorage.getItem(COLS_KEY))
    return Array.isArray(v) ? v.filter(k => ALL_COLUMNS.some(c => c.key === k)) : [...DEFAULT_COLS]
  } catch { return [...DEFAULT_COLS] }
}
function saveCols(cols) { localStorage.setItem(COLS_KEY, JSON.stringify(cols)) }

// sort = { key, dir }. key === null → manual (custom drag order).
function loadSort() {
  try {
    const v = JSON.parse(localStorage.getItem(SORT_KEY))
    if (v && SORTABLE.has(v.key)) return { key: v.key, dir: v.dir === 'desc' ? 'desc' : 'asc' }
  } catch { /* ignore */ }
  return { key: null, dir: 'asc' }
}
function saveSort(sort) { localStorage.setItem(SORT_KEY, JSON.stringify(sort)) }
let sortState = loadSort()

// ── Astro computation (cached by birth signature + ayanamsa) ─────────────────
const astroCache = new Map()

function astroKey(p, settings) {
  return `${p.dob}|${p.tob}|${p.timezone}|${p.lat}|${p.lon}|${settings.ayanamsa}|${settings.observerType}`
}

/** Cached astro value for a profile, or null if not computed yet (sync). */
function peekAstro(p) {
  try { return astroCache.get(astroKey(p, getSettings())) ?? null } catch { return null }
}

async function computeAstro(p) {
  await initSwissEph()
  applyAyanamsa()
  const settings = getSettings()
  const key = astroKey(p, settings)
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
    // numeric sort keys
    _lagna: lagna ? lagna.sign : null,
    _moon:  moon ? moon.sign : null,
    _sun:   sun ? sun.sign : null,
    _nakshatra: moon ? (moon.nakshatraIndex ?? null) : null,
  }
  astroCache.set(key, res)
  return res
}

/** Ensure astro is computed (and cached) for every profile — used before an astro sort. */
async function computeAllAstro(profiles) {
  for (const p of profiles) {
    try { await computeAstro(p) } catch { /* leave uncached; sorts last */ }
  }
}

// ── Sorting ──────────────────────────────────────────────────────────────────
function sortValue(p, key) {
  switch (key) {
    case 'name':     return (p.name || '').trim().toLowerCase()
    case 'dob':      return p.dob || ''      // ISO yyyy-mm-dd sorts chronologically
    case 'tob':      return p.tob || ''      // HH:MM sorts lexically
    case 'location': return (p.location || '').trim().toLowerCase()
    case 'tz':       return p.timezone || ''
    case 'lagna': case 'moon': case 'sun': case 'nakshatra': {
      const a = peekAstro(p)
      return a ? a[`_${key}`] : null
    }
    default: return null
  }
}

function sortedForDisplay(profiles) {
  if (!sortState.key) return profiles
  const dir = sortState.dir === 'desc' ? -1 : 1
  return [...profiles].sort((a, b) => {
    const va = sortValue(a, sortState.key)
    const vb = sortValue(b, sortState.key)
    const ea = va == null || va === ''
    const eb = vb == null || vb === ''
    if (ea && eb) return 0
    if (ea) return 1        // blanks/uncomputed always sort last
    if (eb) return -1
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
    return String(va).localeCompare(String(vb)) * dir
  })
}

// ── Render ───────────────────────────────────────────────────────────────────
export async function renderPeople() {
  const panel = document.getElementById('tab-people')
  if (!panel) return
  const profiles = orderedProfiles()
  const cols = loadCols()
  const activeCols = ALL_COLUMNS.filter(c => cols.includes(c.key))
  const sortCol = ALL_COLUMNS.find(c => c.key === sortState.key)
  const needAstro = activeCols.some(c => c.astro) || !!sortCol?.astro

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

  // Sorting by an astro column needs those values up front (cached after first time).
  if (sortCol?.astro) { try { await computeAllAstro(profiles) } catch { /* best effort */ } }

  const manual = !sortState.key
  const display = sortedForDisplay(profiles)
  const arrow = key => sortState.key === key ? (sortState.dir === 'desc' ? ' ▼' : ' ▲') : ''
  const th = (key, label, cls = '') => SORTABLE.has(key)
    ? `<th class="${cls} sortable${sortState.key === key ? ' sorted' : ''}" data-sort="${key}" title="Sort by ${label}"><span>${label}</span><span class="sort-arrow">${arrow(key)}</span></th>`
    : `<th class="${cls}">${label}</th>`

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
      <p class="people-hint">
        ${manual
          ? 'Drag the <strong>⠿</strong> handle to reorder people. Click a column heading to sort instead.'
          : `Sorted by <strong>${esc(sortCol?.label ?? sortState.key)}</strong> — <button type="button" class="people-linkbtn" id="people-clear-sort">clear sort</button> to drag-reorder.`}
        Toggle <strong>List</strong> to show or hide a person in the profile selector.
      </p>
      <div class="table-scroll">
        <table class="people-table">
          <thead>
            <tr>
              <th class="pt-reorder" aria-label="Reorder"></th>
              <th class="pt-show" title="Show in the profile selector list">List</th>
              ${th('name', 'Name', 'pt-name')}
              ${activeCols.map(c => th(c.key, c.label)).join('')}
              <th class="pt-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${display.map(p => rowHtml(p, activeCols, manual)).join('')}
          </tbody>
        </table>
      </div>
    </div>`

  wireToolbar(panel)
  wireRows(panel, display, manual)
  if (needAstro) fillAstro(panel, display).catch(err => console.error('People astro compute failed:', err))
}

function rowHtml(p, activeCols, manual) {
  const dataCells = activeCols.map(c => {
    const nowrap = c.key !== 'location' ? ' pt-nowrap' : ''
    if (c.astro) return `<td class="${nowrap}" data-label="${c.label}" data-astro="${c.key}"><span class="astro-pending">…</span></td>`
    return `<td class="${nowrap}" data-label="${c.label}">${esc(cellValue(p, c.key))}</td>`
  }).join('')
  return `
    <tr data-pid="${esc(p.id)}"${manual ? ' draggable="true"' : ''}>
      <td class="pt-reorder" data-label="Order">
        ${manual
          ? `<span class="pt-grip" title="Drag to reorder" aria-hidden="true">⠿</span>`
          : `<span class="pt-grip pt-grip-off" title="Clear the sort to reorder" aria-hidden="true">⠿</span>`}
      </td>
      <td class="pt-show" data-label="In list">
        <input type="checkbox" class="pt-show-cb" ${p.hidden ? '' : 'checked'} title="Show in the profile selector list"/>
      </td>
      <td class="pt-name pt-nowrap" data-label="Name">${esc(p.name || '—')}</td>
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
  panel.querySelector('#people-add')?.addEventListener('click', () => newPerson())
  panel.querySelector('#people-export')?.addEventListener('click', exportProfiles)
  panel.querySelector('#people-import')?.addEventListener('change', e => {
    const file = e.target.files[0]
    if (file) { importProfiles(file, renderPeople); e.target.value = '' }
  })
  panel.querySelector('#people-jhd')?.addEventListener('change', e => {
    if (e.target.files.length) { importJhdFiles(e.target.files, renderPeople); e.target.value = '' }
  })

  // Column-heading sort: asc → desc → clear (back to manual order).
  panel.querySelector('thead')?.addEventListener('click', e => {
    const thEl = e.target.closest('th.sortable')
    if (!thEl) return
    const key = thEl.dataset.sort
    if (sortState.key !== key)          sortState = { key, dir: 'asc' }
    else if (sortState.dir === 'asc')   sortState = { key, dir: 'desc' }
    else                                sortState = { key: null, dir: 'asc' }
    saveSort(sortState)
    renderPeople()
  })
  panel.querySelector('#people-clear-sort')?.addEventListener('click', () => {
    sortState = { key: null, dir: 'asc' }
    saveSort(sortState)
    renderPeople()
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

function wireRows(panel, profiles, manual) {
  const tbody = panel.querySelector('tbody')
  if (!tbody) return
  tbody.addEventListener('click', e => {
    const row = e.target.closest('tr[data-pid]')
    if (!row) return
    const id = row.dataset.pid

    if (e.target.closest('.pt-edit')) { editProfileById(id); return }
    if (e.target.closest('.pt-del')) {
      const p = profiles.find(q => q.id === id)
      const label = p ? `"${p.name}" (${p.dob})` : 'this person'
      confirmModal(`Delete ${label}? This cannot be undone.`, { title: 'Delete person', confirmLabel: 'Delete', danger: true })
        .then(ok => { if (ok) { deleteProfile(id); renderPeople() } })
      return
    }
    // The ▶ button or a click anywhere on the row (outside the reorder grip
    // and the List checkbox) opens the person in a tab and shows the chart.
    const cell = e.target.closest('td')
    if (e.target.closest('.pt-open') ||
        (cell && !cell.classList.contains('pt-reorder') && !cell.classList.contains('pt-show'))) {
      loadProfileById(id).catch(err => console.error(err))
    }
  })
  tbody.addEventListener('change', e => {
    const cb = e.target.closest('.pt-show-cb')
    if (!cb) return
    const row = e.target.closest('tr[data-pid]')
    if (row) setProfileHidden(row.dataset.pid, !cb.checked)
  })

  if (manual) wireDragReorder(tbody)
}

// Drag-and-drop reordering (manual mode only). Persists via reorderProfiles.
let _dragId = null
function wireDragReorder(tbody) {
  const clearMarks = () => tbody.querySelectorAll('.pt-drop-before, .pt-drop-after')
    .forEach(el => el.classList.remove('pt-drop-before', 'pt-drop-after'))

  tbody.querySelectorAll('tr[data-pid]').forEach(tr => {
    tr.addEventListener('dragstart', e => {
      _dragId = tr.dataset.pid
      tr.classList.add('pt-dragging')
      e.dataTransfer.effectAllowed = 'move'
      try { e.dataTransfer.setData('text/plain', _dragId) } catch { /* Safari */ }
    })
    tr.addEventListener('dragend', () => { _dragId = null; tr.classList.remove('pt-dragging'); clearMarks() })
    tr.addEventListener('dragover', e => {
      if (!_dragId || tr.dataset.pid === _dragId) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      const before = (e.clientY - tr.getBoundingClientRect().top) < tr.offsetHeight / 2
      clearMarks()
      tr.classList.add(before ? 'pt-drop-before' : 'pt-drop-after')
    })
    tr.addEventListener('drop', e => {
      e.preventDefault()
      const targetId = tr.dataset.pid
      if (!_dragId || _dragId === targetId) return
      const before = tr.classList.contains('pt-drop-before')
      applyDrop(_dragId, targetId, before)
    })
  })
}

function applyDrop(dragId, targetId, before) {
  const ids = orderedProfiles().map(p => p.id)
  const from = ids.indexOf(dragId)
  if (from < 0) return
  ids.splice(from, 1)
  let to = ids.indexOf(targetId)
  if (to < 0) return
  if (!before) to += 1
  ids.splice(to, 0, dragId)
  reorderProfiles(ids)
  renderPeople()
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))
}
