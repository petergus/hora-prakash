// src/auth-ui.js — the login/sign-up gate. Resolves once a signed-in,
// non-disabled user is present.
import { auth } from './firebase.js'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
} from 'firebase/auth'
import { clearPersonalCaches } from './user-scope.js'

const OVERLAY_ID = 'auth-overlay'
const MIN_PASSWORD = 8

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))

let _notice = ''   // shown once in the overlay after a forced sign-out

export function requireAuth() {
  return new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, async user => {
      if (!user) { showOverlay(); return }
      // The native `disabled` flag blocks new sign-ins, but an existing token
      // keeps working until it expires — the status custom claim closes that
      // gap for sessions that were already signed in when the admin disabled them.
      try {
        const t = await user.getIdTokenResult()
        if (t.claims.status === 'disabled') {
          _notice = 'This account has been disabled. Contact support if you think this is a mistake.'
          await signOut(auth)   // → onAuthStateChanged(null) → overlay shows the notice
          return
        }
      } catch { /* claims unreadable (offline) — proceed; Firestore rules still enforce */ }
      unsub()
      hideOverlay()
      resolve(user)
    })
  })
}

export async function logout() {
  clearPersonalCaches()   // profile mirror, BYOK key, open tabs — preferences stay
  await signOut(auth)
  location.reload()
}

function hideOverlay() {
  document.getElementById(OVERLAY_ID)?.remove()
}

function showOverlay(mode = 'signin') {
  let overlay = document.getElementById(OVERLAY_ID)
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.id = OVERLAY_ID
    overlay.className = 'auth-overlay'
    document.body.appendChild(overlay)
  }
  renderCard(overlay, mode)
}

function renderCard(overlay, mode) {
  const appName = document.title || 'Hora Prakash'
  const signup = mode === 'signup'
  overlay.innerHTML = `
    <div class="auth-card">
      <img class="auth-logo" src="/icon.svg" alt="" />
      <h2 class="auth-title">${signup ? 'Create your account' : 'Welcome back'}</h2>
      <p class="auth-subtitle">${signup ? `Start using ${esc(appName)}` : `Sign in to ${esc(appName)}`}</p>
      ${signup ? '<input id="auth-name" class="auth-input" type="text" autocomplete="name" placeholder="Name (optional)" />' : ''}
      <input id="auth-email" class="auth-input" type="email" autocomplete="email" placeholder="Email" />
      <input id="auth-password" class="auth-input" type="password"
             autocomplete="${signup ? 'new-password' : 'current-password'}"
             placeholder="${signup ? `Password (min ${MIN_PASSWORD} characters)` : 'Password'}" />
      <p id="auth-error" class="auth-error">${esc(_notice)}</p>
      <button id="auth-submit" class="auth-submit" type="button">${signup ? 'Create Account' : 'Sign In'}</button>
      <div class="auth-links">
        ${signup
          ? '<a id="auth-toggle" href="#">Already have an account? Sign in</a>'
          : `<a id="auth-reset" href="#">Forgot password?</a><br/>
             <a id="auth-toggle" href="#">New here? Create an account</a>`}
      </div>
    </div>
  `
  _notice = ''

  const $ = id => overlay.querySelector(`#${id}`)

  $('auth-toggle').addEventListener('click', e => {
    e.preventDefault()
    renderCard(overlay, signup ? 'signin' : 'signup')
  })

  $('auth-reset')?.addEventListener('click', async e => {
    e.preventDefault()
    const email = $('auth-email').value.trim()
    if (!email) { $('auth-error').textContent = 'Enter your email above first.'; return }
    try {
      await sendPasswordResetEmail(auth, email)
      $('auth-error').style.color = 'var(--success)'
      $('auth-error').textContent = 'Reset email sent.'
    } catch (err) {
      $('auth-error').style.color = ''
      $('auth-error').textContent = friendlyError(err)
    }
  })

  const submit = async () => {
    const email = $('auth-email').value.trim()
    const pw = $('auth-password').value
    const err = $('auth-error')
    err.style.color = ''
    err.textContent = ''
    if (!email || !pw) { err.textContent = 'Email and password required.'; return }
    if (signup && pw.length < MIN_PASSWORD) {
      err.textContent = `Password must be at least ${MIN_PASSWORD} characters.`
      return
    }
    const btn = $('auth-submit')
    btn.disabled = true
    btn.textContent = '…'
    try {
      if (signup) {
        const name = $('auth-name')?.value.trim()
        const cred = await createUserWithEmailAndPassword(auth, email, pw)
        // Best-effort — the account exists and the auth gate is already
        // resolving (this overlay is about to be torn down), so a failure
        // here has nowhere left to display in the UI anyway.
        if (name) updateProfile(cred.user, { displayName: name }).catch(err => console.error('Failed to set display name:', err))
      } else {
        await signInWithEmailAndPassword(auth, email, pw)
      }
    } catch (e) {
      err.textContent = friendlyError(e)
      btn.disabled = false
      btn.textContent = signup ? 'Create Account' : 'Sign In'
    }
  }

  $('auth-submit').addEventListener('click', submit)
  overlay.onkeydown = e => { if (e.key === 'Enter') submit() }   // assignment: one live handler per render
  setTimeout(() => $('auth-email').focus(), 0)
}

function friendlyError(err) {
  const code = err?.code || ''
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found'))
    return 'Email or password is incorrect.'
  if (code.includes('email-already-in-use')) return 'An account with this email already exists — sign in instead.'
  if (code.includes('weak-password')) return `Password must be at least ${MIN_PASSWORD} characters.`
  if (code.includes('too-many-requests')) return 'Too many attempts. Wait a moment and try again.'
  if (code.includes('invalid-email')) return 'That email address looks invalid.'
  if (code.includes('network')) return 'Network error. Check your connection.'
  return err?.message || 'Something went wrong.'
}
