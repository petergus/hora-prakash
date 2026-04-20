// src/ui/tabs.js
export function initTabs() {
  document.getElementById('tab-nav').addEventListener('click', async (e) => {
    const btn = e.target.closest('.tab-btn')
    if (!btn || btn.disabled) return
    const name = btn.dataset.tab
    switchTab(name)
    // Re-render panel so it always reflects current session state
    if (name === 'chart') {
      const { renderChart }    = await import('../tabs/chart.js')
      renderChart()
    } else if (name === 'dasha') {
      const { renderDasha }    = await import('../tabs/dasha.js')
      renderDasha()
    } else if (name === 'panchang') {
      const { renderPanchang } = await import('../tabs/panchang.js')
      renderPanchang()
    } else if (name === 'input') {
      const { renderInputTab } = await import('../tabs/input.js')
      renderInputTab()
    }
  })
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
