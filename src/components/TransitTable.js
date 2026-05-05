const SIGN_NAMES = ['','Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']

function fmtDeg(dec) {
  const d = Math.floor(dec)
  const m = Math.floor((dec - d) * 60)
  return `${d}°${String(m).padStart(2,'0')}'`
}

export class TransitTable {
  constructor(el, getState) {
    this.el        = el
    this._getState = getState
  }

  get ui() { return this._getState() }

  destroy() { this.el.innerHTML = '' }

  render(natalPlanets, transitPlanets, transitToNatalAspects, transitToTransitAspects) {
    if (!natalPlanets) { this.el.innerHTML = ''; return }

    const filter = this.ui.transitFilter ?? new Set(['Ju','Sa'])

    // Build lookup maps
    const t2nMap = {}   // abbr → aspectsNatalPlanets[]
    const t2tMap = {}   // abbr → aspectsPlanets[]
    if (transitToNatalAspects) {
      for (const r of transitToNatalAspects) t2nMap[r.transitPlanet] = r.aspectsNatalPlanets
    }
    if (transitToTransitAspects) {
      for (const r of transitToTransitAspects) t2tMap[r.planet] = r.aspectsPlanets
    }
    const tMap = {}
    if (transitPlanets) {
      for (const tp of transitPlanets) tMap[tp.abbr] = tp
    }

    const rows = natalPlanets.map(np => {
      const tp        = filter.has(np.abbr) ? tMap[np.abbr] : null
      const t2n       = tp ? (t2nMap[np.abbr] ?? []).join(', ') || '—' : '—'
      const t2t       = tp ? (t2tMap[np.abbr] ?? []).join(', ') || '—' : '—'
      const retroMark = (p) => p?.retrograde ? ' ℞' : ''
      return `
        <tr>
          <td><strong>${np.abbr}</strong></td>
          <td>${SIGN_NAMES[np.sign]}</td>
          <td>${fmtDeg(np.degree)}${retroMark(np)}</td>
          <td>${np.house}</td>
          <td>${tp ? SIGN_NAMES[tp.sign] : '—'}</td>
          <td>${tp ? fmtDeg(tp.degree) + retroMark(tp) : '—'}</td>
          <td>${tp ? tp.house : '—'}</td>
          <td>${t2n}</td>
          <td>${t2t}</td>
        </tr>`
    }).join('')

    this.el.innerHTML = `
      <div class="transit-table-wrap">
        <table class="transit-table">
          <thead>
            <tr>
              <th>Planet</th>
              <th>Natal Sign</th>
              <th>Natal°</th>
              <th>N.House</th>
              <th>Transit Sign</th>
              <th>Transit°</th>
              <th>T.House</th>
              <th>T→Natal</th>
              <th>T→Transit</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
  }
}
