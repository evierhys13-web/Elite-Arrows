import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { db, doc, setDoc, deleteDoc, getDoc, runTransaction, writeBatch, collection, query, where, getDocs } from '../firebase'
import UserSearchSelect from '../components/UserSearchSelect'
import { useToast } from '../context/ToastContext'

function CupManagement() {
  const { getAllUsers, getCups, getFixtures, getResults, advanceCupBracket, triggerDataRefresh, dataRefreshTrigger, notifyUser } = useAuth()
  const { showToast } = useToast()
  const [refreshKey, setRefreshKey] = useState(0)
  const [cups, setCups] = useState([])
  const [expandedCups, setExpandedCups] = useState({})
  const [allCupFixtures, setAllCupFixtures] = useState([])
  const [allCupResults, setAllCupResults] = useState([])
  const [showResultModal, setShowResultModal] = useState(false)
  const [showSwapModal, setShowSwapModal] = useState(false)
  const [showSetPlayerModal, setShowSetPlayerModal] = useState(false)
  const [setPlayerForm, setSetPlayerForm] = useState({
    cup: null,
    match: null,
    position: 1,
    playerId: ''
  })
  const [swapCup, setSwapCup] = useState(null)
  const [playerToRemove, setPlayerToRemove] = useState('')
  const [playerToAdd, setPlayerToAdd] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const syncInProgressRef = useRef(false)
  const [editingDeadlines, setEditingDeadlines] = useState(null)
  const [deadlinesForm, setDeadlinesForm] = useState({})
  const [editingPrize, setEditingPrize] = useState(null)
  const [prizeForm, setPrizeForm] = useState({ prizePool: 0, entryFee: 0 })
  const [resultForm, setResultForm] = useState({
    cup: null,
    match: null,
    score1: '',
    score2: '',
    p1_180s: '0',
    p2_180s: '0',
    p1_checkout: '0',
    p2_checkout: '0',
    p1_doubles: '0',
    p2_doubles: '0',
    p1_avg: '',
    p2_avg: ''
  })
  const allUsers = useMemo(() => getAllUsers(), [getAllUsers])

  const handleUpdateCurrentRound = async (cup) => {
    const newVal = prompt(`Enter new Current Round for "${cup.name}" (0 for Group Stage, 1+ for Knockout):`, cup.currentRound || 0)
    if (newVal === null) return
    const round = parseInt(newVal)
    if (isNaN(round)) return alert('Please enter a valid number')

    setIsSubmitting(true)
    try {
      await setDoc(doc(db, 'cups', String(cup.id)), { currentRound: round }, { merge: true })
      showToast(`Current round updated to ${round === 0 ? 'Group Stage (0)' : `Round ${round}`}!`, 'success')
      triggerDataRefresh('cups')
      setRefreshKey(prev => prev + 1)
    } catch (e) {
      showToast('Error: ' + e.message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAdvanceGroups = async (cup) => {
    if (!window.confirm('This will calculate final group standings and advance the top players to the knockout bracket. Ensure all group matches are entered. Continue?')) return

    setIsSubmitting(true)
    try {
      const cupRef = doc(db, 'cups', String(cup.id))
      const cupSnap = await getDoc(cupRef)
      if (!cupSnap.exists()) throw new Error('Cup not found')
      const cupData = cupSnap.data()

      const allResultsData = getResults().filter(r => String(r.cupId) === String(cup.id) && String(r.status).toLowerCase() === 'approved')

      const standings = {}
      cupData.matches.filter(m => m.stage === 'groups').forEach(match => {
        const gId = match.group
        if (!standings[gId]) standings[gId] = {}
        const p1 = match.player1
        const p2 = match.player2
        if (p1 && !standings[gId][p1]) standings[gId][p1] = { id: p1, played: 0, won: 0, lost: 0, legsFor: 0, legsAgainst: 0, points: 0 }
        if (p2 && !standings[gId][p2]) standings[gId][p2] = { id: p2, played: 0, won: 0, lost: 0, legsFor: 0, legsAgainst: 0, points: 0 }

        const res = allResultsData.find(r => String(r.matchId) === String(match.id))
        if (res && p1 && p2) {
          standings[gId][p1].played++
          standings[gId][p2].played++
          standings[gId][p1].legsFor += res.score1
          standings[gId][p1].legsAgainst += res.score2
          standings[gId][p2].legsFor += res.score2
          standings[gId][p2].legsAgainst += res.score1
          if (res.score1 > res.score2) { standings[gId][p1].won++; standings[gId][p1].points += 2; standings[gId][p2].lost++ }
          else if (res.score2 > res.score1) { standings[gId][p2].won++; standings[gId][p2].points += 2; standings[gId][p1].lost++ }
        }
      })

      const advanceCount = cupData.type === 'group_knockout' ? (cupData.advancePerGroup || 2) : 2

      const sortedGroups = {}
      const extraPlacedPlayers = []

      Object.keys(standings).forEach(gId => {
        const sorted = Object.values(standings[gId]).sort((a,b) => (b.points - a.points) || (b.legsFor - b.legsAgainst) - (a.legsFor - a.legsAgainst) || (b.legsFor - a.legsFor))
        sortedGroups[gId] = sorted

        // Collect the next-placed player beyond the direct qualifiers
        if (cupData.type === 'group_knockout' || cupData.allowBestThird) {
          const nextIndex = advanceCount
          // RULE: Only consider if they are NOT the last placed player in the group
          if (sorted[nextIndex] && nextIndex < sorted.length - 1) {
            extraPlacedPlayers.push({ ...sorted[nextIndex], group: gId })
          }
        }
      })

      // Sort extras and limit to Top 4 as per specific league rules
      const bestExtraPlaced = extraPlacedPlayers
        .sort((a, b) => (b.points - a.points) || (b.legsFor - b.legsAgainst) - (a.legsFor - a.legsAgainst) || (b.legsFor - a.legsFor))
        .slice(0, 4)

      const updatedMatches = [...cupData.matches]
      const newFixtures = []
      const qualifiedPlayers = new Set()

      updatedMatches.filter(m => m.stage === 'knockout' && m.round === 1).forEach(m => {
        const mIdx = updatedMatches.findIndex(um => um.id === m.id)
        if (m.sourceP1) {
          if (m.sourceP1.bestThird || m.sourceP1.bestExtra) {
            const qualified = bestExtraPlaced[m.sourceP1.position - 1]
            if (qualified) {
                updatedMatches[mIdx].player1 = qualified.id
                qualifiedPlayers.add(qualified.id)
            }
          } else {
            const qualified = sortedGroups[m.sourceP1.group]?.[m.sourceP1.position - 1]
            if (qualified) {
                updatedMatches[mIdx].player1 = qualified.id
                qualifiedPlayers.add(qualified.id)
            }
          }
        }
        if (m.sourceP2) {
          if (m.sourceP2.bestThird || m.sourceP2.bestExtra) {
            const qualified = bestExtraPlaced[m.sourceP2.position - 1]
            if (qualified) {
                updatedMatches[mIdx].player2 = qualified.id
                qualifiedPlayers.add(qualified.id)
            }
          } else {
            const qualified = sortedGroups[m.sourceP2.group]?.[m.sourceP2.position - 1]
            if (qualified) {
                updatedMatches[mIdx].player2 = qualified.id
                qualifiedPlayers.add(qualified.id)
            }
          }
        }

        const updatedM = updatedMatches[mIdx]
        if (updatedM.player1 && updatedM.player2) {
           const format = cupData.roundFormats?.[1] || { startScore: 501, bestOf: 3, firstTo: 2 }
           newFixtures.push({
             id: `cup_${cup.id}_match_${updatedM.id}`,
             cupId: isNaN(parseInt(cup.id)) ? cup.id : parseInt(cup.id),
             cupName: cupData.name,
             startScore: format.startScore,
             bestOf: format.bestOf,
             firstTo: format.firstTo || Math.ceil(format.bestOf / 2),
             player1: updatedM.player1,
             player1Id: updatedM.player1,
             player2: updatedM.player2,
             player2Id: updatedM.player2,
             matchId: updatedM.id,
             round: 1,
             status: 'accepted',
             proposalStatus: 'accepted',
             createdAt: new Date().toISOString()
           })
        }
      })

      await setDoc(cupRef, { ...cupData, matches: updatedMatches, groupsAdvanced: true, currentRound: 1, status: 'active' }, { merge: true })
      const batch = writeBatch(db)
      newFixtures.forEach(f => batch.set(doc(db, 'fixtures', f.id), f))
      await batch.commit()

      // Notify qualified players
      for (const pid of Array.from(qualifiedPlayers)) {
          notifyUser(pid, 'Cup Knockout Started!', `You have qualified for the knockout stage of ${cupData.name}! Check your fixtures.`, 'cup_started')
      }

      showToast('Group stage finalized and knockout phase (Round 1) has begun!', 'success')
      triggerDataRefresh('all')
      setRefreshKey(prev => prev + 1)
    } catch (e) {
      showToast('Error advancing groups: ' + e.message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSyncExistingWinners = async (silent = false) => {
    if (syncInProgressRef.current) return
    if (!silent && !window.confirm('This will scan all approved Cup results and ensure winners are advanced in their brackets and fixtures are created for ready matches. Continue?')) return
    syncInProgressRef.current = true

    setIsSubmitting(true)
    setSyncResult(null)
    let totalAdvanced = 0
    let errors = 0
    try {
      const allCups = getCups()
      const allResultsData = getResults().filter(r => String(r.status).toLowerCase() === 'approved')

      for (const cup of allCups) {
        try {
          await runTransaction(db, async (transaction) => {
            const cupRef = doc(db, 'cups', String(cup.id))
            const cupSnap = await transaction.get(cupRef)
            if (!cupSnap.exists()) return

            let cupData = cupSnap.data()
            let matches = [...(cupData.matches || [])]
            let cupChanges = 0

            // Sort rounds ascending to process sequentially
            const rounds = Array.from(new Set(matches.map(m => m.round))).sort((a, b) => a - b)
            const cupResultsList = allResultsData.filter(r => String(r.cupId) === String(cup.id))

            for (const round of rounds) {
              const roundMatches = matches.filter(m => m.round === round)

              for (const m of roundMatches) {
                const mIdx = matches.findIndex(match => String(match.id) === String(m.id))
                let winnerId = matches[mIdx].winner

                // 1. Check for results if no winner yet
                if (!winnerId) {
                  let res = cupResultsList.find(r => String(r.matchId) === String(m.id))

                  // Fallback: search by player names if matchId is missing
                  if (!res && m.player1 && m.player2) {
                    res = cupResultsList.find(r =>
                      (String(r.player1Id) === String(m.player1) && String(r.player2Id) === String(m.player2)) ||
                      (String(r.player2Id) === String(m.player1) && String(r.player1Id) === String(m.player2))
                    )
                  }

                  if (res) {
                    winnerId = res.score1 > res.score2 ? res.player1Id : res.player2Id
                    const isP1 = String(res.player1Id) === String(matches[mIdx].player1)
                    matches[mIdx] = {
                      ...matches[mIdx],
                      winner: winnerId,
                      score1: isP1 ? res.score1 : res.score2,
                      score2: isP1 ? res.score2 : res.score1,
                      resultId: res.id
                    }
                    cupChanges++
                  }
                  // 2. Check for Byes if still no winner and no result
                  else {
                    const isBye = (m.player1 && !m.player2) || (!m.player1 && m.player2)
                    if (isBye) {
                      winnerId = m.player1 || m.player2
                      matches[mIdx] = { ...matches[mIdx], winner: winnerId, score1: 1, score2: 0 }
                      cupChanges++
                    }
                  }
                }

                // 3. Propagate winner to next round
                if (winnerId && m.nextMatchId) {
                  const nextMIdx = matches.findIndex(nm => String(nm.id) === String(m.nextMatchId))
                  if (nextMIdx !== -1) {
                    const siblings = matches
                      .filter(sm => sm.round === m.round && String(sm.nextMatchId) === String(m.nextMatchId))
                      .sort((a,b) => {
                        const diff = (Number(a.matchNum)||0) - (Number(b.matchNum)||0)
                        if (diff !== 0) return diff
                        return String(a.id).localeCompare(String(b.id))
                      })

                    const pos = siblings.findIndex(sm => String(sm.id) === String(m.id))
                    const target = pos === 0 ? 'player1' : 'player2'

                    if (matches[nextMIdx][target] !== winnerId) {
                      console.log(`Advancing ${getPlayerName(winnerId)} to ${target} in ${getRoundName(matches[nextMIdx].round, 5)}`)
                      matches[nextMIdx] = { ...matches[nextMIdx], [target]: winnerId }
                      cupChanges++
                    }
                  }
                }
              }
            }

            if (cupChanges > 0) {
              const allComplete = matches.every(m => (m.player1 && m.player2) ? m.winner : true)
              let currentRound = (cupData.currentRound !== undefined) ? cupData.currentRound : 1

              // Only auto-advance knockout rounds (1+). Groups (0) must be advanced manually.
              if (currentRound > 0) {
                while (matches.filter(m => Number(m.round) === currentRound).every(m => m.winner)) {
                  const maxRound = Math.max(...matches.map(m => m.round))
                  if (currentRound < maxRound) currentRound++
                  else break
                }
              }

              transaction.update(cupRef, { matches, status: allComplete ? 'completed' : 'active', currentRound })
              totalAdvanced += cupChanges

              // Create fixtures for ready matches
              const existingFixtures = getFixtures()
              for (const m of matches) {
                if (m.player1 && m.player2 && !m.winner) {
                  const fId = `cup_${cup.id}_match_${m.id}`

                  // Optimization: Only check/set if it doesn't exist locally to save quota
                  const existsLocally = existingFixtures.some(f => String(f.id) === fId)
                  if (!existsLocally) {
                    const fRef = doc(db, 'fixtures', fId)
                    const fSnap = await transaction.get(fRef)
                    if (!fSnap.exists()) {
                      const fmt = cupData.roundFormats?.[m.round] || { startScore: 501, bestOf: 3, firstTo: 2 }
                      transaction.set(fRef, {
                        id: fId, cupId: parseInt(cup.id), cupName: cupData.name,
                        startScore: fmt.startScore, bestOf: fmt.bestOf,
                        firstTo: fmt.firstTo || Math.ceil(fmt.bestOf / 2),
                        player1: m.player1, player1Id: m.player1,
                        player2: m.player2, player2Id: m.player2,
                        matchId: m.id, round: m.round, status: 'accepted',
                        proposalStatus: 'accepted',
                        createdAt: new Date().toISOString()
                      })
                    }
                  }
                }
              }
            }
          })
        } catch (e) {
          if (e.code === 'resource-exhausted') {
            console.error('Firestore Quota Exceeded.')
            errors++
          } else {
            console.error(`Sync error for cup ${cup.id}:`, e)
            errors++
          }
        }
      }

      if (!silent) {
        if (errors > 0) alert('Sync partially failed due to database limits (Quota Exceeded). Some brackets may not have updated.')
        else alert(`Sync complete!\nProcessed advancements: ${totalAdvanced}`)
      }
      setSyncResult({ advanced: totalAdvanced, skipped: 0, errors })
      triggerDataRefresh('all')
      setRefreshKey(prev => prev + 1)
    } catch (err) {
      if (!silent) alert('Sync failed: ' + err.message)
    } finally {
      setIsSubmitting(false)
      syncInProgressRef.current = false
    }
  }

  useEffect(() => {
    try {
      const cupsData = getCups()
      setCups(Array.isArray(cupsData) ? cupsData : [])
      setAllCupFixtures(getFixtures())
      setAllCupResults(getResults())
    } catch (err) {
      console.error('Error loading data in CupManagement:', err)
    }
  }, [refreshKey, getCups, getFixtures, getResults])

  // Auto-sync once on mount (silently) to fix any un-advanced results
  useEffect(() => {
    const autoSynced = sessionStorage.getItem('cupManagementAutoSynced')
    if (!autoSynced) {
      sessionStorage.setItem('cupManagementAutoSynced', 'true')
      handleSyncExistingWinners(true)
    }
  }, [])

  const getPlayerName = (id) => {
    if (!id) return 'TBD'
    const userProfile = allUsers.find(u => String(u.id) === String(id))
    return userProfile?.username || 'Unknown'
  }

  const getRoundName = (round, totalRoundsCount) => {
    if (Number(round) === Number(totalRoundsCount)) return 'Final'
    if (Number(round) === Number(totalRoundsCount) - 1) return 'Semi-Final'
    if (Number(round) === Number(totalRoundsCount) - 2) return 'Quarter-Final'
    return `Round ${round}`
  }

  const toggleCup = (cupId) => {
    setExpandedCups(prev => ({
      ...prev,
      [cupId]: !prev[cupId]
    }))
  }

  const enterResult = (cup, match) => {
    setResultForm({
      cup,
      match,
      score1: '',
      score2: '',
      p1_180s: '0',
      p2_180s: '0',
      p1_checkout: '0',
      p2_checkout: '0',
      p1_doubles: '0',
      p2_doubles: '0',
      p1_avg: '',
      p2_avg: ''
    })
    setShowResultModal(true)
  }

  const resetResult = async (cup, match) => {
    if (!window.confirm('Reset this match result? This will remove the winner and clear the score.')) return

    try {
      const cupRef = doc(db, 'cups', String(cup.id))
      const cupSnap = await getDoc(cupRef)
      if (!cupSnap.exists()) return alert('Cup not found in database.')

      const cupData = cupSnap.data()
      const updatedMatches = cupData.matches.map(m => {
        if (String(m.id) === String(match.id)) {
          return { ...m, winner: null, score1: null, score2: null, resultId: null }
        }

        const newM = { ...m }
        if (m.round > match.round) {
           const matchPlayer1 = String(match.player1)
           const matchPlayer2 = String(match.player2)

           let changed = false
           if (String(m.player1) === matchPlayer1 || String(m.player1) === matchPlayer2) {
              newM.player1 = null
              changed = true
           }
           if (String(m.player2) === matchPlayer1 || String(m.player2) === matchPlayer2) {
              newM.player2 = null
              changed = true
           }

           if (changed) {
              newM.winner = null
              newM.score1 = null
              newM.score2 = null
              newM.resultId = null
           }
        }
        return newM
      })

      const updatedCup = { ...cupData, matches: updatedMatches }
      await setDoc(cupRef, updatedCup, { merge: true })

      // Sync localStorage
      const localCups = JSON.parse(localStorage.getItem('eliteArrowsCups') || '[]')
      const localIdx = localCups.findIndex(c => String(c.id) === String(cup.id))
      if (localIdx !== -1) {
        localCups[localIdx] = updatedCup
        localStorage.setItem('eliteArrowsCups', JSON.stringify(localCups))
      }
      setCups(prev => {
        const next = [...prev]
        const idx = next.findIndex(c => String(c.id) === String(cup.id))
        if (idx !== -1) next[idx] = updatedCup
        return next
      })

      alert('Result reset successfully.')
      triggerDataRefresh('all')
      setRefreshKey(prev => prev + 1)
    } catch (err) {
      alert('Reset error: ' + err.message)
    }
  }

  const submitResult = async () => {
    if (isSubmitting) return
    const { cup, match, score1, score2, p1_180s, p2_180s, p1_checkout, p2_checkout, p1_doubles, p2_doubles, p1_avg, p2_avg } = resultForm

    if (!cup || !match || !match.player1 || !match.player2) {
      alert('Error: Bracket data is incomplete. Please refresh and try again.')
      return
    }

    const s1 = parseInt(score1)
    const s2 = parseInt(score2)
    
    if (isNaN(s1) || isNaN(s2)) return alert('Please enter scores for both players.')
    if (s1 === s2) return alert('Draws are not permitted in Cup matches.')

    if (!p1_avg || !p2_avg) return alert('Please enter 3-dart averages for both players.')

    setIsSubmitting(true)
    const winnerId = s1 > s2 ? match.player1 : match.player2
    const resultId = `admin_cup_${Date.now()}`

    try {
      // 1. Save Result Record
      const approvedResult = {
        id: resultId,
        player1: getPlayerName(match.player1),
        player1Id: match.player1,
        player2: getPlayerName(match.player2),
        player2Id: match.player2,
        score1: s1,
        score2: s2,
        gameType: 'Cup',
        cupId: cup.id,
        matchId: match.id,
        cupName: cup.name,
        status: 'approved',
        date: new Date().toISOString().split('T')[0],
        submittedAt: new Date().toISOString(),
        submittedBy: 'admin',
        player1Stats: {
          '180s': parseInt(p1_180s) || 0,
          highestCheckout: parseInt(p1_checkout) || 0,
          doubleSuccess: parseFloat(p1_doubles) || 0,
          avg: parseFloat(p1_avg) || 0
        },
        player2Stats: {
          '180s': parseInt(p2_180s) || 0,
          highestCheckout: parseInt(p2_checkout) || 0,
          doubleSuccess: parseFloat(p2_doubles) || 0,
          avg: parseFloat(p2_avg) || 0
        }
      }
      
      await setDoc(doc(db, 'results', resultId), approvedResult)

      // 2. Use shared advancement logic
      await advanceCupBracket(approvedResult)

      setShowResultModal(false)
      alert('Result saved and winner advanced!')
      triggerDataRefresh('all')
      setRefreshKey(prev => prev + 1)
    } catch (err) {
      alert('Database error: ' + err.message)
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSwapPlayerInBracket = async () => {
    if (!swapCup || !playerToRemove || !playerToAdd) return showToast('Please select both players', 'error')

    setIsSubmitting(true)
    try {
      const cupRef = doc(db, 'cups', String(swapCup.id))
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
        players: g.players.map(pid => String(pid) === String(playerToRemove) ? playerToAdd : pid)
      }))

      // 3. Update all matches (swap the ID everywhere it appears)
      const updatedMatches = cupData.matches.map(m => ({
        ...m,
        player1: String(m.player1) === String(playerToRemove) ? playerToAdd : m.player1,
        player2: String(m.player2) === String(playerToRemove) ? playerToAdd : m.player2,
        winner: String(m.winner) === String(playerToRemove) ? playerToAdd : m.winner
      }))

      await setDoc(cupRef, { ...cupData, players: updatedPlayers, groups: updatedGroups, matches: updatedMatches }, { merge: true })

      // 4. Update Fixtures (sync names and IDs)
      const fixturesSnap = await getDocs(query(collection(db, 'fixtures'), where('cupId', 'in', [String(swapCup.id), parseInt(swapCup.id)])))
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

      showToast(`Swapped player in bracket and ${fixtureCount} fixtures.`, 'success')
      setShowSwapModal(false)
      setPlayerToRemove('')
      setPlayerToAdd('')
      triggerDataRefresh('all')
      setRefreshKey(prev => prev + 1)
    } catch (e) {
      showToast('Error: ' + e.message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSetMatchPlayer = async () => {
    const { cup, match, position, playerId } = setPlayerForm
    if (!cup || !match || !playerId) return showToast('Please select a player', 'error')

    setIsSubmitting(true)
    try {
      const cupRef = doc(db, 'cups', String(cup.id))
      const cupSnap = await getDoc(cupRef)
      if (!cupSnap.exists()) throw new Error('Cup not found')

      const cupData = cupSnap.data()
      const newPlayer = allUsers.find(u => u.id === playerId)
      if (!newPlayer) throw new Error('Player not found')

      const updatedMatches = (cupData.matches || []).map(m => {
        if (String(m.id) === String(match.id)) {
          return {
            ...m,
            [position === 1 ? 'player1' : 'player2']: playerId
          }
        }
        return m
      })

      const updatedPlayers = [...(cupData.players || [])]
      if (!updatedPlayers.includes(playerId)) {
        updatedPlayers.push(playerId)
      }

      const nextCupData = { ...cupData, players: updatedPlayers, matches: updatedMatches }
      await setDoc(cupRef, nextCupData, { merge: true })

      // Create fixture if both players now exist
      const updatedMatch = updatedMatches.find(m => String(m.id) === String(match.id))
      if (updatedMatch.player1 && updatedMatch.player2) {
        const existingFixture = (getFixtures() || []).find(f => String(f.matchId) === String(updatedMatch.id))
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

      showToast('Set player for match.', 'success')
      setShowSetPlayerModal(false)
      triggerDataRefresh('all')
      setRefreshKey(prev => prev + 1)
    } catch (e) {
      showToast('Error: ' + e.message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSavePrize = async () => {
    if (!editingPrize) return
    setIsSubmitting(true)
    try {
      await setDoc(doc(db, 'cups', String(editingPrize.id)), {
        prizePool: parseFloat(prizeForm.prizePool) || 0,
        entryFee: parseFloat(prizeForm.entryFee) || 0
      }, { merge: true })
      showToast('Prize info updated!', 'success')
      setEditingPrize(null)
      triggerDataRefresh('cups')
    } catch (e) {
      showToast('Error saving prize info: ' + e.message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveDeadlines = async () => {
    if (!editingDeadlines) return
    setIsSubmitting(true)
    try {
      await setDoc(doc(db, 'cups', String(editingDeadlines.id)), { deadlines: deadlinesForm }, { merge: true })
      showToast('Deadlines updated!', 'success')
      setEditingDeadlines(null)
      triggerDataRefresh('cups')
    } catch (e) {
      showToast('Error saving deadlines: ' + e.message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '100px' }}>
      <div className="card glass" style={{ padding: '20px', border: '1px solid var(--accent-cyan)' }}>
        <h3 className="card-title">Cup Progression Tools</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '15px' }}>
          If a player has won but isn't advanced in the bracket, use this tool to sync all approved results.
        </p>
        <button className="btn btn-primary" onClick={() => handleSyncExistingWinners(false)} disabled={isSubmitting}>
          {isSubmitting ? 'Syncing...' : 'Sync Brackets with Results'}
        </button>
        {syncResult && (
          <div style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Last sync: {syncResult.advanced} advanced, {syncResult.skipped} skipped, {syncResult.errors} errors
          </div>
        )}
      </div>

      {cups.map(cup => {
        const knockoutMatches = cup.matches?.filter(m => m.round) || []
        const totalRounds = knockoutMatches.length > 0 ? Math.max(...knockoutMatches.map(m => m.round)) : 1
        const isExpanded = expandedCups[cup.id]
        const sortedMatches = [...(cup.matches || [])].sort((a, b) => {
          if (a.stage === 'groups' && b.stage === 'knockout') return -1
          if (a.stage === 'knockout' && b.stage === 'groups') return 1
          if (a.round !== b.round) return (a.round || 0) - (b.round || 0)
          return (a.matchNum || 0) - (b.matchNum || 0)
        })

        return (
          <div key={cup.id} className="card glass animate-fade-in" style={{ padding: '0', border: '1px solid rgba(129, 140, 248, 0.2)', overflow: 'hidden' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '24px',
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.02)'
              }}
              onClick={() => toggleCup(cup.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{
                  fontSize: '1.2rem',
                  transition: 'transform 0.2s',
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  color: 'var(--accent-cyan)'
                }}>▶</span>
                <div>
                  <h2 className="text-gradient" style={{ fontSize: '1.5rem', marginBottom: '4px', fontWeight: 900 }}>{cup.name}</h2>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.65rem',
                      background: cup.status === 'active' ? 'var(--success-bg)' : 'rgba(255,255,255,0.1)',
                      color: cup.status === 'active' ? 'var(--success)' : 'var(--text-muted)',
                      padding: '2px 8px',
                      borderRadius: '20px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>{cup.status || 'Planned'}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', opacity: 0.6 }}>ID: {cup.id} | {cup.type}</span>
                    <button
                      className="btn btn-secondary btn-xs"
                      style={{ padding: '2px 8px', fontSize: '0.6rem' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateCurrentRound(cup);
                      }}
                    >
                      Round: {cup.currentRound === 0 ? 'Groups (0)' : (cup.currentRound || 1)} ✏️
                    </button>
                  </div>
                  {cup.roundFormats?._stageDays && (
                    <div style={{ marginTop: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                        ⏱ {cup.roundFormats._stageDays} DAYS PER STAGE
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingDeadlines(cup)
                    setDeadlinesForm(cup.deadlines || {})
                  }}
                >
                  📅 Deadlines
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', background: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.3)' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingPrize(cup)
                    setPrizeForm({
                      prizePool: cup.prizePool || (cup.entryFee * (cup.players?.length || 0)),
                      entryFee: cup.entryFee || 0
                    })
                  }}
                >
                  💰 Prize
                </button>
                {(cup.type === 'group_knockout' || cup.type === 'world_cup') && !cup.groupsAdvanced && (
                   <button
                     className="btn btn-primary btn-sm"
                     onClick={(e) => { e.stopPropagation(); handleAdvanceGroups(cup); }}
                     disabled={isSubmitting}
                   >
                     ⚡ Finalize Groups
                   </button>
                )}
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', background: 'rgba(56, 189, 248, 0.1)', borderColor: 'var(--accent-cyan)' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSwapCup(cup)
                    setShowSwapModal(true)
                  }}
                >
                  🔄 Swap Participant
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ color: 'var(--error)', borderColor: 'rgba(239, 68, 68, 0.2)', padding: '6px 12px' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (window.confirm('Delete this cup?')) {
                      deleteDoc(doc(db, 'cups', String(cup.id))).then(() => triggerDataRefresh('cups'))
                    }
                  }}
                >
                  Delete Cup
                </button>
              </div>
            </div>

            {isExpanded && (
              <div style={{ padding: '24px' }} className="animate-fade-in">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {sortedMatches.map(match => {
                    const isWinnerSet = !!match.winner
                    const p1 = getPlayerName(match.player1)
                    const p2 = getPlayerName(match.player2)

                    let roundLabel = getRoundName(match.round, totalRounds)
                    if (match.stage === 'groups') roundLabel = `GROUP ${match.group}`

                    return (
                      <div key={match.id} style={{
                        padding: '20px',
                        borderRadius: '16px',
                        background: isWinnerSet ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255,255,255,0.03)',
                        border: isWinnerSet ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(255,255,255,0.08)',
                        transition: 'all 0.2s ease',
                        position: 'relative',
                        overflow: 'hidden'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
                           <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{roundLabel}</span>
                           {isWinnerSet && <span style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--success)', background: 'var(--success-bg)', padding: '2px 8px', borderRadius: '4px' }}>COMPLETED</span>}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 12px',
                                background: isWinnerSet && match.winner === match.player1 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,0,0,0.2)',
                                borderRadius: '8px',
                                border: isWinnerSet && match.winner === match.player1 ? '1px solid var(--success)' : '1px solid transparent',
                                cursor: 'pointer'
                              }}
                              onClick={() => {
                                setSetPlayerForm({
                                  cup,
                                  match,
                                  position: 1,
                                  playerId: match.player1 || ''
                                })
                                setShowSetPlayerModal(true)
                              }}
                            >
                               <span style={{ fontWeight: isWinnerSet && match.winner === match.player1 ? 800 : 500, fontSize: '0.9rem' }}>{p1}</span>
                               {isWinnerSet && <span style={{ fontWeight: 900, color: 'var(--success)' }}>{match.score1}</span>}
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 12px',
                                background: isWinnerSet && match.winner === match.player2 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,0,0,0.2)',
                                borderRadius: '8px',
                                border: isWinnerSet && match.winner === match.player2 ? '1px solid var(--success)' : '1px solid transparent',
                                cursor: 'pointer'
                              }}
                              onClick={() => {
                                setSetPlayerForm({
                                  cup,
                                  match,
                                  position: 2,
                                  playerId: match.player2 || ''
                                })
                                setShowSetPlayerModal(true)
                              }}
                            >
                               <span style={{ fontWeight: isWinnerSet && match.winner === match.player2 ? 800 : 500, fontSize: '0.9rem' }}>{p2}</span>
                               {isWinnerSet && <span style={{ fontWeight: 900, color: 'var(--success)' }}>{match.score2}</span>}
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {!isWinnerSet ? (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => enterResult(cup, match)}
                                disabled={!match.player1 || !match.player2}
                                style={{ padding: '8px 12px', fontSize: '0.75rem' }}
                              >
                                Enter
                              </button>
                            ) : (
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ opacity: 0.6, padding: '8px 12px', fontSize: '0.75rem' }}
                                onClick={() => resetResult(cup, match)}
                              >
                                Reset
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {showResultModal && (
        <div className="modal-overlay">
          <div className="modal-content glass" style={{ maxWidth: '460px' }}>
            <h3 style={{ marginBottom: '24px', textAlign: 'center', fontSize: '1.5rem', fontWeight: 900 }} className="text-gradient">Enter Cup Result</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
               <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.75rem' }}>{getPlayerName(resultForm.match?.player1)} (Legs)</label>
                  <input type="number" placeholder="0" value={resultForm.score1} onChange={e => setResultForm({...resultForm, score1: e.target.value})} />
               </div>
               <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.75rem' }}>{getPlayerName(resultForm.match?.player2)} (Legs)</label>
                  <input type="number" placeholder="0" value={resultForm.score2} onChange={e => setResultForm({...resultForm, score2: e.target.value})} />
               </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)', marginBottom: '32px' }}>
              <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px', color: 'var(--accent-cyan)', textAlign: 'center' }}>Match Statistics</h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.65rem' }}>P1 3-Dart Avg</label>
                      <input type="number" step="0.01" value={resultForm.p1_avg} onChange={e => setResultForm({...resultForm, p1_avg: e.target.value})} style={{ padding: '8px 12px', fontSize: '0.9rem' }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.65rem' }}>P1 180s</label>
                      <input type="number" value={resultForm.p1_180s} onChange={e => setResultForm({...resultForm, p1_180s: e.target.value})} style={{ padding: '8px 12px', fontSize: '0.9rem' }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.65rem' }}>P1 Checkout</label>
                      <input type="number" value={resultForm.p1_checkout} onChange={e => setResultForm({...resultForm, p1_checkout: e.target.value})} style={{ padding: '8px 12px', fontSize: '0.9rem' }} />
                    </div>
                 </div>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.65rem' }}>P2 3-Dart Avg</label>
                      <input type="number" step="0.01" value={resultForm.p2_avg} onChange={e => setResultForm({...resultForm, p2_avg: e.target.value})} style={{ padding: '8px 12px', fontSize: '0.9rem' }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.65rem' }}>P2 180s</label>
                      <input type="number" value={resultForm.p2_180s} onChange={e => setResultForm({...resultForm, p2_180s: e.target.value})} style={{ padding: '8px 12px', fontSize: '0.9rem' }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.65rem' }}>P2 Checkout</label>
                      <input type="number" value={resultForm.p2_checkout} onChange={e => setResultForm({...resultForm, p2_checkout: e.target.value})} style={{ padding: '8px 12px', fontSize: '0.9rem' }} />
                    </div>
                 </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
               <button className="btn btn-secondary btn-block" onClick={() => setShowResultModal(false)}>Cancel</button>
               <button className="btn btn-primary btn-block" onClick={submitResult} disabled={isSubmitting}>
                 {isSubmitting ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="spinner" style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
                      Syncing...
                    </span>
                 ) : 'Save & Advance'}
               </button>
            </div>
          </div>
        </div>
      )}

      {showSetPlayerModal && (
        <div className="modal-overlay">
          <div className="modal-content glass" style={{ maxWidth: '400px' }}>
            <h3 style={{ marginBottom: '20px' }}>Set Match Participant</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Manually assign a player to <strong>Position {setPlayerForm.position}</strong> in this match.
            </p>

            <div className="form-group">
              <label>Select Player</label>
              <UserSearchSelect
                users={allUsers}
                selectedId={setPlayerForm.playerId}
                onSelect={(id) => setSetPlayerForm({...setPlayerForm, playerId: id})}
                label=""
                placeholder="Search for player..."
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
              <button className="btn btn-secondary btn-block" onClick={() => setShowSetPlayerModal(false)}>Cancel</button>
              <button
                className="btn btn-primary btn-block"
                onClick={handleSetMatchPlayer}
                disabled={isSubmitting || !setPlayerForm.playerId}
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
              Replace a participant throughout the entire bracket and all fixtures for <strong>{swapCup?.name}</strong>.
            </p>

            <div className="form-group">
              <label>Player to Remove</label>
              <select
                className="glass"
                value={playerToRemove}
                onChange={e => setPlayerToRemove(e.target.value)}
              >
                <option value="">Select participant...</option>
                {swapCup?.players?.map(pid => {
                  const p = allUsers.find(u => u.id === pid)
                  return <option key={pid} value={pid}>{p?.username || pid}</option>
                })}
              </select>
            </div>

            <div className="form-group">
              <label>Replacement Player</label>
              <UserSearchSelect
                users={allUsers.filter(u => !(swapCup?.players || []).includes(u.id))}
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
                onClick={handleSwapPlayerInBracket}
                disabled={isSubmitting || !playerToRemove || !playerToAdd}
              >
                {isSubmitting ? 'Swapping...' : 'Perform Swap'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingDeadlines && (
        <div className="modal-overlay">
          <div className="modal-content glass" style={{ maxWidth: '500px' }}>
            <h3 style={{ marginBottom: '20px' }} className="text-gradient">Tournament Deadlines</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Set completion deadlines for each stage of <strong>{editingDeadlines.name}</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '400px', overflowY: 'auto', paddingRight: '5px' }}>
              <div className="form-group">
                <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>Group Stage Deadline</label>
                <input
                  type="text"
                  placeholder="e.g. 15th July"
                  value={deadlinesForm.groups || ''}
                  onChange={e => setDeadlinesForm({...deadlinesForm, groups: e.target.value})}
                />
              </div>

              {Array.from({ length: 6 }, (_, i) => i + 1).map(round => (
                <div key={round} className="form-group">
                  <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>
                    Round {round} Deadline
                    {round === Math.max(...(editingDeadlines.matches?.map(m => m.round) || [0])) && ' (Final)'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 20th July"
                    value={deadlinesForm[round] || ''}
                    onChange={e => setDeadlinesForm({...deadlinesForm, [round]: e.target.value})}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
              <button className="btn btn-secondary btn-block" onClick={() => setEditingDeadlines(null)}>Cancel</button>
              <button className="btn btn-primary btn-block" onClick={handleSaveDeadlines} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Deadlines'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingPrize && (
        <div className="modal-overlay">
          <div className="modal-content glass" style={{ maxWidth: '400px' }}>
            <h3 style={{ marginBottom: '20px' }} className="text-gradient">Edit Prize Pool</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Update the financial details for <strong>{editingPrize.name}</strong>.
            </p>

            <div className="form-group">
              <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>Total Prize Pool (£)</label>
              <input
                type="number"
                step="0.01"
                value={prizeForm.prizePool}
                onChange={e => setPrizeForm({...prizeForm, prizePool: e.target.value})}
              />
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>Entry Fee (£)</label>
              <input
                type="number"
                step="0.01"
                value={prizeForm.entryFee}
                onChange={e => setPrizeForm({...prizeForm, entryFee: e.target.value})}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
              <button className="btn btn-secondary btn-block" onClick={() => setEditingPrize(null)}>Cancel</button>
              <button className="btn btn-primary btn-block" onClick={handleSavePrize} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Update Prize'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CupManagement
