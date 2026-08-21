import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContextInternal'
import { db, doc, getDoc, setDoc, query, collection, where, getDocs, writeBatch } from '../firebase'
import UserSearchSelect from '../components/UserSearchSelect'
import { useToast } from '../context/ToastContext'
import { ADMIN_EMAILS } from '../config'

export default function CupBracket() {
  const { cupId } = useParams()
  const navigate = useNavigate()
  const { user, getAllUsers, getCups, getFixtures, getResults, dataRefreshTrigger, triggerDataRefresh } = useAuth()
  const { showToast } = useToast()
  const [cup, setCup] = useState(null)
  const [fixtures, setFixtures] = useState([])
  const [results, setResults] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)

  const [showSwapModal, setShowSwapModal] = useState(false)
  const [showSetPlayerModal, setShowSetPlayerModal] = useState(false)
  const [targetMatch, setTargetMatch] = useState(null)
  const [targetPosition, setTargetPosition] = useState(null)
  const [playerToSet, setPlayerToSet] = useState('')
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
    try {
      const cupsData = (typeof getCups === 'function') ? getCups() : []
      const cups = Array.isArray(cupsData) ? cupsData : []
      const foundCup = cups.find(c => c && String(c.id) === String(cupId))
      if (foundCup) setCup(foundCup)
      
      const allFixtures = Array.isArray(getFixtures()) ? getFixtures() : []
      setFixtures(allFixtures.filter(f => f && String(f.cupId) === String(cupId)))
      setResults(Array.isArray(getResults()) ? getResults() : [])
    } catch (e) {
      console.error('CupBracket load error:', e)
    }
  }, [cupId, refreshKey, dataRefreshTrigger])

  useEffect(() => {
    setRefreshKey(prev => prev + 1)
  }, [dataRefreshTrigger])

  const activeStageSetRef = useRef(false)
  const [activeStage, setActiveStage] = useState('groups')

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
    if (!match) return null
    const fixture = fixtures.find(f => f && String(f.matchId) === String(match.id))
    const approvedResult = results.find(result => result && (
      (String(result.cupId || '') === String(cup.id) && String(result.matchId || '') === String(match.id)) ||
      (fixture?.id && String(result.fixtureId || '') === String(fixture.id))
    ) && String(result.status).toLowerCase() === 'approved')

    const approvedResultScores = getScoresFromSource(approvedResult, match)
    if (approvedResultScores) return approvedResultScores

    const matchScores = getScoresFromSource(match, match)
    if (matchScores) return matchScores

    const fixtureScores = fixture && ['approved', 'completed'].includes(String(fixture?.status).toLowerCase())
      ? getScoresFromSource(fixture, match)
      : null

    return fixtureScores
  }

  const getFullMatchResult = (match) => {
    if (!match) return null
    const fixture = fixtures.find(f => f && String(f.matchId) === String(match.id))
    return results.find(result => result && (
      (String(result.cupId || '') === String(cup.id) && String(result.matchId || '') === String(match.id)) ||
      (fixture?.id && String(result.fixtureId || '') === String(fixture.id))
    ) && String(result.status).toLowerCase() === 'approved')
  }

  const groupStandings = useMemo(() => {
    if (!cup || !Array.isArray(cup?.matches) || cup.matches.length === 0) return { sortedStandings: {}, bestThirdIds: [], sortedThirdPlaced: [], numThirdNeeded: 0, advanceCount: 2 }
    const safe = cup.matches
    const standings = {}

    safe.filter(m => m && m.stage === 'groups').forEach(match => {
      const gId = match.group
      if (!gId) return
      if (!standings[gId]) standings[gId] = {}

      const p1 = match.player1
      const p2 = match.player2

      if (p1 && !standings[gId][p1]) standings[gId][p1] = { id: p1, played: 0, won: 0, lost: 0, legsFor: 0, legsAgainst: 0, points: 0, avgSum: 0 }
      if (p2 && !standings[gId][p2]) standings[gId][p2] = { id: p2, played: 0, won: 0, lost: 0, legsFor: 0, legsAgainst: 0, points: 0, avgSum: 0 }

      const result = getMatchResult(match)
      const fullRes = getFullMatchResult(match)

      if (result && p1 && p2) {
        standings[gId][p1].played++
        standings[gId][p2].played++
        standings[gId][p1].legsFor += result.score1
        standings[gId][p1].legsAgainst += result.score2
        standings[gId][p2].legsFor += result.score2
        standings[gId][p2].legsAgainst += result.score1

        // Championship Cup Scoring: 1 point per leg won
        standings[gId][p1].points += result.score1
        standings[gId][p2].points += result.score2

        if (result.score1 > result.score2) {
          standings[gId][p1].won++
          standings[gId][p1].points += 2 // 2 points for match win
          standings[gId][p2].lost++
        } else if (result.score2 > result.score1) {
          standings[gId][p2].won++
          standings[gId][p2].points += 2 // 2 points for match win
          standings[gId][p1].lost++
        }

        if (fullRes) {
          const p1Stats = fullRes.player1Stats || {}
          const p2Stats = fullRes.player2Stats || {}
          const isMatchP1ResultP1 = String(p1) === String(fullRes.player1Id)
          standings[gId][p1].avgSum += isMatchP1ResultP1 ? (p1Stats.avg || 0) : (p2Stats.avg || 0)
          standings[gId][p2].avgSum += isMatchP1ResultP1 ? (p2Stats.avg || 0) : (p1Stats.avg || 0)
        }
      }
    })

    const hasKnockout = cup.matches.some(m => m.stage === 'knockout')
    const advanceCount = cup.type === 'group_knockout' ? (cup.advancePerGroup || 2) : (cup.type === 'world_cup' ? 2 : 0)
    const sortedStandings = {}
    const extraPlaced = []

    Object.keys(standings).forEach(gId => {
      const sorted = Object.values(standings[gId]).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        const diffA = a.legsFor - a.legsAgainst
        const diffB = b.legsFor - b.legsAgainst
        if (diffB !== diffA) return diffB - diffA
        return b.legsFor - a.legsFor
      })
      sortedStandings[gId] = sorted

      // RULE: Only consider if they are NOT the last placed player in the group
      if (hasKnockout && sorted[advanceCount] && advanceCount < sorted.length - 1) {
        extraPlaced.push({ ...sorted[advanceCount], group: gId })
      }
    })

    const numThirdNeeded = 4 // Fixed at Top 4 as per specific league rules

    const sortedThirdPlaced = extraPlaced.sort((a, b) => (b.points - a.points) || (b.legsFor - b.legsAgainst) - (a.legsFor - a.legsAgainst) || (b.legsFor - a.legsFor))

    const bestThirdIds = sortedThirdPlaced.slice(0, numThirdNeeded).map(p => p.id)

    return { sortedStandings, bestThirdIds, sortedThirdPlaced, numThirdNeeded, advanceCount }
  }, [cup, results, fixtures])

  useEffect(() => {
    if (cup && !activeStageSetRef.current) {
      if (cup.type === 'knockout' || cup.groupsAdvanced || (cup.currentRound && cup.currentRound > 0)) {
        setActiveStage('knockout')
      } else {
        setActiveStage('groups')
      }
      activeStageSetRef.current = true
    }
  }, [cup])

  const isWorldCup = cup?.type === 'world_cup'
  const isGroupKnockout = cup?.type === 'group_knockout'
  const isWorldCupOrGroupKO = isWorldCup || isGroupKnockout

  const safeCupMatches = Array.isArray(cup?.matches) ? cup.matches : []

  const upcomingFixtures = useMemo(() => {
    return fixtures.filter(fixture => {
      const match = safeCupMatches.find(m => m && String(m.id) === String(fixture.matchId))
      const status = String(fixture.status || 'pending').toLowerCase()
      const isPending = !['approved', 'result_submitted', 'completed', 'rejected'].includes(status)
      return isPending && !match?.winner && fixture.player1 && fixture.player2
    }).sort((a, b) => (a.round || 0) - (b.round || 0))
  }, [fixtures, safeCupMatches])

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

  const totalRounds = safeCupMatches.length > 0
    ? Math.max(...safeCupMatches.filter(m => m && m.round).map(m => m.round), 1)
    : 1
  const prizePot = cup.prizePool !== undefined ? cup.prizePool : (cup.entryFee || 0) * (cup.players?.length || 0)
  const cupWinner = safeCupMatches.find(m => m && m.round === totalRounds)?.winner

  const getRoundName = (round) => {
    if (round === totalRounds) return 'FINAL'
    if (round === totalRounds - 1 && totalRounds > 1) return 'SEMI-FINALS'
    if (round === totalRounds - 2 && totalRounds > 2) return 'QUARTER-FINALS'
    return `ROUND ${round}`
  }

  const rounds = []
  for (let i = 1; i <= totalRounds; i++) {
    rounds.push(i)
  }

  const getPlayerName = (id) => {
    if (!id) return null
    const user = allUsers.find(u => String(u.id) === String(id))
    if (user) return user.username
    // If not found in allUsers, it might be that id is already a username string
    // from a fixture/match that was manually updated but not synced with allUsers
    return id.length > 20 ? 'Unknown' : id // Basic heuristic to distinguish IDs from names
  }

  const roundsData = rounds.map(round => {
    const matches = safeCupMatches.filter(m => m && m.round === round).sort((a, b) => (a.id || 0) - (b.id || 0))
    return { round, matches }
  })

  const { sortedStandings, bestThirdIds, sortedThirdPlaced, numThirdNeeded, advanceCount = 2 } = groupStandings


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

      // 2. Update groups
      const updatedGroups = (cupData.groups || []).map(g => ({
        ...g,
        players: (g.players || []).map(pid => String(pid) === String(playerToRemove) ? playerToAdd : pid)
      }))

      // 3. Update all matches
      const updatedMatches = cupData.matches.map(m => ({
        ...m,
        player1: String(m.player1) === String(playerToRemove) ? playerToAdd : m.player1,
        player2: String(m.player2) === String(playerToRemove) ? playerToAdd : m.player2,
        winner: String(m.winner) === String(playerToRemove) ? playerToAdd : m.winner
      }))

      const nextCupData = { ...cupData, players: updatedPlayers, groups: updatedGroups, matches: updatedMatches }
      await setDoc(cupRef, nextCupData, { merge: true })

      // 4. Update Fixtures
      const fixturesSnap = await getDocs(query(collection(db, 'fixtures'), where('cupId', 'in', [String(cup.id), parseInt(cup.id)])))
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

  const handleSetMatchPlayer = async () => {
    if (!cup || !targetMatch || !playerToSet) return showToast?.('Please select a player', 'error')

    setIsSubmitting(true)
    try {
      const cupRef = doc(db, 'cups', String(cup.id))
      const cupSnap = await getDoc(cupRef)
      if (!cupSnap.exists()) throw new Error('Cup not found')

      const cupData = cupSnap.data()
      const newPlayer = allUsers.find(u => u.id === playerToSet)
      if (!newPlayer) throw new Error('Player not found')

      // 1. Update the match in cupData.matches
      const updatedMatches = (cupData.matches || []).map(m => {
        if (String(m.id) === String(targetMatch.id)) {
          return {
            ...m,
            [targetPosition === 1 ? 'player1' : 'player2']: playerToSet
          }
        }
        return m
      })

      // 2. Ensure player is in cup.players list
      const updatedPlayers = [...(cupData.players || [])]
      if (!updatedPlayers.includes(playerToSet)) {
        updatedPlayers.push(playerToSet)
      }

      const nextCupData = { ...cupData, players: updatedPlayers, matches: updatedMatches }
      await setDoc(cupRef, nextCupData, { merge: true })

      // 3. Create fixture if both players now exist
      const updatedMatch = updatedMatches.find(m => String(m.id) === String(targetMatch.id))
      if (updatedMatch.player1 && updatedMatch.player2) {
        const existingFixture = (fixtures || []).find(f => String(f.matchId) === String(updatedMatch.id))
        if (!existingFixture) {
          const roundFormat = cupData.roundFormats?.[updatedMatch.round || 0] || { startScore: 501, bestOf: 3, firstTo: 2 }
          const fixtureId = `cup_${cup.id}_match_${updatedMatch.id}`

          const p1 = allUsers.find(u => String(u.id) === String(updatedMatch.player1))
          const p2 = allUsers.find(u => String(u.id) === String(updatedMatch.player2))

          const newFixture = {
            id: fixtureId,
            cupId: isNaN(parseInt(cup.id)) ? cup.id : parseInt(cup.id),
            cupName: cup.name,
            startScore: roundFormat.startScore,
            bestOf: roundFormat.bestOf,
            firstTo: roundFormat.firstTo || Math.ceil(roundFormat.bestOf / 2),
            player1: p1?.username || 'Unknown',
            player1Id: updatedMatch.player1,
            player2: p2?.username || 'Unknown',
            player2Id: updatedMatch.player2,
            matchId: updatedMatch.id,
            round: updatedMatch.round || 0,
            stage: updatedMatch.stage,
            group: updatedMatch.group || null,
            status: 'accepted',
            proposalStatus: 'accepted',
            createdAt: new Date().toISOString()
          }
          await setDoc(doc(db, 'fixtures', fixtureId), newFixture)
        }
      }

      showToast?.(`Set player for match.`, 'success')
      setCup(nextCupData)
      setShowSetPlayerModal(false)
      setTargetMatch(null)
      setPlayerToSet('')
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
      <div className="page-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Link to="/cups" className="btn btn-secondary">← Back to Cups</Link>
          {isAdmin && (isWorldCupOrGroupKO) && !cup.groupsAdvanced && (
            <Link to="/admin?tab=cups" className="btn btn-primary" style={{ background: 'linear-gradient(to right, #f59e0b, #d97706)', color: 'black', fontWeight: 900 }}>
               ⚡ START KNOCKOUT PHASE
            </Link>
          )}
        </div>
        {isAdmin && (
          <button className="btn btn-secondary" onClick={() => setShowSwapModal(true)}>
            🔄 Swap Participant
          </button>
        )}
      </div>
      
      <div style={{ 
        textAlign: 'center', 
        marginBottom: '30px',
        padding: '30px',
        background: isWorldCup
          ? 'linear-gradient(135deg, #1e1b4b, #312e81)'
          : 'linear-gradient(135deg, #0f172a, #1e293b)',
        borderRadius: '24px',
        border: isWorldCup
          ? '2px solid rgba(251, 191, 36, 0.3)'
          : '1px solid rgba(56, 189, 248, 0.2)',
        boxShadow: isWorldCup
          ? '0 20px 50px rgba(0,0,0,0.5), inset 0 0 20px rgba(251, 191, 36, 0.1)'
          : '0 20px 50px rgba(0,0,0,0.3)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {isWorldCup && (
          <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            fontSize: '8rem',
            opacity: 0.05,
            transform: 'rotate(-15deg)',
            pointerEvents: 'none'
          }}>🏆</div>
        )}
        <h1 className={isWorldCup ? "text-gradient-gold" : "text-gradient"} style={{
          margin: '0 0 12px 0',
          fontSize: '3rem',
          fontWeight: 900,
          letterSpacing: '-1px'
        }}>{cup.name}</h1>

        {cup.deadlines && (
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {activeStage === 'groups' && cup.deadlines.groups && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '6px 16px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800, border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                🚨 GROUP STAGE DEADLINE: {cup.deadlines.groups}
              </div>
            )}
            {activeStage === 'knockout' && cup.deadlines[cup.currentRound || 1] && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '6px 16px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800, border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                🚨 ROUND {cup.currentRound || 1} DEADLINE: {cup.deadlines[cup.currentRound || 1]}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap' }}>
          <div className="glass" style={{ padding: '8px 20px', borderRadius: '30px', fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 800, border: '1px solid rgba(255,255,255,0.1)' }}>
             💰 PRIZE: £{prizePot}
          </div>
          <div className="glass" style={{ padding: '8px 20px', borderRadius: '30px', fontSize: '0.85rem', color: 'white', fontWeight: 800, border: '1px solid rgba(255,255,255,0.1)' }}>
             👥 {cup.players?.length || 0} PLAYERS
          </div>
          <div className="glass" style={{
            padding: '8px 20px',
            borderRadius: '30px',
            fontSize: '0.85rem',
            color: isWorldCup ? '#fbbf24' : 'var(--success)',
            fontWeight: 800,
            textTransform: 'uppercase',
            background: isWorldCup ? 'rgba(251, 191, 36, 0.1)' : 'rgba(34, 197, 94, 0.1)',
            border: isWorldCup ? '1px solid rgba(251, 191, 36, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)'
          }}>
             {isWorldCup ? '🏆 WORLD CUP FORMAT' : isGroupKnockout ? '📋 GROUPS → KNOCKOUT' : (cup.type || 'tournament').replace('_', ' ')}
          </div>
          {cup.roundFormats?._stageDays && (
            <div className="glass" style={{ padding: '8px 20px', borderRadius: '30px', fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 800, border: '1px solid var(--accent-cyan)' }}>
              ⏱ {cup.roundFormats._stageDays} DAYS PER STAGE
            </div>
          )}
          {cup.roundFormats && (
            <div className="glass" style={{ padding: '8px 20px', borderRadius: '30px', fontSize: '0.85rem', color: 'white', fontWeight: 800, border: '1px solid rgba(255,255,255,0.1)' }}>
              🎯 {activeStage === 'groups' ? (cup.roundFormats[0]?.firstTo ? `FT${cup.roundFormats[0].firstTo}` : `Bo${cup.roundFormats[0]?.bestOf || 3}`) : 'VARIES BY ROUND'}
            </div>
          )}
        </div>
      </div>

      {cupWinner && (
        <div style={{ 
          textAlign: 'center', 
          padding: '48px',
          background: isWorldCup ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : 'linear-gradient(135deg, #0f172a, #1e293b)',
          borderRadius: '24px',
          marginBottom: '40px',
          boxShadow: isWorldCup ? '0 0 60px rgba(245, 158, 11, 0.3)' : '0 20px 50px rgba(0,0,0,0.3)',
          position: 'relative',
          overflow: 'hidden',
          border: !isWorldCup ? '2px solid rgba(56, 189, 248, 0.3)' : 'none'
        }}>
          <h2 style={{ color: isWorldCup ? 'white' : 'var(--accent-cyan)', margin: 0, fontSize: '1.2rem', fontWeight: 900, letterSpacing: '4px', textTransform: 'uppercase' }}>
            {isWorldCup ? 'World Champion' : '🏆 Champion'}
          </h2>
          <h1 style={{ color: isWorldCup ? 'white' : 'white', margin: '20px 0 0 0', fontSize: '4.5rem', fontWeight: 900, textShadow: '0 4px 20px rgba(0,0,0,0.4)', lineHeight: 1 }}>
            {getPlayerName(cupWinner)}
          </h1>
          <div style={{ marginTop: '20px', fontSize: '3rem' }}>🏆🎯🏆</div>
        </div>
      )}

      {(isWorldCupOrGroupKO || cup.type === 'groups') && (
        <div className="division-tabs" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '16px', maxWidth: '400px', margin: '0 auto 32px' }}>
          <button
            className={`division-tab ${activeStage === 'groups' ? 'active' : ''}`}
            onClick={() => setActiveStage('groups')}
            style={{ flex: 1, margin: 0, borderRadius: '12px' }}
          >
            Group Stages
          </button>
          {(isWorldCupOrGroupKO || cup.type === 'knockout') && (
            <button
              className={`division-tab ${activeStage === 'knockout' ? 'active' : ''}`}
              onClick={() => setActiveStage('knockout')}
              style={{ flex: 1, margin: 0, borderRadius: '12px' }}
            >
              Knockout Phase
            </button>
          )}
        </div>
      )}

      {activeStage === 'groups' && numThirdNeeded > 0 && sortedThirdPlaced.length > 0 && (
        <div className="animate-fade-in" style={{ marginBottom: '48px', maxWidth: '1000px', margin: '0 auto 48px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            padding: '0 10px'
          }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '2px', color: '#fbbf24' }}>BEST 3RD PLACED RANKING</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Ranking of players in 3rd position across all groups.</p>
            </div>
            <div style={{
              background: 'rgba(251, 191, 36, 0.1)',
              color: '#fbbf24',
              padding: '6px 16px',
              borderRadius: '30px',
              fontSize: '0.75rem',
              fontWeight: 800,
              border: '1px solid rgba(251, 191, 36, 0.3)'
            }}>
              TOP {numThirdNeeded} ADVANCE
            </div>
          </div>

          <div className="card glass" style={{ padding: '24px', borderRadius: '24px', border: '1px solid rgba(251, 191, 36, 0.2)', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                    <th style={{ textAlign: 'center', width: '50px', padding: '12px 8px' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '12px 8px' }}>PLAYER</th>
                    <th style={{ textAlign: 'center', padding: '12px 8px' }}>GROUP</th>
                    <th style={{ textAlign: 'center', padding: '12px 8px' }}>P</th>
                    <th style={{ textAlign: 'center', padding: '12px 8px' }}>W</th>
                    <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--accent-primary)' }}>AVG</th>
                    <th style={{ textAlign: 'center', padding: '12px 8px' }}>+/-</th>
                    <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--accent-cyan)' }}>PTS</th>
                    <th style={{ textAlign: 'right', padding: '12px 8px' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedThirdPlaced.map((p, idx) => {
                    const isQualifying = idx < numThirdNeeded
                    return (
                      <tr key={p.id} style={{
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        background: isQualifying ? 'rgba(34, 197, 94, 0.03)' : 'transparent',
                        transition: 'background 0.2s'
                      }}>
                        <td style={{ textAlign: 'center', padding: '14px 8px', fontWeight: 900, color: isQualifying ? '#fbbf24' : 'var(--text-muted)' }}>{idx + 1}</td>
                        <td style={{ padding: '14px 8px', fontWeight: 700 }}>{getPlayerName(p.id)}</td>
                        <td style={{ textAlign: 'center', padding: '14px 8px' }}>
                           <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800 }}>{p.group}</span>
                        </td>
                        <td style={{ textAlign: 'center', padding: '14px 8px' }}>{p.played}</td>
                        <td style={{ textAlign: 'center', padding: '14px 8px' }}>{p.won}</td>
                        <td style={{ textAlign: 'center', padding: '14px 8px', color: 'var(--accent-primary)', fontWeight: 600 }}>{p.played > 0 ? (p.avgSum / p.played).toFixed(2) : '-'}</td>
                        <td style={{ textAlign: 'center', padding: '14px 8px', fontWeight: 700, color: (p.legsFor - p.legsAgainst) >= 0 ? 'var(--success)' : 'var(--error)' }}>
                          {(p.legsFor - p.legsAgainst) > 0 ? `+${p.legsFor - p.legsAgainst}` : p.legsFor - p.legsAgainst}
                        </td>
                        <td style={{ textAlign: 'center', padding: '14px 8px', fontWeight: 900, color: 'var(--accent-cyan)' }}>{p.points}</td>
                        <td style={{ textAlign: 'right', padding: '14px 8px' }}>
                           {isQualifying ? (
                             <span style={{ color: 'var(--success)', fontWeight: 800, fontSize: '0.7rem', background: 'var(--success-bg)', padding: '4px 10px', borderRadius: '20px' }}>✓ QUALIFIED</span>
                           ) : (
                             <span style={{ color: 'var(--error)', fontWeight: 800, fontSize: '0.7rem', background: 'var(--error-bg)', padding: '4px 10px', borderRadius: '20px' }}>✕ ELIMINATED</span>
                           )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeStage === 'groups' && (
        <div className="animate-fade-in">
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            padding: '0 10px'
          }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '2px', color: 'white' }}>GROUP STANDINGS</h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {isWorldCup ? (cup.allowBestThird ? 'Top 2 + Best 3rd Placed Advance' : 'Top 2 Advance to Knockout') : isGroupKnockout ? `Top ${cup.advancePerGroup || 2} + Best Next-Placed Advance` : `Top ${cup.advancePerGroup || 2} Advance to Knockout`}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px', marginBottom: '40px' }}>
            {Object.keys(sortedStandings).sort().map(gId => (
              <div key={gId} className="card glass" style={{
                padding: '24px',
                borderRadius: '20px',
                border: isWorldCup ? '1px solid rgba(251, 191, 36, 0.2)' : '1px solid rgba(255,255,255,0.05)',
                boxShadow: isWorldCup ? '0 10px 30px rgba(0,0,0,0.2)' : ''
              }}>
                <h3 style={{ color: isWorldCup ? '#fbbf24' : 'var(--accent-cyan)', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 900, fontSize: '1.5rem' }}>GROUP {gId}</span>
                  <span style={{ fontSize: '0.7rem', opacity: 0.5, letterSpacing: '1px' }}>ROUND ROBIN</span>
                </h3>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 5px' }}>PLAYER</th>
                    <th style={{ padding: '10px 5px' }}>P</th>
                    <th style={{ padding: '10px 5px' }}>W</th>
                    <th style={{ padding: '10px 5px', color: 'var(--accent-primary)' }}>AVG</th>
                    <th style={{ padding: '10px 5px' }}>+/-</th>
                    <th style={{ padding: '10px 5px', color: 'var(--accent-cyan)' }}>PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStandings[gId].map((p, idx) => {
                    const isDirectQualifier = idx < advanceCount
                    const isBestExtra = idx === advanceCount && bestThirdIds.includes(p.id)
                    const isQualifying = isDirectQualifier || isBestExtra

                    return (
                      <tr key={p.id} style={{
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        background: isQualifying ? 'rgba(34, 197, 94, 0.03)' : 'transparent'
                      }}>
                        <td style={{ padding: '12px 5px', fontWeight: 700 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                             {isQualifying && (
                               <span
                                 title={isDirectQualifier ? "Automatic Qualifier" : "Best Next-Placed Qualifier"}
                                 style={{ color: isDirectQualifier ? 'var(--success)' : 'var(--accent-cyan)', fontSize: '0.7rem' }}
                               >●</span>
                             )}
                             {getPlayerName(p.id)}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', padding: '12px 5px' }}>{p.played}</td>
                        <td style={{ textAlign: 'center', padding: '12px 5px' }}>{p.won}</td>
                        <td style={{ textAlign: 'center', padding: '12px 5px', color: 'var(--accent-primary)', fontWeight: 600 }}>{p.played > 0 ? (p.avgSum / p.played).toFixed(2) : '-'}</td>
                        <td style={{ textAlign: 'center', padding: '12px 5px', color: (p.legsFor - p.legsAgainst) >= 0 ? 'var(--success)' : 'var(--error)' }}>
                          {(p.legsFor - p.legsAgainst) > 0 ? `+${p.legsFor - p.legsAgainst}` : p.legsFor - p.legsAgainst}
                        </td>
                        <td style={{ textAlign: 'center', padding: '12px 5px', fontWeight: 900, color: 'var(--accent-cyan)' }}>{p.points}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                 {safeCupMatches.filter(m => m && m.stage === 'groups' && m.group === gId).map(m => {
                   const res = getMatchResult(m)
                   return (
                     <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '0.75rem' }}>
                        <span style={{ flex: 1, textAlign: 'right', fontWeight: res?.score1 > res?.score2 ? 800 : 400 }}>{getPlayerName(m.player1)}</span>
                        <span style={{ margin: '0 12px', fontWeight: 900, color: 'var(--accent-cyan)' }}>{res ? `${res.score1} - ${res.score2}` : 'vs'}</span>
                        <span style={{ flex: 1, textAlign: 'left', fontWeight: res?.score2 > res?.score1 ? 800 : 400 }}>{getPlayerName(m.player2)}</span>
                     </div>
                   )
                 })}
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

      {activeStage === 'knockout' && (
        <div className="cup-bracket-scroll animate-fade-in" style={{
          background: 'rgba(15, 23, 42, 0.5)',
          borderRadius: '24px',
          padding: '40px',
          overflowX: 'auto',
          width: '100%',
          border: isWorldCup ? '1px solid rgba(251, 191, 36, 0.1)' : '1px solid rgba(255,255,255,0.05)',
          backdropFilter: 'blur(10px)',
          boxShadow: 'inset 0 0 40px rgba(0,0,0,0.3)'
        }}>
        <h3 style={{ 
          color: isWorldCup ? '#fbbf24' : 'white',
          textAlign: 'center', 
          marginBottom: '40px',
          fontSize: '1.5rem',
          fontWeight: 900,
          letterSpacing: '4px',
          textTransform: 'uppercase'
        }}>
          {isWorldCup ? 'Knockout Phase' : 'Tournament Bracket'}
        </h3>
        
        <div className="cup-bracket-stage" style={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0',
          width: 'max-content',
          minWidth: '100%',
          margin: '0 auto'
        }}>
          {roundsData.map((roundData, roundIndex) => {
            const isComplete = roundData.matches.every(m => m.winner)
            const isActive = !isComplete && roundData.matches.some(m => m.player1 && m.player2)
            const isFinal = roundData.round === totalRounds

            return (
              <div key={roundData.round} className="cup-bracket-round" style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ 
                  minWidth: '220px',
                  padding: '0 12px'
                }}>
                  <div style={{ 
                    textAlign: 'center',
                    marginBottom: '24px',
                    padding: '12px',
                    background: isFinal ? 'linear-gradient(to right, #f59e0b, #d97706)' : isComplete ? 'rgba(34, 197, 94, 0.8)' : isActive ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.05)',
                    color: isFinal || isComplete || isActive ? 'black' : 'var(--text-muted)',
                    borderRadius: '12px',
                    fontWeight: 900,
                    fontSize: '0.8rem',
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                    boxShadow: isFinal ? '0 0 20px rgba(245, 158, 11, 0.4)' : 'none',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}>
                    {getRoundName(roundData.round)}
                  </div>
                  
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: roundData.round === 1 ? '16px' : `${Math.pow(2, roundData.round - 1) * 20}px`
                  }}>
                    {roundData.matches.map((match, matchIndex) => {
                      const result = getMatchResult(match)
                      const hasPlayers = match.player1 && match.player2
                      const p1Name = getPlayerName(match.player1)
                      const p2Name = getPlayerName(match.player2)

                      const p1Won = String(match.winner) === String(match.player1) || (result && result.score1 > result.score2)
                      const p2Won = String(match.winner) === String(match.player2) || (result && result.score2 > result.score1)

                      return (
                        <div key={match.id} style={{ 
                          height: '90px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          gap: '4px',
                          position: 'relative'
                        }}>
                          {/* Player 1 Slot */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '10px 14px',
                              background: p1Won ? 'rgba(34, 197, 94, 0.15)' : hasPlayers ? 'rgba(30, 41, 59, 0.8)' : 'rgba(15, 23, 42, 0.4)',
                              borderRadius: '8px 8px 0 0',
                              border: p1Won ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.1)',
                              borderBottom: 'none',
                              minHeight: '40px',
                              transition: 'all 0.3s ease',
                              boxShadow: p1Won ? '0 0 15px rgba(34, 197, 94, 0.1)' : 'none',
                              cursor: isAdmin ? 'pointer' : 'default'
                            }}
                            onClick={() => {
                              if (isAdmin) {
                                setTargetMatch(match)
                                setTargetPosition(1)
                                setPlayerToSet(match.player1 || '')
                                setShowSetPlayerModal(true)
                              }
                            }}
                          >
                            <span style={{ 
                              flex: 1, 
                              color: p1Won ? '#4ade80' : p1Name ? 'white' : 'rgba(255,255,255,0.2)',
                              fontWeight: p1Won ? 900 : 600,
                              fontSize: '0.85rem',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {p1Name || (match.sourceP1 ? (match.sourceP1.bestThird ? `Best 3rd #${match.sourceP1.position}` : match.sourceP1.bestExtra ? `Best Extra #${match.sourceP1.position}` : match.sourceP1.position === 1 ? `Winner Grp ${match.sourceP1.group}` : match.sourceP1.position === 2 ? `Runner-up Grp ${match.sourceP1.group}` : `P${match.sourceP1.position} Grp ${match.sourceP1.group}`) : 'TBD')}
                            </span>
                            {result && (
                              <span style={{ 
                                background: p1Won ? '#22c55e' : 'rgba(255,255,255,0.1)',
                                color: p1Won ? 'black' : 'white',
                                fontWeight: 900,
                                fontSize: '0.8rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                marginLeft: '8px',
                                minWidth: '24px',
                                textAlign: 'center'
                              }}>
                                {result.score1}
                              </span>
                            )}
                          </div>
                          
                          {/* Player 2 Slot */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '10px 14px',
                              background: p2Won ? 'rgba(34, 197, 94, 0.15)' : hasPlayers ? 'rgba(30, 41, 59, 0.8)' : 'rgba(15, 23, 42, 0.4)',
                              borderRadius: '0 0 8px 8px',
                              border: p2Won ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.1)',
                              minHeight: '40px',
                              transition: 'all 0.3s ease',
                              boxShadow: p2Won ? '0 0 15px rgba(34, 197, 94, 0.1)' : 'none',
                              cursor: isAdmin ? 'pointer' : 'default'
                            }}
                            onClick={() => {
                              if (isAdmin) {
                                setTargetMatch(match)
                                setTargetPosition(2)
                                setPlayerToSet(match.player2 || '')
                                setShowSetPlayerModal(true)
                              }
                            }}
                          >
                            <span style={{ 
                              flex: 1, 
                              color: p2Won ? '#4ade80' : p2Name ? 'white' : 'rgba(255,255,255,0.2)',
                              fontWeight: p2Won ? 900 : 600,
                              fontSize: '0.85rem',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {p2Name || (match.sourceP2 ? (match.sourceP2.bestThird ? `Best 3rd #${match.sourceP2.position}` : match.sourceP2.bestExtra ? `Best Extra #${match.sourceP2.position}` : match.sourceP2.position === 1 ? `Winner Grp ${match.sourceP2.group}` : match.sourceP2.position === 2 ? `Runner-up Grp ${match.sourceP2.group}` : `P${match.sourceP2.position} Grp ${match.sourceP2.group}`) : 'TBD')}
                            </span>
                            {result && (
                              <span style={{ 
                                background: p2Won ? '#22c55e' : 'rgba(255,255,255,0.1)',
                                color: p2Won ? 'black' : 'white',
                                fontWeight: 900,
                                fontSize: '0.8rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                marginLeft: '8px',
                                minWidth: '24px',
                                textAlign: 'center'
                              }}>
                                {result.score2}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                
                {roundIndex < roundsData.length - 1 && (
                  <div className="cup-bracket-connector" style={{ 
                    width: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <div style={{ 
                      width: '100%',
                      height: '2px', 
                      background: 'linear-gradient(90deg, rgba(255,255,255,0.1), var(--accent-cyan), rgba(255,255,255,0.1))',
                      opacity: isActive || isComplete ? 1 : 0.2
                    }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )}

      <div className="card glass" style={{ marginTop: '30px', padding: '24px', borderRadius: '24px', border: '1px solid var(--border)' }}>
        <h3 className="card-title" style={{ color: 'var(--accent-cyan)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>📅</span> Upcoming Matches
        </h3>
        {upcomingFixtures.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed var(--border)' }}>
            <p style={{ color: 'var(--success)', fontWeight: 800, margin: 0 }}>✓ All scheduled matches for this stage are completed!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {upcomingFixtures.map(fixture => {
              const p1 = allUsers.find(u => String(u.id) === String(fixture.player1Id || fixture.player1))
              const p2 = allUsers.find(u => String(u.id) === String(fixture.player2Id || fixture.player2))
              const isUserInMatch = user?.id === p1?.id || user?.id === p2?.id

              return (
                <div key={fixture.id} style={{
                  padding: '20px',
                  background: isUserInMatch ? 'rgba(0, 212, 255, 0.05)' : 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '16px',
                  border: isUserInMatch ? '1px solid var(--accent-cyan)' : '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  transition: 'transform 0.2s',
                  position: 'relative'
                }}>
                  {isUserInMatch && <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'var(--accent-cyan)', color: 'black', fontSize: '0.6rem', fontWeight: 900, padding: '2px 8px', borderRadius: '4px' }}>YOUR MATCH</div>}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      {getRoundName(fixture.round)}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', fontWeight: 800 }}>
                      {fixture.startScore || 501} / {fixture.firstTo ? `FT${fixture.firstTo}` : `Bo${fixture.bestOf || 3}`}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ flex: 1, textAlign: 'right', fontWeight: 800, fontSize: '0.95rem' }}>{p1?.username || 'TBD'}</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-muted)', opacity: 0.5 }}>VS</div>
                    <div style={{ flex: 1, textAlign: 'left', fontWeight: 800, fontSize: '0.95rem' }}>{p2?.username || 'TBD'}</div>
                  </div>

                  {fixture.date ? (
                    <div style={{
                      marginTop: '8px',
                      padding: '8px',
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: '8px',
                      textAlign: 'center',
                      fontSize: '0.8rem',
                      color: 'var(--success)',
                      fontWeight: 700
                    }}>
                      🕒 {new Date(fixture.date).toLocaleDateString()} at {fixture.time}
                    </div>
                  ) : (
                    <div style={{
                      marginTop: '8px',
                      textAlign: 'center',
                      fontSize: '0.75rem',
                      color: 'var(--warning)',
                      fontStyle: 'italic'
                    }}>
                      TBD - Not yet scheduled
                    </div>
                  )}

                  {isUserInMatch && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => navigate(`/submit-result?fixtureId=${fixture.id}`)}
                      style={{ marginTop: '10px' }}
                    >
                      Submit Result
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showSetPlayerModal && (
        <div className="modal-overlay">
          <div className="modal-content glass" style={{ maxWidth: '400px' }}>
            <h3 style={{ marginBottom: '20px' }}>Set Match Participant</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Manually assign a player to <strong>Position {targetPosition}</strong> in this match.
            </p>

            <div className="form-group">
              <label>Select Player</label>
              <UserSearchSelect
                users={allUsers}
                selectedId={playerToSet}
                onSelect={setPlayerToSet}
                label=""
                placeholder="Search for player..."
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
              <button className="btn btn-secondary btn-block" onClick={() => { setShowSetPlayerModal(false); setTargetMatch(null); }}>Cancel</button>
              <button
                className="btn btn-primary btn-block"
                onClick={handleSetMatchPlayer}
                disabled={isSubmitting || !playerToSet}
              >
                {isSubmitting ? 'Saving...' : 'Confirm Player'}
              </button>
            </div>
          </div>
        </div>
      )}

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
