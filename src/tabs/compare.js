// src/tabs/compare.js
// Synastry: compare two saved people.
// Whole-sign overlay (B's planets in A's houses) plus inter-chart sign aspects.
import { state } from '../state.js'
import { renderChartSVG } from '../ui/chart-svg.js'
import { getAspectedSigns } from '../core/aspects.js'
import { calcGunaMilan, calcMangalDosha, mangalDoshaMatch } from '../core/gunamilan.js'
import { calcDasha } from '../core/dasha.js'
import { dashaSynchrony, SYNCHRONY_COLOR, buildDashaLanes, planetColor } from '../core/timeline.js'
import { renderTimelineSVG } from '../ui/timeline-svg.js'
import { orderedProfiles } from './profile-store.js'
import { initSwissEph } from '../core/swisseph.js'
import { getSettings, applyAyanamsa } from '../core/settings.js'
import { toJulianDay } from '../utils/time.js'
import { calcBirthChart } from '../core/calculations.js'

const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

let _person1Id  = null      // compared person 1 profile id
let _person2Id  = null      // compared person 2 profile id
let _chartStyle = 'north'
let _gunaSwap   = false     // false: P1 = girl, P2 = boy; true: swapped

// Cache computed charts by profile signature to avoid recalculating on every render if settings haven't changed.
const compareCache = new Map()

async function getCompareChartData(p) {
  if (!p) return null
  const settings = getSettings()
  const cacheKey = `${p.id}|${p.dob}|${p.tob}|${p.lat}|${p.lon}|${p.timezone}|${settings.ayanamsa}|${settings.observerType}`
  if (compareCache.has(cacheKey)) {
    return compareCache.get(cacheKey)
  }
  await initSwissEph()
  applyAyanamsa()
  const jd = toJulianDay(p.dob, p.tob, p.timezone)
  const { planets, lagna } = calcBirthChart(jd, p.lat, p.lon, settings)
  let dasha = null
  try {
    const moon = planets.find(x => x.name === 'Moon')
    if (moon) dasha = await calcDasha(moon, p.dob, { settings, jd })
  } catch (e) { console.error('compare: dasha', e) }
  const result = {
    label: p.name,
    data: {
      planets,
      lagna,
      dasha,
      birth: {
        dob: p.dob,
        tob: p.tob,
        timezone: p.timezone,
        lat: p.lat,
        lon: p.lon,
        location: p.location || '',
      }
    }
  }
  compareCache.set(cacheKey, result)
  return result
}

function houseIn(lagna, sign) {
  return ((sign - lagna.sign + 12) % 12) + 1
}

function fmtDeg(dec) {
  const d = Math.floor(dec)
  const m = Math.floor((dec - d) * 60)
  return `${d}°${String(m).padStart(2, '0')}'`
}

// Table of `who`'s planets placed into `into`'s houses
function overlayTable(who, into) {
  const rows = who.data.planets.map(p => {
    const h = houseIn(into.data.lagna, p.sign)
    return `<tr>
      <td>${esc(p.name)}${p.retrograde ? ' (R)' : ''}</td>
      <td>${SIGN_NAMES[p.sign - 1]} ${fmtDeg(p.degree)}</td>
      <td>${h}</td>
    </tr>`
  }).join('')
  return `
    <div class="card" style="min-width:0">
      <h3 class="section-label">${esc(who.label)}'s planets in ${esc(into.label)}'s houses</h3>
      <div class="table-scroll"><table class="planet-table">
        <thead><tr><th>Planet</th><th>Position</th><th>House of ${esc(into.label)}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`
}

// Ashta Koota (Guna Milan) card between the two charts.
function gunaMilanCard(a, b) {
  const moonOf = c => c.data.planets.find(p => p.name === 'Moon')
  const moonA = moonOf(a), moonB = moonOf(b)
  if (!moonA || !moonB) return ''

  const girl = _gunaSwap ? b : a
  const boy  = _gunaSwap ? a : b
  const milan = calcGunaMilan({ moonLon: moonOf(girl).lon }, { moonLon: moonOf(boy).lon })

  const doshaGirl = calcMangalDosha(girl.data.planets, girl.data.lagna.sign)
  const doshaBoy  = calcMangalDosha(boy.data.planets,  boy.data.lagna.sign)
  const doshaMatch = mangalDoshaMatch(doshaGirl, doshaBoy)

  const pct = milan.total / milan.max
  const barColor = milan.total >= 25 ? 'var(--ok-border,#10b981)'
    : milan.total >= 18 ? 'var(--accent,#6366f1)'
    : 'var(--danger,#dc2626)'

  const kootaRows = milan.kootas.map(k => `<tr>
    <td title="${esc(k.note)}"><strong>${esc(k.name)}</strong></td>
    <td>${esc(String(k.girl))}</td>
    <td>${esc(String(k.boy))}</td>
    <td style="text-align:right;font-variant-numeric:tabular-nums;${k.points === 0 ? 'color:var(--danger,#dc2626);font-weight:600' : ''}">${k.points}/${k.max}</td>
  </tr>`).join('')

  const doshaLine = (label, d) => {
    if (!d.present) return `<li><strong>${esc(label)}:</strong> no Mangal dosha.</li>`
    const where = d.afflictions.map(x => `${x.house}th from ${x.from}`).join(', ')
    const cancel = d.cancellations.length
      ? ` — softened: ${d.cancellations.map(esc).join('; ')}`
      : ' — <span style="color:var(--danger,#dc2626)">uncancelled</span>'
    return `<li><strong>${esc(label)}:</strong> Mars in ${where}${cancel}.</li>`
  }

  return `
    <div class="card" style="margin-top:1rem">
      <div style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap">
        <h3 class="section-label" style="margin:0">Guna Milan (Ashta Koota)</h3>
        <span style="font-size:0.78rem;color:var(--muted)">
          ${esc(girl.label)} as bride · ${esc(boy.label)} as groom
        </span>
        <button id="guna-swap" class="chart-style-btn" style="font-size:0.75rem;padding:0.2rem 0.5rem" title="Swap bride/groom roles">⇄ Swap roles</button>
      </div>
      <div style="display:flex;align-items:center;gap:1rem;margin:0.8rem 0 0.6rem;flex-wrap:wrap">
        <div style="font-size:1.9rem;font-weight:700;font-variant-numeric:tabular-nums">${milan.total}<span style="font-size:1rem;color:var(--muted)">/${milan.max}</span></div>
        <div style="flex:1 1 200px;min-width:160px">
          <div style="height:8px;border-radius:999px;background:var(--border,#e2e8f0);overflow:hidden">
            <div style="height:100%;width:${(pct * 100).toFixed(0)}%;background:${barColor}"></div>
          </div>
          <div style="font-size:0.8rem;color:var(--muted);margin-top:0.25rem">${esc(milan.verdict)} · 18+ traditionally required</div>
        </div>
      </div>
      <div class="table-scroll"><table class="planet-table">
        <thead><tr><th>Koota</th><th>${esc(girl.label)}</th><th>${esc(boy.label)}</th><th style="text-align:right">Points</th></tr></thead>
        <tbody>${kootaRows}</tbody>
      </table></div>
      <div style="margin-top:0.7rem;font-size:0.85rem">
        <strong>Mangal (Kuja) dosha</strong>
        <ul style="margin:0.3rem 0 0 1.1rem;padding:0;line-height:1.6">
          ${doshaLine(girl.label, doshaGirl)}
          ${doshaLine(boy.label, doshaBoy)}
          <li>${esc(doshaMatch.note)}</li>
        </ul>
      </div>
      <p style="font-size:0.72rem;color:var(--muted);margin:0.6rem 0 0">
        Moon-based Ashta Koota; hover a koota name for what it measures. Mangal dosha is
        whole-sign from Lagna and Moon with the common cancellations (own/exalted Mars,
        Jupiter's influence, both-Manglik).
      </p>
    </div>`
}

// Dasha synchrony (D2): both people's MD/AD lanes on one axis + a "relationship
// weather" strip classifying each overlap by both lords' functional nature.
function synchronyCard(a, b) {
  const dA = a.data.dasha, dB = b.data.dasha
  if (!Array.isArray(dA) || !Array.isArray(dB)) return ''

  // Window: a shared adult stretch around now (now − 8y … now + 22y), clipped
  // to where both dasha trees are defined.
  const now = Date.now()
  const lo = Math.max(dA[0].start.getTime(), dB[0].start.getTime())
  const hi = Math.min(dA[dA.length - 1].end.getTime(), dB[dB.length - 1].end.getTime())
  let from = Math.max(lo, now - 8 * 365.25 * 86400000)
  let to   = Math.min(hi, now + 22 * 365.25 * 86400000)
  if (!(to > from)) { from = lo; to = hi }
  const fromD = new Date(from), toD = new Date(to)

  const lanesA = buildDashaLanes(dA)
  const lanesB = buildDashaLanes(dB)
  const sync = dashaSynchrony(dA, a.data.lagna.sign, dB, b.data.lagna.sign, fromD, toD)
  const syncBand = sync.map(s => ({
    start: s.start, end: s.end, color: SYNCHRONY_COLOR[s.tone],
    label: s.tone, sub: `${s.p1Lord} / ${s.p2Lord}`,
  }))

  const lanes = [
    { id: 'a-md', label: `${a.label} MD`, kind: 'band', items: lanesA.md },
    { id: 'a-ad', label: `${a.label} AD`, kind: 'band', items: lanesA.ad },
    { id: 'sync', label: 'Together', kind: 'band', items: syncBand },
    { id: 'b-md', label: `${b.label} MD`, kind: 'band', items: lanesB.md },
    { id: 'b-ad', label: `${b.label} AD`, kind: 'band', items: lanesB.ad },
  ]
  const svg = renderTimelineSVG({ lanes, from: fromD, to: toD, now: new Date(), width: 940 })

  // Current tone, for a headline.
  const cur = sync.find(s => s.start.getTime() <= now && s.end.getTime() > now)
  const TONE_TEXT = {
    harmonious: 'Right now both of you run periods that support your charts — a favourable stretch.',
    mixed: 'Right now one of you is in a supportive period and the other a testing one — uneven, but workable.',
    stormy: 'Right now both of you run testing periods at once — a stretch that asks for patience.',
  }

  return `
    <div class="card" style="margin-top:1rem">
      <h3 class="section-label">Dasha synchrony — relationship weather</h3>
      ${cur ? `<p style="font-size:0.85rem;line-height:1.55;margin:0 0 0.6rem">${esc(TONE_TEXT[cur.tone])}</p>` : ''}
      <div class="tl-scroll" style="cursor:default">${svg}</div>
      <div class="sync-legend">
        <span><i style="background:${SYNCHRONY_COLOR.harmonious}"></i> both supportive</span>
        <span><i style="background:${SYNCHRONY_COLOR.mixed}"></i> mixed</span>
        <span><i style="background:${SYNCHRONY_COLOR.stormy}"></i> both testing</span>
      </div>
      <p style="font-size:0.72rem;color:var(--muted);margin:0.5rem 0 0;line-height:1.5">
        Each person's running Mahadasha lord is judged by <em>their own</em> lagna's functional nature
        (a planet benefic for one chart can be malefic for the other), then combined. A guide to the
        overall tone of a shared stretch, not a verdict on the relationship.
      </p>
    </div>`
}

// Inter-chart aspects: which of `to`'s planets sit in signs aspected by `from`'s planets
function interAspects(from, to) {
  const items = []
  for (const p of from.data.planets) {
    const aspSigns = getAspectedSigns(p.sign, p.abbr)
    const hit = to.data.planets.filter(q => aspSigns.includes(q.sign))
    const conj = to.data.planets.filter(q => q.sign === p.sign)
    if (conj.length) items.push(`<strong>${esc(p.name)}</strong> conjunct (same sign) ${conj.map(q => esc(q.name)).join(', ')}`)
    if (hit.length)  items.push(`<strong>${esc(p.name)}</strong> aspects ${hit.map(q => esc(q.name)).join(', ')}`)
  }
  return items.length
    ? `<ul style="margin:0.25rem 0 0 1.1rem;padding:0;font-size:0.85rem;line-height:1.7">${items.map(i => `<li>${i}</li>`).join('')}</ul>`
    : '<p style="font-size:0.85rem;color:var(--muted)">None.</p>'
}

export async function renderCompare() {
  const el = document.getElementById('tab-compare')
  if (!el) return

  const profiles = orderedProfiles()

  if (profiles.length < 2) {
    el.innerHTML = `
      <div class="card">
        <h3 class="section-label">Compare charts</h3>
        <p style="font-size:0.9rem;color:var(--muted);line-height:1.5;margin-bottom:1rem">
          To compare charts on this page, you need at least <strong>two saved people</strong>.
        </p>
        <p style="font-size:0.9rem;color:var(--muted);line-height:1.5">
          You can add and save people in the <a href="#/people" style="color:var(--accent);text-decoration:underline">People</a> directory or via the <a href="#/p/new/edit" style="color:var(--accent);text-decoration:underline">Birth Details</a> form.
        </p>
      </div>`
    return
  }

  const activeProfileId = state.birth?.profileId
  if (!_person1Id || !profiles.some(p => p.id === _person1Id)) {
    _person1Id = profiles.some(p => p.id === activeProfileId) ? activeProfileId : profiles[0].id
  }
  if (!_person2Id || !profiles.some(p => p.id === _person2Id) || _person2Id === _person1Id) {
    _person2Id = profiles.find(p => p.id !== _person1Id)?.id || profiles[0].id
  }

  // Show a loading indicator
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:40vh;gap:1rem">
      <div class="app-spinner"></div>
      <span style="color:var(--muted);font-size:var(--fs-base)">Calculating charts…</span>
    </div>`

  try {
    const p1 = profiles.find(p => p.id === _person1Id)
    const p2 = profiles.find(p => p.id === _person2Id)

    const [a, b] = await Promise.all([
      getCompareChartData(p1),
      getCompareChartData(p2)
    ])

    if (!a || !b) {
      throw new Error("Could not load chart data for the selected profiles.")
    }

    const chartCell = (c) => `
      <div class="multi-chart-cell">
        <div class="multi-chart-label" style="text-align:center;font-weight:600">${esc(c.label)}</div>
        ${renderChartSVG(c.data.planets, c.data.lagna, _chartStyle, undefined,
          `${c.label}\n${c.data.birth?.dob ?? ''}`.trim(), [], {})}
      </div>`

    el.innerHTML = `
      <div class="card">
        <div class="chart-controls" style="margin-bottom:0.75rem">
          <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">
            <label style="font-size:0.85rem;display:flex;align-items:center;gap:0.4rem">
              Person 1:
              <select id="compare-p1" class="div-select">
                ${profiles.map(p => `<option value="${p.id}"${p.id === _person1Id ? ' selected' : ''}${p.id === _person2Id ? ' disabled' : ''}>${esc(p.name)}</option>`).join('')}
              </select>
            </label>
            <label style="font-size:0.85rem;display:flex;align-items:center;gap:0.4rem">
              Person 2:
              <select id="compare-p2" class="div-select">
                ${profiles.map(p => `<option value="${p.id}"${p.id === _person2Id ? ' selected' : ''}${p.id === _person1Id ? ' disabled' : ''}>${esc(p.name)}</option>`).join('')}
              </select>
            </label>
          </div>
          <div class="chart-style-group">
            <button id="compare-north" class="chart-style-btn${_chartStyle === 'north' ? ' active' : ''}">North</button>
            <button id="compare-south" class="chart-style-btn${_chartStyle === 'south' ? ' active' : ''}">South</button>
          </div>
        </div>
        <div class="multi-chart-grid multi-chart-grid-2">
          ${chartCell(a)}
          ${chartCell(b)}
        </div>
      </div>
      ${gunaMilanCard(a, b)}
      ${synchronyCard(a, b)}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1rem;margin-top:1rem">
        ${overlayTable(b, a)}
        ${overlayTable(a, b)}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1rem;margin-top:1rem">
        <div class="card" style="min-width:0">
          <h3 class="section-label">${esc(a.label)} → ${esc(b.label)} aspects</h3>
          ${interAspects(a, b)}
        </div>
        <div class="card" style="min-width:0">
          <h3 class="section-label">${esc(b.label)} → ${esc(a.label)} aspects</h3>
          ${interAspects(b, a)}
        </div>
      </div>
      <p style="font-size:0.75rem;color:var(--muted,#94a3b8);margin-top:0.75rem">
        Whole-sign synastry: houses are counted sign-to-sign from the other chart's lagna;
        aspects use full Parashari sign aspects (Mars 4/7/8, Jupiter 5/7/9, Saturn 3/7/10, nodes 5/7/9, others 7th).
      </p>`

    el.querySelector('#compare-p1').addEventListener('change', e => {
      _person1Id = e.target.value
      renderCompare()
    })
    el.querySelector('#compare-p2').addEventListener('change', e => {
      _person2Id = e.target.value
      renderCompare()
    })
    el.querySelector('#compare-north').addEventListener('click', () => { _chartStyle = 'north'; renderCompare() })
    el.querySelector('#compare-south').addEventListener('click', () => { _chartStyle = 'south'; renderCompare() })
    el.querySelector('#guna-swap')?.addEventListener('click', () => { _gunaSwap = !_gunaSwap; renderCompare() })

  } catch (err) {
    el.innerHTML = `
      <div class="card">
        <h3 class="section-label" style="color:var(--danger)">Error</h3>
        <p style="font-size:0.9rem;color:var(--muted);line-height:1.5">${esc(err.message)}</p>
      </div>`
    console.error(err)
  }
}
