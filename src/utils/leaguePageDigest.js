import { db, doc, setDoc, serverTimestamp } from '../firebase'
import { computeDivisionStandings, LEAGUE_DIVISION_KEYS, LEAGUE_DIVISION_NAMES } from './leagueStandings'

// The public league pages cannot read the raw users/results/season docs (those
// are signed-in only and hold private data), so the app writes a small curated
// digest per league division that only contains display-safe standings rows.
// Writes are debounced and throttled so the shared write quota stays healthy.

const DIGEST_THROTTLE_MS = 8000
const DIGEST_INITIAL_WAIT_MS = 2000
let digestTimer = null
let lastDigestWrite = 0

const stripRow = (p) => ({
  id: p.id,
  username: p.username,
  nickname: p.nickname,
  name: p.name,
  division: p.division,
  profilePicture: p.profilePicture || '',
  played: p.stats.played || 0,
  wins: p.stats.wins || 0,
  draws: p.stats.draws || 0,
  losses: p.stats.losses || 0,
  points: p.stats.points || 0,
  legsWon: p.stats.legsWon || 0,
  legsLost: p.stats.legsLost || 0,
  legDiff: (p.stats.legsWon || 0) - (p.stats.legsLost || 0),
  average: p.stats.average || 0,
})

const writeLeagueDigest = async (payload) => {
  const res = await writeLeagueDigestNow(payload)
  if (!res.ok) console.warn('league page digest write failed:', res.error)
}

// Immediate (non-throttled) digest write used by the admin "Force Standings
// Sync" button. Returns a status so the UI can report success or failure
// instead of silently doing nothing.
export const writeLeagueDigestNow = async ({ allUsers, results, fixtures, adminData, seasons }) => {
  if (!adminData?.currentSeason) return { ok: false, error: 'No active season set' }
  if (!allUsers || allUsers.length === 0) return { ok: false, error: 'No player data loaded' }
  const seasonName = adminData.currentSeason
  const seasonDoc = (seasons || []).find((s) => s.name === seasonName)
  try {
    let rowCount = 0
    await Promise.all(LEAGUE_DIVISION_KEYS.map(async (key) => {
      const standings = computeDivisionStandings({
        allUsers,
        results,
        fixtures,
        adminData,
        seasonName,
        seasonDoc,
        division: LEAGUE_DIVISION_NAMES[key],
      })
      rowCount = standings.length
      await setDoc(doc(db, 'leaguePagesDigest', key), {
        leagueId: key,
        division: LEAGUE_DIVISION_NAMES[key],
        season: seasonName,
        updatedAt: serverTimestamp(),
        standings: standings.map(stripRow),
      })
    }))
    lastDigestWrite = Date.now()
    return { ok: true, leagues: LEAGUE_DIVISION_KEYS.length, rowCount, season: seasonName }
  } catch (e) {
    return { ok: false, error: e?.message || String(e) }
  }
}

export const scheduleLeagueDigestWrite = (payload) => {
  if (!payload?.adminData?.currentSeason) return
  if (digestTimer) clearTimeout(digestTimer)
  const wait = Math.max(0, lastDigestWrite + DIGEST_THROTTLE_MS - Date.now())
  digestTimer = setTimeout(() => writeLeagueDigest(payload), wait || DIGEST_INITIAL_WAIT_MS)
}