// src/config/branding.js
// Reads public/branding.json at runtime and applies name, logo, favicon, theme.
// Called once in main.js after loadSettings(). Applies branding defaults (name,
// logo, favicon, theme) — theme only applied when user has no saved preference.

export async function loadBranding() {
  let json = {}
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}branding.json`)
    if (res.ok) json = await res.json()
  } catch (e) { console.warn('[branding] failed to load branding.json:', e) }

  // App name
  const appName = json.appName || 'Hora Prakash'
  document.title = appName

  const h1 = document.querySelector('header h1')
  if (h1) {
    const img = h1.querySelector('img')
    const textNode = [...h1.childNodes].find(n => n.nodeType === Node.TEXT_NODE)
    if (textNode) textNode.textContent = appName
    else h1.append(document.createTextNode(appName))

    if (img && json.logoUrl) img.src = json.logoUrl
  }

  // Favicon
  if (json.faviconUrl) {
    const link = document.querySelector('link[rel="icon"]')
    if (link) link.href = json.faviconUrl
  }

  // Apply branding theme only when user has no saved preference
  const hasUserTheme = (() => {
    try { return 'theme' in JSON.parse(localStorage.getItem('hora-prakash-settings') || '{}') } catch { return false }
  })()
  if (!hasUserTheme && json.theme) {
    document.documentElement.dataset.theme = json.theme
  }

  // Meta tags
  const ogTitle = document.querySelector('meta[property="og:title"]')
  if (ogTitle) ogTitle.setAttribute('content', appName)
  if (json.appTagline) {
    const desc = document.querySelector('meta[name="description"]')
    if (desc) desc.setAttribute('content', json.appTagline)
  }

  // Footer
  if (json.footerText && !document.querySelector('.app-footer')) {
    const footer = document.createElement('footer')
    footer.className = 'app-footer'
    footer.style.cssText = 'text-align:center;padding:1rem;font-size:0.78rem;color:var(--muted);margin-top:1rem'
    footer.textContent = json.footerText
    document.body.appendChild(footer)
  }
}
