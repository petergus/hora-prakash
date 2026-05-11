// src/cloud-store.js — per-user Firestore CRUD for profiles + horoscopes.
import { auth, db } from './firebase.js'
import {
  collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp, writeBatch,
} from 'firebase/firestore'

function uid() {
  const u = auth.currentUser
  if (!u) throw new Error('Not signed in')
  return u.uid
}

const profilesCol = () => collection(db, 'users', uid(), 'profiles')
const horoscopesCol = () => collection(db, 'users', uid(), 'horoscopes')

export async function fetchProfiles() {
  if (!auth.currentUser) return []
  const snap = await getDocs(profilesCol())
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function upsertProfile(profile) {
  if (!auth.currentUser) return
  const { id, ...rest } = profile
  await setDoc(doc(profilesCol(), id), { ...rest, updatedAt: serverTimestamp() }, { merge: true })
}

export async function deleteProfileCloud(id) {
  if (!auth.currentUser) return
  await deleteDoc(doc(profilesCol(), id))
}

export async function deleteAllProfilesCloud() {
  if (!auth.currentUser) return
  const snap = await getDocs(profilesCol())
  if (snap.empty) return
  const batch = writeBatch(db)
  snap.docs.forEach(d => batch.delete(d.ref))
  await batch.commit()
}

export async function bulkUpsertProfiles(profiles) {
  if (!auth.currentUser || !profiles.length) return
  const batch = writeBatch(db)
  for (const p of profiles) {
    const { id, ...rest } = p
    batch.set(doc(profilesCol(), id), { ...rest, updatedAt: serverTimestamp() }, { merge: true })
  }
  await batch.commit()
}

/**
 * Save a horoscope snapshot keyed by profileId (one current snapshot per profile).
 * Pass the full computed state.
 */
export async function saveHoroscope(profileId, snapshot) {
  if (!auth.currentUser || !profileId) return
  await setDoc(doc(horoscopesCol(), profileId), {
    ...snapshot,
    savedAt: serverTimestamp(),
  })
}
