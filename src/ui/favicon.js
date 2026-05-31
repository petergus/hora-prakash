// src/ui/favicon.js
const THEME_COLORS = {
  indigo:   { dark: '#312e81', primary: '#4f46e5', ring: '#6366f1', diag: '#a5b4fc' },
  saffron:  { dark: '#78350f', primary: '#d97706', ring: '#f59e0b', diag: '#fcd34d' },
  forest:   { dark: '#064e3b', primary: '#059669', ring: '#10b981', diag: '#6ee7b7' },
  rose:     { dark: '#881337', primary: '#e11d48', ring: '#f43f5e', diag: '#fda4af' },
  midnight: { dark: '#2e1065', primary: '#7c3aed', ring: '#8b5cf6', diag: '#c4b5fd' },
  crimson:  { dark: '#7f1d1d', primary: '#c0392b', ring: '#dc2626', diag: '#fca5a5' },
}

export function updateFavicon(theme) {
  const c = THEME_COLORS[theme] || THEME_COLORS.crimson
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c.dark}"/>
      <stop offset="100%" stop-color="${c.primary}"/>
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fde68a"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <circle cx="256" cy="256" r="256" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="220" fill="none" stroke="${c.ring}" stroke-width="2" opacity="0.5"/>
  <circle cx="256" cy="256" r="200" fill="none" stroke="${c.ring}" stroke-width="1" opacity="0.3"/>
  <polygon points="256,72 440,256 256,440 72,256" fill="none" stroke="url(#gold)" stroke-width="3" opacity="0.9"/>
  <polygon points="256,152 360,256 256,360 152,256" fill="none" stroke="url(#gold)" stroke-width="2" opacity="0.7"/>
  <line x1="256" y1="72"  x2="256" y2="152" stroke="#fde68a" stroke-width="2" opacity="0.5"/>
  <line x1="440" y1="256" x2="360" y2="256" stroke="#fde68a" stroke-width="2" opacity="0.5"/>
  <line x1="256" y1="440" x2="256" y2="360" stroke="#fde68a" stroke-width="2" opacity="0.5"/>
  <line x1="72"  y1="256" x2="152" y2="256" stroke="#fde68a" stroke-width="2" opacity="0.5"/>
  <line x1="256" y1="72"  x2="440" y2="256" stroke="${c.diag}" stroke-width="1" opacity="0.25"/>
  <line x1="440" y1="256" x2="256" y2="440" stroke="${c.diag}" stroke-width="1" opacity="0.25"/>
  <line x1="256" y1="440" x2="72"  y2="256" stroke="${c.diag}" stroke-width="1" opacity="0.25"/>
  <line x1="72"  y1="256" x2="256" y2="72"  stroke="${c.diag}" stroke-width="1" opacity="0.25"/>
  <circle cx="256" cy="256" r="28" fill="url(#gold)" filter="url(#glow)" opacity="0.95"/>
  <circle cx="256" cy="256" r="18" fill="${c.dark}"/>
  <circle cx="256" cy="256" r="8"  fill="url(#gold)"/>
  <circle cx="256" cy="152" r="5" fill="#fde68a" opacity="0.8"/>
  <circle cx="360" cy="256" r="5" fill="#fde68a" opacity="0.8"/>
  <circle cx="256" cy="360" r="5" fill="#fde68a" opacity="0.8"/>
  <circle cx="152" cy="256" r="5" fill="#fde68a" opacity="0.8"/>
</svg>`
  const url = `data:image/svg+xml,${encodeURIComponent(svg)}`
  let link = document.querySelector("link[rel~='icon']")
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = url
}
