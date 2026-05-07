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

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title text-gradient">League Table</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Current standings for Season 1</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleRefresh}>
          🔄 Sync Standings
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

      <div className="card glass" style={{ padding: 0, overflow: 'hidden' }}>
        {playersInDivision.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No players registered in this division yet.
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
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
                {playersInDivision.map((player, index) => {
                  const legDiff = player.stats.legsWon - player.stats.legsLost
                  const isPromotion = index < 2 && activeDivision !== 'Overall'
                  const isRelegation = index >= playersInDivision.length - 2 && playersInDivision.length > 4 && activeDivision !== 'Overall'

                  return (
                    <tr key={player.id} style={{
                      background: player.id === user.id ? 'var(--bg-hover)' : 'transparent',
                    }}>
                      <td style={{ textAlign: 'center', fontWeight: 800, color: index < 3 ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                        {index + 1}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 900, color: 'white', overflow: 'hidden' }}>
                            {player.profilePicture ? (
                              <img src={player.profilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              (player.username || '?').charAt(0).toUpperCase()
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{player.username}</span>
                            {isPromotion && <span style={{ fontSize: '0.65rem', color: 'var(--success)', fontWeight: 800 }}>PROMOTION ZONE ↑</span>}
                            {isRelegation && <span style={{ fontSize: '0.65rem', color: 'var(--error)', fontWeight: 800 }}>RELEGATION ZONE ↓</span>}
                          </div>
                        </div>
                      </td>
                      {activeDivision === 'Overall' && (
                        <td style={{ fontSize: '1.1rem', textAlign: 'center' }}>
                          {DIVISION_EMOJIS[player.displayDivision] || '❓'}
                        </td>
                      )}
                      <td style={{ textAlign: 'center' }}>{player.stats.played}</td>
                      <td style={{ textAlign: 'center', color: 'var(--success)', fontWeight: 600 }}>{player.stats.wins}</td>
                      <td style={{ textAlign: 'center', color: 'var(--warning)', fontWeight: 600 }}>{player.stats.draws}</td>
                      <td style={{ textAlign: 'center', color: 'var(--error)', fontWeight: 600 }}>{player.stats.losses}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: legDiff > 0 ? 'var(--success)' : legDiff < 0 ? 'var(--error)' : 'var(--text-muted)' }}>
                        {legDiff > 0 ? `+${legDiff}` : legDiff}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ background: 'var(--bg-secondary)', padding: '4px 10px', borderRadius: '8px', fontWeight: 800, color: 'var(--accent-cyan)', border: '1px solid var(--border)' }}>
                          {player.stats.points}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: '24px', display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--success)' }}></div>
          Promotion Zone
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--error)' }}></div>
          Relegation Zone
        </div>
      </div>
    </div>
  )
}
