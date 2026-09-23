const CUP_ELIGIBILITY_MIN = 0.75
const SEASON_IDS = ['player1Id', 'player1', 'player2Id', 'player2']

const getPlayerIdFromResult = (r) => {
  if (r.player1Id) return String(r.player1Id)
  if (r.player1) return String(r.player1)
  return ''
}

export function isFirstSeason(user, results, season) {
  if (!user?.id) return false
  if (!season || season === 'Season 1' || season === 'Overall') return false
  if (!Array.isArray(results)) return false
  return !results.some(r => {
    if (r.season === season) return false
    const p1 = String(getPlayerIdFromResult(r))
    return p1 === String(user.id) || String(r.player2Id || r.player2) === String(user.id)
  })
}

export function getCupEligibility(user, results, fixtures, season) {
  const fallback = { played: 0, total: 0, ratio: 0, firstSeason: false, eligible: false, reason: '' }
  if (!user?.id) return fallback

  const firstSeason = isFirstSeason(user, results, season)
  const uid = String(user.id)

  const seasonFixtures = (Array.isArray(fixtures) ? fixtures : []).filter(f => {
    if (f.season && String(f.season) !== String(season)) return false
    const isParticipant = [f.player1Id, f.player2Id, f.player1, f.player2].some(p => String(p) === uid)
    if (!isParticipant) return false
    const status = String(f.status || '')
    if (['declined', 'cancelled', 'countered', 'pending'].includes(status)) return false
    return true
  })

  const playedFixtureIds = new Set(seasonFixtures
    .filter(f => f.status === 'result_submitted' || f.resultId)
    .map(f => String(f.id)))

  const playedFromResults = new Set((Array.isArray(results) ? results : []).filter(r => {
    if (String(r.season) !== String(season)) return false
    if (String(r.status) !== 'approved') return false
    if (r.excludeFromLeague) return false
    const isPlayer = String(getPlayerIdFromResult(r)) === uid || String(r.player2Id || r.player2) === uid
    if (!isPlayer) return false
    if (r.fixtureId && playedFixtureIds.has(String(r.fixtureId))) return false
    return true
  }).map(r => String(r.id)))

  const total = seasonFixtures.length
  const played = new Set([...playedFixtureIds, ...playedFromResults]).size
  const ratio = total > 0 ? Math.min(1, played / total) : 1

  const eligible = !firstSeason || ratio >= CUP_ELIGIBILITY_MIN
  const reason = !firstSeason
    ? ''
    : total === 0
      ? `Play ${Math.round(played)} of ${total} fixtures (${Math.round(ratio * 100)}%) - need 75% for cup eligibility`
      : `Played ${played}/${total} league fixtures (${Math.round(ratio * 100)}%). New members need 75% to enter cups/tournaments`

  return { played, total, ratio, firstSeason, eligible, reason }
}