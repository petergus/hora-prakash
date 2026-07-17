import { DIVISIONAL_OPTIONS } from '../core/divisional.js'
import { parseTzInfo, fmtTransitDate } from '../utils/format.js'
import { activationBadge, activationTitle } from '../core/activation.js'
import { state } from '../state.js'

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
    this.el              = el
    this._getState       = getState
    this._expanded       = new Set()
    this._forecasts      = {}
    this._onForecast     = null
    this._lastRenderArgs = null
    this._tzOffset       = 0
    this._tzAbbr         = 'UTC'
  }

  get ui() { return this._getState() }

  setForecastProvider(fn) { this._onForecast = fn }

  setTimezone(iana) {
    const { offsetMin, abbr } = parseTzInfo(iana)
    this._tzOffset = offsetMin
    this._tzAbbr   = abbr
  }

  setForecast(abbr, events) {
    this._forecasts[abbr] = events
    const expansionEl = this.el.querySelector(`[data-expansion="${abbr}"]`)
    if (expansionEl) {
      expansionEl.innerHTML = this._buildExpansionContent(events)
    }
  }

  clearForecasts() { this._forecasts = {}; this._expanded.clear() }

  destroy() { this.el.innerHTML = '' }

  render(natalPlanets, transitPlanets, _t2n, _t2t, natalLagna, transitLagna, div = 'D1') {
    this._lastRenderArgs = [natalPlanets, transitPlanets, _t2n, _t2t, natalLagna, transitLagna, div]
    if (!natalPlanets) { this.el.innerHTML = ''; return }

    const isD1      = !div || div === 'D1'
    const divSuffix = isD1 ? '' : ` — ${divLabel(div)}`
    const signName  = (sign) => SIGN_NAMES[sign] ?? '—'
    const filter    = this.ui.transitFilter ?? new Set(['Ju','Sa'])

    const tMap = {}
    if (transitPlanets) {
      for (const tp of transitPlanets) tMap[tp.abbr] = tp
    }

    const retroMark = (p) => p?.retrograde ? ' (R)' : ''

    // Ashtakavarga overlay: SAV points of the sign a transit planet occupies
    // (natal Sarvashtakavarga; only meaningful against the rashi chart)
    const sarva = isD1 ? (state.strength?.sarva ?? null) : null
    const savCell = (tp) => {
      if (!sarva || !tp) return sarva ? '<td>—</td>' : ''
      const pts = sarva[tp.sign - 1]
      const cls = pts >= 30 ? 'score-high' : pts <= 22 ? 'score-low' : ''
      return `<td class="${cls}" title="Sarvashtakavarga points of ${signName(tp.sign)} in the natal chart">${pts}</td>`
    }
    const savHeader = sarva
      ? '<th title="Natal Sarvashtakavarga points of the sign the transiting planet occupies. 30+ supportive, 22 or less challenging.">SAV</th>'
      : ''
    const colCount = sarva ? 8 : 7

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
        ${sarva ? '<td>—</td>' : ''}
      </tr>`

    const rows = natalPlanets.map(np => {
      const tp         = filter.has(np.abbr) ? tMap[np.abbr] : null
      const isExpanded = this._expanded.has(np.abbr)
      const clickable  = tp ? ` class="transit-row-clickable" data-abbr="${np.abbr}"` : ''
      const expandIcon = tp ? (isExpanded ? '▼' : '▶') : ''

      const mainRow = `
        <tr${clickable}>
          <td><strong>${np.abbr}</strong> <span class="expand-icon">${expandIcon}</span></td>
          <td>${signName(np.sign)}</td>
          <td>${fmtDeg(np.degree)}${retroMark(np)}</td>
          <td>${nakPada(np)}</td>
          <td>${tp ? signName(tp.sign) : '—'}</td>
          <td>${tp ? fmtDeg(tp.degree) + retroMark(tp) : '—'}</td>
          <td>${tp ? nakPada(tp) : '—'}</td>
          ${savCell(tp)}
        </tr>`

      const expansionRow = tp && isExpanded ? `
        <tr class="transit-expansion-row">
          <td colspan="${colCount}">
            <div class="transit-expansion" data-expansion="${np.abbr}">
              ${this._forecasts[np.abbr]
                ? this._buildExpansionContent(this._forecasts[np.abbr])
                : '<div class="transit-expansion-loading">Computing forecast…</div>'}
            </div>
          </td>
        </tr>` : ''

      return mainRow + expansionRow
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
              ${savHeader}
            </tr>
          </thead>
          <tbody>${lagnaRow}${rows}</tbody>
        </table>
      </div>`

    this.el.querySelectorAll('[data-abbr]').forEach(row => {
      row.addEventListener('click', () => this._handleRowClick(row.dataset.abbr))
    })
  }

  _handleRowClick(abbr) {
    if (this._expanded.has(abbr)) {
      this._expanded.delete(abbr)
    } else {
      this._expanded.add(abbr)
      if (!this._forecasts[abbr] && this._onForecast) {
        this._onForecast(abbr)
      }
    }
    if (this._lastRenderArgs) this.render(...this._lastRenderArgs)
  }

  _buildExpansionContent(events) {
    if (!events || events.length === 0) {
      return '<div class="transit-expansion-empty">No upcoming events found in scan window.</div>'
    }

    const transitEvents = events.filter(e => e.type !== 'natal_aspect')
    const aspectEvents  = events.filter(e => e.type === 'natal_aspect')

    const renderRows = (evs) => evs.map(ev =>
      `<div class="transit-exp-row${ev.activation ? ' transit-exp-row--zap' : ''}">
        <span class="transit-exp-date">${fmtTransitDate(ev.date, this._tzOffset, this._tzAbbr)}</span>
        <span class="transit-exp-label">${ev.label}${ev.activation
          ? ` <span class="transit-exp-zap" title="${activationTitle(ev.activation)}">${activationBadge(ev.activation)}</span>`
          : ''}</span>
      </div>`
    ).join('')

    const hasZap = events.some(e => e.activation)

    return `
      <div class="transit-exp-section">
        <div class="transit-exp-heading">UPCOMING TRANSITS</div>
        ${transitEvents.length ? renderRows(transitEvents) : '<div class="transit-exp-empty">None in scan window</div>'}
      </div>
      ${aspectEvents.length ? `
      <div class="transit-exp-section">
        <div class="transit-exp-heading">NATAL ASPECTS</div>
        ${renderRows(aspectEvents)}
      </div>` : ''}
      ${hasZap ? '<div class="transit-exp-zap-note">⚡ dasha activation — the event involves a running Mahadasha/Antardasha/Pratyantara lord</div>' : ''}`
  }
}
