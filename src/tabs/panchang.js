// src/tabs/panchang.js
import { state } from '../state.js'
import { formatTimeInZone } from '../utils/time.js'

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

export function renderPanchang() {
  const panel = document.getElementById('tab-panchang')
  if (!state.panchang || !state.birth) return
  const { panchang, birth } = state
  const p = panchang

  const fmtTime = (d) => d ? `${formatTimeInZone(d, birth.timezone)} ${esc(birth.timezone)}` : '—'

  panel.innerHTML = `
    <div class="card">
      <h2>Panchang — ${esc(birth.dob)}</h2>
      <p style="color:var(--muted);font-size:0.85rem;margin-top:0.2rem;margin-bottom:1rem">${esc(birth.location || birth.lat + ', ' + birth.lon)}</p>
      <div class="table-scroll"><table class="panchang-table">
        <tbody>
          <tr><th>Tithi</th><td>${p.tithi.name} (${p.tithi.num}/30)</td></tr>
          <tr><th>Vara</th><td>${p.vara.name} — Lord: ${p.vara.lord}</td></tr>
          <tr><th>Nakshatra</th><td>${p.nakshatra.name} Pada ${p.nakshatra.pada} — Lord: ${p.nakshatra.lord}</td></tr>
          <tr><th>Yoga</th><td>${p.yoga}</td></tr>
          <tr><th>Karana</th><td>${p.karana}</td></tr>
          <tr><th>Sunrise</th><td>${fmtTime(p.sunrise)}</td></tr>
          <tr><th>Sunset</th><td>${fmtTime(p.sunset)}</td></tr>
          <tr><th>Rahu Kalam</th><td>${fmtTime(p.rahuKalam.start)} – ${fmtTime(p.rahuKalam.end)}</td></tr>
          <tr><th>Gulika Kalam</th><td>${fmtTime(p.gulikaKalam.start)} – ${fmtTime(p.gulikaKalam.end)}</td></tr>
        </tbody>
      </table></div>
    </div>
  `
}
