import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { db, doc, setDoc, getDoc, getDocs, collection, deleteDoc, updateDoc, writeBatch, addDoc } from '../firebase'
import { ADMIN_EMAILS } from '../config'
import UserSearchSelect from '../components/UserSearchSelect'
import CupManagement from './CupManagement'
import { useToast } from '../context/ToastContext'
import { logMatchApproved } from '../utils/analytics'

export default function Admin() {
  const {
    user,
    loading: authLoading,
    getAllUsers,
    getResults,
    getFixtures,
    getCups,
    advanceCupBracket,
    bets,
    getSeasons,
    adminData,
    updateAdminData,
    addToMoneyHistory,
    triggerDataRefresh,
    dataRefreshTrigger,
    updateResults,
    forceFetchResults
  } = useAuth()

  const navigate = useNavigate()
  const { showToast } = useToast()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [refreshKey, setRefreshKey] = useState(0)
  const [isApproving, setIsApproving] = useState(false)
  const [resultFilter, setResultFilter] = useState('pending')
  const [paymentSubTab, setPaymentSubTab] = useState('pending')
  const [selectedResults, setSelectedResults] = useState([])
  const [resultSearch, setResultSearch] = useState('')
  const [resultTypeFilter, setResultTypeFilter] = useState('all')
  const [editingResult, setEditingResult] = useState(null)
  const [approvingPaymentId, setApprovingPaymentId] = useState(null)
  const [approvalOverride, setApprovalOverride] = useState({ tier: 'standard', season: '' })

  // Form states
  const [showSubmitGame, setShowSubmitGame] = useState(false)
  const [adminGameForm, setAdminGameForm] = useState({
    player1: '', player2: '',
    score1: '', score2: '',
    gameType: 'Friendly',
    p1_180s: '', p2_180s: '',
    p1_checkout: '', p2_checkout: '',
    p1_doubles: '', p2_doubles: ''
  })
  const [tokenForm, setTokenForm] = useState({ player: '', amount: 0, action: 'add' })
  const [seasonForm, setSeasonForm] = useState({ name: '', startDate: new Date().toISOString().split('T')[0], endDate: '' })
  const [grantSubForm, setGrantSubForm] = useState({ player: '', tier: 'standard', season: '' })
  const [divisionForm, setDivisionForm] = useState({ player: '', division: '' })
  const [potAdjust, setPotAdjust] = useState({ standard: 0, premium: 0 })
  const [trophyForm, setTrophyForm] = useState({ player: '', name: '', icon: '🏆', season: '' })
  const [playoffForm, setPlayoffForm] = useState({ player1: '', player2: '', division: '', date: '', time: '', bestOf: '3' })
  const [surveyForm, setSurveyForm] = useState({ title: '', description: '', targetType: 'all', targetUserIds: [] })
  const [surveyQuestions, setSurveyQuestions] = useState([{ id: 'q1', text: '', type: 'text', options: '' }])
  const [viewSurveyResponses, setViewSurveyResponses] = useState(null)

  // Guard: wait for auth
  if (authLoading) return <div className="page glass"><div style={{ padding: '60px', textAlign: 'center', color: 'var(--accent-cyan)', fontWeight: 800 }}>Validating Admin Access...</div></div>
  if (!user) return <div className="page glass"><div style={{ padding: '60px', textAlign: 'center' }}>Please sign in to access the Admin Panel.</div></div>

  const isEmailAdmin = ADMIN_EMAILS.includes(user?.email?.toLowerCase())
  const isDbAdmin = user?.isAdmin === true
  const canAccess = isEmailAdmin || isDbAdmin || user?.isTournamentAdmin || user?.isCupAdmin

  if (!canAccess) {
    return (
      <div className="page glass">
        <h1 className="page-title">Access Denied</h1>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>You do not have administrative permissions.</p>
      </div>
    )
  }

  const isFullAdmin = user?.isAdmin || isEmailAdmin

  // Data Selectors
  const allPlayers = getAllUsers() || []
  const allResults = getResults() || []
  const allFixtures = getFixtures() || []
  const pendingResults = allResults.filter(r => String(r.status).toLowerCase() === 'pending')
  const approvedResults = allResults.filter(r => String(r.status).toLowerCase() === 'approved')
  const rejectedResults = allResults.filter(r => String(r.status).toLowerCase() === 'rejected')

  const pendingPayments = allPlayers.filter(u => u?.paymentPending)
  const entryRequests = allPlayers.filter(u => u?.adminRequestPending)
  const subscribers = allPlayers.filter(u => u?.isSubscribed || (u?.subscribedSeasons && u.subscribedSeasons.length > 0))

  const subscriptionPot = adminData?.subscriptionPot || 0
  const subscriptionPot10 = adminData?.subscriptionPot10 || 0

  useEffect(() => {
    const tab = searchParams.get('tab')
    const allowed = ['dashboard', 'results', 'payments', 'moneypot', 'cups', 'playoffs', 'players', 'admins', 'seasons', 'trophies', 'tokens', 'surveys', 'maintenance']
    if (tab && allowed.includes(tab)) setActiveTab(tab)
  }, [searchParams])

  useEffect(() => {
    setRefreshKey(prev => prev + 1)
  }, [dataRefreshTrigger])

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

  // --- Handlers ---

  const handleApproveResult = async (resultId) => {
    if (isApproving) return
    setIsApproving(true)
    try {
      const res = allResults.find(r => String(r.id) === String(resultId))
      if (!res) throw new Error('Result not found')
      const targetId = res.firestoreId || String(resultId)
      const approvedResult = { ...res, status: 'approved', approvedAt: new Date().toISOString() }
      await setDoc(doc(db, 'results', targetId), approvedResult, { merge: true })
      logMatchApproved(res)

      if (res.gameType === 'Cup') {
        await advanceCupBracket(approvedResult)
      }

      // Update local state immediately so the UI reflects the change
      const updatedResults = allResults.map(r =>
        String(r.id) === String(resultId) ? { ...r, status: 'approved', approvedAt: approvedResult.approvedAt } : r
      )
      updateResults(updatedResults)

      await logAudit('APPROVE_RESULT', `Approved match: ${res.player1} vs ${res.player2}`)
      showToast('Result Approved!', 'success')
    } catch (e) { showToast(e.message, 'error') }
    setIsApproving(false)
  }

  const handleBulkApprove = async () => {
    if (selectedResults.length === 0 || isApproving) return
    setIsApproving(true)
    try {
      const batch = writeBatch(db)
      const cupResults = []
      selectedResults.forEach(id => {
        const res = allResults.find(r => String(r.id) === String(id))
        if (res) {
          const targetId = res.firestoreId || String(id)
          const approvedResult = { ...res, status: 'approved', approvedAt: new Date().toISOString() }
          batch.update(doc(db, 'results', targetId), { status: 'approved', approvedAt: approvedResult.approvedAt })
          logMatchApproved(res)
          if (res.gameType === 'Cup') {
            cupResults.push(approvedResult)
          }
        }
      })
      await batch.commit()

      for (const res of cupResults) {
        await advanceCupBracket(res)
      }

      await logAudit('BULK_APPROVE', `Approved ${selectedResults.length} matches`)
      setSelectedResults([])
      // Update local state immediately
      const approvedIds = new Set(selectedResults)
      const updatedResults = allResults.map(r =>
        approvedIds.has(String(r.id)) ? { ...r, status: 'approved', approvedAt: new Date().toISOString() } : r
      )
      updateResults(updatedResults)
      showToast(`Approved ${selectedResults.length} matches!`, 'success')
    } catch (e) { showToast(e.message, 'error') }
    setIsApproving(false)
  }

  const handleToggleExcludeFromLeague = async (result) => {
    const newVal = !result.excludeFromLeague
    const targetId = result.firestoreId || String(result.id)
    try {
      await setDoc(doc(db, 'results', targetId), { excludeFromLeague: newVal }, { merge: true })
      const updatedResults = allResults.map(r =>
        String(r.id) === String(result.id) ? { ...r, excludeFromLeague: newVal } : r
      )
      updateResults(updatedResults)
      showToast(newVal ? 'Excluded from league table' : 'Included in league table', 'success')
    } catch (e) {
      showToast('Failed to update: ' + e.message, 'error')
    }
  }

  const handleRejectResult = async (resultId) => {
    try {
      const res = allResults.find(r => String(r.id) === String(resultId))
      if (!res) throw new Error('Result not found')
      const targetId = res.firestoreId || String(resultId)
      await setDoc(doc(db, 'results', targetId), { ...res, status: 'rejected', updatedAt: new Date().toISOString() }, { merge: true })
      await logAudit('REJECT_RESULT', `Rejected match: ${res.player1} vs ${res.player2}`)
      triggerDataRefresh('results')
      showToast('Result Rejected', 'info')
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleDeleteResult = async (resultId) => {
    if (!window.confirm('Permanently delete this result?')) return
    try {
      const res = allResults.find(r => String(r.id) === String(resultId))
      const targetId = res?.firestoreId || String(resultId)
      await deleteDoc(doc(db, 'results', targetId))
      await logAudit('DELETE_RESULT', `Deleted result: ${res?.player1} vs ${res?.player2}`)
      triggerDataRefresh('results')
      showToast('Result Deleted', 'info')
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleUpdateResult = async (e) => {
    e.preventDefault()
    if (!editingResult) return
    try {
      const { id, ...updates } = editingResult
      const res = allResults.find(r => String(r.id) === String(id))
      const targetId = res?.firestoreId || String(id)
      await setDoc(doc(db, 'results', targetId), updates, { merge: true })
      await logAudit('EDIT_RESULT', `Edited match: ${updates.player1} vs ${updates.player2}`)
      setEditingResult(null)
      triggerDataRefresh('results')
      showToast('Result updated!', 'success')
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleAdminSubmitGame = async () => {
    const f = adminGameForm
    if (!f.player1 || !f.player2) return showToast('Select both players.', 'error')
    if (!f.score1 || !f.score2) return showToast('Enter both scores.', 'error')
    const s1 = parseInt(f.score1); const s2 = parseInt(f.score2)
    if (isNaN(s1) || isNaN(s2)) return showToast('Invalid scores.', 'error')

    const p1 = allPlayers.find(u => String(u.id) === String(f.player1))
    const p2 = allPlayers.find(u => String(u.id) === String(f.player2))
    if (!p1 || !p2) return showToast('Players not found.', 'error')

    const resultId = `admin_${Date.now()}`
    try {
      const newMatch = {
        id: resultId,
        player1: p1.username,
        player1Id: p1.id,
        player2: p2.username,
        player2Id: p2.id,
        score1: s1, score2: s2,
        gameType: f.gameType,
        status: 'approved',
        date: new Date().toISOString().split('T')[0],
        submittedAt: new Date().toISOString(),
        submittedBy: 'admin',
        player1Stats: { '180s': parseInt(f.p1_180s) || 0, highestCheckout: parseInt(f.p1_checkout) || 0, doubleSuccess: parseFloat(f.p1_doubles) || 0 },
        player2Stats: { '180s': parseInt(f.p2_180s) || 0, highestCheckout: parseInt(f.p2_checkout) || 0, doubleSuccess: parseFloat(f.p2_doubles) || 0 }
      }
      await setDoc(doc(db, 'results', resultId), newMatch)
      logMatchApproved(newMatch)
      await logAudit('ADMIN_SUBMIT_GAME', `Admin submitted game: ${p1.username} ${s1}-${s2} ${p2.username}`)
      setAdminGameForm({ player1: '', player2: '', score1: '', score2: '', gameType: 'Friendly', p1_180s: '', p2_180s: '', p1_checkout: '', p2_checkout: '', p1_doubles: '', p2_doubles: '' })
      triggerDataRefresh('results')
      showToast('Game submitted!', 'success')
    } catch (e) { showToast('Error: ' + e.message, 'error') }
  }

  const handleApprovePayment = async (u) => {
    try {
      const isOverriding = approvingPaymentId === u.id
      const finalTier = isOverriding ? (approvalOverride.tier === 'premium' ? 10 : 5) : ((u.paymentMethod === 'paypal10' || u.requestedPlan === 'elite') ? 10 : 5)
      const finalSeason = isOverriding ? approvalOverride.season : (u.requestedSeason || adminData?.currentSeason || 'Season 1')

      const currentSeasons = Array.isArray(u.subscribedSeasons) ? u.subscribedSeasons : []
      const nextSeasons = Array.from(new Set([...currentSeasons, finalSeason]))

      const updates = {
        isSubscribed: true,
        paymentPending: false,
        subscriptionDate: new Date().toISOString(),
        subscriptionTier: finalTier === 10 ? 'premium' : 'standard',
        subscribedSeasons: nextSeasons
      }
      await setDoc(doc(db, 'users', u.id), updates, { merge: true })

      const potKey = finalTier === 10 ? 'subscriptionPot10' : 'subscriptionPot'
      const currentPot = finalTier === 10 ? subscriptionPot10 : subscriptionPot
      await updateAdminData({ [potKey]: currentPot + finalTier })
      addToMoneyHistory('subscription', finalTier, `Approved payment: ${u.username} for ${finalSeason}`)
      await logAudit('APPROVE_PAYMENT', `Approved payment for ${u.username} (£${finalTier}) - ${finalSeason}`)

      setApprovingPaymentId(null)
      triggerDataRefresh('users')
      showToast(`Subscription Approved for ${finalSeason}!`, 'success')
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleUpdateApprovedSubscription = async (u) => {
    try {
      const finalTier = approvalOverride.tier
      const finalSeason = approvalOverride.season

      const currentSeasons = Array.isArray(u.subscribedSeasons) ? u.subscribedSeasons : []
      // We'll add the selected season if it's not there, keeping others.
      // If they want to remove one, they can use the profile edit (advanced) but this covers 99% of "picked wrong season" cases.
      const nextSeasons = Array.from(new Set([...currentSeasons, finalSeason]))

      await setDoc(doc(db, 'users', u.id), {
        subscriptionTier: finalTier,
        subscribedSeasons: nextSeasons
      }, { merge: true })

      await logAudit('UPDATE_SUBSCRIPTION', `Admin updated ${u.username} sub: ${finalTier}, seasons: ${nextSeasons.join(', ')}`)

      setApprovingPaymentId(null)
      triggerDataRefresh('users')
      showToast(`Subscription updated for ${u.username}`, 'success')
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleGrantSubscription = async () => {
    if (!grantSubForm.player) return showToast('Select a player', 'error')
    try {
      const target = allPlayers.find(p => p.id === grantSubForm.player)
      const selectedSeason = grantSubForm.season || adminData?.currentSeason || 'Season 1'

      const currentSeasons = Array.isArray(target.subscribedSeasons) ? target.subscribedSeasons : []
      const nextSeasons = Array.from(new Set([...currentSeasons, selectedSeason]))

      await setDoc(doc(db, 'users', target.id), {
        isSubscribed: true,
        subscriptionDate: new Date().toISOString(),
        subscriptionTier: grantSubForm.tier,
        subscribedSeasons: nextSeasons
      }, { merge: true })

      await logAudit('GRANT_SUBSCRIPTION', `Manually granted ${grantSubForm.tier} sub to ${target.username} for ${selectedSeason}`)
      triggerDataRefresh('users')
      showToast(`Granted ${grantSubForm.tier} subscription to ${target.username} for ${selectedSeason}`, 'success')
      setGrantSubForm({ ...grantSubForm, player: '' })
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleCreatePlayoff = async () => {
    if (!playoffForm.player1 || !playoffForm.player2 || !playoffForm.date || !playoffForm.time) {
      return showToast('Please fill in all playoff fields', 'error')
    }
    try {
      const p1 = allPlayers.find(p => p.id === playoffForm.player1)
      const p2 = allPlayers.find(p => p.id === playoffForm.player2)
      const fixtureId = `playoff_${Date.now()}`

      const newFixture = {
        id: fixtureId,
        player1Id: p1.id,
        player1Name: p1.username,
        player2Id: p2.id,
        player2Name: p2.username,
        division: playoffForm.division || p1.division || 'Open',
        gameType: 'Playoff',
        fixtureDate: playoffForm.date,
        fixtureTime: playoffForm.time,
        bestOf: parseInt(playoffForm.bestOf),
        firstTo: Math.ceil(parseInt(playoffForm.bestOf) / 2),
        createdBy: user.id,
        createdAt: new Date().toISOString(),
        status: 'accepted',
        proposalStatus: 'accepted'
      }

      await setDoc(doc(db, 'fixtures', fixtureId), newFixture)
      await logAudit('CREATE_PLAYOFF', `Created playoff match: ${p1.username} vs ${p2.username}`)

      setPlayoffForm({ player1: '', player2: '', division: '', date: '', time: '', bestOf: '3' })
      triggerDataRefresh('fixtures')
      showToast('Playoff match created!', 'success')
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleUpdateDivision = async () => {
    if (!divisionForm.player || !divisionForm.division) return showToast('Select both player and division', 'error')
    try {
      const target = allPlayers.find(p => p.id === divisionForm.player)
      await setDoc(doc(db, 'users', target.id), { division: divisionForm.division }, { merge: true })
      await logAudit('MOVE_DIVISION', `Moved ${target.username} to ${divisionForm.division}`)
      triggerDataRefresh('users')
      showToast(`${target.username} moved to ${divisionForm.division}`, 'success')
      setDivisionForm({ player: '', division: '' })
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleUpdateAdminRole = async (targetId, role, value) => {
    try {
      const target = allPlayers.find(p => p.id === targetId)
      await setDoc(doc(db, 'users', targetId), { [role]: value }, { merge: true })
      await logAudit('UPDATE_ROLE', `Updated ${role} to ${value} for ${target?.username}`)
      triggerDataRefresh('users')
      showToast('Permissions updated', 'success')
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleToggleBan = async (targetId, currentStatus) => {
    try {
      const target = allPlayers.find(p => p.id === targetId)
      if (targetId === user.id) return showToast('You cannot ban yourself.', 'error')

      const newStatus = !currentStatus
      await setDoc(doc(db, 'users', targetId), { isBanned: newStatus }, { merge: true })
      await logAudit(newStatus ? 'BAN_USER' : 'UNBAN_USER', `${newStatus ? 'Banned' : 'Unbanned'} user: ${target?.username}`)
      triggerDataRefresh('users')
      showToast(`User ${target?.username} ${newStatus ? 'banned' : 'unbanned'}.`, 'success')
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleCreateSeason = async () => {
    if (!seasonForm.name) return showToast('Name required', 'error')
    try {
      const id = Date.now().toString()
      await setDoc(doc(db, 'seasons', id), { ...seasonForm, id, createdAt: new Date().toISOString(), status: 'active' })
      await logAudit('CREATE_SEASON', `Created season: ${seasonForm.name}`)
      triggerDataRefresh('seasons')
      showToast('Season Created!', 'success')
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleAdjustPot = async (tier) => {
    const amount = tier === 'standard' ? potAdjust.standard : potAdjust.premium
    const key = tier === 'standard' ? 'subscriptionPot' : 'subscriptionPot10'
    const current = tier === 'standard' ? subscriptionPot : subscriptionPot10
    try {
      await updateAdminData({ [key]: current + amount })
      addToMoneyHistory('adjustment', amount, `Manual pot adjustment (${tier})`)
      await logAudit('ADJUST_POT', `Adjusted ${tier} pot by £${amount}`)
      showToast('Pot adjusted', 'success')
      setPotAdjust({ ...potAdjust, [tier]: 0 })
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleAwardTrophy = async () => {
    if (!trophyForm.player || !trophyForm.name) return showToast('Player and Trophy Name required', 'error')
    try {
      const target = allPlayers.find(p => p.id === trophyForm.player)
      const currentTrophies = target.trophies || []
      const newTrophy = {
        name: trophyForm.name,
        icon: trophyForm.icon,
        season: trophyForm.season || localStorage.getItem('eliteArrowsCurrentSeason') || 'Season 1',
        awardedAt: new Date().toISOString()
      }

      await setDoc(doc(db, 'users', target.id), {
        trophies: [...currentTrophies, newTrophy]
      }, { merge: true })

      await logAudit('AWARD_TROPHY', `Awarded "${trophyForm.name}" to ${target.username}`)
      triggerDataRefresh('users')
      showToast(`Awarded "${trophyForm.name}" to ${target.username}`, 'success')
      setTrophyForm({ ...trophyForm, name: '', icon: '🏆' })
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleCreateSurvey = async () => {
    if (!surveyForm.title) return showToast('Survey title required', 'error')
    if (!surveyQuestions[0]?.text) return showToast('At least one question required', 'error')

    const surveys = adminData?.surveys || []
    const newSurvey = {
      id: Date.now().toString(),
      title: surveyForm.title,
      description: surveyForm.description,
      questions: surveyQuestions.map(q => ({
        ...q,
        options: q.options ? q.options.split(',').map(s => s.trim()).filter(Boolean) : []
      })),
      targetType: surveyForm.targetType,
      targetUserIds: surveyForm.targetUserIds,
      createdAt: new Date().toISOString(),
      active: true,
      responses: []
    }

    try {
      await updateAdminData({ surveys: [...surveys, newSurvey] })
      await logAudit('CREATE_SURVEY', `Created survey: ${surveyForm.title}`)
      setSurveyForm({ title: '', description: '', targetType: 'all', targetUserIds: [] })
      setSurveyQuestions([{ id: 'q1', text: '', type: 'text', options: '' }])
      showToast('Survey created!', 'success')
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleDeleteSurvey = async (surveyId) => {
    if (!window.confirm('Delete this survey? All responses will be lost.')) return
    const surveys = (adminData?.surveys || []).filter(s => s.id !== surveyId)
    try {
      await updateAdminData({ surveys })
      showToast('Survey deleted', 'success')
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleDeleteUser = async (targetId) => {
    const target = allPlayers.find(p => p.id === targetId)
    if (!target) return

    if (targetId === user.id) return showToast('You cannot delete your own account.', 'error')
    if (!isFullAdmin && (target.isAdmin || target.isTournamentAdmin)) {
      return showToast('You do not have permission to delete another staff member.', 'error')
    }

    if (!window.confirm(`PERMANENTLY DELETE user "${target.username}"? This will remove their profile and league presence. This cannot be undone.`)) return

    try {
      await deleteDoc(doc(db, 'users', targetId))
      await logAudit('DELETE_USER', `Permanently deleted user: ${target.username} (${target.email})`)
      triggerDataRefresh('users')
      showToast(`User ${target.username} deleted.`, 'success')
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleCheckBetWinners = async () => {
    if (isApproving) return
    setIsApproving(true)
    try {
      const allResults = getResults().filter(r => String(r.status).toLowerCase() === 'approved')
      const batch = writeBatch(db)
      let winCount = 0

      for (const bet of bets) {
        if (bet.won !== null) continue

        const game = allResults.find(r =>
          (bet.fixtureId && String(r.fixtureId) === String(bet.fixtureId)) ||
          (bet.cupId && bet.matchId && String(r.cupId) === String(bet.cupId) && String(r.matchId) === String(bet.matchId)) ||
          (String(r.id) === String(bet.gameId))
        )

        if (!game) continue

        const score1 = Number(game.score1)
        const score2 = Number(game.score2)
        const actualWinnerId = score1 > score2 ? game.player1Id : game.player2Id

        const predictedScore1 = Number(bet.predictedScore1)
        const predictedScore2 = Number(bet.predictedScore2)

        // Exact score check
        const isExactScore = (String(game.player1Id) === String(bet.fixturePlayer1Id))
          ? (score1 === predictedScore1 && score2 === predictedScore2)
          : (score2 === predictedScore1 && score1 === predictedScore2)

        const won = String(actualWinnerId) === String(bet.predictedWinnerId) && isExactScore

        batch.update(doc(db, 'bets', bet.id), { won })

        if (won) {
          winCount++
          const userDoc = doc(db, 'users', bet.userId)
          const userData = allPlayers.find(u => u.id === bet.userId)
          const currentDraw = userData?.promotionDraw || []
          if (!currentDraw.includes(true)) { // Just a flag that they won a bet
             batch.update(userDoc, { promotionDraw: true })
          }
        }
      }

      await batch.commit()
      await logAudit('CHECK_BETS', `Processed ${bets.length} bets, found ${winCount} new winners`)
      triggerDataRefresh('bets')
      showToast(`Checked bets! Found ${winCount} winners.`, 'success')
    } catch (e) { showToast(e.message, 'error') }
    setIsApproving(false)
  }

  const handleManualDrawEntry = async (targetId) => {
    try {
      const target = allPlayers.find(u => u.id === targetId)
      await setDoc(doc(db, 'users', targetId), { promotionDraw: true }, { merge: true })
      await logAudit('MANUAL_DRAW_ENTRY', `Manually added ${target?.username} to promotion draw`)
      triggerDataRefresh('users')
      showToast(`${target?.username} added to draw!`, 'success')
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleBulkSyncAnalytics = async () => {
    const approvedMatches = allResults.filter(r => String(r.status).toLowerCase() === 'approved');
    const users = getAllUsers();

    if (approvedMatches.length === 0) return showToast('No approved matches to sync', 'info');

    if (!window.confirm(`DEEP SYNC ${approvedMatches.length} approved games? This will force historical data to "Season 1", link missing IDs, and set game types to "League" ONLY for non-cup games.`)) return;

    setIsApproving(true);
    try {
      const currentSeason = adminData?.currentSeason || 'Season 1';
      let updatedCount = 0;
      let currentBatch = writeBatch(db);
      let opCount = 0;

      // Track per-result updates so we can merge into local state after batch commit
      const updatesByTargetId = {};

      // Strictly Season 1 window
      const season1Start = new Date('2026-05-01T00:00:00').getTime();
      const season1End = new Date('2026-06-01T23:59:59').getTime();

      for (const match of approvedMatches) {
        const updates = {};
        const targetId = match.firestoreId || String(match.id);
        const matchTime = new Date(match.date || match.submittedAt || 0).getTime();

        // 1. Force Season label
        const currentResSeason = String(match.season || '').trim();
        const isLegacyLabel = ['2026', 'Legacy', 'legacy', '', 'undefined', 'null'].includes(currentResSeason);
        const isInWindow = matchTime >= season1Start && matchTime <= season1End;

        if (isLegacyLabel || isInWindow) {
          if (currentResSeason !== 'Season 1') {
            updates.season = 'Season 1';
          }
        }

        // 2. Fix Game Type
        const s1 = Number(match.score1) || 0;
        const s2 = Number(match.score2) || 0;
        const totalLegs = s1 + s2;
        const isStandardFormat = totalLegs <= 8;

        // Check fixture context to identify hidden cup games
        let isCupGame = Boolean(match.cupId || match.matchId || match.tournamentId);
        if (!isCupGame && match.fixtureId) {
          const fx = allFixtures.find(f => String(f.id) === String(match.fixtureId));
          if (fx && (fx.cupId || fx.tournamentId || String(fx.gameType).toLowerCase().includes('cup'))) {
            isCupGame = true;
          }
        }

        if (isCupGame) {
          if (match.gameType !== 'Cup') {
            updates.gameType = 'Cup';
          }
        } else {
          if (!match.gameType || ['unknown', '', 'undefined', 'null'].includes(String(match.gameType))) {
            updates.gameType = isStandardFormat ? 'League' : 'Friendly';
          } else if (match.gameType === 'League' && !isStandardFormat) {
            updates.gameType = 'Friendly';
          }
        }

        // 3. Fix missing Player IDs
        let p1Id = match.player1Id;
        let p2Id = match.player2Id;

        if (!p1Id && match.player1) {
          const found = users.find(u =>
            u.username?.toLowerCase() === String(match.player1).toLowerCase() ||
            u.email?.toLowerCase() === String(match.player1).toLowerCase()
          );
          if (found) { p1Id = found.id; updates.player1Id = found.id; }
        }
        if (!p2Id && match.player2) {
          const found = users.find(u =>
            u.username?.toLowerCase() === String(match.player2).toLowerCase() ||
            u.email?.toLowerCase() === String(match.player2).toLowerCase()
          );
          if (found) { p2Id = found.id; updates.player2Id = found.id; }
        }

        // 4. Fix missing division data
        if (!match.division || match.division === 'Unassigned') {
          const p1 = users.find(u => String(u.id) === String(p1Id));
          const p2 = users.find(u => String(u.id) === String(p2Id));
          const division = p1?.division || p2?.division;
          if (division && division !== 'Unassigned') {
            updates.division = division;
          }
        }

        // 5. Ensure approvedAt exists
        if (!match.approvedAt) {
          updates.approvedAt = match.date ? new Date(match.date).toISOString() : new Date().toISOString();
        }

        if (Object.keys(updates).length > 0) {
          updatesByTargetId[targetId] = updates;
          currentBatch.update(doc(db, 'results', targetId), updates);
          updatedCount++;
          opCount++;

          if (opCount >= 450) {
            await currentBatch.commit();
            currentBatch = writeBatch(db);
            opCount = 0;
          }
        }
      }

      if (opCount > 0) {
        await currentBatch.commit();
      }

      await logAudit('BULK_SYNC_ANALYTICS', `Deep Sync ${approvedMatches.length} games. Fixed ${updatedCount} records.`);

      // Merge updates into local state directly — avoids silent failure of forceFetchResults
      if (updatedCount > 0) {
        const updatedResults = allResults.map(r => {
          const key = r.firestoreId || String(r.id)
          const merge = updatesByTargetId[key]
          return merge ? { ...r, ...merge } : r
        })
        updateResults(updatedResults)
        showToast(`Fixed ${updatedCount} records. Table updated!`, 'success');
      } else {
        showToast('All records already correct. No changes needed.', 'info');
      }

      // If Soft Reset is active, clear it so the labeled data actually shows in the table
      if (adminData?.leagueTableResetAt) {
        await updateAdminData({ leagueTableResetAt: null })
        triggerDataRefresh('all')
        showToast('Soft Reset cleared — all results now visible in the table.', 'success')
      }

    } catch (e) {
      console.error('Sync error:', e);
      showToast('Sync failed: ' + e.message, 'error');
    }
    setIsApproving(false);
  };

  const handleSoftResetStandings = async () => {
    if (!window.confirm("Soft Reset will hide all current results from the standings table without deleting them. This allows you to start a fresh phase while keeping history. Proceed?")) return;
    try {
      const now = new Date().toISOString();
      await updateAdminData({ leagueTableResetAt: now });
      await logAudit('SOFT_RESET_TABLE', `Set table reset timestamp to ${now}`);
      triggerDataRefresh('all');
      showToast('Standings table reset!', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  };

  const handleClearTableReset = async () => {
    if (!window.confirm("This will restore ALL historical league matches to the standings table. Proceed?")) return;
    try {
      await updateAdminData({ leagueTableResetAt: null });
      await logAudit('CLEAR_TABLE_RESET', 'Cleared table reset timestamp');
      triggerDataRefresh('all');
      showToast('Full history restored to standings!', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  };

  const filteredResultsList = useMemo(() => {
    let list = allResults.filter(r => String(r.status).toLowerCase() === resultFilter)

    if (resultSearch) {
      const s = resultSearch.toLowerCase()
      list = list.filter(r =>
        String(r.player1).toLowerCase().includes(s) ||
        String(r.player2).toLowerCase().includes(s)
      )
    }

    if (resultTypeFilter !== 'all') {
      list = list.filter(r => String(r.gameType).toLowerCase() === resultTypeFilter.toLowerCase())
    }

    return list.sort((a, b) => new Date(b.date || b.submittedAt) - new Date(a.date || a.submittedAt))
  }, [allResults, resultFilter, resultSearch, resultTypeFilter])

  const stats = useMemo(() => {
    const lastWeek = new Date()
    lastWeek.setDate(lastWeek.getDate() - 7)

    const newMembersList = allPlayers
      .filter(u => new Date(u.createdAt || 0) > lastWeek)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))

    return {
      newUsers: newMembersList.length,
      newMembers: newMembersList,
      pendingResults: pendingResults.length,
      pendingPayments: pendingPayments.length + entryRequests.length,
      totalPot: subscriptionPot + subscriptionPot10
    }
  }, [allPlayers, pendingResults, pendingPayments, entryRequests, subscriptionPot, subscriptionPot10])

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'results', label: 'Scores', count: pendingResults.length },
    { id: 'payments', label: 'Payments', count: pendingPayments.length + entryRequests.length },
    { id: 'new', label: 'New Users', count: stats.newUsers },
    { id: 'moneypot', label: 'Finances' },
    { id: 'admins', label: 'Staff' },
    { id: 'cups', label: 'Cups' },
    { id: 'playoffs', label: 'Playoffs' },
    { id: 'players', label: 'Members' },
    { id: 'seasons', label: 'Seasons' },
    { id: 'trophies', label: 'Trophies' },
    { id: 'surveys', label: 'Surveys' },
    { id: 'bets', label: 'Bets' },
    { id: 'tokens', label: 'Tokens' },
    { id: 'maintenance', label: 'System' }
  ]

  const toggleSelectResult = (id) => {
    setSelectedResults(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  return (
    <div className="page animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <h1 className="page-title text-gradient" style={{ fontSize: '2rem' }}>Admin Control Room</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Comprehensive League Management</p>
      </div>

      <div style={{
        display: 'flex',
        overflowX: 'auto',
        gap: '10px',
        marginBottom: '24px',
        paddingBottom: '12px',
        WebkitOverflowScrolling: 'touch',
        borderBottom: '1px solid rgba(255,255,255,0.05)'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`division-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            style={{ whiteSpace: 'nowrap', padding: '10px 18px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {tab.label}
            {tab.count > 0 && <span style={{ background: 'white', color: 'black', padding: '2px 6px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 900 }}>{tab.count}</span>}
          </button>
        ))}
      </div>

      <div className="admin-body">

        {/* TAB: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="animate-fade-in">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px', marginBottom: '32px' }}>
              <div className="stat-card glass" onClick={() => setActiveTab('results')} style={{ cursor: 'pointer', transition: 'transform 0.2s', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div className="stat-label" style={{ margin: 0 }}>Pending Results</div>
                  <div style={{ fontSize: '1.5rem' }}>🎯</div>
                </div>
                <div className="stat-value" style={{ color: stats.pendingResults > 0 ? 'var(--warning)' : 'var(--success)', fontSize: '2.5rem' }}>{stats.pendingResults}</div>
              </div>
              <div className="stat-card glass" onClick={() => setActiveTab('payments')} style={{ cursor: 'pointer', transition: 'transform 0.2s', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div className="stat-label" style={{ margin: 0 }}>Pending Payments</div>
                  <div style={{ fontSize: '1.5rem' }}>💳</div>
                </div>
                <div className="stat-value" style={{ color: stats.pendingPayments > 0 ? 'var(--error)' : 'var(--success)', fontSize: '2.5rem' }}>{stats.pendingPayments}</div>
              </div>
              <div className="stat-card glass" onClick={() => setActiveTab('new')} style={{ cursor: 'pointer', transition: 'transform 0.2s', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div className="stat-label" style={{ margin: 0 }}>New Users (7d)</div>
                  <div style={{ fontSize: '1.5rem' }}>👤</div>
                </div>
                <div className="stat-value" style={{ color: 'var(--accent-cyan)', fontSize: '2.5rem' }}>{stats.newUsers}</div>
              </div>
              <div className="stat-card glass" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div className="stat-label" style={{ margin: 0 }}>Total Sub Pot</div>
                  <div style={{ fontSize: '1.5rem' }}>💰</div>
                </div>
                <div className="stat-value" style={{ fontSize: '2.5rem' }}>£{stats.totalPot.toFixed(0)}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
              <div className="card glass" style={{ padding: '24px' }}>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>📊</span> Analytics Sync
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px', lineHeight: '1.6' }}>
                  Synchronize all approved match results and player data with the Analytics engine. This ensures all charts and historical stats are correctly categorized by season and division.
                </p>
                <button className="btn btn-primary btn-block" onClick={handleBulkSyncAnalytics} disabled={isApproving} style={{ padding: '14px' }}>
                  {isApproving ? 'Syncing...' : 'Bulk Sync All Approved Games'}
                </button>
              </div>

              <div className="card glass" style={{ padding: '24px' }}>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>🚨</span> Urgent Actions
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                  {(stats.pendingResults > 0 || stats.pendingPayments > 0) ? (
                    <>
                      {stats.pendingResults > 0 && (
                        <div className="glass" style={{ padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid var(--warning)', background: 'rgba(245, 158, 11, 0.05)' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{stats.pendingResults} matches awaiting review.</span>
                          <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('results')}>Review</button>
                        </div>
                      )}
                      {stats.pendingPayments > 0 && (
                        <div className="glass" style={{ padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid var(--error)', background: 'rgba(239, 68, 68, 0.05)' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{stats.pendingPayments} payments to verify.</span>
                          <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('payments')}>Verify</button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '10px' }}>✅</div>
                      <p style={{ color: 'var(--text-muted)', margin: 0 }}>System is healthy. No urgent tasks.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: RESULTS */}
        {activeTab === 'results' && (
          <div className="card glass">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h3>Match History & Review</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}> Standings are updated automatically from Approved League results.</p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="btn btn-sm btn-secondary glass" onClick={() => { triggerDataRefresh('all'); showToast('Standings sync triggered', 'info'); }} title="Force refresh of all league data">
                  🔄 Sync Standings
                </button>
                {resultFilter === 'pending' && selectedResults.length > 0 && (
                  <button className="btn btn-sm btn-primary" onClick={handleBulkApprove} disabled={isApproving}>
                    Approve Selected ({selectedResults.length})
                  </button>
                )}
                <button className={`btn btn-sm ${showSubmitGame ? 'btn-success' : 'btn-secondary'}`} onClick={() => setShowSubmitGame(!showSubmitGame)}>
                  {showSubmitGame ? 'Close' : '+ Submit Game'}
                </button>
                {['pending', 'approved', 'rejected'].map(f => (
                  <button key={f} className={`btn btn-sm ${resultFilter === f ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setResultFilter(f); setSelectedResults([]); }}>{f.toUpperCase()}</button>
                ))}
              </div>
            </div>

            {/* Search and Filter Bar */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="glass"
                placeholder="🔍 Search players..."
                style={{ flex: 2, minWidth: '200px', padding: '10px' }}
                value={resultSearch}
                onChange={e => setResultSearch(e.target.value)}
              />
              <select
                className="glass"
                style={{ flex: 1, minWidth: '150px', padding: '10px' }}
                value={resultTypeFilter}
                onChange={e => setResultTypeFilter(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="league">League</option>
                <option value="cup">Cup</option>
                <option value="friendly">Friendly</option>
              </select>
            </div>

            {editingResult && (
              <div className="card glass" style={{ marginBottom: '24px', padding: '24px', border: '1px solid var(--accent-cyan)' }}>
                <h4 style={{ marginBottom: '16px', color: 'var(--accent-cyan)' }}>Edit Match Record</h4>
                <form onSubmit={handleUpdateResult}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div className="form-group">
                      <label>Season</label>
                      <select value={editingResult.season || ''} onChange={e => setEditingResult({...editingResult, season: e.target.value})}>
                        <option value="">Legacy (Season 1)</option>
                        {getSeasons().map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Division</label>
                      <select value={editingResult.division || ''} onChange={e => setEditingResult({...editingResult, division: e.target.value})}>
                        <option value="">Auto (Profile)</option>
                        {['Elite', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze', 'Development'].map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div className="form-group">
                      <label>Score 1 ({editingResult.player1})</label>
                      <input type="number" value={editingResult.score1} onChange={e => setEditingResult({...editingResult, score1: parseInt(e.target.value)})} />
                    </div>
                    <div className="form-group">
                      <label>Score 2 ({editingResult.player2})</label>
                      <input type="number" value={editingResult.score2} onChange={e => setEditingResult({...editingResult, score2: parseInt(e.target.value)})} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div className="form-group">
                      <label>P1 180s</label>
                      <input type="number" value={editingResult.player1Stats?.['180s'] || 0} onChange={e => setEditingResult({...editingResult, player1Stats: {...(editingResult.player1Stats||{}), '180s': parseInt(e.target.value)}})} />
                    </div>
                    <div className="form-group">
                      <label>P2 180s</label>
                      <input type="number" value={editingResult.player2Stats?.['180s'] || 0} onChange={e => setEditingResult({...editingResult, player2Stats: {...(editingResult.player2Stats||{}), '180s': parseInt(e.target.value)}})} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Changes</button>
                    <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditingResult(null)}>Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {showSubmitGame && (
              <div className="card glass" style={{ marginBottom: '24px', padding: '24px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <h4 style={{ marginBottom: '16px', color: 'var(--success)' }}>Submit Game (No Proof Required)</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Player 1</label>
                    <select value={adminGameForm.player1} onChange={e => setAdminGameForm({...adminGameForm, player1: e.target.value})}>
                      <option value="">Select player...</option>
                      {allPlayers.map(p => <option key={p.id} value={p.id}>{p.username}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Player 2</label>
                    <select value={adminGameForm.player2} onChange={e => setAdminGameForm({...adminGameForm, player2: e.target.value})}>
                      <option value="">Select player...</option>
                      {allPlayers.map(p => <option key={p.id} value={p.id}>{p.username}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Score 1</label>
                    <input type="number" placeholder="0" value={adminGameForm.score1} onChange={e => setAdminGameForm({...adminGameForm, score1: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Score 2</label>
                    <input type="number" placeholder="0" value={adminGameForm.score2} onChange={e => setAdminGameForm({...adminGameForm, score2: e.target.value})} />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label>Game Type</label>
                  <select value={adminGameForm.gameType} onChange={e => setAdminGameForm({...adminGameForm, gameType: e.target.value})}>
                    <option value="Friendly">Friendly</option>
                    <option value="League">League</option>
                    <option value="Cup">Cup</option>
                  </select>
                </div>
                <details style={{ marginBottom: '16px', cursor: 'pointer' }}>
                  <summary style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Stats (optional)</summary>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}><label style={{ fontSize: '0.75rem' }}>P1 180s</label><input type="number" value={adminGameForm.p1_180s} onChange={e => setAdminGameForm({...adminGameForm, p1_180s: e.target.value})} /></div>
                    <div className="form-group" style={{ marginBottom: 0 }}><label style={{ fontSize: '0.75rem' }}>P2 180s</label><input type="number" value={adminGameForm.p2_180s} onChange={e => setAdminGameForm({...adminGameForm, p2_180s: e.target.value})} /></div>
                    <div className="form-group" style={{ marginBottom: 0 }}><label style={{ fontSize: '0.75rem' }}>P1 Checkout</label><input type="number" value={adminGameForm.p1_checkout} onChange={e => setAdminGameForm({...adminGameForm, p1_checkout: e.target.value})} /></div>
                    <div className="form-group" style={{ marginBottom: 0 }}><label style={{ fontSize: '0.75rem' }}>P2 Checkout</label><input type="number" value={adminGameForm.p2_checkout} onChange={e => setAdminGameForm({...adminGameForm, p2_checkout: e.target.value})} /></div>
                    <div className="form-group" style={{ marginBottom: 0 }}><label style={{ fontSize: '0.75rem' }}>P1 Doubles %</label><input type="number" step="0.1" value={adminGameForm.p1_doubles} onChange={e => setAdminGameForm({...adminGameForm, p1_doubles: e.target.value})} /></div>
                    <div className="form-group" style={{ marginBottom: 0 }}><label style={{ fontSize: '0.75rem' }}>P2 Doubles %</label><input type="number" step="0.1" value={adminGameForm.p2_doubles} onChange={e => setAdminGameForm({...adminGameForm, p2_doubles: e.target.value})} /></div>
                  </div>
                </details>
                <button className="btn btn-success" onClick={handleAdminSubmitGame} style={{ width: '100%' }}>Submit Game (Approved)</button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredResultsList.map(r => (
                <div key={r.id} className="result-item glass" style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {resultFilter === 'pending' && (
                    <input type="checkbox" checked={selectedResults.includes(r.id)} onChange={() => toggleSelectResult(r.id)} style={{ width: '20px', height: '20px' }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontWeight: 700 }}>{r.player1} <span style={{ color: 'var(--accent-cyan)' }}>vs</span> {r.player2}</span>
                      <span style={{ fontWeight: 900, color: 'var(--accent-cyan)' }}>{r.score1}-{r.score2}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                      {r.gameType} | {r.date} | Sub: {r.submittedBy || 'Player'}
                      {r.excludeFromLeague && <span style={{ marginLeft: '8px', color: 'var(--error)', fontWeight: 700 }}>🚫 EXCLUDED</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {resultFilter === 'pending' && <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => handleApproveResult(r.id)}>Approve</button>}
                      {resultFilter === 'pending' && <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => handleRejectResult(r.id)}>Reject</button>}
                      {resultFilter !== 'pending' && (
                        <>
                          <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setEditingResult({...r})}>✏️ Edit</button>
                          <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => handleApproveResult(r.id)}>Restore/Reset</button>
                          <button className={`btn btn-sm ${r.excludeFromLeague ? 'btn-warning' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => handleToggleExcludeFromLeague(r)}>
                            {r.excludeFromLeague ? 'Include' : 'Exclude'}
                          </button>
                        </>
                      )}
                      <button className="btn btn-danger btn-sm" style={{ padding: '8px' }} onClick={() => handleDeleteResult(r.id)}>🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
              {(filteredResultsList.length === 0) && <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No results found matching your criteria.</p>}
            </div>
          </div>
        )}

        {/* TAB: PAYMENTS */}
        {activeTab === 'payments' && (
          <div className="card glass">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h3 style={{ margin: 0 }}>League Subscriptions</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Verify and manage player access payments.</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className={`btn btn-sm ${paymentSubTab === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPaymentSubTab('pending')}
                >
                  Pending ({pendingPayments.length})
                </button>
                <button
                  className={`btn btn-sm ${paymentSubTab === 'approved' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPaymentSubTab('approved')}
                >
                  Approved ({subscribers.length})
                </button>
              </div>
            </div>

            {paymentSubTab === 'pending' ? (
              <div className="animate-fade-in">
                {pendingPayments.map(u => (
                  <div key={u.id} className="glass" style={{ padding: '20px', borderRadius: '12px', marginBottom: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', flexWrap: 'wrap', gap: '12px' }}>
                       <div>
                          <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{u.username}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{u.email}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', marginTop: '4px', fontWeight: 600 }}>
                            Method: {u.paymentMethod || 'Unknown'} | Plan: {u.requestedPlan || 'Standard'} | Season: {u.requestedSeason || adminData?.currentSeason || 'TBC'}
                          </div>
                       </div>

                       <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                         {approvingPaymentId === u.id ? (
                           <div className="glass" style={{ display: 'flex', gap: '8px', padding: '8px', borderRadius: '8px', border: '1px solid var(--accent-cyan)' }}>
                             <select
                               className="glass"
                               style={{ fontSize: '0.75rem', padding: '4px' }}
                               value={approvalOverride.tier}
                               onChange={e => setApprovalOverride({...approvalOverride, tier: e.target.value})}
                             >
                               <option value="standard">Standard (£5)</option>
                               <option value="premium">Premium (£10)</option>
                             </select>
                             <select
                               className="glass"
                               style={{ fontSize: '0.75rem', padding: '4px' }}
                               value={approvalOverride.season}
                               onChange={e => setApprovalOverride({...approvalOverride, season: e.target.value})}
                             >
                               {getSeasons().map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                               {!getSeasons().find(s => s.name === 'Season 1') && <option value="Season 1">Season 1</option>}
                             </select>
                             <button className="btn btn-primary btn-sm" onClick={() => handleApprovePayment(u)}>Confirm</button>
                             <button className="btn btn-secondary btn-sm" onClick={() => setApprovingPaymentId(null)}>×</button>
                           </div>
                         ) : (
                           <>
                             <button
                               className="btn btn-secondary btn-sm"
                               onClick={() => {
                                 setApprovingPaymentId(u.id);
                                 setApprovalOverride({
                                   tier: (u.requestedPlan === 'elite' || u.paymentMethod === 'paypal10') ? 'premium' : 'standard',
                                   season: u.requestedSeason || adminData?.currentSeason || 'Season 1'
                                 });
                               }}
                             >
                               Edit & Approve
                             </button>
                             <button className="btn btn-primary btn-sm" onClick={() => handleApprovePayment(u)}>Quick Approve</button>
                           </>
                         )}
                       </div>
                    </div>
                    {u.paymentProof && (
                      <div style={{ marginTop: '10px' }}>
                        <p style={{ fontSize: '0.75rem', marginBottom: '8px', color: 'var(--text-muted)' }}>Payment Receipt:</p>
                        <img
                          src={u.paymentProof}
                          alt="Proof"
                          style={{ width: '100%', maxWidth: '400px', borderRadius: '12px', border: '1px solid var(--border)', cursor: 'pointer' }}
                          onClick={() => window.open(u.paymentProof, '_blank')}
                        />
                      </div>
                    )}
                  </div>
                ))}
                {pendingPayments.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>✅</div>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>No payments awaiting approval.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="animate-fade-in">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {subscribers.sort((a,b) => new Date(b.subscriptionDate || 0) - new Date(a.subscriptionDate || 0)).map(u => (
                    <div key={u.id} className="glass" style={{ padding: '16px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div className="avatar-ring" style={{ width: '45px', height: '42px', padding: '2px' }}>
                            <div className="avatar-inner" style={{ background: '#050816', fontSize: '1rem' }}>
                              {u.profilePicture ? (
                                <img src={u.profilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <span>{u.username.charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{u.username}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              <span style={{ color: u.subscriptionTier === 'premium' ? '#fbbf24' : 'var(--accent-cyan)', fontWeight: 700 }}>
                                {u.subscriptionTier?.toUpperCase() || 'STANDARD'}
                              </span>
                              {' • '} Approved {u.subscriptionDate ? new Date(u.subscriptionDate).toLocaleDateString() : 'Historical'}
                            </div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '2px', fontStyle: 'italic' }}>
                              Seasons: {(u.subscribedSeasons || []).join(', ') || 'Legacy'}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {approvingPaymentId === u.id ? (
                            <div className="glass" style={{ display: 'flex', gap: '8px', padding: '8px', borderRadius: '8px', border: '1px solid var(--accent-cyan)' }}>
                              <select
                                className="glass"
                                style={{ fontSize: '0.75rem', padding: '4px' }}
                                value={approvalOverride.tier}
                                onChange={e => setApprovalOverride({...approvalOverride, tier: e.target.value})}
                              >
                                <option value="standard">Standard (£5)</option>
                                <option value="premium">Premium (£10)</option>
                              </select>
                              <select
                                className="glass"
                                style={{ fontSize: '0.75rem', padding: '4px' }}
                                value={approvalOverride.season}
                                onChange={e => setApprovalOverride({...approvalOverride, season: e.target.value})}
                              >
                                {getSeasons().map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                {!getSeasons().find(s => s.name === 'Season 1') && <option value="Season 1">Season 1</option>}
                              </select>
                              <button className="btn btn-primary btn-sm" onClick={() => handleUpdateApprovedSubscription(u)}>Update</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => setApprovingPaymentId(null)}>×</button>
                            </div>
                          ) : (
                            <>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                onClick={() => {
                                  setApprovingPaymentId(u.id);
                                  setApprovalOverride({
                                    tier: u.subscriptionTier || 'standard',
                                    season: adminData?.currentSeason || 'Season 1'
                                  });
                                }}
                              >
                                Edit Sub
                              </button>
                              {u.paymentProof && (
                                <button className="btn btn-secondary btn-sm" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => window.open(u.paymentProof, '_blank')}>View Receipt</button>
                              )}
                              <button className="btn btn-secondary btn-sm" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => navigate(`/profile/${u.id}`)}>Profile</button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {subscribers.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>No approved subscribers found.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB: NEW USERS */}
        {activeTab === 'new' && (
          <div className="card glass animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h3 className="card-title">New User Onboarding</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Users who joined in the last 7 days.</p>
              </div>
              <div style={{ padding: '8px 16px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid var(--accent-cyan)', borderRadius: '8px', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                {stats.newUsers} RECENT
              </div>
            </div>

            {stats.newMembers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '20px' }}>🌵</div>
                <p style={{ color: 'var(--text-muted)' }}>No new users joined in the last week.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {stats.newMembers.map(p => (
                  <div key={p.id} className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <div className="avatar-ring" style={{ width: '55px', height: '52px', padding: '2px' }}>
                        <div className="avatar-inner" style={{ background: '#050816', fontSize: '1.2rem' }}>
                          {p.profilePicture ? (
                            <img src={p.profilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span>{(p.username || '?').charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '4px' }}>{p.username}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {p.email} • Joined {new Date(p.createdAt).toLocaleDateString()}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                             Div: {p.division || 'TBC'}
                          </span>
                          {p.isSubscribed && (
                             <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', color: 'var(--success)' }}>
                               ELITE PASS
                             </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/profile/${p.id}`)}>Profile</button>
                      <button className="btn btn-primary btn-sm" onClick={() => { setDivisionForm({ player: p.id, division: '' }); setActiveTab('players'); }}>Assign Div</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: MONEY POT */}
        {activeTab === 'moneypot' && (
          <div className="card glass">
            <h3>League Financials</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '20px' }}>
               <div className="glass" style={{ padding: '20px', borderRadius: '12px' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Standard Pot (£5)</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--accent-cyan)' }}>£{subscriptionPot.toFixed(2)}</div>
                  <div style={{ marginTop: '15px', display: 'flex', gap: '8px' }}>
                     <input type="number" className="glass" style={{ flex: 1, padding: '8px' }} placeholder="+/- Amount" onChange={e => setPotAdjust({...potAdjust, standard: parseFloat(e.target.value) || 0})} />
                     <button className="btn btn-secondary btn-sm" onClick={() => handleAdjustPot('standard')}>Adjust</button>
                  </div>
               </div>
               <div className="glass" style={{ padding: '20px', borderRadius: '12px' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Premium Pot (£10)</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fbbf24' }}>£{subscriptionPot10.toFixed(2)}</div>
                  <div style={{ marginTop: '15px', display: 'flex', gap: '8px' }}>
                     <input type="number" className="glass" style={{ flex: 1, padding: '8px' }} placeholder="+/- Amount" onChange={e => setPotAdjust({...potAdjust, premium: parseFloat(e.target.value) || 0})} />
                     <button className="btn btn-secondary btn-sm" onClick={() => handleAdjustPot('premium')}>Adjust</button>
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* TAB: STAFF */}
        {activeTab === 'admins' && (
          <div className="card glass">
            <h3>Staff & Permissions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
               {allPlayers.filter(p => p.isAdmin || p.isTournamentAdmin || p.isCupAdmin).map(p => (
                 <div key={p.id} className="glass" style={{ padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                       <div style={{ fontWeight: 700 }}>{p.username}</div>
                       <div style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)' }}>{p.email}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                       <label style={{ fontSize: '0.7rem', textAlign: 'center' }}>
                          <input type="checkbox" checked={p.isAdmin || false} onChange={e => handleUpdateAdminRole(p.id, 'isAdmin', e.target.checked)} /><br/>Super
                       </label>
                       <label style={{ fontSize: '0.7rem', textAlign: 'center' }}>
                          <input type="checkbox" checked={p.isTournamentAdmin || false} onChange={e => handleUpdateAdminRole(p.id, 'isTournamentAdmin', e.target.checked)} /><br/>Tourny
                       </label>
                       <label style={{ fontSize: '0.7rem', textAlign: 'center' }}>
                          <input type="checkbox" checked={p.isCupAdmin || false} onChange={e => handleUpdateAdminRole(p.id, 'isCupAdmin', e.target.checked)} /><br/>Cup
                       </label>
                    </div>
                 </div>
               ))}
            </div>

            <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
               <h4>Add New Staff Member</h4>
               <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <UserSearchSelect users={allPlayers.filter(p => !p.isAdmin)} selectedId={''} onSelect={id => handleUpdateAdminRole(id, 'isTournamentAdmin', true)} label="Select User to Promote" />
               </div>
            </div>
          </div>
        )}

        {/* TAB: PLAYOFFS */}
        {activeTab === 'playoffs' && (
          <div className="card glass animate-fade-in">
            <h3 className="card-title">Playoff Match Creation</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px' }}>
              Create official playoff fixtures between two players. These will appear in the fixtures list immediately.
            </p>

            <div className="glass" style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div className="form-group">
                  <label>Player 1</label>
                  <UserSearchSelect users={allPlayers} selectedId={playoffForm.player1} onSelect={id => setPlayoffForm({...playoffForm, player1: id})} label="Select Player 1" />
                </div>
                <div className="form-group">
                  <label>Player 2</label>
                  <UserSearchSelect users={allPlayers} selectedId={playoffForm.player2} onSelect={id => setPlayoffForm({...playoffForm, player2: id})} label="Select Player 2" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div className="form-group">
                  <label>Division Override (Optional)</label>
                  <input type="text" className="glass" placeholder="e.g. Elite" value={playoffForm.division} onChange={e => setPlayoffForm({...playoffForm, division: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Start Date</label>
                  <input type="date" className="glass" value={playoffForm.date} onChange={e => setPlayoffForm({...playoffForm, date: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Start Time</label>
                  <input type="time" className="glass" value={playoffForm.time} onChange={e => setPlayoffForm({...playoffForm, time: e.target.value})} />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label>Format (Best of Legs)</label>
                <select className="glass" value={playoffForm.bestOf} onChange={e => setPlayoffForm({...playoffForm, bestOf: e.target.value})}>
                  <option value="1">Best of 1 (First to 1)</option>
                  <option value="3">Best of 3 (First to 2)</option>
                  <option value="5">Best of 5 (First to 3)</option>
                  <option value="7">Best of 7 (First to 4)</option>
                  <option value="9">Best of 9 (First to 5)</option>
                  <option value="11">Best of 11 (First to 6)</option>
                  <option value="13">Best of 13 (First to 7)</option>
                </select>
              </div>

              <button className="btn btn-primary btn-block" onClick={handleCreatePlayoff}>Create Playoff Fixture</button>
            </div>
          </div>
        )}

        {/* TAB: SEASONS */}
        {activeTab === 'seasons' && (
          <div className="card glass">
            <h3>Season Management</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
               <div className="glass" style={{ padding: '15px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid var(--accent-cyan)' }}>
                  <strong>ACTIVE SEASON:</strong> {localStorage.getItem('eliteArrowsCurrentSeason') || 'Not Set'}
               </div>
               {getSeasons().map(s => (
                 <div key={s.id} className="glass" style={{ padding: '12px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{s.name} ({s.status})</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                       <button className="btn btn-secondary btn-sm" onClick={() => { localStorage.setItem('eliteArrowsCurrentSeason', s.name); window.location.reload(); }}>Set Active</button>
                       <button className="btn btn-danger btn-sm" onClick={async () => { await deleteDoc(doc(db, 'seasons', s.id)); triggerDataRefresh('seasons'); }}>🗑️</button>
                    </div>
                 </div>
               ))}

               <div style={{ marginTop: '20px' }}>
                  <h4>Create New Season</h4>
                  <input type="text" className="glass" placeholder="Season Name (e.g. Summer 2025)" style={{ width: '100%', padding: '12px', marginBottom: '10px' }} onChange={e => setSeasonForm({...seasonForm, name: e.target.value})} />
                  <button className="btn btn-primary btn-block" onClick={handleCreateSeason}>Launch Season</button>
               </div>
            </div>
          </div>
        )}

        {/* TAB: CUPS */}
        {activeTab === 'cups' && <CupManagement />}

        {/* TAB: MEMBERS */}
        {activeTab === 'players' && (
          <div className="card glass">
            <h3 style={{ marginBottom: '20px' }}>Global Membership List</h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '30px' }}>
              <div className="glass" style={{ padding: '20px', borderRadius: '15px' }}>
                <h4>Manually Grant Elite Pass</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                    <UserSearchSelect users={allPlayers} selectedId={grantSubForm.player} onSelect={id => setGrantSubForm({...grantSubForm, player: id})} label="Target Player" />
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <select className="glass" style={{ flex: 1, padding: '10px' }} value={grantSubForm.tier} onChange={e => setGrantSubForm({...grantSubForm, tier: e.target.value})}>
                        <option value="standard">Standard (£5)</option>
                        <option value="premium">Premium (£10)</option>
                      </select>
                      <select className="glass" style={{ flex: 1, padding: '10px' }} value={grantSubForm.season} onChange={e => setGrantSubForm({...grantSubForm, season: e.target.value})}>
                        <option value="">Current Season</option>
                        {getSeasons().map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        {!getSeasons().find(s => s.name === 'Season 1') && <option value="Season 1">Season 1</option>}
                      </select>
                    </div>
                    <button className="btn btn-primary btn-block" onClick={handleGrantSubscription}>Activate Membership</button>
                </div>
              </div>

              <div className="glass" style={{ padding: '20px', borderRadius: '15px' }}>
                <h4>Move Player Division</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                    <UserSearchSelect users={allPlayers} selectedId={divisionForm.player} onSelect={id => setDivisionForm({...divisionForm, player: id})} label="Target Player" />
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <select className="glass" style={{ flex: 1, padding: '10px' }} value={divisionForm.division} onChange={e => setDivisionForm({...divisionForm, division: e.target.value})}>
                        <option value="">Select Division...</option>
                        <option value="Elite">Elite</option>
                        <option value="Diamond">Diamond</option>
                        <option value="Platinum">Platinum</option>
                        <option value="Gold">Gold</option>
                        <option value="Silver">Silver</option>
                        <option value="Bronze">Bronze</option>
                        <option value="Development">Development</option>
                        <option value="Unassigned">Unassigned</option>
                      </select>
                      <button className="btn btn-primary" onClick={handleUpdateDivision}>Move</button>
                    </div>
                </div>
              </div>
            </div>

            <div style={{ maxHeight: '600px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '10px' }}>
              {allPlayers.sort((a, b) => a.username.localeCompare(b.username)).map(p => (
                <div key={p.id} className="player-card glass" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div className="avatar-ring" style={{ width: '45px', height: '42px', padding: '2px' }}>
                      <div className="avatar-inner" style={{ background: '#050816', fontSize: '1rem' }}>
                        {p.profilePicture ? (
                          <img src={p.profilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span>{(p.username || '?').charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {p.username}
                        {p.isSubscribed && (
                          <span style={{
                            color: 'var(--success)',
                            fontSize: '0.6rem',
                            background: 'rgba(16, 185, 129, 0.1)',
                            padding: '2px 8px',
                            borderRadius: '99px',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}>
                            Pass
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {p.email} • <span style={{ color: 'var(--accent-cyan)' }}>{p.division || 'Unassigned'}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-secondary btn-sm" style={{ padding: '8px 12px' }} onClick={() => navigate(`/profile/${p.id}`)}>View</button>
                    {isFullAdmin && (
                      <>
                        <button
                          className="btn btn-sm"
                          style={{
                            background: p.isBanned ? 'var(--success)' : 'rgba(239, 68, 68, 0.1)',
                            border: `1px solid ${p.isBanned ? 'var(--success)' : 'var(--error)'}`,
                            padding: '8px',
                            color: p.isBanned ? 'white' : 'var(--error)',
                            minWidth: '40px'
                          }}
                          onClick={() => handleToggleBan(p.id, p.isBanned)}
                          title={p.isBanned ? 'Unban User' : 'Ban User'}
                        >
                          {p.isBanned ? '😇' : '🚫'}
                        </button>
                        <button className="btn btn-danger btn-sm" style={{ padding: '8px', minWidth: '40px' }} onClick={() => handleDeleteUser(p.id)}>🗑️</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: BETS */}
        {activeTab === 'bets' && (
          <div className="card glass">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', alignItems: 'center' }}>
              <h3>Betting Management</h3>
              <button className="btn btn-primary" onClick={handleCheckBetWinners} disabled={isApproving}>
                {isApproving ? 'Checking...' : 'Check Bet Winners'}
              </button>
            </div>

            <div className="glass" style={{ padding: '20px', borderRadius: '12px', marginBottom: '24px', background: 'rgba(56, 189, 248, 0.05)' }}>
              <h4 style={{ marginBottom: '12px' }}>Manually Add to Promotion Draw</h4>
              <div style={{ display: 'flex', gap: '12px' }}>
                <UserSearchSelect users={allPlayers.filter(u => u.promotionDraw !== true)} selectedId={''} onSelect={handleManualDrawEntry} label="Select Player" />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {bets.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No bets placed yet.</p>
              ) : (
                [...bets].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(bet => (
                  <div key={bet.id} className="glass" style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: bet.won === true ? '1px solid var(--success)' : bet.won === false ? '1px solid var(--error)' : '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{bet.username}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(bet.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div style={{ fontSize: '0.9rem', marginBottom: '8px' }}>
                      Bet on: <strong>{bet.player1Name} vs {bet.player2Name}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.85rem' }}>
                        Prediction: <span style={{ fontWeight: 600 }}>{bet.predictedWinner} ({bet.predictedScore1}-{bet.predictedScore2})</span>
                      </div>
                      <div style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        background: bet.won === true ? 'var(--success-bg)' : bet.won === false ? 'var(--error-bg)' : 'rgba(255,255,255,0.1)',
                        color: bet.won === true ? 'var(--success)' : bet.won === false ? 'var(--error)' : 'var(--text-muted)',
                        textTransform: 'uppercase'
                      }}>
                        {bet.won === true ? 'Won' : bet.won === false ? 'Lost' : 'Pending'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB: TOKENS */}
        {activeTab === 'tokens' && (
          <div className="card glass">
            <h3>Elite Token Disbursement</h3>
            <div style={{ marginTop: '20px' }}>
               <UserSearchSelect users={allPlayers} selectedId={tokenForm.player} onSelect={id => setTokenForm({...tokenForm, player: id})} label="Recipient" />
               <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                  <input type="number" className="glass" style={{ flex: 1, padding: '12px' }} placeholder="Amount" onChange={e => setTokenForm({...tokenForm, amount: parseInt(e.target.value) || 0})} />
                  <select className="glass" style={{ padding: '10px' }} value={tokenForm.action} onChange={e => setTokenForm({...tokenForm, action: e.target.value})}>
                     <option value="add">Add</option>
                     <option value="remove">Remove</option>
                  </select>
               </div>
               <button className="btn btn-primary btn-block" style={{ marginTop: '15px' }} onClick={async () => {
                  const target = allPlayers.find(u => u.id === tokenForm.player)
                  const current = target?.eliteTokens || 0
                  const next = tokenForm.action === 'add' ? current + tokenForm.amount : Math.max(0, current - tokenForm.amount)
                  await setDoc(doc(db, 'users', tokenForm.player), { eliteTokens: next }, { merge: true })
                  await logAudit('ADJUST_TOKENS', `${tokenForm.action} ${tokenForm.amount} tokens to ${target?.username}`)
                  triggerDataRefresh('users')
                  showToast('Tokens updated', 'success')
               }}>Update Token Balance</button>
            </div>
          </div>
        )}

        {/* TAB: TROPHIES */}
        {activeTab === 'trophies' && (
          <div className="card glass">
            <h3>Trophy Room Management</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Award digital trophies to players for their achievements.</p>

            <div className="glass" style={{ padding: '24px', borderRadius: '16px' }}>
              <div className="form-group">
                <label>Select Player</label>
                <UserSearchSelect users={allPlayers} selectedId={trophyForm.player} onSelect={id => setTrophyForm({...trophyForm, player: id})} label="Recipient" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Icon</label>
                  <select className="glass" value={trophyForm.icon} onChange={e => setTrophyForm({...trophyForm, icon: e.target.value})}>
                    <option value="🏆">🏆 Trophy</option>
                    <option value="🥇">🥇 Gold</option>
                    <option value="🥈">🥈 Silver</option>
                    <option value="🥉">🥉 Bronze</option>
                    <option value="🎯">🎯 Bullseye</option>
                    <option value="🔥">🔥 Hot Streak</option>
                    <option value="👑">👑 Champion</option>
                    <option value="🎖️">🎖️ Medal</option>
                    <option value="🚀">🚀 Rising Star</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Trophy Name</label>
                  <input className="glass" placeholder="e.g. League Champion, Most 180s" value={trophyForm.name} onChange={e => setTrophyForm({...trophyForm, name: e.target.value})} />
                </div>
              </div>

              <div className="form-group">
                <label>Season</label>
                <input className="glass" placeholder="e.g. Season 1" value={trophyForm.season} onChange={e => setTrophyForm({...trophyForm, season: e.target.value})} />
              </div>

              <button className="btn btn-primary btn-block" onClick={handleAwardTrophy}>Award Trophy to Player</button>
            </div>
          </div>
        )}

        {/* TAB: SURVEYS */}
        {activeTab === 'surveys' && (
          <div className="card glass">
            <h3 style={{ marginBottom: '24px' }}>Survey Management</h3>

            <div className="card glass" style={{ padding: '24px', marginBottom: '24px', border: '1px solid var(--accent-cyan)' }}>
              <h4 style={{ marginBottom: '16px', color: 'var(--accent-cyan)' }}>Create New Survey</h4>

              <div className="form-group">
                <label>Survey Title</label>
                <input value={surveyForm.title} onChange={e => setSurveyForm({...surveyForm, title: e.target.value})} placeholder="e.g. Season 2 Feedback" />
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <textarea value={surveyForm.description} onChange={e => setSurveyForm({...surveyForm, description: e.target.value})} rows={2} placeholder="Brief explanation..." />
              </div>
              <div className="form-group">
                <label>Target Audience</label>
                <select value={surveyForm.targetType} onChange={e => setSurveyForm({...surveyForm, targetType: e.target.value})}>
                  <option value="all">All Users</option>
                  <option value="specific">Specific Users</option>
                </select>
              </div>

              {surveyForm.targetType === 'specific' && (
                <div className="form-group">
                  <label>Select Target Users</label>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                    {allPlayers.map(p => (
                      <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={surveyForm.targetUserIds.includes(p.id)}
                          onChange={e => {
                            if (e.target.checked) setSurveyForm({...surveyForm, targetUserIds: [...surveyForm.targetUserIds, p.id]})
                            else setSurveyForm({...surveyForm, targetUserIds: surveyForm.targetUserIds.filter(id => id !== p.id)})
                          }}
                        />
                        {p.username} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({p.division || 'Unassigned'})</span>
                      </label>
                    ))}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>{surveyForm.targetUserIds.length} selected</p>
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px' }}>Questions</label>
                {surveyQuestions.map((q, i) => (
                  <div key={q.id} className="glass" style={{ padding: '16px', borderRadius: '8px', marginBottom: '10px', background: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Question {i + 1}</span>
                      {surveyQuestions.length > 1 && (
                        <button className="btn btn-danger btn-sm" style={{ padding: '4px 8px', fontSize: '0.7rem' }} onClick={() => setSurveyQuestions(surveyQuestions.filter((_, idx) => idx !== i))}>Remove</button>
                      )}
                    </div>
                    <input value={q.text} onChange={e => {
                      const next = [...surveyQuestions]
                      next[i] = { ...next[i], text: e.target.value }
                      setSurveyQuestions(next)
                    }} placeholder="Question text" style={{ marginBottom: '8px' }} />
                    <select value={q.type} onChange={e => {
                      const next = [...surveyQuestions]
                      next[i] = { ...next[i], type: e.target.value }
                      setSurveyQuestions(next)
                    }} style={{ marginBottom: '8px' }}>
                      <option value="text">Text Answer</option>
                      <option value="radio">Single Choice</option>
                      <option value="checkbox">Multiple Choice</option>
                    </select>
                    {(q.type === 'radio' || q.type === 'checkbox') && (
                      <input value={q.options || ''} onChange={e => {
                        const next = [...surveyQuestions]
                        next[i] = { ...next[i], options: e.target.value }
                        setSurveyQuestions(next)
                      }} placeholder="Options (comma-separated)" style={{ fontSize: '0.8rem' }} />
                    )}
                  </div>
                ))}
                <button className="btn btn-secondary btn-sm" onClick={() => setSurveyQuestions([...surveyQuestions, { id: `q${Date.now()}`, text: '', type: 'text', options: '' }])}>+ Add Question</button>
              </div>

              <button className="btn btn-primary btn-block" onClick={handleCreateSurvey}>Publish Survey</button>
            </div>

            <h4 style={{ marginBottom: '16px' }}>Existing Surveys</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(adminData?.surveys || []).length === 0 ? (
                <p style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No surveys created yet.</p>
              ) : (
                [...(adminData?.surveys || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(survey => (
                  <div key={survey.id} className="glass" style={{ padding: '16px', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div>
                        <strong>{survey.title}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '10px' }}>{survey.questions.length} questions | {survey.targetType === 'all' ? 'All users' : `${(survey.targetUserIds || []).length} users`}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ fontSize: '0.7rem', color: survey.active ? 'var(--success)' : 'var(--text-muted)' }}>{survey.active ? 'Active' : 'Inactive'}</span>
                        <button className="btn btn-secondary btn-sm" onClick={() => setViewSurveyResponses(viewSurveyResponses === survey.id ? null : survey.id)}>
                          {(survey.responses || []).length} Responses
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteSurvey(survey.id)}>🗑️</button>
                      </div>
                    </div>
                    {survey.description && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>{survey.description}</p>}

                    {viewSurveyResponses === survey.id && (
                      <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                        <h5 style={{ marginBottom: '12px', fontSize: '0.85rem' }}>Responses ({(survey.responses || []).length})</h5>
                        {(survey.responses || []).length === 0 ? (
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No responses yet.</p>
                        ) : (
                          survey.responses.map((resp, ri) => {
                            const player = allPlayers.find(p => p.id === resp.userId)
                            return (
                              <div key={ri} style={{ padding: '12px', borderBottom: '1px solid var(--border)', marginBottom: '8px' }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>{player?.username || 'Unknown'}</div>
                                {resp.answers.map((ans, ai) => (
                                  <div key={ai} style={{ fontSize: '0.75rem', marginBottom: '4px' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Q{ai + 1}:</span> {ans.answer}
                                  </div>
                                ))}
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{new Date(resp.submittedAt).toLocaleDateString()}</div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB: MAINTENANCE */}
        {activeTab === 'maintenance' && (
          <div className="card glass" style={{ padding: '32px' }}>
            <div style={{ marginBottom: '32px' }}>
              <h3 className="card-title" style={{ fontSize: '1.5rem', marginBottom: '8px' }}>System Control Center</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Manage global application behavior and maintenance states.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '40px' }}>
              <div className="glass" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--accent-cyan)' }}>
                <h4 style={{ marginBottom: '12px' }}>Season 1 Recovery</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Force historical data to "Season 1" and link missing IDs.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button className="btn btn-secondary btn-sm" onClick={handleBulkSyncAnalytics} disabled={isApproving}>
                    {isApproving ? 'Processing...' : 'Run Deep Sync'}
                  </button>
                  <button className="btn btn-danger btn-sm" style={{ opacity: 0.8 }} onClick={handleSoftResetStandings}>
                    Soft Reset Table (Wipe Stats)
                  </button>
                  {adminData?.leagueTableResetAt && (
                    <button className="btn btn-secondary btn-sm" style={{ fontSize: '0.7rem' }} onClick={handleClearTableReset}>
                      Restore All History
                    </button>
                  )}
                </div>
              </div>

              <div className="glass" style={{
                padding: '24px',
                borderRadius: '16px',
                background: adminData?.isMaintenanceMode ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.05)',
                border: `1px solid ${adminData?.isMaintenanceMode ? 'var(--error)' : 'var(--success)'}`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '180px'
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div style={{ fontSize: '2.5rem' }}>{adminData?.isMaintenanceMode ? '🔒' : '🔓'}</div>
                    <div className="toggle-switch">
                      <input
                        type="checkbox"
                        id="maintenanceToggle"
                        checked={adminData?.isMaintenanceMode || false}
                        onChange={e => updateAdminData({ isMaintenanceMode: e.target.checked })}
                      />
                      <label htmlFor="maintenanceToggle"></label>
                    </div>
                  </div>
                  <h4 style={{ margin: '0 0 8px 0', fontWeight: 800, fontSize: '1.1rem' }}>Maintenance Mode</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.5' }}>
                    Only administrators can access the application. Users will see your custom banner message.
                  </p>
                </div>
              </div>

              <div className="glass" style={{
                padding: '24px',
                borderRadius: '16px',
                background: adminData?.registrationsEnabled !== false ? 'rgba(56, 189, 248, 0.1)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${adminData?.registrationsEnabled !== false ? 'var(--accent-cyan)' : 'var(--border)'}`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '180px'
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div style={{ fontSize: '2.5rem' }}>{adminData?.registrationsEnabled !== false ? '📝' : '🚫'}</div>
                    <div className="toggle-switch">
                      <input
                        type="checkbox"
                        id="regToggle"
                        checked={adminData?.registrationsEnabled !== false}
                        onChange={e => updateAdminData({ registrationsEnabled: e.target.checked })}
                      />
                      <label htmlFor="regToggle"></label>
                    </div>
                  </div>
                  <h4 style={{ margin: '0 0 8px 0', fontWeight: 800, fontSize: '1.1rem' }}>User Sign-ups</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.5' }}>
                    Control whether new players can create accounts. Useful for closing recruitment during peak season.
                  </p>
                </div>
              </div>
            </div>

            <div className="glass" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
              <h4 style={{ marginBottom: '16px', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-cyan)' }}>Broadcast Message</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '16px' }}>
                This message is displayed to all active users when Maintenance Mode is locked.
              </p>
              <textarea
                className="glass"
                style={{ width: '100%', padding: '16px', borderRadius: '12px', marginBottom: '20px', fontSize: '0.95rem', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                rows={3}
                placeholder="e.g. Updating league tables for Season 2. Back online soon!"
                defaultValue={adminData?.maintenanceMessage || ''}
                id="maintMsgInput"
              />
              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '14px', fontWeight: 700 }}
                onClick={() => {
                  updateAdminData({ maintenanceMessage: document.getElementById('maintMsgInput').value });
                  showToast('Broadcast message updated', 'success');
                }}
              >
                Update Broadcast Message
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
