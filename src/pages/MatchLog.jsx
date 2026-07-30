import { useState, useMemo, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getResultPlayerId, isLeagueResult, isPlayoffResult, isSuperLeagueResult, isOpenLeagueResult, isOpenLeagueDoublesResult } from '../utils/leagueResults'
import UserSearchSelect from '../components/UserSearchSelect'
import { db, doc, setDoc, getDocs, collection } from '../firebase'
import { useToast } from '../context/ToastContext'

export default function MatchLog() {
  const { user, getAllUsers, getFixtures, getResults, adminData, getSeasons, bets, useTokens, triggerDataRefresh } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState('toPlay')
  const [competition, setCompetition] = useState('League') // 'League', 'Champions League', 'Open Singles', 'Open Doubles'
  const [targetPlayerId, setTargetPlayerId] = useState(user?.id)
  const [showBetForm, setShowBetForm] = useState(null)
  const [betAmount, setBetAmount] = useState(10)
  const [predictedWinner, setPredictedWinner] = useState('')
  const [predictedScore1, setPredictedScore1] = useState('')
  const [predictedScore2, setPredictedScore2] = useState('')

  const [openSinglesEntries, setOpenSinglesEntries] = useState([])
  const [openDuoEntries, setOpenDuoEntries] = useState([])

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

  const handlePlaceBet = async (opponent) => {
    if (!predictedWinner || predictedScore1 === '' || predictedScore2 === '') {
      showToast('Please fill in all prediction fields', 'error')
      return
    }

    const cost = parseInt(betAmount)
    if ((user?.eliteTokens || 0) < cost) {
      showToast('Not enough elite tokens!', 'error')
      return
    }

    // Identify if a fixture already exists for this match
    const existingFixture = fixtures.find(f =>
      !f._deleted &&
      String(f.gameType || '').toLowerCase() === (competition === 'League' ? 'league' : 'champions league') &&
      ((String(f.player1Id) === String(targetUser.id) && String(f.player2Id) === String(opponent.id)) ||
       (String(f.player1Id) === String(opponent.id) && String(f.player2Id) === String(targetUser.id)))
    )

    const gameId = existingFixture ? `fixture_${existingFixture.id}` : `fixture_${targetUser.id}_${opponent.id}`

    const hasBet = bets.some(b => b.userId === user.id && b.gameId === gameId)
    if (hasBet) {
      showToast('You have already bet on this game!', 'error')
      return
    }

    const success = await useTokens(cost)
    if (!success) return

    const betId = `bet_${Date.now()}`
    const player1Name = targetUser.username
    const player2Name = opponent.username
    const predictedWinnerName = String(predictedWinner) === String(targetUser.id) ? player1Name : player2Name

    const newBet = {
      id: betId,
      userId: user.id,
      username: user.username,
      gameId: gameId,
      fixtureId: existingFixture?.id || null,
      fixtureType: competition,
      fixturePlayer1Id: targetUser.id,
      fixturePlayer2Id: opponent.id,
      player1Name,
      player2Name,
      amount: cost,
      predictedWinner: predictedWinnerName,
      predictedWinnerId: predictedWinner,
      predictedScore1: parseInt(predictedScore1),
      predictedScore2: parseInt(predictedScore2),
      won: null,
      createdAt: new Date().toISOString(),
      season: currentSeasonName
    }

    try {
      await setDoc(doc(db, 'bets', betId), newBet)
      showToast('Bet placed! Good luck!', 'success')
      setShowBetForm(null)
      triggerDataRefresh('bets')
    } catch (e) {
      showToast('Error placing bet: ' + e.message, 'error')
    }
  }

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

  const competitionResults = useMemo(() => {
    if (!targetUser.id) return []
    return allResults
      .filter(r => {
        const isDoubles = isOpenLeagueDoublesResult(r)
        const p1Id = String(r.player1Id || '')
        const p2Id = String(r.player2Id || '')
        const p3Id = String(r.player3Id || '')
        const p4Id = String(r.player4Id || '')

        const isTargetMatch = isDoubles
          ? [p1Id, p2Id, p3Id, p4Id].includes(String(targetUser.id))
          : (p1Id === String(targetUser.id) || p2Id === String(targetUser.id))

        const isApproved = String(r.status || '').toLowerCase() === 'approved'

        // Robust season matching
        const resSeason = String(r.season || '').trim()
        const isSeasonMatch = resSeason === currentSeasonName || (!resSeason && currentSeasonName === 'Season 1')

        if (!isApproved || !isSeasonMatch || !isTargetMatch) return false

        if (competition === 'League') {
          return isLeagueResult(r, fixturesById) || isPlayoffResult(r, fixturesById)
        } else if (competition === 'Champions League') {
          return isSuperLeagueResult(r, fixturesById)
        } else if (competition === 'Cup') {
          return String(r.gameType || '').toLowerCase() === 'cup' || !!r.cupId
        } else if (competition === 'Open Singles') {
          return isOpenLeagueResult(r)
        } else if (competition === 'Open Doubles') {
          return isDoubles
        }
        return false
      })
      .map(r => {
        const isDoubles = isOpenLeagueDoublesResult(r)
        const p1Id = String(r.player1Id || '')
        const p2Id = String(r.player2Id || '')
        const p3Id = String(r.player3Id || '')
        const p4Id = String(r.player4Id || '')

        let isTeam1 = false
        let opponentName = ''
        let opponentId = ''

        if (isDoubles) {
          isTeam1 = (p1Id === String(targetUser.id) || p2Id === String(targetUser.id))
          opponentName = isTeam1 ? r.player2 : r.player1 // Using the display strings we now store correctly
          // In doubles, we use the display strings from player1/player2 which now represent teams
        } else {
          isTeam1 = p1Id === String(targetUser.id)
          opponentId = isTeam1 ? p2Id : p1Id
          const opponentUser = allUsers.find(u => String(u.id) === String(opponentId))
          opponentName = opponentUser?.username || (isTeam1 ? r.player2 : r.player1) || 'Unknown'
        }

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
  
  const getPlayoffOpponent = () => {
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
  }
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

    if (competition === 'League') {
      const divisionOpponents = targetUser.division && targetUser.division !== 'Unassigned'
        ? allUsers.map(u => {
            const sDiv = activeSeasonDoc?.stagedDivisions?.[String(u.id)]
            return { ...u, effectiveDiv: sDiv || u.division || 'Unassigned' }
          }).filter(u =>
            String(u.id) !== String(targetUser.id) &&
            u.effectiveDiv === targetUser.division &&
            !playedOpponentCounts[String(u.id)]
          )
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
        .filter(u =>
          String(u.id) !== String(targetUser.id) &&
          u.superLeagueDivision === slDivision
        )
        .map(u => {
          const playedCount = playedOpponentCounts[String(u.id)] || 0
          return { ...u, _playedCount: playedCount, _remaining: 2 - playedCount }
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
        .filter(u =>
          String(u.id) !== String(targetUser.id) &&
          openSinglesEntries.some(e => String(e.userId) === String(u.id)) &&
          !playedOpponentCounts[String(u.id)]
        )
    } else if (competition === 'Open Doubles') {
      const targetDuo = openDuoEntries.find(e => String(e.p1Id) === String(targetUser.id) || String(e.p2Id) === String(targetUser.id))
      if (!targetDuo) return []

      const targetDuoIds = [String(targetDuo.p1Id), String(targetDuo.p2Id)].sort()
      const targetDuoKey = targetDuoIds.join('_')

      // For doubles, playedOpponentCounts uses opponentId as a key.
      // But in OpenLeague results, we might want to track duo vs duo.
      // Actually, my isOpenLeagueDoublesResult filtering already gets the results.
      // I need to filter out duos already played.

      const playedDuoKeys = new Set()
      allResults
        .filter(r => isOpenLeagueDoublesResult(r) && r.status === 'approved')
        .forEach(r => {
          const duo1 = [String(r.player1Id), String(r.player2Id)].sort().join('_')
          const duo2 = [String(r.player3Id), String(r.player4Id)].sort().join('_')
          if (duo1 === targetDuoKey) playedDuoKeys.add(duo2)
          if (duo2 === targetDuoKey) playedDuoKeys.add(duo1)
        })

      return openDuoEntries
        .filter(d => {
          const ids = [String(d.p1Id), String(d.p2Id)].sort()
          const key = ids.join('_')
          return key !== targetDuoKey && !playedDuoKeys.has(key)
        })
        .map(d => {
          const u1 = allUsers.find(u => String(u.id) === String(d.p1Id))
          const u2 = allUsers.find(u => String(u.id) === String(d.p2Id))
          return {
            id: d.id,
            username: `${u1?.username || '?'} & ${u2?.username || '?'}`,
            _isDuo: true,
            p1Id: d.p1Id,
            p2Id: d.p2Id
          }
        })
    }
    return []
  }, [allUsers, targetUser.id, targetUser.division, targetUser.superLeagueDivision, playedOpponentCounts, playoffOpponent, playoffAlreadyPlayed, activeSeasonDoc, competition, openSinglesEntries, openDuoEntries, allResults])

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
          className={`btn btn-sm ${competition === 'Open Singles' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setCompetition('Open Singles')}
          style={{ borderRadius: '99px', minWidth: '120px' }}
        >
          Open Singles
        </button>
        <button
          className={`btn btn-sm ${competition === 'Open Doubles' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setCompetition('Open Doubles')}
          style={{ borderRadius: '99px', minWidth: '120px' }}
        >
          Open Doubles
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
                        {player._isCup ? `${player._cupName} - Round ${player._round}` : (competition === 'League' ? `${player.division} Division` : `${player.superLeagueDivision} Champions Rank`)}
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
                          if (competition === 'Open Singles') {
                            navigate(`/submit-result?opponent=${player.id}&gameType=Open League Singles&season=${currentSeasonName}`)
                          } else if (competition === 'Open Doubles') {
                            navigate(`/submit-result?opponent=${player.p1Id}&gameType=Open League Doubles&season=${currentSeasonName}`)
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

                    {!isMe && String(player.id) !== String(user?.id) && (
                      <button
                        className="btn btn-accent btn-sm"
                        style={{ padding: '6px 12px', fontSize: '0.75rem', background: 'var(--accent-primary)', color: '#000' }}
                        onClick={() => {
                          if (showBetForm === player.id) {
                            setShowBetForm(null)
                          } else {
                            setShowBetForm(player.id)
                            setPredictedWinner('')
                            setPredictedScore1('')
                            setPredictedScore2('')
                          }
                        }}
                      >
                        {showBetForm === player.id ? 'Cancel Bet' : 'Bet on Game'}
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

                {showBetForm === player.id && (
                  <div className="glass animate-fade-in" style={{
                    marginTop: '-4px',
                    marginBottom: '12px',
                    padding: '16px',
                    borderRadius: '0 0 12px 12px',
                    background: 'rgba(168, 85, 247, 0.05)',
                    border: '1px solid rgba(168, 85, 247, 0.2)',
                    borderTop: 'none'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--accent-primary)' }}>Place Your Bet</h4>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Balance: <span style={{ color: 'var(--accent-cyan)' }}>{user?.eliteTokens || 0} tokens</span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.7rem' }}>Bet Amount</label>
                        <select
                          value={betAmount}
                          onChange={(e) => setBetAmount(parseInt(e.target.value))}
                          style={{ padding: '8px', fontSize: '0.8rem' }}
                        >
                          <option value="10">10 Tokens</option>
                          <option value="20">20 Tokens</option>
                          <option value="50">50 Tokens</option>
                          <option value="100">100 Tokens</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.7rem' }}>Predict Winner</label>
                        <select
                          value={predictedWinner}
                          onChange={(e) => setPredictedWinner(e.target.value)}
                          style={{ padding: '8px', fontSize: '0.8rem' }}
                        >
                          <option value="">Select winner</option>
                          <option value={targetUser.id}>{targetUser.username}</option>
                          <option value={player.id}>{player.username}</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.7rem' }}>{targetUser.username} Score</label>
                        <input
                          type="number"
                          value={predictedScore1}
                          onChange={(e) => setPredictedScore1(e.target.value)}
                          placeholder="0"
                          min="0"
                          max="10"
                          style={{ padding: '8px', fontSize: '0.8rem' }}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.7rem' }}>{player.username} Score</label>
                        <input
                          type="number"
                          value={predictedScore2}
                          onChange={(e) => setPredictedScore2(e.target.value)}
                          placeholder="0"
                          min="0"
                          max="10"
                          style={{ padding: '8px', fontSize: '0.8rem' }}
                        />
                      </div>
                    </div>

                    <button
                      className="btn btn-primary btn-block"
                      style={{ padding: '10px', fontSize: '0.85rem' }}
                      onClick={() => handlePlaceBet(player)}
                    >
                      Confirm Bet ({betAmount} Tokens)
                    </button>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
                      Correct score predicts enter you into the Promotion Draw!
                    </p>
                  </div>
                )}
              </Fragment>

              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
