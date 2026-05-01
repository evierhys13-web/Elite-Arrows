import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { db, doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, collection, query, where } from '../firebase'
import CupManagement from './CupManagement'
import UserSearchSelect from '../components/UserSearchSelect'
import { getNormalizedResultSignature, getResultOverrideKeys, getResultSignature } from '../utils/resultIdentity'

export default function Admin() {
  const { user, notifications, getAllUsers, updateUser, updateOtherUser, getResults, getFixtures, updateFixtures, getCups, getSupportRequests, getSeasons, getNews, postNews, deleteNews, togglePinNews, adminData, updateAdminData, addToMoneyHistory, triggerDataRefresh, dataRefreshTrigger, notifyUser, notifyAllSubscribers } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const subscriptionPot = adminData.subscriptionPot || 0
  const subscriptionPot10 = adminData.subscriptionPot10 || 0
  const tournamentPot = adminData.tournamentPot || 0
  const moneyHistory = adminData.moneyHistory || []
  const [gameForm, setGameForm] = useState({
    player1: '',
    player2: '',
    score1: '',
    score2: '',
    gameType: 'Friendly',
    division: ''
  })
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setRefreshKey(prev => prev + 1)
  }, [dataRefreshTrigger])
  const [pendingResults, setPendingResults] = useState([])
  const [resultFilter, setResultFilter] = useState('pending')
  const [approvedResults, setApprovedResults] = useState([])
  const [toast, setToast] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [activeTab, setActiveTab] = useState('results')
  const [showConfirmModal, setShowConfirmModal] = useState(null)
  const [proofPreviewResult, setProofPreviewResult] = useState(null)
  const [showColorsForm, setShowColorsForm] = useState(false)
  const [colors, setColors] = useState({
    primary: localStorage.getItem('eliteArrowsColors') ? JSON.parse(localStorage.getItem('eliteArrowsColors')).primary : '#00d4ff',
    background: localStorage.getItem('eliteArrowsColors') ? JSON.parse(localStorage.getItem('eliteArrowsColors')).background : '#0a0a1a',
    button: localStorage.getItem('eliteArrowsColors') ? JSON.parse(localStorage.getItem('eliteArrowsColors')).button : '#00d4ff'
  })
  const [selectedAssignUser, setSelectedAssignUser] = useState('')
  const [selectedRemoveSubUser, setSelectedRemoveSubUser] = useState('')

  useEffect(() => {
    const tab = searchParams.get('tab')
    const allowedTabs = new Set([
      'results',
      'submit-game',
      'payments',
      'moneypot',
      'cups',
      'players',
      'support',
      'fixture-activity',
      'news',
      'subscriptions',
      'admins',
      'seasons',
      'tokens',
      'games',
      'appearance'
    ])
    if (tab && allowedTabs.has(tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [refreshKey])

  const clearCacheAndReload = () => {
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name))
      })
    }
    localStorage.removeItem('eliteArrowsUsers')
    window.location.reload(true)
  }

  const refreshUsers = () => {
    setRefreshKey(k => k + 1)
  }

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const showSuccessMessage = (message) => {
    setSuccessMessage(message)
    setTimeout(() => {
      setSuccessMessage('')
    }, 1800)
  }

  const hasResultProof = (result) => (
    typeof result.proofImage === 'string' && result.proofImage.trim().length > 0
  )

  const renderResultProof = (result, showMissing = false) => {
    if (!hasResultProof(result)) {
      if (!showMissing) return null
      return (
        <div style={{
          width: '100%',
          padding: '12px',
          marginBottom: '12px',
          border: '1px dashed var(--border)',
          borderRadius: '8px',
          color: 'var(--text-muted)',
          background: 'var(--bg-secondary)'
        }}>
          No proof uploaded for this result.
        </div>
      )
    }

    return (
      <div style={{ width: '100%', marginBottom: '12px' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '8px' }}>
          Proof of result
        </div>
        <button
          type="button"
          onClick={() => setProofPreviewResult(result)}
          style={{
            display: 'block',
            width: '100%',
            maxWidth: '360px',
            padding: 0,
            border: '1px solid var(--border)',
            borderRadius: '8px',
            overflow: 'hidden',
            background: 'var(--bg-primary)',
            cursor: 'pointer',
            textAlign: 'left'
          }}
          aria-label={`View proof for ${result.player1} versus ${result.player2}`}
        >
          <img
            src={result.proofImage}
            alt={`Proof for ${result.player1} versus ${result.player2}`}
            style={{
              display: 'block',
              width: '100%',
              maxHeight: '220px',
              objectFit: 'contain',
              background: '#000'
            }}
          />
          <span style={{
            display: 'block',
            padding: '8px 10px',
            color: 'var(--accent-cyan)',
            fontSize: '0.85rem',
            fontWeight: 700
          }}>
            View full proof
          </span>
        </button>
      </div>
    )
  }

  const persistResultStatusOverride = async (result, status) => {
    const nextOverrides = {
      ...(adminData.resultStatusOverrides || {})
    }
    const override = {
      status,
      resultId: result.id ? String(result.id) : String(result.firestoreId || ''),
      firestoreId: result.firestoreId || null,
      signature: getResultSignature(result),
      normalizedSignature: getNormalizedResultSignature(result),
      updatedAt: new Date().toISOString()
    }

    getResultOverrideKeys(result).forEach(key => {
      nextOverrides[key] = override
    })
    localStorage.setItem('eliteArrowsResultStatusOverrides', JSON.stringify(nextOverrides))
    await updateAdminData({ resultStatusOverrides: nextOverrides })
  }

  const getResultDocIds = async (result) => {
    const logicalId = result.id ? String(result.id) : null
    const preferredId = result.firestoreId ? String(result.firestoreId) : logicalId
    const fallbackIds = new Set([logicalId, preferredId].filter(Boolean))
    const docIds = new Set()

    const snapshot = await getDocs(collection(db, 'results'))
    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data()
      const dataIds = [data.id, data.firestoreId, docSnap.id].filter(Boolean).map(String)
      const sameLogicalId = [logicalId, preferredId].filter(Boolean).some(id => dataIds.includes(id))
      const sameFixture = result.fixtureId && String(data.fixtureId || '') === String(result.fixtureId)
      const sameCupMatch = result.cupId && result.matchId &&
        String(data.cupId || '') === String(result.cupId) &&
        String(data.matchId || '') === String(result.matchId)
      const samePlayersById =
        result.player1Id &&
        result.player2Id &&
        String(data.player1Id) === String(result.player1Id) &&
        String(data.player2Id) === String(result.player2Id)
      const samePlayersByIdReversed =
        result.player1Id &&
        result.player2Id &&
        String(data.player1Id) === String(result.player2Id) &&
        String(data.player2Id) === String(result.player1Id)
      const samePlayersByName =
        result.player1 &&
        result.player2 &&
        String(data.player1 || '').trim().toLowerCase() === String(result.player1).trim().toLowerCase() &&
        String(data.player2 || '').trim().toLowerCase() === String(result.player2).trim().toLowerCase()
      const samePlayersByNameReversed =
        result.player1 &&
        result.player2 &&
        String(data.player1 || '').trim().toLowerCase() === String(result.player2).trim().toLowerCase() &&
        String(data.player2 || '').trim().toLowerCase() === String(result.player1).trim().toLowerCase()
      const sameGame =
        (
          ((samePlayersById || samePlayersByName) &&
            String(data.score1) === String(result.score1) &&
            String(data.score2) === String(result.score2)) ||
          ((samePlayersByIdReversed || samePlayersByNameReversed) &&
            String(data.score1) === String(result.score2) &&
            String(data.score2) === String(result.score1))
        ) &&
        data.date === result.date &&
        data.gameType === result.gameType

      if (sameLogicalId || sameFixture || sameCupMatch || sameGame) {
        docIds.add(docSnap.id)
      }
    })

    return Array.from(docIds.size ? docIds : fallbackIds)
  }

  const syncFixtureAfterResultReview = async (result, reviewStatus) => {
    const fixtures = getFixtures()
    const fixtureIndex = fixtures.findIndex(fixture => (
      String(fixture.id) === String(result.fixtureId || '') ||
      (
        result.cupId &&
        result.matchId &&
        String(fixture.cupId || '') === String(result.cupId) &&
        String(fixture.matchId || '') === String(result.matchId)
      )
    ))
    if (fixtureIndex === -1) return

    const isApproved = reviewStatus === 'approved'
    const now = new Date().toISOString()
    const updatedFixture = {
      ...fixtures[fixtureIndex],
      status: isApproved ? 'approved' : 'accepted',
      updatedAt: now,
      resultId: isApproved ? result.id : null,
      submittedResultId: isApproved ? result.id : null,
      score1: isApproved ? Number(result.score1) : null,
      score2: isApproved ? Number(result.score2) : null
    }

    const updatedFixtures = [...fixtures]
    updatedFixtures[fixtureIndex] = updatedFixture
    updateFixtures(updatedFixtures)
    await setDoc(doc(db, 'fixtures', String(updatedFixture.id)), updatedFixture, { merge: true })
    triggerDataRefresh('fixtures')
  }

  const syncCupApproval = async (result) => {
    if (result.gameType !== 'Cup' || !result.cupId || !result.matchId) return

    const cups = getCups()
    const cupIndex = cups.findIndex(cup => String(cup.id) === String(result.cupId))
    if (cupIndex === -1) return

    const cup = { ...cups[cupIndex] }
    const match = cup.matches?.find(item => String(item.id) === String(result.matchId))
    if (!match) return

    const score1 = Number(result.score1)
    const score2 = Number(result.score2)
    const winnerId = score1 > score2 ? result.player1Id : result.player2Id
    const now = new Date().toISOString()

    let updatedMatches = cup.matches.map(item => (
      String(item.id) === String(match.id)
        ? {
          ...item,
          player1: item.player1 || result.player1Id,
          player2: item.player2 || result.player2Id,
          winner: winnerId,
          score1,
          score2,
          resultId: result.id
        }
        : { ...item }
    ))

    if (match.nextMatchId) {
      updatedMatches = updatedMatches.map(item => {
        if (String(item.id) !== String(match.nextMatchId)) return item
        if (item.player1 === winnerId || item.player2 === winnerId) return item
        if (!item.player1) return { ...item, player1: winnerId }
        if (!item.player2) return { ...item, player2: winnerId }
        return item
      })
    }

    const allComplete = updatedMatches.every(item => {
      if (!item.player1 || !item.player2) return true
      return item.winner !== null && item.winner !== undefined
    })
    const nextOpenRound = updatedMatches
      .filter(item => item.player1 && item.player2 && !item.winner)
      .sort((a, b) => a.round - b.round)[0]?.round

    const updatedCup = {
      ...cup,
      matches: updatedMatches,
      status: allComplete ? 'completed' : 'active',
      currentRound: nextOpenRound || cup.currentRound || 1,
      updatedAt: now
    }

    const updatedCups = [...cups]
    updatedCups[cupIndex] = updatedCup
    localStorage.setItem('eliteArrowsCups', JSON.stringify(updatedCups))
    await setDoc(doc(db, 'cups', String(cup.id)), updatedCup, { merge: true })

    const fixtures = getFixtures()
    const updatedFixtures = [...fixtures]
    const currentFixtureIndex = updatedFixtures.findIndex(fixture => (
      String(fixture.id) === String(result.fixtureId || '') ||
      (String(fixture.cupId) === String(result.cupId) && String(fixture.matchId) === String(result.matchId))
    ))

    if (currentFixtureIndex !== -1) {
      updatedFixtures[currentFixtureIndex] = {
        ...updatedFixtures[currentFixtureIndex],
        status: 'approved',
        score1,
        score2,
        winnerId,
        resultId: result.id,
        updatedAt: now
      }
      await setDoc(doc(db, 'fixtures', String(updatedFixtures[currentFixtureIndex].id)), updatedFixtures[currentFixtureIndex], { merge: true })
    }

    const nextMatch = match.nextMatchId
      ? updatedMatches.find(item => String(item.id) === String(match.nextMatchId))
      : null
    const nextFixtureExists = nextMatch
      ? updatedFixtures.some(fixture => String(fixture.cupId) === String(cup.id) && String(fixture.matchId) === String(nextMatch.id))
      : true

    if (nextMatch?.player1 && nextMatch?.player2 && !nextFixtureExists) {
      const roundFormat = cup.roundFormats?.[nextMatch.round] || {}
      const bestOf = roundFormat.bestOf || 3
      const nextFixture = {
        id: Date.now() + Number(nextMatch.id || 0),
        cupId: cup.id,
        cupName: cup.name,
        startScore: roundFormat.startScore || 501,
        bestOf,
        firstTo: Math.ceil(bestOf / 2),
        player1: nextMatch.player1,
        player1Id: nextMatch.player1,
        player2: nextMatch.player2,
        player2Id: nextMatch.player2,
        matchId: nextMatch.id,
        round: nextMatch.round,
        date: '',
        time: '',
        scheduledBy: nextMatch.player1,
        status: 'pending',
        proposalStatus: 'needs_scheduling',
        proposedDate: '',
        proposedTime: '',
        counterDate: '',
        counterTime: '',
        createdAt: now
      }

      updatedFixtures.push(nextFixture)
      await setDoc(doc(db, 'fixtures', String(nextFixture.id)), nextFixture, { merge: true })
      await Promise.all([nextMatch.player1, nextMatch.player2].map(playerId =>
        notifyUser(
          playerId,
          'Cup Match Ready',
          `${cup.name} ${getRoundNameForCup(nextMatch.round, updatedCup)} is ready. Propose a date and time in cup fixtures.`,
          'cup_match',
          { fixtureKind: 'cup', fixtureId: nextFixture.id, cupId: cup.id, url: '/cup-fixtures' }
        )
      ))
    }

    updateFixtures(updatedFixtures)
    triggerDataRefresh('cups')
    triggerDataRefresh('fixtures')
  }

  const getRoundNameForCup = (round, cup) => {
    const totalRounds = Math.max(...(cup.matches?.map(match => match.round) || [1]))
    if (round === totalRounds) return 'Final'
    if (round === totalRounds - 1) return 'Semi-Final'
    if (round === totalRounds - 2) return 'Quarter-Final'
    return `Round ${round}`
  }

  useEffect(() => {
    const results = getResults();
    const pending = results.filter(r => r.status === 'pending');
    const managed = results.filter(r => ['pending', 'approved', 'rejected'].includes(r.status));
    if (user.isTournamentAdmin && !user.isAdmin) {
      setPendingResults(pending.filter(r => r.gameType === 'Tournament'));
      setApprovedResults(managed.filter(r => r.gameType === 'Tournament'));
    } else {
      setPendingResults(pending);
      setApprovedResults(managed);
    }

    if (user?.isAdmin) {
      let seasons = JSON.parse(localStorage.getItem('eliteArrowsSeasons') || '[]')
      if (seasons.length === 0) {
        seasons.push({ id: Date.now(), name: 'Season 1', createdAt: new Date().toISOString(), status: 'active', isArchived: false, startDate: '2026-05-01', endDate: '2026-06-01' })
        localStorage.setItem('eliteArrowsSeasons', JSON.stringify(seasons))
        localStorage.setItem('eliteArrowsCurrentSeason', 'Season 1')
      } else {
        seasons = seasons.map(s => {
          if (!s.startDate || !s.endDate || isNaN(new Date(s.startDate).getTime()) || isNaN(new Date(s.endDate).getTime())) {
            return { ...s, startDate: '2026-05-01', endDate: '2026-06-01' }
          }
          return s
        })
        localStorage.setItem('eliteArrowsSeasons', JSON.stringify(seasons))
        if (!localStorage.getItem('eliteArrowsCurrentSeason')) {
          localStorage.setItem('eliteArrowsCurrentSeason', seasons[0].name)
        }
      }
    }
  }, [user.isAdmin, user.isTournamentAdmin, dataRefreshTrigger]);

  const approveResult = async (resultId) => {
    const resultIdStr = String(resultId)
    console.log('Approve called with ID:', resultIdStr)
    
    const results = getResults()
    const resultsIndex = results.findIndex(r => String(r.id) === resultIdStr)
    
    if (resultsIndex === -1) {
      alert('Result not found')
      return
    }
    
    if (results[resultsIndex].gameType === 'Cup' && Number(results[resultsIndex].score1) === Number(results[resultsIndex].score2)) {
      alert('Cup matches cannot be approved with a tied score.')
      return
    }

    const reviewedAt = new Date().toISOString()
    const updatedResult = {
      ...results[resultsIndex],
      status: 'approved',
      approvedAt: reviewedAt,
      updatedAt: reviewedAt
    }
    const resultDocIds = await getResultDocIds(updatedResult)
    results[resultsIndex] = updatedResult
    localStorage.setItem('eliteArrowsResults', JSON.stringify(results))
    console.log('Updated localStorage')
    
    setPendingResults(prev => prev.filter(r => String(r.id) !== resultIdStr))
    setApprovedResults(prev => {
      const withoutResult = prev.filter(r => String(r.id) !== resultIdStr)
      return [updatedResult, ...withoutResult]
    })
    
    try {
      await Promise.all(resultDocIds.map(resultDocId =>
        setDoc(doc(db, 'results', resultDocId), { ...updatedResult, firestoreId: resultDocId }, { merge: true })
      ))
      await syncFixtureAfterResultReview(updatedResult, 'approved')
      await syncCupApproval(updatedResult)
      await persistResultStatusOverride(updatedResult, 'approved')
      console.log('Successfully approved in Firebase!')
      triggerDataRefresh('results')
      showSuccessMessage('You have successfully approved a result')
    } catch (e) {
      alert('ERROR: ' + e.code + ' - ' + e.message)
      console.error('FATAL Firebase error:', e.code, e.message)
    }
  }

  const rejectResult = async (resultId) => {
    const resultIdStr = String(resultId)
    console.log('Reject called with ID:', resultIdStr)
    
    const results = getResults()
    const resultsIndex = results.findIndex(r => String(r.id) === resultIdStr)
    
    if (resultsIndex === -1) {
      alert('Result not found')
      return
    }
    
    const updatedResult = { ...results[resultsIndex], status: 'rejected', updatedAt: new Date().toISOString() }
    const resultDocIds = await getResultDocIds(updatedResult)
    results[resultsIndex] = updatedResult
    localStorage.setItem('eliteArrowsResults', JSON.stringify(results))
    console.log('Updated localStorage')
    setPendingResults(prev => prev.filter(r => String(r.id) !== resultIdStr))
    setApprovedResults(prev => {
      const withoutResult = prev.filter(r => String(r.id) !== resultIdStr)
      return [updatedResult, ...withoutResult]
    })
    
    try {
      await Promise.all(resultDocIds.map(resultDocId =>
        setDoc(doc(db, 'results', resultDocId), { ...updatedResult, firestoreId: resultDocId }, { merge: true })
      ))
      await syncFixtureAfterResultReview(updatedResult, 'rejected')
      await persistResultStatusOverride(updatedResult, 'rejected')
      console.log('Successfully updated Firebase!')
    } catch (e) {
      console.error('FATAL Firebase error:', e.code, e.message)
    }

    showToast('Result rejected')
  }

  const resetResultStatus = async (resultId) => {
    const resultIdStr = String(resultId)
    if (!confirm('Reset this result status? It will be removed from approved result management.')) return
    
    const results = getResults()
    const resultsIndex = results.findIndex(r => String(r.id) === resultIdStr)
    
    if (resultsIndex === -1) {
      alert('Result not found')
      return
    }
    
    const updatedResult = { ...results[resultsIndex], status: null, updatedAt: new Date().toISOString() }
    const resultDocIds = await getResultDocIds(updatedResult)
    results[resultsIndex] = updatedResult
    localStorage.setItem('eliteArrowsResults', JSON.stringify(results))
    
    setApprovedResults(prev => prev.filter(r => String(r.id) !== resultIdStr))
    setPendingResults(prev => prev.filter(r => String(r.id) !== resultIdStr))
    
    try {
      await Promise.all(resultDocIds.map(resultDocId =>
        setDoc(doc(db, 'results', resultDocId), { ...updatedResult, firestoreId: resultDocId }, { merge: true })
      ))
      await syncFixtureAfterResultReview(updatedResult, null)
      await persistResultStatusOverride(updatedResult, null)
      triggerDataRefresh('results')
      showToast('Result status reset')
    } catch (e) {
      alert('ERROR: ' + e.message)
      console.error(e)
    }
  }

  const approvePayment = async (userId) => {
    const users = getAllUsers()
    const index = users.findIndex(u => u.id === userId)
    if (index === -1) {
      alert('User not found')
      return
    }

    try {
      const userDivision = users[index].division
      const isHighTier = userDivision === 'Elite' || userDivision === 'Diamond'
      const amount = isHighTier ? 10 : 5
      
      const seasonStart = new Date('2026-05-01')
      const seasonEnd = new Date('2026-06-01')
      const now = new Date()
      
      const updates = {
        isSubscribed: true,
        paymentPending: false,
        subscriptionDate: now.toISOString(),
        subscriptionExpiry: now < seasonStart ? seasonEnd.toISOString() : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        subscriptionSource: 'payment'
      }
      
      // Filter out undefined values
      const cleanUpdates = {}
      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
          cleanUpdates[key] = updates[key]
        }
      })
      
      // Update Firestore
      await setDoc(doc(db, 'users', userId), cleanUpdates, { merge: true })
      
      // Update local state
      users[index] = { ...users[index], ...cleanUpdates }
      localStorage.setItem('eliteArrowsUsers', JSON.stringify(users))
      
      if (isHighTier) {
        await updateAdminData({ subscriptionPot10: subscriptionPot10 + amount })
      } else {
        await updateAdminData({ subscriptionPot: subscriptionPot + amount })
      }
      addToMoneyHistory('subscription', amount, `Payment from ${users[index].username}`)
      
      alert('Payment approved!')
    } catch (e) {
      console.error(e)
      alert('Error: ' + e.message)
    }
  }

  const rejectPayment = (userId) => {
    const users = getAllUsers()
    const index = users.findIndex(u => u.id === userId)
    if (index !== -1) {
      users[index].paymentPending = false
      users[index].paymentProof = null
      users[index].paymentMethod = null
      localStorage.setItem('eliteArrowsUsers', JSON.stringify(users))
    }
  }

  const createTournament = () => {
    if (!tournamentForm.name) return alert('Please enter a tournament name')
    const tournaments = JSON.parse(localStorage.getItem('eliteArrowsTournaments') || '[]')
    tournaments.push({
      id: Date.now(),
      ...tournamentForm,
      createdAt: new Date().toISOString(),
      createdBy: user.id,
      createdByName: user.username,
      status: 'open',
      rounds: []
    })
    localStorage.setItem('eliteArrowsTournaments', JSON.stringify(tournaments))
    setShowTournamentForm(false)
    setTournamentForm({ name: '', type: 'knockout', divisions: [], entryFee: 0, isCashBased: false, prizeInfo: '', maxParticipants: 16, entryDeadline: '', daysBetweenRounds: 3, formatR1: '3', formatR2: '3', formatQF: '3', formatSF: '5', formatF: '7' })
    alert('Tournament created!')
  }

  const saveColors = () => {
    localStorage.setItem('eliteArrowsColors', JSON.stringify(colors))
    document.documentElement.style.setProperty('--accent-primary', colors.primary)
    document.documentElement.style.setProperty('--bg-primary', colors.background)
    document.documentElement.style.setProperty('--button-color', colors.button)
    setShowColorsForm(false)
    alert('Colors saved!')
  }

  const submitAdminGame = async () => {
    if (!gameForm.player1 || !gameForm.player2 || !gameForm.score1 || !gameForm.score2) {
      alert('Please fill in all required fields')
      return
    }

    const player1User = getAllUsers().find(u => u.id === gameForm.player1)
    const player2User = getAllUsers().find(u => u.id === gameForm.player2)

    const results = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]')
    const resultId = Date.now().toString()
    const approvedAt = new Date().toISOString()
    const newResult = {
      id: resultId,
      firestoreId: resultId,
      player1: player1User.username,
      player1Id: player1User.id,
      player2: player2User.username,
      player2Id: player2User.id,
      score1: parseInt(gameForm.score1),
      score2: parseInt(gameForm.score2),
      division: gameForm.division || player1User.division,
      gameType: gameForm.gameType,
      season: new Date().getFullYear().toString(),
      date: new Date().toISOString().split('T')[0],
      submittedAt: approvedAt,
      approvedAt,
      updatedAt: approvedAt,
      bestOf: '3',
      firstTo: '3',
      proofImage: '',
      submittedBy: 'admin',
      status: 'approved'
    }
    results.push(newResult)
    localStorage.setItem('eliteArrowsResults', JSON.stringify(results))
    await setDoc(doc(db, 'results', resultId), newResult, { merge: true })

    alert('Game submitted and approved!')
    setShowSubmitGame(false)
    setGameForm({ player1: '', player2: '', score1: '', score2: '', gameType: 'Friendly', division: '' })
  }

  const pendingAdmins = getAllUsers().filter(u => u.adminRequestPending && !u.isAdmin && !u.isTournamentAdmin)
  const pendingPayments = getAllUsers().filter(u => u.paymentPending && !u.isSubscribed)
  const subscribers = getAllUsers().filter(u => u.isSubscribed)
  const freeUsers = getAllUsers().filter(u => !u.isSubscribed && !u.paymentPending)
  const tournamentAdmins = getAllUsers().filter(u => u.isTournamentAdmin)
  const fixtureActivity = notifications.filter(n => n.type === 'fixture_activity').slice(0, 50)

  const ADMIN_EMAILS = ['rhyshowe2023@outlook.com', 'dhineberry@yahoo.com']
  const isEmailAdmin = ADMIN_EMAILS.includes(user?.email?.toLowerCase())
  const isDbAdmin = user?.isAdmin === true
  const canAccess = isEmailAdmin || isDbAdmin || user?.isTournamentAdmin || user?.isCupAdmin
  
  if (!canAccess) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Access Denied</h1>
        </div>
        <div className="card">
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
            You do not have access to this page.
          </p>
        </div>
      </div>
    );
  }

  const isFullAdmin = user?.isAdmin || ADMIN_EMAILS.includes(user?.email?.toLowerCase())
  const filteredManagedResults = approvedResults.filter(result => (
    resultFilter === 'all' ? true : result.status === resultFilter
  ))

  return (
    <div className="page">
      {successMessage && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            width: 'min(420px, 100%)',
            background: 'var(--bg-secondary)',
            border: '2px solid var(--success)',
            borderRadius: '12px',
            padding: '28px',
            textAlign: 'center',
            boxShadow: '0 12px 40px rgba(0,0,0,0.45)'
          }}>
            <div style={{ fontSize: '2rem', color: 'var(--success)', fontWeight: 800, marginBottom: '10px' }}>Success</div>
            <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 600 }}>
              {successMessage}
            </p>
          </div>
        </div>
      )}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 10000,
          padding: '12px 18px',
          borderRadius: '8px',
          background: toast.type === 'success' ? 'var(--success)' : 'var(--accent-cyan)',
          color: '#000',
          fontWeight: 700,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)'
        }}>
          {toast.message}
        </div>
      )}
      <div className="page-header">
        <h1 className="page-title">Admin Panel</h1>
      </div>

      {isFullAdmin && (
        <div className="home-stats-grid" style={{ marginBottom: '20px' }}>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>{pendingResults.length}</div>
            <div className="stat-label">Pending Results</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--warning)' }}>{pendingPayments.length}</div>
            <div className="stat-label">Pending Payments</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--success)' }}>£{subscriptionPot + subscriptionPot10}</div>
            <div className="stat-label">Subscription Pot</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--accent-primary)' }}>{getAllUsers().length}</div>
            <div className="stat-label">Total Players</div>
          </div>
        </div>
      )}

      <div className="division-tabs">
        {isFullAdmin && (
          <>
            <button
              className={`division-tab ${activeTab === 'results' ? 'active' : ''}`}
              onClick={() => setActiveTab('results')}
            >
              Pending Results ({pendingResults.length})
            </button>
            <button
              className={`division-tab ${activeTab === 'submit-game' ? 'active' : ''}`}
              onClick={() => setActiveTab('submit-game')}
            >
              Submit Game
            </button>
          </>
        )}
        {isFullAdmin && (
          <button
            className={`division-tab ${activeTab === 'payments' ? 'active' : ''}`}
            onClick={() => setActiveTab('payments')}
          >
            Payments ({pendingPayments.length})
          </button>
        )}
        {isFullAdmin && (
          <button
            className={`division-tab ${activeTab === 'moneypot' ? 'active' : ''}`}
            onClick={() => setActiveTab('moneypot')}
          >
            Money Pot
          </button>
        )}
        {(isFullAdmin || user?.isCupAdmin) && (
          <button
            className={`division-tab ${activeTab === 'cups' ? 'active' : ''}`}
            onClick={() => setActiveTab('cups')}
          >
            Cup Management
          </button>
        )}
        <button
          className={`division-tab ${activeTab === 'players' ? 'active' : ''}`}
          onClick={() => setActiveTab('players')}
        >
          Players
        </button>
        <button
          className={`division-tab ${activeTab === 'support' ? 'active' : ''}`}
          onClick={() => setActiveTab('support')}
        >
          Support
        </button>
        <button
          className={`division-tab ${activeTab === 'fixture-activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('fixture-activity')}
        >
          Fixture Activity
        </button>
        <button
          className={`division-tab ${activeTab === 'news' ? 'active' : ''}`}
          onClick={() => setActiveTab('news')}
        >
          News
        </button>
        {isFullAdmin && (
          <>
            <button
              className={`division-tab ${activeTab === 'subscriptions' ? 'active' : ''}`}
              onClick={() => setActiveTab('subscriptions')}
            >
              Subscriptions
            </button>
            <button
              className={`division-tab ${activeTab === 'admins' ? 'active' : ''}`}
              onClick={() => setActiveTab('admins')}
            >
              Manage Admins & Members
            </button>
            <button
              className={`division-tab ${activeTab === 'seasons' ? 'active' : ''}`}
              onClick={() => setActiveTab('seasons')}
            >
              Seasons
            </button>
            <button
              className={`division-tab ${activeTab === 'tokens' ? 'active' : ''}`}
              onClick={() => setActiveTab('tokens')}
            >
              Elite Tokens
            </button>
          </>
        )}
        <button
          className={`division-tab ${activeTab === 'games' ? 'active' : ''}`}
          onClick={() => setActiveTab('games')}
        >
          Games
        </button>
        {isFullAdmin && (
          <button
            className={`division-tab ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveTab('appearance')}
          >
            Appearance
          </button>
        )}
      </div>

      {activeTab === 'results' && (
        <div>
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="card-title">Pending Results</h3>
            {pendingResults.length === 0 ? (
              <div className="empty-state">
                <p>No pending results to approve</p>
              </div>
            ) : (
              pendingResults.map(result => (
                <div key={result.id} className="result-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div>
                      <strong>{result.player1}</strong> vs <strong>{result.player2}</strong>
                    </div>
                    <span style={{ color: 'var(--text-muted)' }}>{result.date}</span>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    Score: {result.score1} - {result.score2} | Division: {result.division}
                  </div>
                  {renderResultProof(result, true)}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-primary" onClick={() => setShowConfirmModal({ type: 'approve', result })}>
                      Approve
                    </button>
                    <button className="btn btn-danger" onClick={() => setShowConfirmModal({ type: 'reject', result })}>
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '15px' }}>
              <h3 className="card-title" style={{ margin: 0 }}>Approved Results</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['all', 'pending', 'approved', 'rejected'].map(filter => (
                  <button
                    key={filter}
                    className={`btn btn-sm ${resultFilter === filter ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setResultFilter(filter)}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {filteredManagedResults.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px 10px' }}>
                No {resultFilter === 'all' ? '' : resultFilter} results found
              </p>
            ) : (
              filteredManagedResults.map(result => (
                <div key={result.id} className="result-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <strong>{result.player1}</strong> vs <strong>{result.player2}</strong>
                    </div>
                    <span style={{
                      color: result.status === 'approved' ? 'var(--success)' : result.status === 'rejected' ? 'var(--error)' : 'var(--warning)',
                      fontWeight: 700
                    }}>
                      {(result.status || 'No Status').toUpperCase()}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '12px' }}>
                    {result.score1} - {result.score2} | {result.division} | {result.gameType} | {result.date}
                  </div>
                  {renderResultProof(result)}
                  {result.status === 'pending' ? (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button className="btn btn-primary" onClick={() => setShowConfirmModal({ type: 'approve', result })}>
                        Approve
                      </button>
                      <button className="btn btn-danger" onClick={() => setShowConfirmModal({ type: 'reject', result })}>
                        Reject
                      </button>
                    </div>
                  ) : (
                    <button className="btn btn-secondary" onClick={() => resetResultStatus(result.id)}>
                      Delete/Reset
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'submit-game' && (
        <div className="card">
          <h3 className="card-title">Submit Game (Admin)</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
            Admins can directly submit and approve games without needing player submission or proof
          </p>

          <div className="form-group">
            <label>Game Type</label>
            <select 
              value={gameForm.gameType}
              onChange={(e) => setGameForm({...gameForm, gameType: e.target.value})}
            >
              <option value="Friendly">Friendly</option>
              <option value="League">League</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '15px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <UserSearchSelect
                users={getAllUsers()}
                selectedId={gameForm.player1}
                onSelect={(id) => {
                  const selected = getAllUsers().find(u => u.id === id)
                  setGameForm({...gameForm, player1: id, division: selected?.division || ''})
                }}
                placeholder="Select player 1..."
                label="Player 1"
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <UserSearchSelect
                users={getAllUsers().filter(u => u.id !== gameForm.player1)}
                selectedId={gameForm.player2}
                onSelect={(id) => setGameForm({...gameForm, player2: id})}
                placeholder="Select player 2..."
                label="Player 2"
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '15px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Player 1 Score (Legs Won)</label>
              <input 
                type="number"
                value={gameForm.score1}
                onChange={(e) => setGameForm({...gameForm, score1: e.target.value})}
                min="0"
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Player 2 Score (Legs Won)</label>
              <input 
                type="number"
                value={gameForm.score2}
                onChange={(e) => setGameForm({...gameForm, score2: e.target.value})}
                min="0"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Division</label>
            <select 
              value={gameForm.division}
              onChange={(e) => setGameForm({...gameForm, division: e.target.value})}
            >
              <option value="">Select Division</option>
              <option value="Elite">Elite</option>
              <option value="Diamond">Diamond</option>
              <option value="Platinum">Platinum</option>
              <option value="Gold">Gold</option>
              <option value="Silver">Silver</option>
              <option value="Bronze">Bronze</option>
              <option value="Development">Development</option>
            </select>
          </div>

          <button className="btn btn-primary btn-block" onClick={submitAdminGame}>
            Submit & Approve Game
          </button>
        </div>
      )}

      {activeTab === 'payments' && (
        <div>
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="card-title">Pending Payments ({pendingPayments.length})</h3>
            {pendingPayments.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No pending payments</p>
            ) : (
              pendingPayments.map(u => (
                <div key={u.id} className="player-card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                    <div className="player-avatar">{u.username.charAt(0).toUpperCase()}</div>
                    <div className="player-info">
                      <h3>{u.username}</h3>
                      <p>{u.email}</p>
                    </div>
                  </div>
                  <div style={{ margin: '12px 0' }}>
                    <p><strong>Method:</strong> {u.paymentMethod === 'bank' ? 'Bank Transfer' : 'PayPal'}</p>
                    <p><strong>Date:</strong> {u.paymentDate ? new Date(u.paymentDate).toLocaleDateString() : 'N/A'}</p>
                  </div>
                  {u.paymentProof && (
                    <div style={{ marginBottom: '12px' }}>
                      <p style={{ marginBottom: '8px' }}><strong>Proof of Payment:</strong></p>
                      <img src={u.paymentProof} alt="Proof" style={{ maxWidth: '200px', borderRadius: '8px' }} />
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-primary" onClick={() => approvePayment(u.id)}>Approve</button>
                    <button className="btn btn-danger" onClick={() => rejectPayment(u.id)}>Reject</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="card">
            <h3 className="card-title">All Subscribers ({subscribers.length})</h3>
            {subscribers.map(u => (
              <div key={u.id} className="player-card">
                <div className="player-avatar">{u.username.charAt(0).toUpperCase()}</div>
                <div className="player-info">
                  <h3>{u.username}</h3>
                  <p>{u.email}</p>
                  {u.freeAdminSubscription && <p style={{ color: 'var(--accent-cyan)', fontSize: '0.75rem' }}>Free (Admin)</p>}
                  {u.subscriptionDate && <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Since: {new Date(u.subscriptionDate).toLocaleDateString()}</p>}
                </div>
                <span style={{ color: 'var(--success)' }}>Active</span>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginTop: '20px' }}>
            <h3 className="card-title">Free Users ({freeUsers.length})</h3>
            {freeUsers.map(u => (
              <div key={u.id} className="player-card">
                <div className="player-avatar">{u.username.charAt(0).toUpperCase()}</div>
                <div className="player-info">
                  <h3>{u.username}</h3>
                  <p>{u.email}</p>
                </div>
                <button 
                  className="btn btn-primary"
                  onClick={async () => {
                    const seasonStart = new Date('2026-05-01')
                    const seasonEnd = new Date('2026-06-01')
                    const now = new Date()
                    
                    const cleanUpdates = {
                      isSubscribed: true,
                      freeAdminSubscription: true,
                      subscriptionDate: now.toISOString(),
                      subscriptionExpiry: now < seasonStart ? seasonEnd.toISOString() : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                      subscriptionSource: 'admin_granted'
                    }
                    
                    const users = getAllUsers()
                    const index = users.findIndex(us => us.id === u.id)
                    if (index === -1) return
                    
                    users[index] = { ...users[index], ...cleanUpdates }
                    localStorage.setItem('eliteArrowsUsers', JSON.stringify(users))
                    
                    const amount = 5
                    await updateAdminData({ subscriptionPot: subscriptionPot + amount })
                    addToMoneyHistory('subscription', amount, `Free subscription granted to ${u.username}`)
                    
                    await setDoc(doc(db, 'users', u.id), cleanUpdates, { merge: true })
                    
                    alert(`${u.username} now has free subscription (admin granted)`)
                  }}
                >
                  Grant Free Sub
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'support' && (
        <div>
          <div className="card">
            <h3 className="card-title">Support Requests</h3>
            {(() => {
              const supportRequests = getSupportRequests()
              const pendingRequests = supportRequests.filter(r => r.status === 'pending')
              
              if (pendingRequests.length === 0) {
                return <p style={{ color: 'var(--text-muted)' }}>No support requests</p>
              }
              
              return pendingRequests.map(request => (
                <div key={request.id} className="result-item" style={{ flexDirection: 'column', alignItems: 'flex-start', marginBottom: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '8px' }}>
                    <strong>{request.username}</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {new Date(request.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem', marginBottom: '4px' }}>
                    {request.issue}
                  </p>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>{request.description}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{request.email}</p>
                  <button 
                    className="btn btn-primary btn-block" 
                    style={{ marginTop: '8px'}}
                    onClick={async () => {
                      const all = getSupportRequests()
                      const idx = all.findIndex(r => r.id === request.id)
                      if (idx !== -1) {
                        all[idx].status = 'resolved'
                        localStorage.setItem('eliteArrowsSupportRequests', JSON.stringify(all))
                        try {
                          await setDoc(doc(db, 'supportRequests', request.id.toString()), all[idx], { merge: true })
                        } catch (e) {
                          console.log('Error saving to Firebase:', e)
                        }
                        triggerDataRefresh('supportRequests')
                        alert('Request marked as resolved')
                      }
                    }}
                  >
                    Mark as Resolved
                  </button>
                </div>
              ))
            })()}
          </div>
        </div>
      )}

      {activeTab === 'news' && (
        <div>
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="card-title">Post Announcement</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="text"
                id="newsTitle"
                placeholder="Announcement title..."
                style={{ width: '100%', padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '1rem' }}
              />
              <textarea
                id="newsMessage"
                placeholder="Announcement message..."
                rows={4}
                style={{ width: '100%', padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.95rem', resize: 'vertical', fontFamily: 'inherit' }}
              />
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem', cursor: 'pointer' }}>
                  <input type="checkbox" id="newsPinned" /> Pin to top
                </label>
              </div>
              <button
                className="btn btn-primary btn-block"
                onClick={async () => {
                  const title = document.getElementById('newsTitle').value.trim()
                  const message = document.getElementById('newsMessage').value.trim()
                  const pinned = document.getElementById('newsPinned').checked
                  if (!title || !message) return alert('Please fill in both title and message')
                  await postNews(title, message, pinned)
                  document.getElementById('newsTitle').value = ''
                  document.getElementById('newsMessage').value = ''
                  document.getElementById('newsPinned').checked = false
                  alert('Announcement posted!')
                }}
              >
                Post Announcement
              </button>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">All Announcements</h3>
            {(() => {
              const allNews = getNews()
              if (allNews.length === 0) {
                return <p style={{ color: 'var(--text-muted)' }}>No announcements yet</p>
              }
              return allNews.map(item => (
                <div key={item.id} className="player-card" style={{ marginBottom: '10px' }}>
                  <div className="player-info" style={{ flex: 1 }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {item.pinned && <span style={{ color: 'var(--accent-primary)' }}>📌</span>}
                      {item.title}
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.authorName} · {new Date(item.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => togglePinNews(item.id, item.pinned)}>
                      {item.pinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => { if (confirm('Delete this announcement?')) deleteNews(item.id) }}>
                      Delete
                    </button>
                  </div>
                </div>
              ))
            })()}
          </div>
        </div>
      )}

      {activeTab === 'players' && (
        <div className="card">
          <h3 className="card-title">All Players</h3>
          {getAllUsers().length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No players found</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Division</th>
                  <th>3-Dart Avg</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {getAllUsers().map(player => (
                  <tr key={player.id}>
                    <td>{player.username}</td>
                    <td>{player.email}</td>
                    <td>{player.division || 'Unassigned'}</td>
                    <td>{player.threeDartAverage?.toFixed(2) || 0}</td>
                    <td>
                      <button 
                        className="btn btn-sm"
                        onClick={() => navigate(`/profile/${player.id}`)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

{activeTab === 'subscriptions' && (
        <>
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="card-title">Assign Division & Subscription</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
              Assign a player to a division and/or grant subscription
            </p>
            <UserSearchSelect
              users={getAllUsers()}
              selectedId={selectedAssignUser}
              onSelect={setSelectedAssignUser}
              placeholder="Search for player..."
              label="Select Player"
            />
            
            <select 
              id="assignDivision"
              style={{ width: '100%', padding: '12px', marginBottom: '12px' }}
            >
              <option value="">Select Division</option>
              <option value="Unassigned">Unassigned</option>
              <option value="Elite">Elite</option>
              <option value="Diamond">Diamond</option>
              <option value="Platinum">Platinum</option>
              <option value="Gold">Gold</option>
              <option value="Silver">Silver</option>
              <option value="Bronze">Bronze</option>
              <option value="Development">Development</option>
            </select>
            
            <div className="form-group">
              <label>Subscription Type</label>
              <select id="grantSubType">
                <option value="">Select Pass</option>
                <option value="Elite Pass">Elite Pass (£5)</option>
                <option value="Standard Pass">Standard Pass (£5)</option>
              </select>
            </div>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <input type="checkbox" id="freeSubCheck" />
              <span>Free (Admin Granted)</span>
            </label>
            
            <button 
              className="btn btn-primary"
              onClick={async () => {
                const userId = selectedAssignUser
                const division = document.getElementById('assignDivision').value
                const subType = document.getElementById('grantSubType').value
                const freeSub = document.getElementById('freeSubCheck').checked
                
                if (!userId) return alert('Select a user')
                if (!division && !subType) return alert('Select a division and/or subscription type')
                
                const users = getAllUsers()
                const index = users.findIndex(u => u.id === userId)
                if (index === -1) return
                
                const userUpdates = {}
                if (division) userUpdates.division = division
                if (subType) {
                  const seasonStart = new Date('2026-05-01')
                  const seasonEnd = new Date('2026-06-01')
                  const now = new Date()
                  
                  userUpdates.isSubscribed = true
                  userUpdates.subscriptionType = subType
                  userUpdates.subscriptionDate = now.toISOString()
                  userUpdates.subscriptionExpiry = now < seasonStart ? seasonEnd.toISOString() : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
                  userUpdates.subscriptionSource = freeSub ? 'admin_granted' : 'paid'
                }
                if (freeSub) userUpdates.freeAdminSubscription = true
                
                // Filter out undefined
                const cleanUpdates = {}
                Object.keys(userUpdates).forEach(key => {
                  if (userUpdates[key] !== undefined) {
                    cleanUpdates[key] = userUpdates[key]
                  }
                })
                
                await updateOtherUser(userId, cleanUpdates)
                
                const amount = 5
                if (subType && !freeSub) {
                  await updateAdminData({ subscriptionPot: subscriptionPot + amount })
                }
                addToMoneyHistory('subscription', amount, `Updated ${users[index].username} - ${subType || ''} Division: ${division || 'Unassigned'}`)
                
                alert(`${users[index].username} updated!`)
                setActiveTab('subscriptions')
              }}
            >
              Update User
            </button>
          </div>

          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="card-title">Remove Subscription</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
              Remove subscription from a user
            </p>
            <UserSearchSelect
              users={getAllUsers().filter(u => u.isSubscribed)}
              selectedId={selectedRemoveSubUser}
              onSelect={setSelectedRemoveSubUser}
              placeholder="Search for subscriber..."
              label="Select Subscriber"
            />
            <button 
              className="btn btn-primary"
              style={{ marginTop: '12px' }}
              onClick={async () => {
                if (!selectedRemoveSubUser) return alert('Select a user')
                if (!confirm('Are you sure you want to remove this subscription?')) return
                const users = getAllUsers()
                const index = users.findIndex(u => u.id === selectedRemoveSubUser)
                if (index !== -1) {
                  users[index].isSubscribed = false
                  users[index].freeAdminSubscription = false
                  users[index].paymentPending = false
                  users[index].paymentDate = null
                  users[index].subscriptionDate = null
                  users[index].subscriptionExpiry = null
                  users[index].subscriptionSource = null
                  localStorage.setItem('eliteArrowsUsers', JSON.stringify(users))
                  
                  try {
                    setDoc(doc(db, 'users', users[index].id), {
                      isSubscribed: false,
                      freeAdminSubscription: false,
                      paymentPending: false,
                      paymentDate: null,
                      subscriptionDate: null,
                      subscriptionExpiry: null,
                      subscriptionSource: null
                    }, { merge: true })
                  } catch (err) {
                    console.log('Error saving to Firebase:', err)
                  }
                  
                  alert('Subscription removed')
                  setSelectedRemoveSubUser('')
                }
              }}
            >
              Remove Subscription
            </button>
          </div>

          <div className="card">
            <h3 className="card-title">All Subscribers</h3>
            {subscribers.map(u => (
              <div key={u.id} className="player-card">
                <div className="player-avatar">{u.username.charAt(0).toUpperCase()}</div>
                <div className="player-info">
                  <h3>{u.username}</h3>
                  <p>{u.email}</p>
                </div>
                <span style={{ color: 'var(--success)' }}>
                  {u.freeAdminSubscription ? 'Free (Admin)' : 'Paid'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'admins' && isFullAdmin && (
        <div>
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="card-title">Existing Admins</h3>
            {getAllUsers().filter(u => u.isAdmin).map(u => (
              <div key={u.id} className="player-card">
                <div className="player-avatar">
                  {u.username.charAt(0).toUpperCase()}
                </div>
                <div className="player-info">
                  <h3>{u.username}</h3>
                  <p>{u.email}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {u.id !== user.id && (
                    <button 
                      className="btn btn-danger btn-sm"
                      onClick={async () => {
                        if (confirm(`Remove admin privileges from ${u.username}?`)) {
                          await setDoc(doc(db, 'users', u.id), { isAdmin: false }, { merge: true })
                          
                          const users = getAllUsers()
                          const index = users.findIndex(us => us.id === u.id)
                          if (index !== -1) {
                            users[index].isAdmin = false
                            localStorage.setItem('eliteArrowsUsers', JSON.stringify(users))
                          }
                          
                          alert(`${u.username} is no longer an admin`)
                        }
                      }}
                    >
                      Remove Admin
                    </button>
                  )}
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={async () => {
                      await setDoc(doc(db, 'users', u.id), { isTournamentAdmin: !u.isTournamentAdmin }, { merge: true })
                      
                      const users = getAllUsers()
                      const index = users.findIndex(us => us.id === u.id)
                      if (index !== -1) {
                        users[index].isTournamentAdmin = !u.isTournamentAdmin
                        localStorage.setItem('eliteArrowsUsers', JSON.stringify(users))
                      }
                      
                      alert(`${u.username} ${u.isTournamentAdmin ? 'removed from' : 'added as'} tournament admin`)
                    }}
                  >
                    {u.isTournamentAdmin ? 'Remove Tournament Admin' : 'Add Tournament Admin'}
                  </button>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={async () => {
                      await setDoc(doc(db, 'users', u.id), { isCupAdmin: !u.isCupAdmin }, { merge: true })
                      
                      const users = getAllUsers()
                      const index = users.findIndex(us => us.id === u.id)
                      if (index !== -1) {
                        users[index].isCupAdmin = !u.isCupAdmin
                        localStorage.setItem('eliteArrowsUsers', JSON.stringify(users))
                      }
                      
                      alert(`${u.username} ${u.isCupAdmin ? 'removed from' : 'added as'} cup admin`)
                    }}
                  >
                    {u.isCupAdmin ? 'Remove Cup Admin' : 'Add Cup Admin'}
                  </button>
                  {u.id !== user.id && (
                    <button 
                      className="btn btn-danger btn-sm"
                      style={{ marginTop: '5px' }}
                      onClick={async () => {
                        if (confirm(`Remove ${u.username} from the league entirely?`)) {
                          const userIdToDelete = u.id
                          await deleteDoc(doc(db, 'users', userIdToDelete))
                          const users = getAllUsers().filter(us => us.id !== userIdToDelete)
                          localStorage.setItem('eliteArrowsUsers', JSON.stringify(users))
                          triggerDataRefresh('users')
                        }
                      }}
                    >
                      Remove from League
                    </button>
                  )}
                  {u.id === user.id && (
                    <span style={{ color: 'var(--accent-cyan)', fontSize: '0.8rem' }}>You</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="card-title">Tournament Admins</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
              Tournament admins can manage tournaments and approve tournament results, but cannot submit league/friendly games, manage subscriptions, or change appearance.
            </p>
            {tournamentAdmins.length > 0 ? (
              tournamentAdmins.map(u => (
                <div key={u.id} className="player-card">
                  <div className="player-avatar">
                    {u.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="player-info">
                    <h3>{u.username}</h3>
                    <p>{u.email}</p>
                  </div>
                  <button 
                    className="btn btn-danger"
                    onClick={async () => {
                      if (confirm(`Remove tournament admin privileges from ${u.username}?`)) {
                        await setDoc(doc(db, 'users', u.id), { isTournamentAdmin: false }, { merge: true })
                        
                        const users = getAllUsers()
                        const index = users.findIndex(us => us.id === u.id)
                        if (index !== -1) {
                          users[index].isTournamentAdmin = false
                          localStorage.setItem('eliteArrowsUsers', JSON.stringify(users))
                        }
                        
                        alert(`${u.username} is no longer a tournament admin`)
                      }
                    }}
                  >
                    Remove
                  </button>
                  <button 
                    className="btn btn-danger btn-sm"
                    style={{ marginTop: '5px' }}
                    onClick={async () => {
                      if (confirm(`Remove ${u.username} from the league entirely?`)) {
                        await deleteDoc(doc(db, 'users', u.id))
                        clearCacheAndReload()
                      }
                    }}
                  >
                    Remove from League
                  </button>
                </div>
              ))
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>No tournament admins yet</p>
            )}
            <div style={{ marginTop: '15px' }}>
              <select 
                id="addTournamentAdmin"
                style={{ width: '100%', padding: '12px', marginBottom: '12px' }}
                onChange={async (e) => {
                  if (!e.target.value) return
                  await setDoc(doc(db, 'users', e.target.value), { isTournamentAdmin: true }, { merge: true })
                  
                  const users = getAllUsers()
                  const index = users.findIndex(u => u.id === e.target.value)
                  if (index !== -1) {
                    users[index].isTournamentAdmin = true
                    localStorage.setItem('eliteArrowsUsers', JSON.stringify(users))
                  }
                  
                  alert(`User is now a tournament admin`)
                  e.target.value = ''
                }}
              >
                <option value="">Select user to make Tournament Admin</option>
                {getAllUsers().filter(u => !u.isAdmin && !u.isTournamentAdmin).map(u => (
                  <option key={u.id} value={u.id}>{u.username} ({u.email})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="card-title">Grant Admin Access</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
              Give a user full admin privileges
            </p>
            <select 
              id="grantAdmin"
              style={{ width: '100%', padding: '12px', marginBottom: '12px' }}
              onChange={async (e) => {
                if (!e.target.value) return
                if (!confirm(`Make this user a full admin?`)) {
                  e.target.value = ''
                  return
                }
                await setDoc(doc(db, 'users', e.target.value), {
                  isAdmin: true
                }, { merge: true })
                
                const users = getAllUsers()
                const index = users.findIndex(u => u.id === e.target.value)
                if (index !== -1) {
                  users[index].isAdmin = true
                  localStorage.setItem('eliteArrowsUsers', JSON.stringify(users))
                }
                
                alert(`User is now a full admin`)
                e.target.value = ''
              }}
            >
              <option value="">Select user to make Admin</option>
              {getAllUsers().filter(u => !u.isAdmin).map(u => (
                <option key={u.id} value={u.id}>{u.username} ({u.email})</option>
              ))}
            </select>
          </div>

          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="card-title">All Members - Remove Users</h3>
            {getAllUsers().map(u => (
              <div key={u.id} className="player-card">
                <div className="player-avatar">
                  {u.username.charAt(0).toUpperCase()}
                </div>
                <div className="player-info">
                  <h3>
                    {u.username}
                    {u.isAdmin && <span className="admin-badge" style={{ marginLeft: '8px' }}>Admin</span>}
                    {u.isTournamentAdmin && <span className="admin-badge" style={{ marginLeft: '8px', background: 'var(--accent-cyan)', color: '#000' }}>Tournament Admin</span>}
                    {u.isSubscribed && <span className="admin-badge" style={{ marginLeft: '8px', background: 'var(--success)' }}>Subscribed</span>}
                    {u.paymentPending && <span className="admin-badge" style={{ marginLeft: '8px', background: 'var(--warning)' }}>Pending</span>}
                  </h3>
                  <p>{u.email}</p>
                </div>
                {u.id !== user.id && (
                  <button 
                    className="btn btn-danger"
                    onClick={async () => {
                      if (confirm(`Are you sure you want to remove ${u.username} from the league?`)) {
                        try {
                          await deleteDoc(doc(db, 'users', u.id))
                          setRefreshKey(k => k + 1)
                        } catch (error) {
                          console.error('Error removing user:', error)
                          alert('Failed to remove user: ' + error.message)
                        }
                      }
                    }}
                  >
                    Remove
                  </button>
                )}
                {u.id === user.id && (
                  <span style={{ color: 'var(--accent-cyan)' }}>You</span>
                )}
              </div>
            ))}
          </div>

          <div className="card">
            <h3 className="card-title">Pending Admin Requests ({pendingAdmins.length})</h3>
            {pendingAdmins.length === 0 ? (
              <div className="empty-state">
                <p>No pending admin requests</p>
              </div>
            ) : (
              pendingAdmins.map(u => (
                <div key={u.id} className="player-card">
                  <div className="player-avatar">
                    {u.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="player-info">
                    <h3>{u.username}</h3>
                    <p>{u.email}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      className="btn btn-primary"
                      onClick={async () => {
                        await setDoc(doc(db, 'users', u.id), {
                          isAdmin: true,
                          adminRequestPending: false
                        }, { merge: true });
                        alert(`${u.username} is now an admin`);
                      }}
                    >
                      Approve
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'games' && (
        <div className="card">
          <h3 className="card-title">Manage Games</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>View and manage all games played in the league.</p>
          
          {(() => {
            const games = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]')
            const allUsers = JSON.parse(localStorage.getItem('eliteArrowsUsers') || '[]')
            
            return (
              <div>
                <div style={{ marginBottom: '20px', padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                  <strong>Total Games:</strong> {games.length}
                </div>
                
                {games.length === 0 ? (
                  <div className="empty-state">
                    <p>No games recorded yet.</p>
                  </div>
                ) : (
                  <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '10px', textAlign: 'left' }}>Date</th>
                          <th style={{ padding: '10px', textAlign: 'left' }}>Player 1</th>
                          <th style={{ padding: '10px', textAlign: 'left' }}>Player 2</th>
                          <th style={{ padding: '10px', textAlign: 'left' }}>Score</th>
                          <th style={{ padding: '10px', textAlign: 'left' }}>Type</th>
                          <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {games.slice(0, 50).map((game, index) => {
                          const p1 = allUsers.find(u => u.id === game.player1Id)
                          const p2 = allUsers.find(u => u.id === game.player2Id)
                          return (
                            <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '10px' }}>{new Date(game.date).toLocaleDateString()}</td>
                              <td style={{ padding: '10px' }}>{p1?.username || 'Unknown'}</td>
                              <td style={{ padding: '10px' }}>{p2?.username || 'Unknown'}</td>
                              <td style={{ padding: '10px' }}>{game.score1} - {game.score2}</td>
                              <td style={{ padding: '10px' }}>{game.gameType}</td>
                              <td style={{ padding: '10px' }}>{game.status}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {activeTab === 'fixture-activity' && (
        <div className="card">
          <h3 className="card-title">Fixture Activity</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
            Recent fixture actions across league and cup matches.
          </p>
          {fixtureActivity.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No fixture activity yet.</p>
          ) : (
            fixtureActivity.map((entry) => (
              <div
                key={entry.id}
                style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{entry.message || entry.title}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                    {entry.data?.fixtureKind === 'cup' ? 'Cup' : 'League'} | {entry.data?.action || 'updated'}
                  </div>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                  {new Date(entry.createdAt).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'appearance' && (
        <div className="card">
          <button className="btn btn-primary btn-block" onClick={() => setShowColorsForm(true)} style={{ marginBottom: '20px' }}>
            Customize Colors
          </button>

          {showColorsForm && (
            <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <h4 style={{ marginBottom: '15px' }}>Customize Colors</h4>
              <div className="form-group">
                <label>Primary Color (Accent)</label>
                <input 
                  type="color" 
                  value={colors.primary}
                  onChange={(e) => setColors({...colors, primary: e.target.value})}
                  style={{ width: '100%', height: '40px' }}
                />
              </div>
              <div className="form-group">
                <label>Background Color</label>
                <input 
                  type="color" 
                  value={colors.background}
                  onChange={(e) => setColors({...colors, background: e.target.value})}
                  style={{ width: '100%', height: '40px' }}
                />
              </div>
              <div className="form-group">
                <label>Button Color</label>
                <input 
                  type="color" 
                  value={colors.button}
                  onChange={(e) => setColors({...colors, button: e.target.value})}
                  style={{ width: '100%', height: '40px' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button className="btn btn-primary" onClick={saveColors}>Save Colors</button>
                <button className="btn btn-secondary" onClick={() => setShowColorsForm(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'seasons' && isFullAdmin && (
        <div>
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="card-title">Current Active Season</h3>
            <div style={{ padding: '15px', background: 'var(--accent-cyan)', color: '#000', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold' }}>
              {localStorage.getItem('eliteArrowsCurrentSeason') || new Date().getFullYear().toString()}
            </div>
            {(() => {
              const seasons = getSeasons()
              const activeSeasonName = localStorage.getItem('eliteArrowsCurrentSeason')
              const currentSeason = seasons.find(s => s.name === activeSeasonName)
              if (currentSeason?.startDate && currentSeason?.endDate) {
                return (
                  <p style={{ color: '#000', marginTop: '10px', fontSize: '0.9rem' }}>
                    {new Date(currentSeason.startDate).toLocaleDateString()} - {new Date(currentSeason.endDate).toLocaleDateString()}
                  </p>
                )
              }
              return null
            })()}
          </div>

          <div className="card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 className="card-title" style={{ margin: 0 }}>Seasons</h3>
              <button className="btn btn-primary" onClick={async () => {
                const name = prompt('Enter season name:')
                if (name) {
                  const startDate = prompt('Enter start date (YYYY-MM-DD):', '2025-05-01')
                  const endDate = prompt('Enter end date (YYYY-MM-DD):', '2025-06-01')
                  if (startDate && endDate) {
                    const seasons = getSeasons()
                    const newSeason = { id: Date.now(), name, createdAt: new Date().toISOString(), status: 'active', isArchived: false, startDate, endDate }
                    seasons.push(newSeason)
                    localStorage.setItem('eliteArrowsSeasons', JSON.stringify(seasons))
                    localStorage.setItem('eliteArrowsCurrentSeason', name)
                    try {
                      await setDoc(doc(db, 'seasons', newSeason.id.toString()), newSeason)
                    } catch (e) {
                      console.log('Error saving season to Firebase:', e)
                    }
                    triggerDataRefresh('seasons')
                    alert(`Season "${name}" created! (${startDate} - ${endDate})`)
                  }
                }
              }}>Create New Season</button>
            </div>

            {(() => {
              const seasons = getSeasons()
              const activeSeason = localStorage.getItem('eliteArrowsCurrentSeason') || new Date().getFullYear().toString()
              const activeSeasons = seasons.filter(s => !s.isArchived)
              const archivedSeasons = seasons.filter(s => s.isArchived)
              
              if (seasons.length === 0) {
                return <p style={{ color: 'var(--text-muted)' }}>No seasons created yet.</p>
              }

              return (
                <>
                  {activeSeasons.length > 0 && (
                    <div style={{ marginBottom: '15px' }}>
                      {activeSeasons.map(s => (
                        <div key={s.id} className="player-card">
                          <div className="player-info">
                            <h3>{s.name}</h3>
                            <p style={{ fontSize: '0.8rem' }}>{new Date(s.startDate).toLocaleDateString()} - {new Date(s.endDate).toLocaleDateString()}</p>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {s.name !== activeSeason && (
                              <button className="btn btn-secondary btn-sm" onClick={() => {
                                localStorage.setItem('eliteArrowsCurrentSeason', s.name)
                                triggerDataRefresh('seasons')
                                alert(`Active season changed to "${s.name}"`)
                              }}>Set Active</button>
                            )}
                            <button className="btn btn-danger btn-sm" onClick={async () => {
                              if (confirm('Archive this season?')) {
                                const allSeasons = getSeasons()
                                const updated = allSeasons.map(season => season.id === s.id ? { ...season, isArchived: true, status: 'archived' } : season)
                                localStorage.setItem('eliteArrowsSeasons', JSON.stringify(updated))
                                try {
                                  await setDoc(doc(db, 'seasons', s.id.toString()), { isArchived: true, status: 'archived' }, { merge: true })
                                } catch (e) {
                                  console.log('Error saving to Firebase:', e)
                                }
                                triggerDataRefresh('seasons')
                                alert('Season archived')
                              }
                            }}>Archive</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {archivedSeasons.length > 0 && (
                    <div>
                      <h4 style={{ color: 'var(--text-muted)', marginBottom: '10px' }}>Archived</h4>
                      {archivedSeasons.map(s => (
                        <div key={s.id} className="player-card" style={{ opacity: 0.7 }}>
                          <div className="player-info">
                            <h3>{s.name}</h3>
                          </div>
                          <button className="btn btn-secondary btn-sm" onClick={async () => {
                            const allSeasons = getSeasons()
                            const updated = allSeasons.map(season => season.id === s.id ? { ...season, isArchived: false, status: 'active' } : { ...season, status: 'archived' })
                            localStorage.setItem('eliteArrowsSeasons', JSON.stringify(updated))
                            localStorage.setItem('eliteArrowsCurrentSeason', s.name)
                            try {
                              await setDoc(doc(db, 'seasons', s.id.toString()), { isArchived: false, status: 'active' }, { merge: true })
                            } catch (e) {
                              console.log('Error saving to Firebase:', e)
                            }
                            triggerDataRefresh('seasons')
                            alert('Season restored')
                          }}>Restore</button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )
            })()}
          </div>

          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="card-title">Reset Table</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
              Reset league table points from now without deleting existing results.
            </p>
            <button className="btn btn-danger" onClick={async () => {
              if (confirm('Reset league table points to 0 from now? Existing results will stay in match history but stop counting toward the table.')) {
                const resetAt = new Date().toISOString()
                await updateAdminData({ leagueTableResetAt: resetAt })
                localStorage.setItem('eliteArrowsLeagueTableResetAt', resetAt)
                triggerDataRefresh('results')
                alert('League table points reset to 0!')
              }
            }}>Reset League Points</button>

            <p style={{ color: 'var(--text-muted)', margin: '18px 0 15px' }}>
              Permanently clear all results for the current season.
            </p>
            <button className="btn btn-danger" onClick={async () => {
              const currentSeason = localStorage.getItem('eliteArrowsCurrentSeason') || new Date().getFullYear().toString()
              if (confirm(`Reset all results for "${currentSeason}" season?`)) {
                const results = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]')
                const currentSeasonResults = results.filter(r => r.season === currentSeason)
                const filtered = results.filter(r => r.season !== currentSeason)
                localStorage.setItem('eliteArrowsResults', JSON.stringify(filtered))
                await Promise.all(currentSeasonResults.map(result => 
                  deleteDoc(doc(db, 'results', String(result.firestoreId || result.id))).catch(e => {
                    console.log('Error deleting result from Firebase:', e)
                  })
                ))
                triggerDataRefresh('results')
                alert('Table reset!')
              }
            }}>Reset Current Season Table</button>
          </div>

          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="card-title">Prize Pool Calculator</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
              Prize money split between 7 divisions. Each division 1st place gets the same amount.
            </p>
            {(() => {
              const totalPot = subscriptionPot + subscriptionPot10
              const divisions = ['Elite', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze', 'Development']
              const numDivisions = divisions.length
              const perDivisionFirst = Math.floor(totalPot / numDivisions)
              const adminFee = totalPot - (perDivisionFirst * numDivisions)
              
              return (
                <>
                  <div style={{ 
                    padding: '15px', 
                    background: 'var(--bg-primary)', 
                    borderRadius: '8px',
                    marginBottom: '15px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span>Total Pot:</span>
                      <strong style={{ color: 'var(--success)' }}>£{totalPot.toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span>7 Divisions:</span>
                      <strong>{numDivisions}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span>Per Division 1st Place:</span>
                      <strong style={{ color: 'var(--accent-cyan)' }}>£{perDivisionFirst.toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                      <span>Admin Fee:</span>
                      <span style={{ color: 'var(--text-muted)' }}>£{adminFee.toFixed(2)}</span>
                    </div>
                  </div>
                   
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <p style={{ marginBottom: '8px' }}>Note: Promotion and relegation happens within each division standings (top 2 wins, bottom 2 lose).</p>
                  </div>
                </>
              )
            })()}
          </div>

          <div className="card">
            <h3 className="card-title">Move Player Between Divisions</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <select 
                id="movePlayerDivision"
                style={{ flex: 1, minWidth: '150px' }}
                onChange={async (e) => {
                  if (!e.target.value) return
                  const division = prompt('Enter new division (Elite, Diamond, Platinum, Gold, Silver, Bronze, Development):')
                  if (division && ['Elite', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze', 'Development'].includes(division)) {
                    await updateOtherUser(e.target.value, { division })
                    const users = getAllUsers()
                    const user = users.find(u => u.id === e.target.value)
                    alert(`${user?.username} moved to ${division}`)
                    e.target.value = ''
                  }
                }}
              >
                <option value="">Select Player</option>
                {getAllUsers().map(p => (
                  <option key={p.id} value={p.id}>{p.username} ({p.division})</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tokens' && isFullAdmin && (
        <div>
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="card-title">Manage Elite Tokens</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
              Add or remove elite tokens from player accounts.
            </p>
            <div className="form-group">
              <label>Select Player</label>
              <select 
                id="tokenPlayerSelect"
                style={{ width: '100%', padding: '12px', marginBottom: '12px' }}
              >
                <option value="">Select a player</option>
                {getAllUsers().map(p => (
                  <option key={p.id} value={p.id}>{p.username} - {p.eliteTokens || 0} tokens</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Amount</label>
                <input 
                  type="number" 
                  id="tokenAmount"
                  defaultValue={0}
                  min="0"
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Action</label>
                <select id="tokenAction" style={{ width: '100%', padding: '12px' }}>
                  <option value="add">Add Tokens</option>
                  <option value="remove">Remove Tokens</option>
                </select>
              </div>
            </div>
            <button 
              className="btn btn-primary"
              onClick={async () => {
                const playerId = document.getElementById('tokenPlayerSelect').value
                const amount = parseInt(document.getElementById('tokenAmount').value) || 0
                const action = document.getElementById('tokenAction').value
                
                if (!playerId) return alert('Please select a player')
                if (amount <= 0) return alert('Please enter an amount')
                
                const users = getAllUsers()
                const index = users.findIndex(u => u.id === playerId)
                if (index !== -1) {
                  if (action === 'remove' && (users[index].eliteTokens || 0) < amount) {
                    return alert('Player does not have enough tokens')
                  }
                  const nextTokenBalance = (users[index].eliteTokens || 0) + (action === 'add' ? amount : -amount)
                  users[index].eliteTokens = nextTokenBalance
                  localStorage.setItem('eliteArrowsUsers', JSON.stringify(users))
                  await updateOtherUser(playerId, { eliteTokens: nextTokenBalance })
                  triggerDataRefresh('users')
                  alert(`${action === 'add' ? 'Added' : 'Removed'} ${amount} tokens ${action === 'add' ? 'to' : 'from'} ${users[index].username}`)
                  document.getElementById('tokenPlayerSelect').value = ''
                  document.getElementById('tokenAmount').value = 0
                }
              }}
            >
              Update Tokens
            </button>
            <div style={{ marginTop: '20px', padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <h4 style={{ marginBottom: '10px', color: 'var(--accent-cyan)' }}>Add Tokens to All Players</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '12px' }}>
                Adds the same amount to every player account.
              </p>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: '1 1 180px', marginBottom: 0 }}>
                  <label>Amount per player</label>
                  <input
                    type="number"
                    id="bulkTokenAmount"
                    defaultValue={0}
                    min="0"
                  />
                </div>
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    const amount = parseInt(document.getElementById('bulkTokenAmount').value) || 0
                    if (amount <= 0) return alert('Please enter an amount')

                    const users = getAllUsers()
                    if (users.length === 0) return alert('No players found')
                    if (!confirm(`Add ${amount} tokens to all ${users.length} players?`)) return

                    const updatedUsers = users.map(player => ({
                      ...player,
                      eliteTokens: (player.eliteTokens || 0) + amount
                    }))

                    localStorage.setItem('eliteArrowsUsers', JSON.stringify(updatedUsers))
                    try {
                      await Promise.all(updatedUsers.map(player =>
                        updateOtherUser(player.id, { eliteTokens: player.eliteTokens })
                      ))
                      triggerDataRefresh('users')
                      document.getElementById('bulkTokenAmount').value = 0
                      alert(`Added ${amount} tokens to ${updatedUsers.length} players`)
                    } catch (error) {
                      alert('Some token updates may not have saved: ' + error.message)
                    }
                  }}
                >
                  Add to All
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">All Players - Token Balance</h3>
            {getAllUsers()
              .sort((a, b) => (b.eliteTokens || 0) - (a.eliteTokens || 0))
              .map(p => (
                <div key={p.id} className="player-card">
                  <div className="player-avatar">
                    {p.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="player-info">
                    <h3>{p.username}</h3>
                    <p>{p.email}</p>
                  </div>
                  <span style={{ fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
                    {p.eliteTokens || 0} tokens
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {activeTab === 'moneypot' && (
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
            <div className="card">
              <h3 className="card-title">Standard Subscription Pot (£5)</h3>
              <div style={{ 
                padding: '30px', 
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-cyan))',
                borderRadius: '12px',
                textAlign: 'center',
                marginBottom: '20px'
              }}>
                <p style={{ fontSize: '0.9rem', marginBottom: '5px', opacity: 0.9 }}>Gold/Silver/Bronze</p>
                <p style={{ fontSize: '3rem', fontWeight: 'bold', margin: 0 }}>£{subscriptionPot.toFixed(2)}</p>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                From £5/month subscriptions
              </p>
              <div style={{ marginTop: '15px', padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <h4 style={{ marginBottom: '10px' }}>Adjust Pot</h4>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    type="number" 
                    id="subPotAdjust"
                    placeholder="Amount"
                    style={{ flex: 1, padding: '8px' }}
                  />
                  <button 
                    className="btn btn-primary"
                    onClick={async () => {
                      const amount = parseFloat(document.getElementById('subPotAdjust').value) || 0
                      if (amount !== 0) {
                        await updateAdminData({ subscriptionPot: subscriptionPot + amount })
                        addToMoneyHistory('subscription', amount, 'Manual adjustment')
                        alert(`Subscription pot ${amount >= 0 ? 'increased' : 'decreased'} by £${Math.abs(amount).toFixed(2)}`)
                        document.getElementById('subPotAdjust').value = ''
                      }
                    }}
                  >
                    Update
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="card-title">Premium Subscription Pot (£5)</h3>
              <div style={{ 
                padding: '30px', 
                background: 'linear-gradient(135deg, #ffd700, #ff8c00)',
                borderRadius: '12px',
                textAlign: 'center',
                marginBottom: '20px',
                color: '#000'
              }}>
                <p style={{ fontSize: '0.9rem', marginBottom: '5px', opacity: 0.9 }}>Elite/Diamond</p>
                <p style={{ fontSize: '3rem', fontWeight: 'bold', margin: 0 }}>£{subscriptionPot10.toFixed(2)}</p>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                From £5/month subscriptions
              </p>
              <div style={{ marginTop: '15px', padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <h4 style={{ marginBottom: '10px' }}>Adjust Pot</h4>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    type="number" 
                    id="subPot10Adjust"
                    placeholder="Amount"
                    style={{ flex: 1, padding: '8px' }}
                  />
                  <button 
                    className="btn btn-primary"
                    onClick={async () => {
                      const amount = parseFloat(document.getElementById('subPot10Adjust').value) || 0
                      if (amount !== 0) {
                        await updateAdminData({ subscriptionPot10: subscriptionPot10 + amount })
                        addToMoneyHistory('subscription', amount, 'Manual adjustment (£5 tier)')
                        alert(`Premium subscription pot ${amount >= 0 ? 'increased' : 'decreased'} by £${Math.abs(amount).toFixed(2)}`)
                        document.getElementById('subPot10Adjust').value = ''
                      }
                    }}
                  >
                    Update
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="card-title">Tournament Pot</h3>
              <div style={{ 
                padding: '30px', 
                background: 'linear-gradient(135deg, var(--accent-cyan), var(--success))',
                borderRadius: '12px',
                textAlign: 'center',
                marginBottom: '20px'
              }}>
                <p style={{ fontSize: '0.9rem', marginBottom: '5px', opacity: 0.9 }}>Total From Entry Fees</p>
                <p style={{ fontSize: '3rem', fontWeight: 'bold', margin: 0 }}>£{tournamentPot.toFixed(2)}</p>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                From tournament cash entries
              </p>
              <div style={{ marginTop: '15px', padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <h4 style={{ marginBottom: '10px' }}>Adjust Pot</h4>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    type="number" 
                    id="tourPotAdjust"
                    placeholder="Amount"
                    style={{ flex: 1, padding: '8px' }}
                  />
                  <button 
                    className="btn btn-primary"
                    onClick={async () => {
                      const amount = parseFloat(document.getElementById('tourPotAdjust').value) || 0
                      if (amount !== 0) {
                        await updateAdminData({ tournamentPot: tournamentPot + amount })
                        addToMoneyHistory('tournament', amount, 'Manual adjustment')
                        alert(`Tournament pot ${amount >= 0 ? 'increased' : 'decreased'} by £${Math.abs(amount).toFixed(2)}`)
                        document.getElementById('tourPotAdjust').value = ''
                      }
                    }}
                  >
                    Update
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 className="card-title" style={{ margin: 0 }}>Cup Prize Pots</h3>
            </div>
            {(() => {
              const cups = JSON.parse(localStorage.getItem('eliteArrowsCups') || '[]')
              if (cups.length === 0) {
                return <p style={{ color: 'var(--text-muted)' }}>No cups created yet</p>
              }
              return (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Cup Name</th>
                      <th>Entry Fee</th>
                      <th>Players</th>
                      <th>Prize Pot</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cups.map(cup => {
                      const prizePot = cup.entryFee * (cup.players?.length || 0)
                      return (
                        <tr key={cup.id}>
                          <td>{cup.name}</td>
                          <td>£{cup.entryFee}</td>
                          <td>{cup.players?.length || 0}</td>
                          <td style={{ color: 'var(--success)', fontWeight: 'bold' }}>£{prizePot}</td>
                          <td>{cup.status || 'Active'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )
            })()}
          </div>
        </div>
      )}

      {activeTab === 'cups' && (
        <CupManagement />
      )}

      {activeTab === 'moneypot' && (
        <div className="card" style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 className="card-title" style={{ margin: 0 }}>Money Pot History</h3>
              <button 
                className="btn btn-danger"
                onClick={async () => {
                  if (confirm('Are you sure you want to reset all money history? This cannot be undone.')) {
                    localStorage.setItem('eliteArrowsMoneyHistory', JSON.stringify([]))
                    await updateAdminData({ moneyHistory: [] })
                    alert('Money history has been reset')
                  }
                }}
              >
                Reset History
              </button>
            </div>
            {(() => {
              const history = JSON.parse(localStorage.getItem('eliteArrowsMoneyHistory') || '[]')
              if (history.length === 0) {
                return <p style={{ color: 'var(--text-muted)' }}>No transactions yet</p>
              }
              return (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.slice(-20).reverse().map((item, index) => (
                      <tr key={index}>
                        <td>{new Date(item.date).toLocaleDateString()}</td>
                        <td>
                          <span style={{ 
                            color: item.type === 'subscription' ? 'var(--accent-cyan)' : 'var(--success)',
                            fontWeight: 'bold'
                          }}>
                            {item.type === 'subscription' ? 'Subscription' : 'Tournament'}
                          </span>
                        </td>
                        <td style={{ color: item.amount >= 0 ? 'var(--success)' : 'var(--error)' }}>
                          {item.amount >= 0 ? '+' : ''}£{item.amount.toFixed(2)}
                        </td>
                        <td>{item.description}</td>
                      </tr>
                    ))}
</tbody>
                </table>
              )
            })()}
          </div>
      )}
      
      {/* Result Proof Preview */}
      {proofPreviewResult && hasResultProof(proofPreviewResult) && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '18px'
          }}
          onClick={() => setProofPreviewResult(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '900px',
              maxHeight: '92vh',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '16px',
              overflow: 'auto'
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px'
            }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text)' }}>Result Proof</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {proofPreviewResult.player1} {proofPreviewResult.score1} - {proofPreviewResult.score2} {proofPreviewResult.player2}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setProofPreviewResult(null)}
              >
                Close
              </button>
            </div>
            <img
              src={proofPreviewResult.proofImage}
              alt={`Proof for ${proofPreviewResult.player1} versus ${proofPreviewResult.player2}`}
              style={{
                display: 'block',
                width: '100%',
                maxHeight: '78vh',
                objectFit: 'contain',
                background: '#000',
                borderRadius: '8px'
              }}
            />
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: 'var(--card-bg)',
            padding: '30px',
            borderRadius: '12px',
            maxWidth: '90%',
            textAlign: 'center',
            border: '2px solid var(--accent-cyan)'
          }}>
            <h3 style={{ marginBottom: '20px', color: 'var(--text)' }}>
              {showConfirmModal.type === 'approve' ? 'Approve Result?' : 'Reject Result?'}
            </h3>
            <p style={{ marginBottom: '20px', color: 'var(--text-muted)' }}>
              {showConfirmModal.result.player1} {showConfirmModal.result.score1} - {showConfirmModal.result.score2} {showConfirmModal.result.player2}
            </p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button 
                className="btn btn-primary"
                onClick={async () => {
                  const action = showConfirmModal.type === 'approve' ? approveResult : rejectResult
                  const result = showConfirmModal.result
                  setShowConfirmModal(null)
                  await action(result.id)
                }}
              >
                Yes - {showConfirmModal.type === 'approve' ? 'Approve' : 'Reject'}
              </button>
              <button 
                className="btn btn-danger"
                onClick={() => setShowConfirmModal(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
