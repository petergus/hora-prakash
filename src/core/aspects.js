export const PLANET_COLORS = {
  Su: '#f59e0b',
  Mo: '#6366f1',
  Ma: '#ef4444',
  Me: '#10b981',
  Ju: '#f97316',
  Ve: '#ec4899',
  Sa: '#64748b',
  Ra: '#7c3aed',
  Ke: '#0891b2',
}

// 0-based offsets: 7th house = 6, 4th = 3, 5th = 4, 8th = 7, 9th = 8, 3rd = 2, 10th = 9
const ASPECT_OFFSETS = {
  Su: [6],
  Mo: [6],
  Ma: [3, 6, 7],
  Me: [6],
  Ju: [4, 6, 8],
  Ve: [6],
  Sa: [2, 6, 9],
  Ra: [4, 6, 8],
  Ke: [4, 6, 8],
}

// Returns array of sign numbers (1–12) that planetAbbr aspects from planetSign
export function getAspectedSigns(planetSign, planetAbbr) {
  const offsets = ASPECT_OFFSETS[planetAbbr] ?? [6]
  return offsets.map(o => ((planetSign - 1 + o) % 12) + 1)
}
