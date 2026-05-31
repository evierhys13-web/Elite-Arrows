import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { db, doc, getDoc, setDoc, query, collection, where, getDocs, writeBatch } from '../firebase'
import UserSearchSelect from '../components/UserSearchSelect'
import { useToast } from '../context/ToastContext'
import { ADMIN_EMAILS } from '../config'

export default function CupBracket() {
  const { cupId } = useParams()
  const { user, getAllUsers, getCups, getFixtures, getResults, dataRefreshTrigger, triggerDataRefresh } = useAuth()
  const { showToast } = useToast()
  const [cup, setCup] = useState(null)
  const [fixtures, setFixtures] = useState([])
  const [results, setResults] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)

  const [showSwapModal, setShowSwapModal] = useState(false)
  const [playerToRemove, setPlayerToRemove] = useState('')
  const [playerToAdd, setPlayerToAdd] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const allUsers = getAllUsers()

  const isEmailAdmin = ADMIN_EMAILS.includes(user?.email?.toLowerCase())
  const isDbAdmin = user?.isAdmin === true
  const isTournamentAdmin = user?.isTournamentAdmin === true
  const isCupAdmin = user?.isCupAdmin === true
  const isAdmin = isEmailAdmin || isDbAdmin || isTournamentAdmin || isCupAdmin

  useEffect(() => {
    const cups = getCups()
    const foundCup = cups.find(c => String(c.id) === String(cupId))
    if (foundCup) {
      setCup(foundCup)
    }
    
    const allFixtures = getFixtures()
    setFixtures(allFixtures.filter(f => String(f.cupId) === String(cupId)))
    setResults(getResults())
  }, [cupId, refreshKey, dataRefreshTrigger])

  useEffect(() => {
    setRefreshKey(prev => prev + 1)
  }, [dataRefreshTrigger])

  if (!cup) {
    return (
      <div className="page">
        <div className="page-header">
          <Link to="/cups" className="btn btn-secondary">← Back to Cups</Link>
        </div>
        <div className="card">
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Cup not found</p>
        </div>
      </div>
    )
  }

  const totalRounds = cup.matches?.length > 0 ? Math.max(...cup.matches.map(m => m.round)) : 1
  const prizePot = (cup.entryFee || 0) * (cup.players?.length || 0)
  const cupWinner = cup.matches?.find(m => m.round === totalRounds)?.winner

  const getRoundName = (round) => {
    if (round === totalRounds) return 'FINAL'
    if (round === totalRounds - 1 && totalRounds > 1) return 'SEMI-FINALS'
    if (round === totalRounds - 2 && totalRounds > 2) return 'QUARTER-FINALS'
    return `ROUND ${round}`
  }

  const hasScore = (score) => score !== undefined && score !== null && score !== ''

  const getScoreForPlayer = (source, playerId, fallbackScore) => {
    const sourcePlayer1Id = source.player1Id || source.player1
    const sourcePlayer2Id = source.player2Id || source.player2
    if (String(playerId) === String(sourcePlayer1Id)) return source.score1
    if (String(playerId) === String(sourcePlayer2Id)) return source.score2
    return fallbackScore
  }

  const getScoresFromSource = (source, match) => {
    if (!source || !hasScore(source.score1) || !hasScore(source.score2)) return null
    return {
      score1: getScoreForPlayer(source, match.player1, source.score1),
      score2: getScoreForPlayer(source, match.player2, source.score2)
    }
  }

  const getMatchResult = (match) => {
    const fixture = fixtures.find(f => String(f.matchId) === String(match.id))
    const approvedResult = results.find(result => (
      (
        (
          String(result.cupId || '') === String(cup.id) &&
          String(result.matchId || '') === String(match.id)
        ) ||
        (fixture?.id && String(result.fixtureId || '') === String(fixture.id))
      ) &&
      String(result.status).toLowerCase() === 'approved'
    ))

    const approvedResultScores = getScoresFromSource(approvedResult, match)
    if (approvedResultScores) return approvedResultScores

    const matchScores = getScoresFromSource(match, match)
    if (matchScores) return matchScores

    const fixtureScores = ['approved', 'completed'].includes(String(fixture?.status).toLowerCase())
      ? getScoresFromSource(fixture, match)
      : null

    return fixtureScores
  }

  const rounds = []
  for (let i = 1; i <= totalRounds; i++) {
    rounds.push(i)
  }

  const getPlayerName = (id) => {
    if (!id) return null
    return allUsers.find(u => String(u.id) === String(id))?.username || 'Unknown'
  }

  const roundsData = rounds.map(round => {
    const matches = cup.matches?.filter(m => m.round === round).sort((a, b) => a.id - b.id) || []
    return { round, matches }
  })

  const upcomingFixtures = fixtures.filter(fixture => {
    const match = cup.matches?.find(m => String(m.id) === String(fixture.matchId))
    const hasResult = ['approved', 'result_submitted', 'completed'].includes(fixture.status)
    return !hasResult && !match?.winner
  })

  const handleSwapPlayer = async () => {
    if (!cup || !playerToRemove || !playerToAdd) return showToast?.('Please select both players', 'error')

    setIsSubmitting(true)
    try {
      const cupRef = doc(db, 'cups', String(cup.id))
      const cupSnap = await getDoc(cupRef)
      if (!cupSnap.exists()) throw new Error('Cup not found')

      const cupData = cupSnap.data()
      const newPlayer = allUsers.find(u => u.id === playerToAdd)
      if (!newPlayer) throw new Error('New player not found')

      // 1. Update participants list
      const updatedPlayers = cupData.players.map(pid => String(pid) === String(playerToRemove) ? playerToAdd : pid)

      // 2. Update all matches
      const updatedMatches = cupData.matches.map(m => ({
        ...m,
        player1: String(m.player1) === String(playerToRemove) ? playerToAdd : m.player1,
        player2: String(m.player2) === String(playerToRemove) ? playerToAdd : m.player2,
        winner: String(m.winner) === String(playerToRemove) ? playerToAdd : m.winner
      }))

      const nextCupData = { ...cupData, players: updatedPlayers, matches: updatedMatches }
      await setDoc(cupRef, nextCupData, { merge: true })

      // 3. Update Fixtures
      const fixturesSnap = await getDocs(query(collection(db, 'fixtures'), where('cupId', '==', parseInt(cup.id))))
      const batch = writeBatch(db)
      let fixtureCount = 0

      fixturesSnap.docs.forEach(fDoc => {
        const fData = fDoc.data()
        let changed = false
        const updates = {}

        if (String(fData.player1Id) === String(playerToRemove)) {
          updates.player1Id = playerToAdd
          updates.player1 = newPlayer.username
          changed = true
        }
        if (String(fData.player2Id) === String(playerToRemove)) {
          updates.player2Id = playerToAdd
          updates.player2 = newPlayer.username
          changed = true
        }

        if (changed) {
          batch.update(fDoc.ref, updates)
          fixtureCount++
        }
      })

      if (fixtureCount > 0) await batch.commit()

      showToast?.(`Swapped player and updated ${fixtureCount} fixtures.`, 'success')
      setCup(nextCupData)
      setShowSwapModal(false)
      setPlayerToRemove('')
      setPlayerToAdd('')
      triggerDataRefresh('all')
      setRefreshKey(prev => prev + 1)
    } catch (e) {
      showToast?.('Error: ' + e.message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page" style={{ padding: '20px' }}>
      <div className="page-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/cups" className="btn btn-secondary">← Back to Cups</Link>
        {isAdmin && (
          <button className="btn btn-secondary" onClick={() => setShowSwapModal(true)}>
            🔄 Swap Participant
          </button>
        )}
      </div>
      
      <div style={{ 
        textAlign: 'center', 
        marginBottom: '30px',
        padding: '20px',
        background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
        borderRadius: '16px',
        border: '2px solid var(--accent-cyan)'
      }}>
        <h1 style={{ color: 'var(--accent-cyan)', margin: '0 0 10px 0', fontSize: '2rem' }}>{cup.name}</h1>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', color: 'white', fontSize: '1rem' }}>
          <span>Entry: £{cup.entryFee}</span>
          <span>Prize Pot: £{prizePot}</span>
          <span>{cup.players?.length || 0} Players</span>
        </div>
      </div>

      {cupWinner && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px',
          background: 'linear-gradient(135deg, #f5af19, #f12711)',
          borderRadius: '16px',
          marginBottom: '30px',
          boxShadow: '0 10px 40px rgba(245, 175, 25, 0.4)'
        }}>
          <h2 style={{ color: 'white', margin: 0, fontSize: '1.5rem' }}>🏆 TOURNAMENT WINNER 🏆</h2>
          <h1 style={{ color: 'white', margin: '15px 0 0 0', fontSize: '3rem', textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
            {getPlayerName(cupWinner)}
          </h1>
        </div>
      )}

      <div className="cup-bracket-scroll" style={{ 
        background: '#0f0f23',
        borderRadius: '16px',
        padding: '30px',
        overflowX: 'auto',
        width: '100%'
      }}>
        <h3 style={{ 
          color: 'white', 
          textAlign: 'center', 
          marginBottom: '30px',
          fontSize: '1.3rem',
          letterSpacing: '2px'
        }}>
          BRACKET
        </h3>
        
        <div className="cup-bracket-stage" style={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: '0',
          width: 'max-content',
          minWidth: '100%',
          margin: '0 auto'
        }}>
          {roundsData.map((roundData, roundIndex) => {
            const isComplete = roundData.matches.every(m => m.winner)
            const isActive = !isComplete && roundData.matches.some(m => m.player1 && m.player2)
            
            return (
              <div key={roundData.round} className="cup-bracket-round" style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ 
                  minWidth: '160px',
                  padding: '0 8px'
                }}>
                  <div style={{ 
                    textAlign: 'center',
                    marginBottom: '20px',
                    padding: '10px',
                    background: isComplete ? '#22c55e' : isActive ? 'var(--accent-cyan)' : '#333',
                    color: 'white',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                    letterSpacing: '1px'
                  }}>
                    {getRoundName(roundData.round)}
                  </div>
                  
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: roundData.round === 1 ? '10px' : `${Math.pow(2, roundData.round - 1) * 10}px`
                  }}>
                    {roundData.matches.map((match, matchIndex) => {
                      const result = getMatchResult(match)
                      const hasPlayers = match.player1 && match.player2
                      const p1Name = getPlayerName(match.player1)
                      const p2Name = getPlayerName(match.player2)

                      const p1Won = String(match.winner) === String(match.player1) || (result && result.score1 > result.score2)
                      const p2Won = String(match.winner) === String(match.player2) || (result && result.score2 > result.score1)
                      
                      const containerHeight = roundData.round === 1 ? 75 : Math.pow(2, roundData.round - 1) * 75
                      const halfHeight = containerHeight / 2
                      const matchOffset = halfHeight / 2 + matchIndex * containerHeight
                      
                      return (
                        <div key={match.id} style={{ 
                          height: '75px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '10px 12px',
                            background: p1Won ? 'rgba(34, 197, 94, 0.2)' : hasPlayers ? '#1e1e3f' : '#1a1a2e',
                            borderRadius: '8px',
                            border: p1Won ? '2px solid #22c55e' : '2px solid #333',
                            minHeight: '35px'
                          }}>
                            <span style={{ 
                              flex: 1, 
                              color: p1Won ? '#22c55e' : p1Name ? 'white' : '#666',
                              fontWeight: p1Won ? 'bold' : 'normal',
                              fontSize: '0.85rem'
                            }}>
                              {p1Name || 'TBD'}
                            </span>
                            {result && (
                              <span style={{ 
                                color: p1Won ? '#22c55e' : '#ef4444',
                                fontWeight: 'bold',
                                fontSize: '0.9rem',
                                marginLeft: '8px'
                              }}>
                                {result.score1}
                              </span>
                            )}
                            {p1Won && <span style={{ color: '#22c55e', marginLeft: '5px' }}>★</span>}
                          </div>
                          
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '10px 12px',
                            background: p2Won ? 'rgba(34, 197, 94, 0.2)' : hasPlayers ? '#1e1e3f' : '#1a1a2e',
                            borderRadius: '8px',
                            border: p2Won ? '2px solid #22c55e' : '2px solid #333',
                            minHeight: '35px'
                          }}>
                            <span style={{ 
                              flex: 1, 
                              color: p2Won ? '#22c55e' : p2Name ? 'white' : '#666',
                              fontWeight: p2Won ? 'bold' : 'normal',
                              fontSize: '0.85rem'
                            }}>
                              {p2Name || 'TBD'}
                            </span>
                            {result && (
                              <span style={{ 
                                color: p2Won ? '#22c55e' : '#ef4444',
                                fontWeight: 'bold',
                                fontSize: '0.9rem',
                                marginLeft: '8px'
                              }}>
                                {result.score2}
                              </span>
                            )}
                            {p2Won && <span style={{ color: '#22c55e', marginLeft: '5px' }}>★</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                
                {roundIndex < roundsData.length - 1 && (
                  <div className="cup-bracket-connector" style={{ 
                    width: '30px', 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <div style={{ 
                      width: '30px', 
                      height: '2px', 
                      background: 'linear-gradient(90deg, #333, var(--accent-cyan))' 
                    }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <h3 className="card-title">Upcoming Matches</h3>
        {upcomingFixtures.length === 0 ? (
          <p style={{ color: 'var(--success)', textAlign: 'center' }}>✓ All matches completed!</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
            {upcomingFixtures.map(fixture => (
              <div key={fixture.id} style={{ 
                padding: '15px', 
                background: '#1e1e3f', 
                borderRadius: '10px',
                border: '1px solid var(--accent-cyan)'
              }}>
                <div style={{ 
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px'
                }}>
                  <span style={{ 
                    fontSize: '0.8rem', 
                    color: 'var(--accent-cyan)',
                    fontWeight: 'bold'
                  }}>
                    {getRoundName(fixture.round)}
                  </span>
                  <span style={{ 
                    fontSize: '0.7rem', 
                    color: 'var(--text-muted)',
                    background: 'rgba(255,255,255,0.1)',
                    padding: '2px 8px',
                    borderRadius: '4px'
                  }}>
                    {fixture.startScore || 501} / Bo{fixture.bestOf || 3}
                  </span>
                </div>
                <div style={{ fontSize: '1rem', color: 'white' }}>
                  {getPlayerName(fixture.player1) || 'TBD'} 
                  <span style={{ color: '#666', margin: '0 10px' }}>vs</span>
                  {getPlayerName(fixture.player2) || 'TBD'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showSwapModal && (
        <div className="modal-overlay">
          <div className="modal-content glass" style={{ maxWidth: '400px' }}>
            <h3 style={{ marginBottom: '20px' }}>Swap Player in Cup</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Replace a participant throughout the entire bracket and all fixtures for <strong>{cup?.name}</strong>.
            </p>

            <div className="form-group">
              <label>Player to Remove</label>
              <select
                className="glass"
                value={playerToRemove}
                onChange={e => setPlayerToRemove(e.target.value)}
              >
                <option value="">Select participant...</option>
                {cup?.players?.map(pid => {
                  const p = allUsers.find(u => u.id === pid)
                  return <option key={pid} value={pid}>{p?.username || pid}</option>
                })}
              </select>
            </div>

            <div className="form-group">
              <label>Replacement Player</label>
              <UserSearchSelect
                users={allUsers.filter(u => !(cup?.players || []).includes(u.id))}
                selectedId={playerToAdd}
                onSelect={setPlayerToAdd}
                label=""
                placeholder="Search for new player..."
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
              <button className="btn btn-secondary btn-block" onClick={() => setShowSwapModal(false)}>Cancel</button>
              <button
                className="btn btn-primary btn-block"
                onClick={handleSwapPlayer}
                disabled={isSubmitting || !playerToRemove || !playerToAdd}
              >
                {isSubmitting ? 'Swapping...' : 'Perform Swap'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
