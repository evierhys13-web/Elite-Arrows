import { useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { getResultPlayerId, isLeagueResult, isPlayoffResult } from '../utils/leagueResults'
import UserSearchSelect from '../components/UserSearchSelect'

export default function MatchLog() {
  const { user, getAllUsers, getFixtures, getResults } = useAuth()
  const [activeTab, setActiveTab] = useState('played')
  const [targetPlayerId, setTargetPlayerId] = useState(user.id)

  const allResults = getResults()
  const allUsers = getAllUsers()
  const fixtures = getFixtures()
  const fixturesById = Object.fromEntries(fixtures.map(fixture => [String(fixture.id), fixture]))
  
  const targetUser = allUsers.find(u => String(u.id) === String(targetPlayerId)) || user
  const currentSeason = adminData?.currentSeason || 'Season 1'

  const leagueResults = useMemo(() => {
    return allResults
      .filter(r => {
        const player1Id = getResultPlayerId(r, 1, allUsers)
        const player2Id = getResultPlayerId(r, 2, allUsers)
        return (
          String(r.status || '').toLowerCase() === 'approved' &&
          (isLeagueResult(r, fixturesById) || isPlayoffResult(r, fixturesById)) &&
          (String(player1Id) === String(targetUser.id) || String(player2Id) === String(targetUser.id))
        )
      })
      .map(r => {
        const player1Id = getResultPlayerId(r, 1, allUsers)
        const player2Id = getResultPlayerId(r, 2, allUsers)
        const isPlayer1 = String(player1Id) === String(targetUser.id)
        const opponentId = isPlayer1 ? player2Id : player1Id
        const opponentUser = allUsers.find(u => String(u.id) === String(opponentId))
        const win = isPlayer1 ? r.score1 > r.score2 : r.score2 > r.score1
        return {
          id: r.id,
          opponentId,
          opponent: opponentUser?.username || 'Unknown',
          opponentDivision: opponentUser?.division || '',
          result: win ? 'Win' : (r.score1 === r.score2 ? 'Draw' : 'Loss'),
          score: isPlayer1 ? `${r.score1}-${r.score2}` : `${r.score2}-${r.score1}`,
          date: r.date,
          season: r.season,
          gameType: r.gameType
        }
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [allResults, allUsers, fixturesById, targetUser.id])

  const playedLeagueOpponentIds = useMemo(() => {
    // Only count regular league matches for the CURRENT season
    return leagueResults
      .filter(r => {
        const isLeague = !String(r.gameType || '').toLowerCase().includes('playoff')
        const isThisSeason = !r.season || r.season === currentSeason
        return isLeague && isThisSeason
      })
      .map(m => String(m.opponentId))
  }, [leagueResults, currentSeason])
  
  const opponentsToPlay = useMemo(() => {
    // 1. Basic Round Robin (remaining divisional players for this season)
    const allDivisionPlayers = allUsers.filter(u => String(u.id) !== String(targetUser.id) && u.division === targetUser.division)
    const remainingDivisional = allDivisionPlayers
      .filter(p => !playedLeagueOpponentIds.includes(String(p.id)))
      .map(p => ({
        id: `rr-${p.id}`,
        opponentId: p.id,
        opponent: p.username,
        opponentDivision: p.division,
        type: 'League',
        status: 'unarranged',
        date: 'TBC'
      }))

    // 2. Explicit Fixtures (Playoffs, etc.) that aren't played yet
    const explicitFixtures = fixtures.filter(f => {
      const p1 = f.player1Id || f.player1
      const p2 = f.player2Id || f.player2
      const isPart = String(p1) === String(targetUser.id) || String(p2) === String(targetUser.id)
      const status = String(f.status).toLowerCase()
      const isUnplayed = ['pending', 'accepted', 'countered', 'result_submitted'].includes(status)
      const isLeagueOrPlayoff = ['league', 'playoff'].includes(String(f.gameType).toLowerCase())

      const hasApproved = allResults.some(r =>
        String(r.status).toLowerCase() === 'approved' &&
        (String(r.fixtureId) === String(f.id) || (f.cupId && r.cupId && String(r.cupId) === String(f.cupId) && String(r.matchId) === String(f.matchId)))
      )

      return isPart && isUnplayed && isLeagueOrPlayoff && !hasApproved
    }).map(f => {
      const p1 = f.player1Id || f.player1
      const p2 = f.player2Id || f.player2
      const opponentId = String(p1) === String(targetUser.id) ? p2 : p1
      const opponentUser = allUsers.find(u => String(u.id) === String(opponentId))
      return {
        id: f.id,
        opponentId,
        opponent: opponentUser?.username || f.player1Name || f.player2Name || 'Unknown',
        opponentDivision: opponentUser?.division || '',
        type: f.gameType,
        status: f.status,
        date: f.fixtureDate || f.date || 'TBC'
      }
    })

    // Deduplicate: if an explicit fixture exists for a RR opponent, prefer the fixture info
    // ALSO: if it's a playoff, it SHOULD appear even if already played in league
    const combined = [...explicitFixtures]
    remainingDivisional.forEach(rr => {
      if (!combined.some(c => String(c.opponentId) === String(rr.opponentId))) {
        combined.push(rr)
      }
    })

    return combined
  }, [allUsers, targetUser.id, playedLeagueOpponentIds, fixtures, allResults])

  return (
    <div className="page animate-fade-in">
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <h1 className="page-title text-gradient">Match Log</h1>
        <p style={{ color: 'var(--text-muted)' }}>Historical league performance and remaining fixtures</p>
      </div>

      <div className="card glass" style={{ marginBottom: '24px', padding: '16px' }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Viewing matches for:</label>
        <UserSearchSelect
          users={allUsers}
          selectedId={targetPlayerId}
          onSelect={setTargetPlayerId}
          label="Select Player"
        />
      </div>

      <div className="division-tabs" style={{ marginBottom: '20px' }}>
        <button 
          className={`division-tab ${activeTab === 'played' ? 'active' : ''}`}
          onClick={() => setActiveTab('played')}
        >
          Played ({leagueResults.length})
        </button>
        <button 
          className={`division-tab ${activeTab === 'toPlay' ? 'active' : ''}`}
          onClick={() => setActiveTab('toPlay')}
        >
          To Play ({opponentsToPlay.length})
        </button>
      </div>

      {activeTab === 'played' && (
        <div className="card glass" style={{ padding: '10px' }}>
          {leagueResults.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <p>No league games recorded for this player.</p>
            </div>
          ) : (
            leagueResults.map(match => (
              <div key={match.id} style={{
                padding: '16px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '1rem' }}>vs {match.opponent}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {match.season} • {match.date}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontWeight: '900',
                      color: match.result === 'Win' ? 'var(--success)' : (match.result === 'Draw' ? 'var(--warning)' : 'var(--error)')
                    }}
                  >
                    {match.result}
                  </div>
                  <div style={{ fontWeight: '700', fontSize: '1.1rem' }}>{match.score}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'toPlay' && (
        <div className="card glass" style={{ padding: '10px' }}>
          {opponentsToPlay.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: 'var(--success)', fontWeight: 700 }}>Season schedule complete!</p>
            </div>
          ) : (
            opponentsToPlay.map(match => (
              <div key={match.id} style={{
                padding: '16px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontWeight: '700' }}>{match.opponent}</span>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {match.type} {match.opponentDivision ? `(${match.opponentDivision})` : ''} • {match.date}
                  </div>
                </div>
                <span style={{
                  color: match.status === 'accepted' ? 'var(--success)' : 'var(--accent-cyan)',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  background: match.status === 'accepted' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0, 212, 255, 0.1)',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  border: `1px solid ${match.status === 'accepted' ? 'rgba(16, 185, 129, 0.3)' : 'transparent'}`
                }}>
                  {match.status === 'accepted' ? 'Confirmed' : 'Remaining'}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
