// Unit tests for Ashta Koota Guna Milan + Mangal dosha (src/core/gunamilan.js).
// Includes the classic identical-Moon sanity result (28/36 with Nadi dosha)
// and a fully hand-derived mixed case. Pure — no ephemeris.
// Run: node tests/gunamilan.test.mjs

let failures = 0
function assert(cond, msg) {
  if (cond) { console.log('  ✓', msg) }
  else { failures++; console.error('  ✗ FAIL:', msg) }
}

const { calcGunaMilan, calcMangalDosha, mangalDoshaMatch } =
  await import('../src/core/gunamilan.js')

// Moon longitude helpers: middle of a nakshatra (index 0-26)
const nakMid = i => i * (360 / 27) + 360 / 54

console.log('\n[identical Moons — the classic 28/36]')
{
  // Same nakshatra & sign: every koota scores full EXCEPT Nadi (same nadi → 0)
  // and Varna/Vashya… actually Varna 1, Vashya 2, Tara 3, Yoni 4, Maitri 5,
  // Gana 6, Bhakoota 7, Nadi 0 → 28. A well-known result.
  const m = calcGunaMilan({ moonLon: nakMid(3) }, { moonLon: nakMid(3) }) // Rohini/Rohini
  assert(m.total === 28, `identical Moons score 28 (got ${m.total})`)
  const byKey = Object.fromEntries(m.kootas.map(k => [k.key, k.points]))
  assert(byKey.nadi === 0 && byKey.bhakoota === 7 && byKey.gana === 6 && byKey.maitri === 5,
    'only Nadi fails for identical Moons')
  assert(m.verdict === 'Very good match', `verdict band (got "${m.verdict}")`)
}

console.log('\n[hand-derived mixed case — girl Magha, boy Rohini]')
{
  // Girl: Magha (nak 9, Leo). Boy: Rohini (nak 3, Taurus).
  //  Varna: Leo=Kshatriya > Taurus=Vaishya (boy lower) → 0
  //  Vashya: boy Chatushpada × girl Vanachara → 1.5
  //  Tara: girl→boy count 22 (r4 ok), boy→girl count 7 (r7 Vadha) → 1.5
  //  Yoni: Serpent (boy row) × Rat (girl) → 1
  //  Maitri: Sun (girl) vs Venus (boy) — mutual enemies → 0
  //  Gana: girl Rakshasa × boy Manushya → 0
  //  Bhakoota: Leo↔Taurus = 10/4 → auspicious → 7
  //  Nadi: Antya vs Antya → 0
  //  Total: 11
  const m = calcGunaMilan({ moonLon: nakMid(9) }, { moonLon: nakMid(3) })
  const byKey = Object.fromEntries(m.kootas.map(k => [k.key, k.points]))
  assert(byKey.varna === 0,    'Varna: boy below girl → 0')
  assert(byKey.vashya === 1.5, `Vashya Chatushpada×Vanachara → 1.5 (got ${byKey.vashya})`)
  assert(byKey.tara === 1.5,   `Tara one-way affliction → 1.5 (got ${byKey.tara})`)
  assert(byKey.yoni === 1,     `Yoni Serpent×Rat → 1 (got ${byKey.yoni})`)
  assert(byKey.maitri === 0,   'Maitri Sun×Venus mutual enemies → 0')
  assert(byKey.gana === 0,     'Gana Rakshasa girl × Manushya boy → 0')
  assert(byKey.bhakoota === 7, 'Bhakoota 4/10 → 7')
  assert(byKey.nadi === 0,     'Nadi both Antya → 0')
  assert(m.total === 11 && m.verdict === 'Not recommended (below 18)',
    `total 11, not recommended (got ${m.total})`)
}

console.log('\n[koota table spot checks]')
{
  // Yoni sworn enemies → 0: Cow (U.Phalguni, nak 11) × Tiger (Chitra, nak 13)
  const y = calcGunaMilan({ moonLon: nakMid(11) }, { moonLon: nakMid(13) })
  assert(y.kootas.find(k => k.key === 'yoni').points === 0, 'Cow × Tiger yoni → 0')

  // Gana asymmetry: girl Deva + boy Manushya → 6, girl Manushya + boy Deva → 5
  const g1 = calcGunaMilan({ moonLon: nakMid(0) }, { moonLon: nakMid(1) })  // Ashwini girl (Deva), Bharani boy (Manushya)
  const g2 = calcGunaMilan({ moonLon: nakMid(1) }, { moonLon: nakMid(0) })
  assert(g1.kootas.find(k => k.key === 'gana').points === 6, 'girl Deva × boy Manushya → 6')
  assert(g2.kootas.find(k => k.key === 'gana').points === 5, 'girl Manushya × boy Deva → 5')

  // Bhakoota shadashtaka (6/8): Aries ↔ Virgo
  const bh = calcGunaMilan({ moonLon: 5 }, { moonLon: 155 })
  assert(bh.kootas.find(k => k.key === 'bhakoota').points === 0, 'Aries↔Virgo 6/8 → 0')

  // Vashya half-sign: early Sagittarius Moon is Manava, late is Chatushpada
  const early = calcGunaMilan({ moonLon: 245 }, { moonLon: 245 })  // 5° Sg
  const late  = calcGunaMilan({ moonLon: 260 }, { moonLon: 260 })  // 20° Sg
  assert(early.kootas.find(k => k.key === 'vashya').girl === 'Manava',      'Sg first half → Manava')
  assert(late.kootas.find(k => k.key === 'vashya').girl === 'Chatushpada',  'Sg second half → Chatushpada')

  // Nadi different → 8: Ashwini (Adi) × Bharani (Madhya)
  assert(g1.kootas.find(k => k.key === 'nadi').points === 8, 'Adi × Madhya nadi → 8')
}

console.log('\n[Mangal dosha]')
{
  // Mars in the 7th from lagna, no relief in sight
  const planets1 = [
    { name: 'Mars',    sign: 7 },   // lagna 1 → 7th house
    { name: 'Moon',    sign: 2 },   // Mars 6th from Moon → clean from Moon
    { name: 'Jupiter', sign: 2 },   // aspects 6,8,10 — not 7
  ]
  const d1 = calcMangalDosha(planets1, 1)
  assert(d1.present && d1.effective, 'Mars in 7th from lagna → effective dosha')
  assert(d1.afflictions.length === 1 && d1.afflictions[0].from === 'Lagna', 'affliction from Lagna only')

  // Own-sign Mars in the 8th → present but cancelled
  const planets2 = [
    { name: 'Mars',    sign: 8 },   // Scorpio (own), 8th from lagna 1
    { name: 'Moon',    sign: 5 },   // Mars 4th from Moon → also afflicted
    { name: 'Jupiter', sign: 3 },
  ]
  const d2 = calcMangalDosha(planets2, 1)
  assert(d2.present && !d2.effective, 'own-sign Mars → dosha cancelled')
  assert(d2.cancellations.some(c => c.includes('own sign')), 'cancellation names own sign')
  assert(d2.afflictions.length === 2, 'checked from both Lagna and Moon')

  // Jupiter aspect cancellation: Mars in 4th (sign 4), Jupiter in 12th aspects 4/6/8
  const planets3 = [
    { name: 'Mars',    sign: 4 },
    { name: 'Moon',    sign: 3 },
    { name: 'Jupiter', sign: 12 },  // 5th aspect → sign 4
  ]
  const d3 = calcMangalDosha(planets3, 1)
  assert(d3.present && d3.cancellations.some(c => c.includes('Jupiter')), 'Jupiter aspect cancels')

  // No dosha: Mars in the 3rd from both lagna and Moon
  const d4 = calcMangalDosha([{ name: 'Mars', sign: 3 }, { name: 'Moon', sign: 1 }], 1)
  assert(!d4.present, 'Mars in 3rd from both → no dosha')

  // Match-level verdicts
  assert(mangalDoshaMatch(d1, d1).verdict === 'cancelled', 'both Manglik → cancelled')
  assert(mangalDoshaMatch(d1, d4).verdict === 'one-sided' && mangalDoshaMatch(d1, d4).afflictedSide === 'girl',
    'one-sided dosha names the side')
  assert(mangalDoshaMatch(d4, d4).verdict === 'clear', 'neither → clear')
}

console.log(failures === 0 ? '\nALL GUNA MILAN TESTS PASSED' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
