// src/ui/tabs.js
export function initTabs() {
  document.getElementById('tab-nav').addEventListener('click', async (e) => {
    const btn = e.target.closest('.tab-btn')
    if (!btn || btn.disabled) return
    const name = btn.dataset.tab
    switchTab(name)
    if (name === 'chart') {
      const { renderChart }    = await import('../tabs/chart.js')
      renderChart()
    } else if (name === 'dasha') {
      const { renderDasha }    = await import('../tabs/dasha.js')
      renderDasha().catch(console.error)
    } else if (name === 'panchang') {
      const { renderPanchang } = await import('../tabs/panchang.js')
      renderPanchang()
    } else if (name === 'strength') {
      const { renderStrength } = await import('../tabs/strength.js')
      renderStrength()
    } else if (name === 'input') {
      const { renderInputTab } = await import('../tabs/input.js')
      renderInputTab()
    }
  })

  // Global swipe navigation between top-level tabs (mobile)
  // "Hard swipe": must be fast, far, and clearly horizontal — not a scroll gesture.
  const TAB_ORDER = ['input', 'chart', 'dasha', 'panchang', 'strength']
  let swipeStartX = 0, swipeStartY = 0, swipeStartTime = 0, swipeCancelled = false

  // Returns true if el (or any ancestor up to <main>) can scroll horizontally.
  function insideHorizScrollable(el) {
    while (el && el.tagName !== 'MAIN') {
      if (el.scrollWidth > el.clientWidth + 4) return true
      el = el.parentElement
    }
    return false
  }

  const mainEl = document.querySelector('main')
  if (mainEl) {
    mainEl.addEventListener('touchstart', e => {
      const t = e.changedTouches[0]
      swipeStartX    = t.clientX
      swipeStartY    = t.clientY
      swipeStartTime = Date.now()
      swipeCancelled = insideHorizScrollable(e.target)
    }, { passive: true })

    // Cancel early if the gesture turns vertical before the finger lifts.
    mainEl.addEventListener('touchmove', e => {
      if (swipeCancelled) return
      const t  = e.changedTouches[0]
      const dx = Math.abs(t.clientX - swipeStartX)
      const dy = Math.abs(t.clientY - swipeStartY)
      // If vertical movement leads horizontal by more than 10 px, this is a scroll.
      if (dy > 10 && dy > dx) swipeCancelled = true
    }, { passive: true })

    mainEl.addEventListener('touchend', async e => {
      if (swipeCancelled) return
      const t   = e.changedTouches[0]
      const dx  = t.clientX - swipeStartX
      const adx = Math.abs(dx)
      const ady = Math.abs(t.clientY - swipeStartY)
      const ms  = Date.now() - swipeStartTime

      // Hard-swipe rules:
      //   • minimum 80 px horizontal travel
      //   • horizontal must be at least 2.5× the vertical (≈ 22° angle)
      //   • completed within 400 ms (deliberate swipe, not a slow drag)
      if (adx < 80 || ady > adx * 0.4 || ms > 400) return

      const activeBtn = document.querySelector('#tab-nav .tab-btn.active')
      if (!activeBtn) return
      const currentIdx = TAB_ORDER.indexOf(activeBtn.dataset.tab)
      const nextIdx = dx < 0 ? currentIdx + 1 : currentIdx - 1
      if (nextIdx < 0 || nextIdx >= TAB_ORDER.length) return

      const nextTab = TAB_ORDER[nextIdx]
      const nextBtn = document.querySelector(`.tab-btn[data-tab="${nextTab}"]`)
      if (!nextBtn || nextBtn.disabled) return

      switchTab(nextTab)
      if (nextTab === 'chart') {
        const { renderChart } = await import('../tabs/chart.js')
        renderChart()
      } else if (nextTab === 'dasha') {
        const { renderDasha } = await import('../tabs/dasha.js')
        renderDasha().catch(console.error)
      } else if (nextTab === 'panchang') {
        const { renderPanchang } = await import('../tabs/panchang.js')
        renderPanchang()
      } else if (nextTab === 'strength') {
        const { renderStrength } = await import('../tabs/strength.js')
        renderStrength()
      } else if (nextTab === 'input') {
        const { renderInputTab } = await import('../tabs/input.js')
        renderInputTab()
      }
    }, { passive: true })
  }
}

export function switchTab(name) {
  if (!name) return
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name))
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${name}`))
}

export function enableTab(name) {
  const btn = document.querySelector(`.tab-btn[data-tab="${name}"]`)
  if (btn) btn.disabled = false
}
