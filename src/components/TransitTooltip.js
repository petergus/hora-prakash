// src/components/TransitTooltip.js
const PLANET_ICONS = { Su:'☉', Mo:'☽', Ma:'♂', Me:'☿', Ju:'♃', Ve:'♀', Sa:'♄', Ra:'☊', Ke:'☋', Asc:'↑' }
const SIGN_SYMS    = ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓']
const SIGN_NAMES   = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtDate(date) {
  return `${MONTH_ABBR[date.getUTCMonth()]} ${date.getUTCDate()}`
}

export class TransitTooltip {
  constructor() {
    this._el         = null
    this._target     = null
    this._onMove     = null
    this._onOver     = null
    this._onOut      = null
    this._enabled    = true
    this._visible    = false
    this._forecasts  = {}
    this._onForecast = null
    this._currentAbbr = null
  }

  mount() {
    if (this._el) return
    this._el = document.createElement('div')
    this._el.className = 'p-tooltip p-tooltip--hidden'
    document.body.appendChild(this._el)
    this._onMove = e => { if (this._visible) this._position(e) }
    document.addEventListener('mousemove', this._onMove)
  }

  attach(container) {
    this.detach()
    this._target = container
    this._onOver = e => {
      if (!this._enabled) return
      const el = e.target.closest('[data-tip]')
      if (!el) { this._hide(); return }
      try { this._show(JSON.parse(el.getAttribute('data-tip')), e) } catch { this._hide() }
    }
    this._onOut = e => {
      if (!e.relatedTarget?.closest('[data-tip]')) this._hide()
    }
    container.addEventListener('mouseover', this._onOver)
    container.addEventListener('mouseout',  this._onOut)
  }

  detach() {
    if (this._target) {
      this._target.removeEventListener('mouseover', this._onOver)
      this._target.removeEventListener('mouseout',  this._onOut)
      this._target = null
    }
    this._hide()
  }

  setEnabled(v) { this._enabled = v; if (!v) this._hide() }

  setForecastProvider(fn) { this._onForecast = fn }

  setForecast(abbr, events) {
    this._forecasts[abbr] = events
    if (this._visible && this._currentAbbr === abbr) {
      this._el.querySelector('.p-tt-forecast')?.replaceWith(this._buildForecastEl(events))
    }
  }

  clearForecasts() { this._forecasts = {} }

  destroy() {
    this.detach()
    if (this._onMove) document.removeEventListener('mousemove', this._onMove)
    this._el?.remove()
    this._el = null
  }

  _buildForecastEl(events) {
    const el = document.createElement('div')
    el.className = 'p-tt-forecast'
    const top2 = events.filter(e => e.type !== 'pada').slice(0, 2)
    if (top2.length === 0) { el.style.display = 'none'; return el }
    el.innerHTML = `
      <div class="p-tt-divider">Next Events</div>
      ${top2.map(ev => `
        <div class="p-tt-row">
          <span class="p-tt-lbl">${ev.label}</span>
          <span class="p-tt-val">${fmtDate(ev.date)}</span>
        </div>`).join('')}`
    return el
  }

  _show(d, e) {
    this._currentAbbr = d.abbr
    const icon    = PLANET_ICONS[d.abbr] ?? '●'
    const signIdx = SIGN_NAMES.indexOf(d.sign)
    const signSym = signIdx >= 0 ? SIGN_SYMS[signIdx] : ''
    const badge   = d.transit
      ? `<span class="p-tt-badge p-tt-badge--transit">Transit</span>`
      : `<span class="p-tt-badge p-tt-badge--natal">Natal</span>`

    let speedRow = ''
    if (typeof d.speed === 'number') {
      const sign = d.speed < 0 ? '−' : '+'
      const abs  = Math.abs(d.speed).toFixed(3)
      const cls  = d.retro ? ' p-tt-retro' : ''
      const flag = d.retro ? ' ℞' : ''
      speedRow = `<div class="p-tt-row"><span class="p-tt-lbl">Speed</span><span class="p-tt-val${cls}">${sign}${abs}°/d${flag}</span></div>`
    } else if (d.retro) {
      speedRow = `<div class="p-tt-row"><span class="p-tt-lbl">Motion</span><span class="p-tt-val p-tt-retro">Retrograde ℞</span></div>`
    }

    this._el.innerHTML = `
      <div class="p-tt-head">
        <span class="p-tt-icon">${icon}</span>
        <span class="p-tt-name">${d.name}</span>
        ${badge}
      </div>
      <div class="p-tt-body">
        ${d.sign ? `<div class="p-tt-row"><span class="p-tt-lbl">Sign</span><span class="p-tt-val">${d.sign} ${signSym}</span></div>` : ''}
        ${d.nak  ? `<div class="p-tt-row"><span class="p-tt-lbl">Nakshatra</span><span class="p-tt-val">${d.nak}${d.pada ? ' · Pāda ' + d.pada : ''}</span></div>` : ''}
        ${d.deg  ? `<div class="p-tt-row"><span class="p-tt-lbl">Degree</span><span class="p-tt-val">${d.deg}</span></div>` : ''}
        ${speedRow}
      </div>`

    if (d.transit && d.abbr) {
      const cached = this._forecasts[d.abbr]
      if (cached) {
        this._el.appendChild(this._buildForecastEl(cached))
      } else {
        const loadingEl = document.createElement('div')
        loadingEl.className = 'p-tt-forecast'
        loadingEl.innerHTML = '<div class="p-tt-divider">Next Events</div><div class="p-tt-row p-tt-loading">Computing…</div>'
        this._el.appendChild(loadingEl)
        if (this._onForecast) this._onForecast(d.abbr)
      }
    }

    this._el.classList.remove('p-tooltip--hidden')
    this._visible = true
    this._position(e)
  }

  _hide() {
    this._visible = false
    this._currentAbbr = null
    this._el?.classList.add('p-tooltip--hidden')
  }

  _position(e) {
    if (!this._el || !this._visible) return
    const x = e.clientX + 14, y = e.clientY - 10
    const w = this._el.offsetWidth,  h = this._el.offsetHeight
    const vw = window.innerWidth,    vh = window.innerHeight
    this._el.style.left = (x + w > vw - 8 ? e.clientX - w - 10 : x) + 'px'
    this._el.style.top  = (y + h > vh - 8 ? e.clientY - h - 8  : y) + 'px'
  }
}
