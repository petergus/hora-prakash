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
    } else if (name === 'input') {
      const { renderInputTab } = await import('../tabs/input.js')
      renderInputTab()
    }
  })

  // Global swipe navigation between top-level tabs (mobile)
  const TAB_ORDER = ['input', 'chart', 'dasha', 'panchang']
  let swipeStartX = 0, swipeStartY = 0

  const mainEl = document.querySelector('main')
  if (mainEl) {
    mainEl.addEventListener('touchstart', e => {
      swipeStartX = e.changedTouches[0].clientX
      swipeStartY = e.changedTouches[0].clientY
    }, { passive: true })

    mainEl.addEventListener('touchend', async e => {
      const dx = e.changedTouches[0].clientX - swipeStartX
      const dy = Math.abs(e.changedTouches[0].clientY - swipeStartY)
      if (Math.abs(dx) < 50 || dy > 75) return

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
