// src/auth-ui.js — email/password gate. Resolves once a user is signed in.
import { auth } from './firebase.js'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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
      <h2 id="auth-title" style="margin:0;font-size:1.15rem">Sign in to Hora Prakash</h2>
      <p style="margin:0;color:var(--muted,#999);font-size:0.83rem;line-height:1.4">
        Your saved profiles and horoscopes are private to your account.
      </p>
      <input id="auth-email" type="email" autocomplete="email" placeholder="Email" style="padding:0.55rem 0.7rem;border-radius:6px;border:1px solid #444;background:#0f0f17;color:inherit;font-size:0.9rem" />
      <input id="auth-password" type="password" autocomplete="current-password" placeholder="Password (min 6 chars)" style="padding:0.55rem 0.7rem;border-radius:6px;border:1px solid #444;background:#0f0f17;color:inherit;font-size:0.9rem" />
      <p id="auth-error" style="margin:0;color:#f87171;font-size:0.8rem;min-height:1.1em"></p>
      <button id="auth-submit" type="button" style="padding:0.6rem;border-radius:6px;border:none;background:#6366f1;color:#fff;font-weight:600;cursor:pointer">Sign In</button>
      <div style="display:flex;justify-content:space-between;font-size:0.8rem">
        <a id="auth-toggle" href="#" style="color:#a5b4fc">Create an account</a>
        <a id="auth-reset" href="#" style="color:#94a3b8">Forgot password?</a>
      </div>
    </div>
  `
  document.body.appendChild(overlay)

  let mode = 'signin'
  const $ = id => overlay.querySelector(`#${id}`)
  const setMode = m => {
    mode = m
    $('auth-title').textContent = m === 'signin' ? 'Sign in to Hora Prakash' : 'Create your account'
    $('auth-submit').textContent = m === 'signin' ? 'Sign In' : 'Sign Up'
    $('auth-toggle').textContent = m === 'signin' ? 'Create an account' : 'Have an account? Sign in'
    $('auth-password').autocomplete = m === 'signin' ? 'current-password' : 'new-password'
    $('auth-error').textContent = ''
  }

  $('auth-toggle').addEventListener('click', e => {
    e.preventDefault()
    setMode(mode === 'signin' ? 'signup' : 'signin')
  })

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
      if (mode === 'signin') await signInWithEmailAndPassword(auth, email, pw)
      else await createUserWithEmailAndPassword(auth, email, pw)
    } catch (err) {
      $('auth-error').textContent = friendlyError(err)
      $('auth-submit').disabled = false
      $('auth-submit').textContent = mode === 'signin' ? 'Sign In' : 'Sign Up'
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
  if (code.includes('email-already-in-use')) return 'That email is already registered. Try signing in.'
  if (code.includes('weak-password')) return 'Password must be at least 6 characters.'
  if (code.includes('invalid-email')) return 'That email address looks invalid.'
  if (code.includes('network')) return 'Network error. Check your connection.'
  return err?.message || 'Something went wrong.'
}
