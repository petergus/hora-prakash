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
  const overlay = document.createElement('div')
  overlay.id = OVERLAY_ID
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(8,8,16,0.92);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem;font-family:Inter,system-ui,sans-serif'
  overlay.innerHTML = `
    <div style="background:var(--card,#1a1a22);color:var(--fg,#eee);max-width:380px;width:100%;padding:1.6rem;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,0.6);display:flex;flex-direction:column;gap:0.85rem">
      <h2 style="margin:0;font-size:1.15rem">Sign in to Hora Prakash</h2>
      <input id="auth-email" type="email" autocomplete="email" placeholder="Email" style="padding:0.55rem 0.7rem;border-radius:6px;border:1px solid #444;background:#0f0f17;color:inherit;font-size:0.9rem" />
      <input id="auth-password" type="password" autocomplete="current-password" placeholder="Password" style="padding:0.55rem 0.7rem;border-radius:6px;border:1px solid #444;background:#0f0f17;color:inherit;font-size:0.9rem" />
      <p id="auth-error" style="margin:0;color:#f87171;font-size:0.8rem;min-height:1.1em"></p>
      <button id="auth-submit" type="button" style="padding:0.6rem;border-radius:6px;border:none;background:#6366f1;color:#fff;font-weight:600;cursor:pointer">Sign In</button>
      <div style="text-align:right;font-size:0.8rem">
        <a id="auth-reset" href="#" style="color:#94a3b8">Forgot password?</a>
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
      $('auth-error').style.color = '#34d399'
      $('auth-error').textContent = 'Reset email sent.'
    } catch (err) {
      $('auth-error').style.color = '#f87171'
      $('auth-error').textContent = friendlyError(err)
    }
  })

  const submit = async () => {
    const email = $('auth-email').value.trim()
    const pw = $('auth-password').value
    if (!email || !pw) { $('auth-error').textContent = 'Email and password required.'; return }
    $('auth-submit').disabled = true
    $('auth-submit').textContent = '…'
    $('auth-error').style.color = '#f87171'
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
