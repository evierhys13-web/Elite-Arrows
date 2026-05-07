import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { derivePlayerStatsFromResults } from '../utils/playerStats'
import Breadcrumbs from '../components/Breadcrumbs'

const DIVISION_EMOJIS = {
  'Elite': '👑',
  'Diamond': '💎',
  'Platinum': '💠',
  'Gold': '🥇',
  'Silver': '🥈',
  'Bronze': '🥉',
  'Development': '🌱',
  'Overall': '🏆'
}

export default function Table() {
  const [activeDivision, setActiveDivision] = useState('Overall')
  const { user, getAllUsers, getFixtures, getResults, triggerDataRefresh, dataRefreshTrigger, adminData } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)

  const divisions = ['Overall', 'Elite', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze', 'Development']

  useEffect(() => {
    setRefreshKey(prev => prev + 1)
  }, [dataRefreshTrigger])

  const allUsers = getAllUsers()
  const fixtures = getFixtures()
  const results = getResults()

  const playerStats = useMemo(() => {
    return derivePlayerStatsFromResults(allUsers, results, {
      fixtures,
      adminData,
      leagueOnly: true
    })
  }, [allUsers, results, fixtures, adminData, refreshKey])

  const playersInDivision = useMemo(() => {
    const source = activeDivision === 'Overall'
      ? allUsers
      : allUsers.filter(u => u.division === activeDivision)

    return source
      .map(p => ({
        ...p,
        displayDivision: p.division || 'Unassigned',
        stats: playerStats[String(p.id)] || { played: 0, wins: 0, draws: 0, losses: 0, legsWon: 0, legsLost: 0, points: 0 }
      }))
      .sort((a, b) => {
        if (b.stats.points !== a.stats.points) return b.stats.points - a.stats.points
        const aLegDiff = a.stats.legsWon - a.stats.legsLost
        const bLegDiff = b.stats.legsWon - b.stats.legsLost
        return bLegDiff - aLegDiff
      })
  }, [activeDivision, allUsers, playerStats])

  const handleRefresh = () => {
    triggerDataRefresh('all')
    setRefreshKey(prev => prev + 1)
  }

  return (
    <div className="page animate-fade-in">
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'League Table', path: '/table' }]} />

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title text-gradient">League Table</h1>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleRefresh}>
          🔄 Sync Data
        </button>
      </div>

      <div className="division-tabs">
        {divisions.map(div => (
          <button
            key={div}
            className={`division-tab ${activeDivision === div ? 'active' : ''}`}
            onClick={() => setActiveDivision(div)}
          >
            <span style={{ marginRight: '6px' }}>{DIVISION_EMOJIS[div]}</span>
            {div}
          </button>
        ))}
      </div>

      <div className="card glass" style={{ padding: '0' }}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '50px', textAlign: 'center' }}>#</th>
                <th>Player</th>
                {activeDivision === 'Overall' && <th>Div</th>}
                <th style={{ textAlign: 'center' }}>P</th>
                <th style={{ textAlign: 'center' }}>W</th>
                <th style={{ textAlign: 'center' }}>D</th>
                <th style={{ textAlign: 'center' }}>L</th>
                <th style={{ textAlign: 'center' }}>+/-</th>
                <th style={{ textAlign: 'center' }}>Pts</th>
              </tr>
            </thead>
            <tbody>
              {playersInDivision.length === 0 ? (
                <tr>
                  <td colSpan={activeDivision === 'Overall' ? 9 : 8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No players in this division yet
                  </td>
                </tr>
              ) : (
                playersInDivision.map((player, index) => {
                  const legDiff = player.stats.legsWon - player.stats.legsLost
                  const isPromotion = index < 2 && activeDivision !== 'Overall'
                  const isRelegation = index >= playersInDivision.length - 2 && playersInDivision.length > 4 && activeDivision !== 'Overall'

                  return (
                    <tr key={player.id} style={{
                      background: player.id === user.id ? 'var(--bg-hover)' : 'transparent',
                    }}>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{index + 1}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: '600' }}>{player.username}</span>
                          {(isPromotion || isRelegation) && (
                            <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: isPromotion ? 'var(--success)' : 'var(--error)' }}>
                              {isPromotion ? 'PROMOTION ↑' : 'RELEGATION ↓'}
                            </span>
                          )}
                        </div>
                      </td>
                      {activeDivision === 'Overall' && (
                        <td style={{ textAlign: 'center' }}>{DIVISION_EMOJIS[player.displayDivision]}</td>
                      )}
                      <td style={{ textAlign: 'center' }}>{player.stats.played}</td>
                      <td style={{ textAlign: 'center' }}>{player.stats.wins}</td>
                      <td style={{ textAlign: 'center' }}>{player.stats.draws}</td>
                      <td style={{ textAlign: 'center' }}>{player.stats.losses}</td>
                      <td style={{ textAlign: 'center', color: legDiff >= 0 ? 'var(--success)' : 'var(--error)', fontWeight: 'bold' }}>
                        {legDiff > 0 ? `+${legDiff}` : legDiff}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
                        {player.stats.points}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
