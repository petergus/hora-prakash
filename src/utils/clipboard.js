// src/utils/clipboard.js
// navigator.clipboard only exists in secure contexts (HTTPS / localhost); on
// plain HTTP even *accessing* .writeText throws. Fall back to a hidden
// textarea + execCommand('copy') so the copy buttons work everywhere.

/**
 * Copy text to the clipboard.
 * @param {string} text
 * @returns {Promise<boolean>} true if the copy succeeded
 */
export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch { /* fall through to legacy path */ }
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;top:-9999px;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
