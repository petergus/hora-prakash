import { DIVISIONAL_OPTIONS } from '../core/divisional.js'

const SIGN_NAMES = ['','Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']

function divLabel(key) {
  return DIVISIONAL_OPTIONS.find(o => o.value === key)?.label ?? key
}

function fmtDeg(dec) {
  const d = Math.floor(dec)
  const m = Math.floor((dec - d) * 60)
  return `${d}°${String(m).padStart(2,'0')}'`
}

function nakPada(p) {
  if (!p?.nakshatra) return '—'
  return `${p.nakshatra} (${p.pada})`
}

export class TransitTable {
  constructor(el, getState) {
    this.el        = el
    this._getState = getState
  }

  get ui() { return this._getState() }

  destroy() { this.el.innerHTML = '' }

  render(natalPlanets, transitPlanets, _t2n, _t2t, natalLagna, transitLagna, div = 'D1') {
    if (!natalPlanets) { this.el.innerHTML = ''; return }
    const isD1       = !div || div === 'D1'
    const divSuffix  = isD1 ? '' : ` — ${divLabel(div)}`
    const isChalit   = div === 'Chalit'
    const signName   = (sign) => isChalit ? `H${sign}` : (SIGN_NAMES[sign] ?? '—')

    const filter = this.ui.transitFilter ?? new Set(['Ju','Sa'])

    const tMap = {}
    if (transitPlanets) {
      for (const tp of transitPlanets) tMap[tp.abbr] = tp
    }

    const retroMark = (p) => p?.retrograde ? ' (R)' : ''

    // Lagna rows
    const nLagna = natalLagna
    const tLagna = transitLagna ?? this.ui.transitLagna
    const lagnaRow = `
      <tr class="lagna-row">
        <td><strong>Lg</strong></td>
        <td>${nLagna ? signName(nLagna.sign) : '—'}</td>
        <td>${nLagna ? fmtDeg(nLagna.degree) : '—'}</td>
        <td>${nLagna ? nakPada(nLagna) : '—'}</td>
        <td>${tLagna ? signName(tLagna.sign) : '—'}</td>
        <td>${tLagna ? fmtDeg(tLagna.degree) : '—'}</td>
        <td>${tLagna ? nakPada(tLagna) : '—'}</td>
      </tr>`

    const rows = natalPlanets.map(np => {
      const tp = filter.has(np.abbr) ? tMap[np.abbr] : null
      return `
        <tr>
          <td><strong>${np.abbr}</strong></td>
          <td>${signName(np.sign)}</td>
          <td>${fmtDeg(np.degree)}${retroMark(np)}</td>
          <td>${nakPada(np)}</td>
          <td>${tp ? signName(tp.sign) : '—'}</td>
          <td>${tp ? fmtDeg(tp.degree) + retroMark(tp) : '—'}</td>
          <td>${tp ? nakPada(tp) : '—'}</td>
        </tr>`
    }).join('')

    this.el.innerHTML = `
      <div class="transit-table-wrap">
        <h3 class="section-label" style="padding:0.5rem 0 0.25rem">Planetary Positions${divSuffix}</h3>
        <table class="transit-table">
          <thead>
            <tr>
              <th>Planet</th>
              <th>Natal Sign</th>
              <th>Natal°</th>
              <th>Natal Nakshatra</th>
              <th>Transit Sign</th>
              <th>Transit°</th>
              <th>Transit Nakshatra</th>
            </tr>
          </thead>
          <tbody>${lagnaRow}${rows}</tbody>
        </table>
      </div>`
  }
}
