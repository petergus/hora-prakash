#!/usr/bin/env python3
"""
Verify hora-prakash Ashtakavarga against PyJHora.
Uses Chart A's birth chart: 1990-07-26, 08:30, Location A (29N25, 80E06), IST +5:30
"""
import sys
sys.path.insert(0, '/Users/priyankgahtori/Code/PyJhora/src')

from jhora.panchanga import drik
from jhora.horoscope.chart import charts, ashtakavarga
from jhora import utils, const

# ── Birth data ────────────────────────────────────────────────────────────────
dob   = drik.Date(1990, 7, 26)
tob   = (8, 30, 0)
place = drik.Place('Location A', 29.417, 80.1, 5.5)

jd = utils.julian_day_number(dob, tob)

# ── Get chart ─────────────────────────────────────────────────────────────────
pp = charts.divisional_chart(jd, place, divisional_chart_factor=1, chart_method=1)
house_to_planet_list = utils.get_house_planet_list_from_planet_positions(pp)

print("House→planet list (Ar=0..Pi=11):")
for i, h in enumerate(house_to_planet_list):
    sign_names = ['Ar','Ta','Ge','Ca','Le','Vi','Li','Sc','Sg','Cp','Aq','Pi']
    if h.strip():
        print(f"  {sign_names[i]}: {h}")

# ── Ashtakavarga ─────────────────────────────────────────────────────────────
bav, sav, pav = ashtakavarga.get_ashtaka_varga(house_to_planet_list)

planet_names = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Lagna']
sign_abbr    = ['Ar','Ta','Ge','Ca','Le','Vi','Li','Sc','Sg','Cp','Aq','Pi']

print("\n=== Bhinnashtakavarga (PyJHora) ===")
print(f"{'Planet':<10} " + " ".join(f"{s:>3}" for s in sign_abbr) + "  Total")
for i, pname in enumerate(planet_names):
    row = bav[i]
    print(f"{pname:<10} " + " ".join(f"{v:>3}" for v in row) + f"  {sum(row):>3}")

print("\n=== Sarvashtakavarga (PyJHora, Sun..Saturn only) ===")
print(f"{'Sarva':<10} " + " ".join(f"{v:>3}" for v in sav) + f"  {sum(sav):>3}")

# ── Expected from hora-prakash JS (manually computed or pasted from browser) ─
# Chart A chart planet signs (1-indexed, from Chart A.md):
# Sun=4(Ca), Moon=5(Le), Mars=1(Ar), Mercury=5(Le), Jupiter=4(Ca),
# Venus=3(Ge), Saturn=9(Sg), Lagna=5(Le)
print("\n=== Planet signs used (for cross-check) ===")
p_to_h = utils.get_planet_to_house_dict_from_chart(house_to_planet_list)
planet_id_names = {0:'Sun',1:'Moon',2:'Mars',3:'Mercury',4:'Jupiter',5:'Venus',6:'Saturn','L':'Lagna'}
for pid, pname in planet_id_names.items():
    sign0 = p_to_h.get(pid if pid != 'L' else const._ascendant_symbol, None)
    if sign0 is not None:
        print(f"  {pname}: sign {sign0+1} ({sign_abbr[sign0]})")
