import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { derivePlayerStatsFromResults } from '../utils/playerStats'
import Breadcrumbs from '../components/Breadcrumbs'

const DIVISION_COLORS = {
  'Elite': '#f59e0b',
  'Diamond': '#0ea5e9',
  'Platinum': '#818cf8',
  'Gold': '#fbbf24',
  'Silver': '#94a3b8',
  'Bronze': '#b45309',
  'Development': '#10b981',
  'Overall': '#7c3aed'
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
        if (bLegDiff !== aLegDiff) return bLegDiff - aLegDiff
        return b.stats.legsWon - a.stats.legsWon
      })
  }, [activeDivision, allUsers, playerStats])

  const handleRefresh = () => {
    triggerDataRefresh('all')
    setRefreshKey(prev => prev + 1)
  }

  return (
    <div className="page animate-fade-in" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'League Table', path: '/table' }]} />

      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title text-gradient" style={{ fontSize: '2.5rem' }}>League Standings</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Professional Darts League Division Rankings</p>
          </div>
          <button className="btn btn-secondary btn-sm glass" onClick={handleRefresh}>
            🔄 Sync Live Data
          </button>
        </div>
      </div>

      <div className="division-tabs" style={{ marginBottom: '30px' }}>
        {divisions.map(div => (
          <button
            key={div}
            className={`division-tab ${activeDivision === div ? 'active' : ''}`}
            onClick={() => setActiveDivision(div)}
            style={{
              borderBottom: activeDivision === div ? `3px solid ${DIVISION_COLORS[div]}` : '3px solid transparent',
              color: activeDivision === div ? DIVISION_COLORS[div] : 'var(--text-muted)'
            }}
          >
            {div}
          </button>
        ))}
      </div>

      <div className="card glass" style={{ padding: '0', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '16px 12px', width: '60px', textAlign: 'center' }}>Pos</th>
                <th style={{ padding: '16px 12px', textAlign: 'left' }}>Player</th>
                {activeDivision === 'Overall' && <th style={{ padding: '16px 12px', textAlign: 'left' }}>Div</th>}
                <th style={{ padding: '16px 12px', textAlign: 'center', width: '50px' }}>P</th>
                <th style={{ padding: '16px 12px', textAlign: 'center', width: '50px' }}>W</th>
                <th style={{ padding: '16px 12px', textAlign: 'center', width: '50px' }}>D</th>
                <th style={{ padding: '16px 12px', textAlign: 'center', width: '50px' }}>L</th>
                <th style={{ padding: '16px 12px', textAlign: 'center', width: '60px' }}>+/-</th>
                <th style={{ padding: '16px 12px', textAlign: 'center', width: '80px', color: 'var(--accent-cyan)' }}>Pts</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: '0.95rem' }}>
              {playersInDivision.length === 0 ? (
                <tr>
                  <td colSpan={activeDivision === 'Overall' ? 9 : 8} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                    No data available for this division
                  </td>
                </tr>
              ) : (
                playersInDivision.map((player, index) => {
                  const legDiff = player.stats.legsWon - player.stats.legsLost
                  const isPromotion = index < 2 && activeDivision !== 'Overall'
                  const isRelegation = index >= playersInDivision.length - 2 && playersInDivision.length > 4 && activeDivision !== 'Overall'
                  const isMe = player.id === user?.id

                  return (
                    <tr key={player.id} style={{
                      background: isMe ? 'rgba(124, 92, 252, 0.1)' : 'transparent',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      transition: 'background 0.2s ease'
                    }}>
                      <td style={{
                        padding: '16px 12px',
                        textAlign: 'center',
                        fontWeight: '800',
                        color: index === 0 ? '#fbbf24' : index === 1 ? '#94a3b8' : index === 2 ? '#b45309' : 'var(--text-muted)'
                      }}>
                        {index + 1}
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {isMe && <div style={{ width: '4px', height: '24px', background: 'var(--accent-primary)', borderRadius: '2px' }} />}
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: isMe ? '800' : '600', color: isMe ? 'white' : 'var(--text-primary)' }}>
                              {player.username}
                            </span>
                            {(isPromotion || isRelegation) && (
                              <span style={{
                                fontSize: '0.6rem',
                                fontWeight: '900',
                                letterSpacing: '0.05em',
                                color: isPromotion ? '#10b981' : '#ef4444',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                marginTop: '2px'
                              }}>
                                {isPromotion ? '↑ PROMOTION ZONE' : '↓ RELEGATION ZONE'}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      {activeDivision === 'Overall' && (
                        <td style={{ padding: '16px 12px' }}>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: '800',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            background: `${DIVISION_COLORS[player.displayDivision]}22`,
                            color: DIVISION_COLORS[player.displayDivision],
                            border: `1px solid ${DIVISION_COLORS[player.displayDivision]}44`
                          }}>
                            {player.displayDivision}
                          </span>
                        </td>
                      )}
                      <td style={{ padding: '16px 12px', textAlign: 'center', fontWeight: '500' }}>{player.stats.played}</td>
                      <td style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--success)' }}>{player.stats.wins}</td>
                      <td style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>{player.stats.draws}</td>
                      <td style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--error)' }}>{player.stats.losses}</td>
                      <td style={{
                        padding: '16px 12px',
                        textAlign: 'center',
                        fontWeight: '700',
                        color: legDiff > 0 ? '#10b981' : legDiff < 0 ? '#ef4444' : 'var(--text-muted)'
                      }}>
                        {legDiff > 0 ? `+${legDiff}` : legDiff}
                      </td>
                      <td style={{
                        padding: '16px 12px',
                        textAlign: 'center',
                        fontWeight: '900',
                        fontSize: '1.1rem',
                        color: 'var(--accent-cyan)',
                        textShadow: '0 0 10px rgba(0, 212, 255, 0.3)'
                      }}>
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

      <div style={{ marginTop: '24px', display: 'flex', gap: '20px', flexWrap: 'wrap', padding: '0 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981' }} />
          <span>Top 2: Automatic Promotion</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444' }} />
          <span>Bottom 2: Relegation Playoff</span>
        </div>
      </div>
    </div>
  )
}
