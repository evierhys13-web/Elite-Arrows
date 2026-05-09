import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { derivePlayerStatsFromResults } from '../utils/playerStats'
import Breadcrumbs from '../components/Breadcrumbs'

const DIVISION_COLORS = {
  'Elite': '#fbbf24',
  'Diamond': '#38bdf8',
  'Platinum': '#818cf8',
  'Gold': '#fcd34d',
  'Silver': '#cbd5e1',
  'Bronze': '#d97706',
  'Development': '#4ade80',
  'Overall': '#818cf8'
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
      leagueOnly: true,
      currentSeason: adminData?.currentSeason || 'Season 1'
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
    <div className="page animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'League Table', path: '/table' }]} />

      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title text-gradient" style={{ fontSize: '2.2rem' }}>League Standings</h1>
          </div>
          <button className="btn btn-secondary btn-sm glass" onClick={handleRefresh} style={{ padding: '8px 12px' }}>
            🔄 Sync
          </button>
        </div>
      </div>

      <div className="division-tabs" style={{
        display: 'flex',
        overflowX: 'auto',
        gap: '8px',
        marginBottom: '20px',
        paddingBottom: '8px',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        {divisions.map(div => (
          <button
            key={div}
            className={`division-tab ${activeDivision === div ? 'active' : ''}`}
            onClick={() => setActiveDivision(div)}
            style={{
              whiteSpace: 'nowrap',
              padding: '10px 16px',
              fontSize: '0.85rem',
              borderBottom: activeDivision === div ? `3px solid ${DIVISION_COLORS[div]}` : '3px solid transparent',
              color: activeDivision === div ? 'white' : 'rgba(255,255,255,0.6)',
              background: activeDivision === div ? 'rgba(255,255,255,0.1)' : 'transparent'
            }}
          >
            {div}
          </button>
        ))}
      </div>

      <div className="card glass" style={{ padding: '0', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.3)', color: 'rgba(255,255,255,0.7)', fontSize: '0.6rem', textTransform: 'uppercase' }}>
                <th style={{ width: '28px', padding: '12px 2px', textAlign: 'center' }}>#</th>
                <th style={{ textAlign: 'left', padding: '12px 4px' }}>Player</th>
                <th style={{ width: '22px', padding: '12px 2px', textAlign: 'center' }}>P</th>
                <th style={{ width: '22px', padding: '12px 2px', textAlign: 'center' }}>W</th>
                <th style={{ width: '22px', padding: '12px 2px', textAlign: 'center' }}>D</th>
                <th style={{ width: '22px', padding: '12px 2px', textAlign: 'center' }}>L</th>
                <th style={{ width: '30px', padding: '12px 2px', textAlign: 'center' }}>+/-</th>
                <th style={{ width: '35px', padding: '12px 2px', textAlign: 'center', color: 'var(--accent-cyan)' }}>Pts</th>
              </tr>
            </thead>
            <tbody>
              {playersInDivision.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No data</td>
                </tr>
              ) : (
                playersInDivision.map((player, index) => {
                  const legDiff = player.stats.legsWon - player.stats.legsLost
                  const isPromotion = index < 2 && activeDivision !== 'Overall'
                  const isRelegation = index >= playersInDivision.length - 2 && playersInDivision.length > 4 && activeDivision !== 'Overall'
                  const isMe = player.id === user?.id

                  return (
                    <tr key={player.id} style={{
                      background: isMe ? 'rgba(217, 70, 239, 0.15)' : 'transparent',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      fontSize: '0.8rem'
                    }}>
                      <td style={{ textAlign: 'center', fontWeight: '800', color: index === 0 ? '#fbbf24' : 'rgba(255,255,255,0.5)' }}>
                        {index + 1}
                      </td>
                      <td style={{ padding: '10px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: isMe ? '800' : '600', color: isMe ? 'white' : 'rgba(255,255,255,0.9)' }}>
                            {player.username}
                          </span>
                          {(isPromotion || isRelegation) && (
                            <span style={{ fontSize: '0.5rem', fontWeight: '900', color: isPromotion ? '#10b981' : '#ef4444', letterSpacing: '0.05em' }}>
                              {isPromotion ? 'PROMOTION' : 'RELEGATION'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 2px' }}>{player.stats.played}</td>
                      <td style={{ textAlign: 'center', padding: '10px 2px', color: 'rgba(255,255,255,0.6)' }}>{player.stats.wins}</td>
                      <td style={{ textAlign: 'center', padding: '10px 2px', color: 'rgba(255,255,255,0.6)' }}>{player.stats.draws}</td>
                      <td style={{ textAlign: 'center', padding: '10px 2px', color: 'rgba(255,255,255,0.6)' }}>{player.stats.losses}</td>
                      <td style={{
                        textAlign: 'center',
                        padding: '10px 2px',
                        fontWeight: '700',
                        color: legDiff > 0 ? '#10b981' : legDiff < 0 ? '#ef4444' : 'rgba(255,255,255,0.4)'
                      }}>
                        {legDiff > 0 ? `+${legDiff}` : legDiff}
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 2px', fontWeight: '900', color: 'var(--accent-cyan)', fontSize: '0.9rem' }}>
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

      <div style={{ marginTop: '20px', display: 'flex', gap: '15px', flexWrap: 'wrap', padding: '0 5px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#10b981' }} />
          <span>Automatic Promotion</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#ef4444' }} />
          <span>Relegation Zone</span>
        </div>
      </div>
    </div>
  )
}
