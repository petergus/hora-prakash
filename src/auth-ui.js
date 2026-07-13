// src/auth-ui.js — email/password gate. Resolves once a user is signed in.
import { auth } from './firebase.js'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth'

const OVERLAY_ID = 'auth-overlay'

export function requireAuth() {
  return new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, user => {
      if (user) {
        unsub()
        hideOverlay()
        resolve(user)
      } else {
        showOverlay()
      }
    })
  })
}

export async function logout() {
  await signOut(auth)
  location.reload()
}

function hideOverlay() {
  document.getElementById(OVERLAY_ID)?.remove()
}

function showOverlay() {
  if (document.getElementById(OVERLAY_ID)) return
  const appName = document.title || 'Hora Prakash'
  const overlay = document.createElement('div')
  overlay.id = OVERLAY_ID
  overlay.className = 'auth-overlay'
  overlay.innerHTML = `
    <div class="auth-card">
      <img class="auth-logo" src="/icon.svg" alt="" />
      <h2 class="auth-title">Welcome back</h2>
      <p class="auth-subtitle">Sign in to ${appName}</p>
      <input id="auth-email" class="auth-input" type="email" autocomplete="email" placeholder="Email" />
      <input id="auth-password" class="auth-input" type="password" autocomplete="current-password" placeholder="Password" />
      <p id="auth-error" class="auth-error"></p>
      <button id="auth-submit" class="auth-submit" type="button">Sign In</button>
      <div class="auth-links">
        <a id="auth-reset" href="#">Forgot password?</a>
      </div>
    </div>
  `
  document.body.appendChild(overlay)

  const $ = id => overlay.querySelector(`#${id}`)

  $('auth-reset').addEventListener('click', async e => {
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
    if (!email || !pw) { $('auth-error').textContent = 'Email and password required.'; return }
    $('auth-submit').disabled = true
    $('auth-submit').textContent = '…'
    $('auth-error').style.color = ''
    $('auth-error').textContent = ''
    try {
      await signInWithEmailAndPassword(auth, email, pw)
    } catch (err) {
      $('auth-error').textContent = friendlyError(err)
      $('auth-submit').disabled = false
      $('auth-submit').textContent = 'Sign In'
    }
  }

  $('auth-submit').addEventListener('click', submit)
  overlay.addEventListener('keydown', e => { if (e.key === 'Enter') submit() })
  setTimeout(() => $('auth-email').focus(), 0)
}

function friendlyError(err) {
  const code = err?.code || ''
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found'))
    return 'Email or password is incorrect.'
  if (code.includes('invalid-email')) return 'That email address looks invalid.'
  if (code.includes('network')) return 'Network error. Check your connection.'
  return err?.message || 'Something went wrong.'
}
