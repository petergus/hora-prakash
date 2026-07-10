// src/tabs/profile-store.js
// Saved-profile persistence: localStorage store mirrored to Firestore, plus
// JSON and Jagannatha Hora (.jhd) import/export. No DOM here beyond download
// anchors and alert() feedback — rendering stays in input.js.
import { parseJhdFile } from '../utils/jhd.js'
import {
  upsertProfile as cloudUpsertProfile,
  deleteProfileCloud,
  deleteAllProfilesCloud,
  bulkUpsertProfiles,
} from '../cloud-store.js'

const STORAGE_KEY = 'hora-prakash-profiles'

export function genId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function loadProfiles() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

export function saveProfiles(profiles) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles))
}

export function saveProfile(profile) {
  const profiles = loadProfiles()
  const existing = profiles.findIndex(p => p.id === profile.id)
  if (existing >= 0) profiles[existing] = profile
  else profiles.unshift(profile)
  saveProfiles(profiles)
  cloudUpsertProfile(profile).catch(err => console.error('Cloud save failed:', err))
}

export function deleteProfile(id) {
  saveProfiles(loadProfiles().filter(p => p.id !== id))
  deleteProfileCloud(id).catch(err => console.error('Cloud delete failed:', err))
}

// ── Ordering + selector-list visibility ─────────────────────────────────────
// Profiles carry two optional fields used by the People directory:
//   • order  — explicit display index (assigned when the user reorders)
//   • hidden — when true, the profile is omitted from selector dropdowns
// Both are synced to Firestore so they survive the cloud→localStorage refresh
// on reload (main.js overwrites localStorage with the cloud copy at startup).

/** Profiles sorted by explicit `order`, falling back to stored array position. */
export function orderedProfiles(profiles = loadProfiles()) {
  return profiles
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const oa = Number.isFinite(a.p.order) ? a.p.order : a.i
      const ob = Number.isFinite(b.p.order) ? b.p.order : b.i
      return oa - ob || a.i - b.i
    })
    .map(x => x.p)
}

/** Ordered profiles flagged to appear in selector lists (i.e. not hidden). */
export function visibleProfiles(profiles = loadProfiles()) {
  return orderedProfiles(profiles).filter(p => !p.hidden)
}

/** Toggle whether a profile appears in selector dropdowns. Persists local + cloud. */
export function setProfileHidden(id, hidden) {
  const profiles = loadProfiles()
  const p = profiles.find(q => q.id === id)
  if (!p) return
  p.hidden = !!hidden
  saveProfiles(profiles)
  cloudUpsertProfile(p).catch(err => console.error('Cloud save failed:', err))
}

/** Persist a new explicit ordering. `orderedIds` is every id in display order. */
export function reorderProfiles(orderedIds) {
  const profiles = loadProfiles()
  const byId = new Map(profiles.map(p => [p.id, p]))
  orderedIds.forEach((id, i) => { const p = byId.get(id); if (p) p.order = i })
  saveProfiles(profiles)
  const changed = orderedIds.map(id => byId.get(id)).filter(Boolean)
  bulkUpsertProfiles(changed).catch(err => console.error('Cloud reorder save failed:', err))
}

export function clearAllProfiles() {
  saveProfiles([])
  deleteAllProfilesCloud().catch(err => console.error('Cloud clear-all failed:', err))
}

export function exportProfiles() {
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

/** @param {File} file  @param {() => void} [onDone]  called after a successful import */
export function importProfiles(file, onDone) {
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
      bulkUpsertProfiles(toAdd).catch(err => console.error('Cloud bulk import failed:', err))
      onDone?.()
      alert(`Imported ${toAdd.length} profile${toAdd.length > 1 ? 's' : ''}.`)
    } catch (err) {
      alert(`Import failed: ${err.message}`)
    }
  }
  reader.readAsText(file)
}

/** @param {FileList|File[]} files  @param {() => void} [onDone]  called after a successful import */
export async function importJhdFiles(files, onDone) {
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
    bulkUpsertProfiles(successes).catch(err => console.error('Cloud JHD import failed:', err))
    onDone?.()
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
