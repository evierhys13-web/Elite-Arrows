import { useState, useMemo, Fragment, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContextInternal'
import { getResultPlayerId, isLeagueResult, isPlayoffResult, isSuperLeagueResult, isFriendlyLeagueResult } from '../utils/leagueResults'
import UserSearchSelect from '../components/UserSearchSelect'
import { db, doc, setDoc, getDocs, collection, deleteDoc, addDoc } from '../firebase'
import { useToast } from '../context/ToastContext'
import { ADMIN_EMAILS } from '../config'

export default function MatchLog() {
  const { user, getAllUsers, getFixtures, getResults, getCups, adminData, getSeasons, triggerDataRefresh, updateFixtures } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const isAdmin = user?.isAdmin || user?.isTournamentAdmin || user?.isCupAdmin || (user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()))

  const logAudit = async (action, details) => {
    try {
      await addDoc(collection(db, 'auditLogs'), {
        adminId: user.id,
        adminName: user.username,
        action,
        details,
        timestamp: new Date().toISOString()
      })
    } catch (e) { console.error('Audit log failed', e) }
  }
  const [activeTab, setActiveTab] = useState('toPlay')
  const [competition, setCompetition] = useState('League') // 'League', 'Champions League', 'Friendly Singles'
  const [targetPlayerId, setTargetPlayerId] = useState(user?.id)

  const [openSinglesEntries, setOpenSinglesEntries] = useState([])
  const [openDuoEntries, setOpenDuoEntries] = useState([])

  const cups = useMemo(() => {
    if (typeof getCups !== 'function') return []
    const data = getCups()
    return Array.isArray(data) ? data : []
  }, [getCups])

  useMemo(() => {
    const fetchData = async () => {
      try {
        const [sSnap, dSnap] = await Promise.all([
          getDocs(collection(db, 'openLeagueSingles')),
          getDocs(collection(db, 'openLeagueDuos'))
        ])
        setOpenSinglesEntries(sSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        setOpenDuoEntries(dSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (e) { console.error(e) }
    }
    fetchData()
  }, [])

  const allResults = getResults()
  const allUsers = getAllUsers()
  const fixtures = getFixtures()
  const seasons = getSeasons()
  const fixturesById = Object.fromEntries(fixtures.map(fixture => [String(fixture.id), fixture]))
  
  const currentSeasonName = adminData?.currentSeason || 'Season 1'
  const activeSeasonDoc = seasons.find(s => s.name === currentSeasonName)

  // Calculate effective user (with division for the active season)
  const targetRaw = allUsers.find(u => String(u.id) === String(targetPlayerId)) || user || {}
  const targetUser = useMemo(() => {
    if (!targetRaw.id) return {}
    const stagedDiv = activeSeasonDoc?.stagedDivisions?.[String(targetRaw.id)]
    return {
      ...targetRaw,
      division: stagedDiv || targetRaw.division || 'Unassigned'
    }
  }, [targetRaw, activeSeasonDoc])

  const isMe = String(targetUser.id) === String(user?.id)

  const handleRemoveFixture = async (fixtureId, opponentName) => {
    if (!window.confirm(`Are you sure you want to remove the scheduled game against ${opponentName}?`)) return
    try {
      await deleteDoc(doc(db, 'fixtures', String(fixtureId)))

      // Update local state
      const updatedFixtures = fixtures.filter(f => String(f.id) !== String(fixtureId))
      updateFixtures(updatedFixtures)

      await logAudit('REMOVE_FIXTURE_MATCHLOG', `Removed fixture ${fixtureId} between ${targetUser.username} and ${opponentName}`)
      showToast('Scheduled game removed', 'info')
      triggerDataRefresh('fixtures')
    } catch (e) {
      showToast('Error removing fixture: ' + e.message, 'error')
    }
  }

  const competitionResults = useMemo(() => {
    if (!targetUser.id) return []
    return allResults
      .filter(r => {
        const p1Id = String(r.player1Id || '')
        const p2Id = String(r.player2Id || '')

        const isTargetMatch = (p1Id === String(targetUser.id) || p2Id === String(targetUser.id))

        const isApproved = String(r.status || '').toLowerCase() === 'approved'

        // Robust season matching
        const resSeason = String(r.season || '').trim()
        const isSeasonMatch = resSeason === currentSeasonName || (!resSeason && currentSeasonName === 'Season 1')

        const isOpen = isFriendlyLeagueResult(r)

        if (!isApproved || (!isSeasonMatch && !isOpen) || !isTargetMatch) return false

        if (competition === 'League') {
          return isLeagueResult(r, fixturesById) || isPlayoffResult(r, fixturesById)
        } else if (competition === 'Champions League') {
          return isSuperLeagueResult(r, fixturesById)
        } else if (competition === 'Cup') {
          return String(r.gameType || '').toLowerCase() === 'cup' || !!r.cupId
        } else if (competition === 'Friendly Singles') {
          return isFriendlyLeagueResult(r)
        }
        return false
      })
      .map(r => {
        const p1Id = String(r.player1Id || '')
        const p2Id = String(r.player2Id || '')

        let isTeam1 = false
        let opponentName = ''
        let opponentId = ''

        isTeam1 = p1Id === String(targetUser.id)
        opponentId = isTeam1 ? p2Id : p1Id
        const opponentUser = allUsers.find(u => String(u.id) === String(opponentId))
        opponentName = opponentUser?.username || (isTeam1 ? r.player2 : r.player1) || 'Unknown'

        const win = Number(r.score1) > Number(r.score2) ? (isTeam1 ? true : false) : (Number(r.score2) > Number(r.score1) ? (isTeam1 ? false : true) : null)

        let resultLabel = 'Draw'
        if (win === true) resultLabel = 'Win'
        if (win === false) resultLabel = 'Loss'

        return {
          id: r.id,
          opponentId: String(opponentId),
          opponent: opponentName,
          result: resultLabel,
          score: isTeam1 ? `${r.score1}-${r.score2}` : `${r.score2}-${r.score1}`,
          date: r.date,
          season: r.season,
          gameType: r.gameType
        }
      })
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  }, [allResults, allUsers, fixturesById, targetUser.id, competition, currentSeasonName])

  const playedOpponentCounts = useMemo(() => {
    const counts = {}
    competitionResults.forEach(m => {
      const oid = String(m.opponentId)
      counts[oid] = (counts[oid] || 0) + 1
    })
    return counts
  }, [competitionResults])
  
  const getPlayoffOpponent = useCallback(() => {
    if (!targetUser.id || competition !== 'League') return null
    const allPlayoffs = fixtures.filter(f => {
      if (f._deleted) return false
      return String(f.gameType || '').toLowerCase() === 'playoff'
    })
    const playoff = allPlayoffs.find(f => {
      const status = (f.status || '').toLowerCase()
      const proposal = (f.proposalStatus || '').toLowerCase()
      if (status !== 'accepted' && proposal !== 'accepted') return false
      const p1 = String(f.player1Id || f.player1 || '')
      const p2 = String(f.player2Id || f.player2 || '')
      return p1 === String(targetUser.id) || p2 === String(targetUser.id)
    })
    if (!playoff) return null
    const p1 = String(playoff.player1Id || playoff.player1 || '')
    const p2 = String(playoff.player2Id || playoff.player2 || '')
    const opponentId = p1 === String(targetUser.id) ? p2 : p1
    const u = allUsers.find(u => String(u.id) === opponentId)
    return u ? { ...u, _playoff: true, _fixtureId: playoff.id } : null
  }, [targetUser.id, competition, fixtures, allUsers])

  const playoffOpponent = getPlayoffOpponent()

  const playoffAlreadyPlayed = useMemo(() => {
    if (!playoffOpponent) return false
    return allResults.some(r => {
      if (String(r.status || '').toLowerCase() !== 'approved') return false
      if (!r.fixtureId) return false
      return String(r.fixtureId) === String(playoffOpponent._fixtureId)
    })
  }, [allResults, playoffOpponent])

  const opponentsToPlay = useMemo(() => {
    if (!targetUser.id) return []

    // Specifically clear "To Play" list for Tom Beaumont in Season 4 as requested
    if (currentSeasonName === "Season 4" && (targetUser.username === "Tom Beaumont" || targetUser.name === "Tom Beaumont")) {
      return []
    }

    if (competition === 'League') {
      const divisionOpponents = targetUser.division && targetUser.division !== 'Unassigned'
        ? allUsers.map(u => {
            const sDiv = activeSeasonDoc?.stagedDivisions?.[String(u.id)]
            return { ...u, effectiveDiv: sDiv || u.division || 'Unassigned' }
          }).filter(u => {
            if (u.id === targetUser.id) return false;
            // Specifically remove Tom Beaumont from Season 4 as requested
            if (currentSeasonName === "Season 4" && (u.username === "Tom Beaumont" || u.name === "Tom Beaumont")) return false;

            return u.effectiveDiv === targetUser.division && !playedOpponentCounts[String(u.id)]
          })
          .map(u => {
            // Find existing fixture
            const fixture = fixtures.find(f =>
              !f._deleted &&
              String(f.gameType || '').toLowerCase() === 'league' &&
              ((String(f.player1Id) === String(targetUser.id) && String(f.player2Id) === String(u.id)) ||
               (String(f.player1Id) === String(u.id) && String(f.player2Id) === String(targetUser.id)))
            )
            return { ...u, _fixtureId: fixture?.id }
          })
        : []

      const seen = new Set()
      return [...divisionOpponents, ...(playoffOpponent && !playoffAlreadyPlayed ? [playoffOpponent] : [])].filter(u => {
        if (seen.has(String(u.id))) return false
        seen.add(String(u.id))
        return true
      })
    } else if (competition === 'Champions League') {
      // Champions League: play each opponent 2x
      const slDivision = targetUser.superLeagueDivision
      if (!slDivision) return []

      return allUsers
        .filter(u => {
          if (String(u.id) === String(targetUser.id)) return false;
          // Specifically remove Tom Beaumont from Season 4 as requested
          if (currentSeasonName === "Season 4" && (u.username === "Tom Beaumont" || u.name === "Tom Beaumont")) return false;

          return u.superLeagueDivision === slDivision;
        })
        .map(u => {
          const playedCount = playedOpponentCounts[String(u.id)] || 0
          const fixture = fixtures.find(f =>
            !f._deleted &&
            String(f.gameType || '').toLowerCase() === 'champions league' &&
            ((String(f.player1Id) === String(targetUser.id) && String(f.player2Id) === String(u.id)) ||
             (String(f.player1Id) === String(u.id) && String(f.player2Id) === String(targetUser.id)))
          )
          return { ...u, _playedCount: playedCount, _remaining: 2 - playedCount, _fixtureId: fixture?.id }
        })
        .filter(u => u._remaining > 0)
    } else if (competition === 'Cup') {
      // Cup logic: show active fixtures
      return fixtures
        .filter(f => {
          if (!f.cupId || f._deleted) return false
          const status = String(f.status).toLowerCase()
          if (['approved', 'result_submitted', 'completed'].includes(status)) return false
          return String(f.player1Id) === String(targetUser.id) || String(f.player2Id) === String(targetUser.id)
        })
        .map(f => {
          const opponentId = String(f.player1Id) === String(targetUser.id) ? f.player2Id : f.player1Id
          const opponent = allUsers.find(u => String(u.id) === String(opponentId))
          const cup = cups.find(c => String(c.id) === String(f.cupId))
          return {
            ...opponent,
            id: opponent?.id || opponentId,
            username: opponent?.username || 'Unknown',
            _isCup: true,
            _cupName: cup?.name || f.cupName || 'Cup',
            _round: f.round,
            _fixtureId: f.id
          }
        })
    } else if (competition === 'Open Singles') {
      const isInOpenSingles = openSinglesEntries.some(e => String(e.userId) === String(targetUser.id))
      if (!isInOpenSingles) return []

      return allUsers
        .filter(u => {
          if (String(u.id) === String(targetUser.id)) return false;
          // Specifically remove Tom Beaumont from Season 4 as requested
          if (currentSeasonName === "Season 4" && (u.username === "Tom Beaumont" || u.name === "Tom Beaumont")) return false;

          return openSinglesEntries.some(e => String(e.userId) === String(u.id)) && !playedOpponentCounts[String(u.id)];
        })
        .map(u => {
          const fixture = fixtures.find(f =>
            !f._deleted &&
            String(f.gameType || '').toLowerCase().includes('friendly league singles') &&
            ((String(f.player1Id) === String(targetUser.id) && String(f.player2Id) === String(u.id)) ||
             (String(f.player1Id) === String(u.id) && String(f.player2Id) === String(targetUser.id)))
          )
          return { ...u, _fixtureId: fixture?.id }
        })
    }
    return []
  }, [allUsers, targetUser.id, targetUser.division, targetUser.superLeagueDivision, playedOpponentCounts, playoffOpponent, playoffAlreadyPlayed, activeSeasonDoc, competition, openSinglesEntries, allResults])

  return (
    <div className="page animate-fade-in">
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <h1 className="page-title text-gradient">Match Log</h1>
        <p style={{ color: 'var(--text-muted)' }}>Track progress and remaining fixtures for {currentSeasonName}</p>
      </div>

      <div className="card glass" style={{ marginBottom: '24px', padding: '16px' }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Viewing schedule for:</label>
        <UserSearchSelect
          users={allUsers}
          selectedId={targetPlayerId}
          onSelect={setTargetPlayerId}
          label="Select Player"
        />
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
        <button
          className={`btn btn-sm ${competition === 'League' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setCompetition('League')}
          style={{ borderRadius: '99px', minWidth: '120px' }}
        >
          Standard League
        </button>
        <button
          className={`btn btn-sm ${competition === 'Champions League' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setCompetition('Champions League')}
          style={{ borderRadius: '99px', minWidth: '120px' }}
        >
          Champions League
        </button>
        <button
          className={`btn btn-sm ${competition === 'Cup' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setCompetition('Cup')}
          style={{ borderRadius: '99px', minWidth: '120px' }}
        >
          Cups
        </button>
        <button
          className={`btn btn-sm ${competition === 'Friendly Singles' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setCompetition('Friendly Singles')}
          style={{ borderRadius: '99px', minWidth: '120px' }}
        >
          Friendly Singles
        </button>
      </div>

      <div className="division-tabs" style={{ marginBottom: '20px' }}>
        <button 
          className={`division-tab ${activeTab === 'played' ? 'active' : ''}`}
          onClick={() => setActiveTab('played')}
        >
          Played ({competitionResults.length})
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
          {competitionResults.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <p>No {competition} games recorded for this player.</p>
            </div>
          ) : (
            competitionResults.map(match => (
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
                    {match.season} • {match.date} {competition === 'Champions League' ? `(CL)` : ''}
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
              <p style={{ color: 'var(--success)', fontWeight: 700 }}>{competition} schedule complete!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {opponentsToPlay.map(player => (
                <Fragment key={player.id}>
                  <div className="glass" style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'rgba(255,255,255,0.02)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="avatar-ring" style={{ width: '40px', height: '40px', padding: '2px' }}>
                      <div className="avatar-inner" style={{ background: '#050816', fontSize: '0.9rem' }}>
                        {player.profilePicture ? (
                          <img src={player.profilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span>{player.username.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{player.username}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {player._isCup
                          ? `${player._cupName} - Round ${player._round}`
                          : (competition === 'League'
                              ? `${player.division} Division`
                              : (competition === 'Champions League'
                                  ? `${player.superLeagueDivision} Champions Rank`
                                  : 'Friendly League'))}
                      </div>
                      {competition === 'Champions League' && (
                        <div style={{ fontSize: '0.65rem', color: 'var(--accent-cyan)' }}>
                          Played: {player._playedCount}/2
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {isMe && (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                        onClick={() => {
                          if (competition === 'Friendly Singles') {
                            navigate(`/submit-result?opponent=${player.id}&gameType=Friendly League Singles&season=${currentSeasonName}`)
                          } else if (competition === 'Cup') {
                            navigate(`/submit-result?fixtureId=${player._fixtureId}&gameType=Cup&season=${currentSeasonName}`)
                          } else {
                            navigate(`/submit-result?opponent=${player.id}&gameType=${player._playoff ? 'Playoff' : competition}&season=${currentSeasonName}`)
                          }
                        }}
                      >
                        Submit Score
                      </button>
                    )}

                    {isAdmin && player._fixtureId && (
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFixture(player._fixtureId, player.username);
                        }}
                      >
                        🗑️ Remove Schedule
                      </button>
                    )}

                    <span style={{
                      color: player._playoff ? 'var(--warning)' : 'var(--accent-cyan)',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      background: player._playoff ? 'rgba(245, 158, 11, 0.1)' : 'rgba(0, 212, 255, 0.05)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: `1px solid ${player._playoff ? 'rgba(245, 158, 11, 0.2)' : 'rgba(0, 212, 255, 0.2)'}`
                    }}>{player._playoff ? 'Playoff' : (player._isCup ? 'Cup' : competition)}</span>
                  </div>
                </div>

              </Fragment>

              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
