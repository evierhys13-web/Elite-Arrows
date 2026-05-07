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
          </div>
          <button className="btn btn-secondary btn-sm glass" onClick={handleRefresh}>
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
        scrollbarWidth: 'none'
      }}>
        {divisions.map(div => (
          <button
            key={div}
            className={`division-tab ${activeDivision === div ? 'active' : ''}`}
            onClick={() => setActiveDivision(div)}
            style={{
              whiteSpace: 'nowrap',
              borderBottom: activeDivision === div ? `3px solid ${DIVISION_COLORS[div]}` : '3px solid transparent',
              color: activeDivision === div ? DIVISION_COLORS[div] : 'var(--text-muted)'
            }}
          >
            {div}
          </button>
        ))}
      </div>

      <div className="card glass" style={{ padding: '0', borderRadius: '12px', overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase' }}>
                <th style={{ width: '35px', padding: '12px 4px', textAlign: 'center' }}>#</th>
                <th style={{ textAlign: 'left', padding: '12px 8px' }}>Player</th>
                {activeDivision === 'Overall' && <th className="hide-mobile" style={{ width: '80px', textAlign: 'left' }}>Div</th>}
                <th style={{ width: '30px', padding: '12px 2px', textAlign: 'center' }}>P</th>
                <th className="hide-mobile" style={{ width: '30px', textAlign: 'center' }}>W</th>
                <th className="hide-mobile" style={{ width: '30px', textAlign: 'center' }}>D</th>
                <th className="hide-mobile" style={{ width: '30px', textAlign: 'center' }}>L</th>
                <th style={{ width: '40px', padding: '12px 2px', textAlign: 'center' }}>+/-</th>
                <th style={{ width: '45px', padding: '12px 2px', textAlign: 'center', color: 'var(--accent-cyan)' }}>Pts</th>
              </tr>
            </thead>
            <tbody>
              {playersInDivision.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No data</td>
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
                      fontSize: '0.85rem'
                    }}>
                      <td style={{ textAlign: 'center', fontWeight: '800', color: index === 0 ? '#fbbf24' : 'var(--text-muted)' }}>
                        {index + 1}
                      </td>
                      <td style={{ padding: '10px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: isMe ? '800' : '600', color: isMe ? 'white' : 'var(--text-primary)' }}>
                            {player.username}
                          </span>
                          {(isPromotion || isRelegation) && (
                            <span style={{ fontSize: '0.55rem', fontWeight: '900', color: isPromotion ? '#10b981' : '#ef4444' }}>
                              {isPromotion ? 'PRO' : 'REL'}
                            </span>
                          )}
                        </div>
                      </td>
                      {activeDivision === 'Overall' && (
                        <td className="hide-mobile" style={{ padding: '10px 4px' }}>
                          <span style={{ fontSize: '0.65rem', color: DIVISION_COLORS[player.displayDivision] }}>{player.displayDivision}</span>
                        </td>
                      )}
                      <td style={{ textAlign: 'center' }}>{player.stats.played}</td>
                      <td className="hide-mobile" style={{ textAlign: 'center' }}>{player.stats.wins}</td>
                      <td className="hide-mobile" style={{ textAlign: 'center' }}>{player.stats.draws}</td>
                      <td className="hide-mobile" style={{ textAlign: 'center' }}>{player.stats.losses}</td>
                      <td style={{
                        textAlign: 'center',
                        fontWeight: '700',
                        color: legDiff > 0 ? '#10b981' : legDiff < 0 ? '#ef4444' : 'var(--text-muted)'
                      }}>
                        {legDiff > 0 ? `+${legDiff}` : legDiff}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: '900', color: 'var(--accent-cyan)' }}>
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

      <style>{`
        @media (max-width: 600px) {
          .hide-mobile { display: none !important; }
          .table { font-size: 0.8rem !important; }
        }
      `}</style>

      <div style={{ marginTop: '20px', display: 'flex', gap: '15px', flexWrap: 'wrap', padding: '0 5px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#10b981' }} />
          <span>Promotion</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#ef4444' }} />
          <span>Relegation</span>
        </div>
      </div>
    </div>
  )
}
