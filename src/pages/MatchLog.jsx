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
  
  const targetUser = allUsers.find(u => String(u.id) === String(targetPlayerId)) || user || {}

  const leagueResults = useMemo(() => {
    if (!targetUser.id) return []
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
        const win = Number(r.score1) > Number(r.score2) ? (isPlayer1 ? true : false) : (Number(r.score2) > Number(r.score1) ? (isPlayer1 ? false : true) : null)

        let resultLabel = 'Draw'
        if (win === true) resultLabel = 'Win'
        if (win === false) resultLabel = 'Loss'

        return {
          id: r.id,
          opponentId: String(opponentId),
          opponent: opponentUser?.username || 'Unknown',
          opponentDivision: opponentUser?.division || '',
          result: resultLabel,
          score: isPlayer1 ? `${r.score1}-${r.score2}` : `${r.score2}-${r.score1}`,
          date: r.date,
          season: r.season
        }
      })
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  }, [allResults, allUsers, fixturesById, targetUser.id])

  const playedOpponentIds = useMemo(() => leagueResults.map(m => String(m.opponentId)), [leagueResults])
  
  const opponentsToPlay = useMemo(() => {
    if (!targetUser.id || !targetUser.division) return []
    return allUsers
      .filter(u => String(u.id) !== String(targetUser.id) && u.division === targetUser.division)
      .filter(p => !playedOpponentIds.includes(String(p.id)))
  }, [allUsers, targetUser.id, targetUser.division, playedOpponentIds])

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
            opponentsToPlay.map(player => (
              <div key={player.id} style={{
                padding: '16px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontWeight: '700' }}>{player.username}</span>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{player.division} Division</div>
                </div>
                <span style={{
                  color: 'var(--accent-cyan)',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  background: 'rgba(0, 212, 255, 0.1)',
                  padding: '4px 10px',
                  borderRadius: '20px'
                }}>Remaining</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
