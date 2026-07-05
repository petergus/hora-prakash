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
