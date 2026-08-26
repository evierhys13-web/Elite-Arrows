import { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import { useAuth } from '../context/AuthContextInternal'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { db, doc, setDoc, getDoc, getDocs, collection, deleteDoc, updateDoc, writeBatch, addDoc, query, orderBy, limit } from '../firebase'
import { ADMIN_EMAILS } from '../config'
import UserSearchSelect from '../components/UserSearchSelect'
import { useToast } from '../context/ToastContext'
import { logMatchApproved } from '../utils/analytics'
import { checkMatchAchievements } from '../utils/achievements'
import { derivePlayerStatsFromResults } from '../utils/playerStats'

import CupManagement from './CupManagement'

export default function Admin() {
  const {
    user,
    loading: authLoading,
    getAllUsers,
    getResults,
    getFixtures,
    getCups,
    advanceCupBracket,
    getSeasons,
    adminData,
    updateAdminData,
    addToMoneyHistory,
    triggerDataRefresh,
    dataRefreshTrigger,
    updateResults,
    removeResult,
    updateFixtures,
    forceFetchResults,
    searchUsers
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
  const [approvalOverride, setApprovalOverride] = useState({ tier: 'elite', season: '' })
  const [isProcessing, setIsProcessing] = useState(false)
  const [previewImage, setPreviewImage] = useState(null)

  // Form states
  const [showSubmitGame, setShowSubmitGame] = useState(false)
  const [adminGameForm, setAdminGameForm] = useState({
    player1: '', player2: '', player3: '', player4: '',
    score1: '', score2: '',
    gameType: 'League',
    season: '',
    p1_180s: '', p2_180s: '',
    p1_checkout: '', p2_checkout: '',
    p1_doubles: '', p2_doubles: '',
    p1_avg: '', p2_avg: ''
  })
  const [seasonForm, setSeasonForm] = useState({ name: '', startDate: new Date().toISOString().split('T')[0], endDate: '' })
  const [grantSubForm, setGrantSubForm] = useState({ player: '', tier: 'elite', season: '' })
  const [superRankForm, setSuperRankForm] = useState({ player: '', rank: '' })
  const [divisionForm, setDivisionForm] = useState({ player: '', division: '' })
  const [potAdjust, setPotAdjust] = useState({ amount: 0 })
  const [selectedMemberIds, setSelectedMemberIds] = useState([])
  const [memberSearch, setMemberSearch] = useState('')
  const [bulkDivision, setBulkDivision] = useState('')
  const [bulkSeason, setBulkSeason] = useState('')
  const [trophyForm, setTrophyForm] = useState({ player: '', name: '', icon: '🏆', season: '' })
  const [hallOfFameForm, setHallOfFameForm] = useState({ player: '', name: '', icon: '🏆', season: '', visible: true })
  const [hallOfFame, setHallOfFame] = useState([])
  const [playoffForm, setPlayoffForm] = useState({ player1: '', player2: '', division: '', date: '', time: '', bestOf: '3' })
  const [surveyForm, setSurveyForm] = useState({ title: '', description: '', targetType: 'all', targetUserIds: [] })
  const [surveyQuestions, setSurveyQuestions] = useState([{ id: 'q1', text: '', type: 'text', options: '' }])
  const [viewSurveyResponses, setViewSurveyResponses] = useState(null)
  const [expandedProofs, setExpandedProofs] = useState({})

  const toggleProof = (id, field) => {
    setExpandedProofs(prev => ({
      ...prev,
      [`${id}_${field}`]: !prev[`${id}_${field}`]
    }))
  }
  const [openLeagueDuos, setOpenLeagueDuos] = useState([])
  const [openLeagueSingles, setOpenLeagueSingles] = useState([])
  const [duoForm, setDuoForm] = useState({ p1: '', p2: '', teamName: '', captainId: '' })
  const [singlesPlayerForm, setSinglesPlayerForm] = useState('')
  const [auditLogs, setAuditLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  useEffect(() => {
    if (activeTab === 'openleague' || (activeTab === 'results' && showSubmitGame)) {
      const fetchData = async () => {
        try {
          const [duoSnap, singlesSnap] = await Promise.all([
            getDocs(collection(db, 'openLeagueDuos')),
            getDocs(collection(db, 'openLeagueSingles'))
          ])
          const duosData = duoSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          const singlesData = singlesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          setOpenLeagueDuos(duosData)
          setOpenLeagueSingles(singlesData)
          console.log("Friendly League Data Loaded:", { duos: duosData.length, singles: singlesData.length });
        } catch (e) {
          console.error("Failed to fetch Friendly League admin data", e)
          showToast("Failed to load Friendly League data", "error")
        }
      }
      fetchData()
    }
  }, [activeTab, refreshKey, dataRefreshTrigger])

  useEffect(() => {
    if (activeTab === 'halloffame') {
      const fetchHallOfFame = async () => {
        try {
          const snap = await getDocs(collection(db, 'hallOfFame'))
          setHallOfFame(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        } catch (e) { console.error('Failed to fetch Hall of Fame', e) }
      }
      fetchHallOfFame()
    }
  }, [activeTab, refreshKey])

  useEffect(() => {
    if (activeTab === 'audit') {
      const fetchLogs = async () => {
        setLoadingLogs(true)
        try {
          const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(100))
          const snap = await getDocs(q)
          setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        } catch (e) {
          console.error("Failed to fetch audit logs", e)
        }
        setLoadingLogs(false)
      }
      fetchLogs()
    }
  }, [activeTab, refreshKey])

  // Guard: wait for auth
  const isEmailAdmin = user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())
  const isAdminFromDoc = user?.isAdmin || user?.isTournamentAdmin || user?.isCupAdmin
  const canAccess = isEmailAdmin || isAdminFromDoc

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
    const allowed = ['dashboard', 'results', 'payments', 'moneypot', 'cups', 'playoffs', 'players', 'admins', 'seasons', 'trophies', 'halloffame', 'tokens', 'surveys', 'maintenance', 'audit', 'openleague', 'new', 'bets', 'practice']
    if (tab && allowed.includes(tab)) setActiveTab(tab)
  }, [searchParams])

  useEffect(() => {
    setRefreshKey(prev => prev + 1)
  }, [dataRefreshTrigger])

  const filteredResultsList = useMemo(() => {
    let list = allResults.filter(r => String(r.status).toLowerCase() === resultFilter)
    if (resultSearch) { const s = resultSearch.toLowerCase(); list = list.filter(r => String(r.player1).toLowerCase().includes(s) || String(r.player2).toLowerCase().includes(s)) }
    if (resultTypeFilter !== 'all') {
      if (resultTypeFilter === 'cup') {
        list = list.filter(r => String(r.gameType).toLowerCase() === 'cup' || !!r.cupId)
      } else if (resultTypeFilter === 'open league') {
        list = list.filter(r => String(r.gameType).toLowerCase().includes('friendly league'))
      } else {
        list = list.filter(r => String(r.gameType).toLowerCase() === resultTypeFilter.toLowerCase())
      }
    }
    return list.sort((a, b) => new Date(b.date || b.submittedAt) - new Date(a.date || a.submittedAt))
  }, [allResults, resultFilter, resultSearch, resultTypeFilter])

  const stats = useMemo(() => {
    const lastWeek = new Date(); lastWeek.setDate(lastWeek.getDate() - 7)
    const newMembersList = allPlayers.filter(u => new Date(u.createdAt || 0) > lastWeek).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    return { newUsers: newMembersList.length, newMembers: newMembersList, pendingResults: pendingResults.length, pendingPayments: pendingPayments.length + entryRequests.length, totalPot: subscriptionPot + subscriptionPot10 }
  }, [allPlayers, pendingResults, pendingPayments, entryRequests, subscriptionPot, subscriptionPot10])

  // --- Handlers ---

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

  const handleAddDuo = async () => {
    if (!duoForm.p1 || !duoForm.p2) return showToast("Select two players", "error")
    if (duoForm.p1 === duoForm.p2) return showToast("Cannot pair a player with themselves", "error")
    const duoId = [duoForm.p1, duoForm.p2].sort().join('_')
    if (openLeagueDuos.find(d => d.id === duoId)) return showToast("Duo already exists", "warning")

    try {
      const newDuo = {
        id: duoId,
        p1Id: duoForm.p1,
        p2Id: duoForm.p2,
        teamName: (duoForm.teamName || '').trim(),
        captainId: duoForm.captainId || duoForm.p1,
        createdAt: new Date().toISOString()
      }
      await setDoc(doc(db, 'openLeagueDuos', duoId), newDuo)
      setOpenLeagueDuos(prev => [...prev, newDuo])
      setDuoForm({ p1: '', p2: '', teamName: '', captainId: '' })
      await logAudit('ADD_OPEN_LEAGUE_DUO', `Created duo pairing: ${duoId} (${newDuo.teamName || 'No Name'})`)
      showToast("Duo created!", "success")
      triggerDataRefresh('all')
    } catch (e) { showToast(e.message, "error") }
  }

  const handleRemoveDuo = async (id) => {
    if (!window.confirm("Delete this pairing?")) return
    try {
      await deleteDoc(doc(db, 'openLeagueDuos', id))
      setOpenLeagueDuos(prev => prev.filter(d => d.id !== id))
      await logAudit('REMOVE_OPEN_LEAGUE_DUO', `Deleted duo pairing: ${id}`)
      showToast("Duo removed", "info")
      triggerDataRefresh('all')
    } catch (e) { showToast(e.message, "error") }
  }

  const handleAddSinglesPlayer = async () => {
    if (!singlesPlayerForm) return showToast("Select a player", "error")
    if (openLeagueSingles.find(p => p.userId === singlesPlayerForm)) return showToast("Player already in table", "warning")

    try {
      const id = Date.now().toString()
      const newPlayer = { id, userId: singlesPlayerForm, createdAt: new Date().toISOString() }
      await setDoc(doc(db, 'openLeagueSingles', id), newPlayer)
      setOpenLeagueSingles(prev => [...prev, newPlayer])
      setSinglesPlayerForm('')
      await logAudit('ADD_OPEN_LEAGUE_SINGLES', `Added player to Friendly League table: ${singlesPlayerForm}`)
      showToast("Player added to table!", "success")
      triggerDataRefresh('all')
    } catch (e) { showToast(e.message, "error") }
  }

  const handleRemoveSinglesPlayer = async (id) => {
    if (!window.confirm("Remove this player from the table?")) return
    try {
      await deleteDoc(doc(db, 'openLeagueSingles', id))
      setOpenLeagueSingles(prev => prev.filter(p => p.id !== id))
      await logAudit('REMOVE_OPEN_LEAGUE_SINGLES', `Removed player from Friendly League table: ${id}`)
      showToast("Player removed", "info")
      triggerDataRefresh('all')
    } catch (e) { showToast(e.message, "error") }
  }

  // --- Handlers ---

  const handleApproveResult = async (resultId) => {
    if (isApproving) return
    setIsApproving(true)
    try {
      const res = allResults.find(r => String(r.id) === String(resultId))
      if (!res) throw new Error('Result not found')

      const updates = { status: 'approved', approvedAt: new Date().toISOString() };

      const findUser = (name) => {
        if (!name) return null;
        const n = String(name).toLowerCase().trim();
        return allPlayers.find(u =>
          u.username?.toLowerCase() === n ||
          u.nickname?.toLowerCase() === n ||
          String(u.id) === n ||
          (u.username && n.includes(u.username.toLowerCase())) ||
          (u.nickname && n.includes(u.nickname.toLowerCase()))
        );
      }

      let p1Id = res.player1Id;
      let p2Id = res.player2Id;
      if (!p1Id && res.player1) {
        const found = findUser(res.player1);
        if (found) { p1Id = found.id; updates.player1Id = found.id; }
      }
      if (!p2Id && res.player2) {
        const found = findUser(res.player2);
        if (found) { p2Id = found.id; updates.player2Id = found.id; }
      }

      const s1 = Number(res.score1) || 0;
      const s2 = Number(res.score2) || 0;
      const totalLegs = s1 + s2;
      const isSuperFormat = (s1 === 6 || s2 === 6) && totalLegs <= 11 && totalLegs >= 6;
      const isStandardFormat = totalLegs <= 8;

      const p1Data = allPlayers.find(u => String(u.id) === String(p1Id));
      const p2Data = allPlayers.find(u => String(u.id) === String(p2Id));
      const isSuperMatch = p1Data?.superLeagueDivision || p2Data?.superLeagueDivision;

      if (!res.gameType || ['league', 'friendly', 'unknown', ''].includes(String(res.gameType).toLowerCase())) {
        if (isSuperFormat || (isSuperMatch && totalLegs > 8)) updates.gameType = 'Champions League';
        else if (isStandardFormat && totalLegs > 0) updates.gameType = 'League';
      }

      if (!res.season || ['2026', 'legacy', ''].includes(String(res.season).toLowerCase())) {
        const matchTime = new Date(res.date || res.submittedAt || Date.now()).getTime();
        const s2Start = new Date('2026-08-01T00:00:00').getTime();
        updates.season = matchTime >= s2Start ? 'Season 4' : 'Season 1';
      }

      if (!res.division || res.division === 'Unassigned') {
        const p1 = allPlayers.find(u => String(u.id) === String(p1Id));
        const p2 = allPlayers.find(u => String(u.id) === String(p2Id));
        const division = p1?.division || p2?.division;
        if (division && division !== 'Unassigned') updates.division = division;
      }

      const targetId = res.firestoreId || String(resultId)
      const approvedResult = { ...res, ...updates }
      await setDoc(doc(db, 'results', targetId), approvedResult, { merge: true })
      logMatchApproved(approvedResult)

      const checkAndAward = async (uid, matchData) => {
        if (!uid) return
        const targetUser = allPlayers.find(u => String(u.id) === String(uid))
        if (!targetUser) return
        const fixtures = getFixtures()
        const results = getResults()
        const allStats = derivePlayerStatsFromResults(allPlayers, results, { fixtures, adminData })
        const playerStats = allStats[uid]
        const earned = await checkMatchAchievements(matchData, uid, playerStats, targetUser.achievements || [])
        if (earned.length > 0) {
            earned.forEach(a => showToast(`Achievement Unlocked for ${targetUser.username}: ${a.label}!`, 'success'))
        }
      }

      await checkAndAward(p1Id, approvedResult)
      await checkAndAward(p2Id, approvedResult)

      const updatedResults = allResults.map(r =>
        String(r.id) === String(resultId) ? { ...r, ...updates } : r
      )
      updateResults(updatedResults)

      if (approvedResult.gameType === 'Cup' || approvedResult.cupId) {
        await advanceCupBracket(approvedResult)
      }

      await logAudit('APPROVE_RESULT', `Approved/Healed match: ${res.player1} vs ${res.player2}`)
      showToast('Result Approved & Standings Updated!', 'success')
      triggerDataRefresh('all')
    } catch (e) {
      console.error(e)
      showToast(e.message, 'error')
    }
    setIsApproving(false)
  }

  const handleBulkApprove = async () => {
    if (selectedResults.length === 0 || isApproving) return
    setIsApproving(true)
    try {
      const batch = writeBatch(db)
      const cupResults = []
      const resultsToUpdate = []

      selectedResults.forEach(id => {
        const res = allResults.find(r => String(r.id) === String(id))
        if (res) {
          const updates = { status: 'approved', approvedAt: new Date().toISOString() };
          const s1 = Number(res.score1) || 0;
          const s2 = Number(res.score2) || 0;
          const totalLegs = s1 + s2;
          if (!res.gameType || ['league', 'friendly', ''].includes(String(res.gameType).toLowerCase())) {
            if ((s1 === 6 || s2 === 6) && totalLegs <= 11) updates.gameType = 'Champions League';
            else if (totalLegs <= 8) updates.gameType = 'League';
          }
          if (!res.season) {
            const matchTime = new Date(res.date || res.submittedAt || Date.now()).getTime();
            const s2Start = new Date('2026-08-01T00:00:00').getTime();
            updates.season = matchTime >= s2Start ? 'Season 4' : 'Season 1';
          }
          const targetId = res.firestoreId || String(id)
          batch.update(doc(db, 'results', targetId), updates)
          const approvedResult = { ...res, ...updates }
          logMatchApproved(approvedResult)
          resultsToUpdate.push(approvedResult)
          if (res.gameType === 'Cup' || updates.gameType === 'Cup') {
            cupResults.push(approvedResult)
          }
        }
      })
      await batch.commit()
      for (const res of cupResults) { await advanceCupBracket(res) }
      await logAudit('BULK_APPROVE', `Approved ${selectedResults.length} matches`)
      setSelectedResults([])
      const updatedResults = allResults.map(r => {
        const match = resultsToUpdate.find(u => String(u.id) === String(r.id))
        return match ? match : r
      })
      updateResults(updatedResults)
      showToast(`Approved & Fixed ${selectedResults.length} matches!`, 'success')
      triggerDataRefresh('all')
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
    } catch (e) { showToast('Failed to update: ' + e.message, 'error') }
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
      removeResult(resultId)
      await logAudit('DELETE_RESULT', `Deleted result: ${res?.player1} vs ${res?.player2}`)
      showToast('Result Deleted', 'info')
      triggerDataRefresh('results')
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
    if (!f.player1 || !f.player2) return showToast('Select both players/teams.', 'error')
    if (!f.score1 || !f.score2) return showToast('Enter both scores.', 'error')
    const s1 = parseInt(f.score1); const s2 = parseInt(f.score2)
    if (isNaN(s1) || isNaN(s2)) return showToast('Invalid scores.', 'error')

    const p1 = allPlayers.find(u => String(u.id) === String(f.player1))
    const p2 = allPlayers.find(u => String(u.id) === String(f.player2))

    if (!p1 || !p2) return showToast('Players not found.', 'error')

    const resultId = `admin_${Date.now()}`
    try {
      const isSuper = f.gameType === 'Champions League'
      const isLeague = f.gameType === 'League'
      const isCup = f.gameType === 'Cup'
      let targetSeason = f.season || adminData?.currentSeason || 'Season 1'

      let cupId = null
      let matchId = null
      let cupName = null
      let fixtureId = null

      if (isCup) {
        // Try to find a matching cup fixture
        const allFixtures = getFixtures()
        const match = allFixtures.find(fixture => {
          if (!fixture.cupId || fixture._deleted) return false
          const { player1Id, player2Id } = fixture
          const p1Match = String(player1Id) === String(p1.id) || String(player1Id) === String(p2.id)
          const p2Match = String(player2Id) === String(p1.id) || String(player2Id) === String(p2.id)
          const status = String(fixture.status).toLowerCase()
          return p1Match && p2Match && !['approved', 'result_submitted', 'completed'].includes(status)
        })

        if (match) {
          cupId = match.cupId
          matchId = match.matchId
          cupName = match.cupName
          fixtureId = match.id
        }
      }

      const matchTime = new Date().getTime()
      const s2Start = new Date('2026-08-01T00:00:00').getTime()
      if (isSuper && (!f.season || f.season === 'Season 1' || f.season === '2026')) {
        if (matchTime >= s2Start) targetSeason = 'Season 4'
      }

      const newMatch = {
        id: resultId,
        player1: p1.username,
        player1Id: p1.id,
        player2: p2.username,
        player2Id: p2.id,
        score1: s1, score2: s2,
        gameType: f.gameType,
        status: 'approved',
        season: targetSeason,
        division: isSuper ? (p1.superLeagueDivision || '') : (isLeague ? (p1.division || '') : ''),
        date: new Date().toISOString().split('T')[0],
        submittedAt: new Date().toISOString(),
        submittedBy: 'admin',
        ...(cupId && { cupId, matchId, cupName }),
        ...(fixtureId && { fixtureId }),
        player1Stats: {
          '180s': parseInt(f.p1_180s) || 0,
          highestCheckout: parseInt(f.p1_checkout) || 0,
          doubleSuccess: parseFloat(f.p1_doubles) || 0,
          avg: parseFloat(f.p1_avg) || 0
        },
        player2Stats: {
          '180s': parseInt(f.p2_180s) || 0,
          highestCheckout: parseInt(f.p2_checkout) || 0,
          doubleSuccess: parseFloat(f.p2_doubles) || 0,
          avg: parseFloat(f.p2_avg) || 0
        }
      }

      await setDoc(doc(db, 'results', resultId), newMatch)

      if (fixtureId) {
        const allFixtures = [...getFixtures()]
        const fIdx = allFixtures.findIndex(fix => String(fix.id) === String(fixtureId))
        if (fIdx !== -1) {
          allFixtures[fIdx] = {
            ...allFixtures[fIdx],
            status: 'approved',
            resultId,
            score1: s1,
            score2: s2,
            updatedAt: new Date().toISOString()
          }
          updateFixtures(allFixtures)
          await setDoc(doc(db, 'fixtures', String(fixtureId)), allFixtures[fIdx], { merge: true })
        }
      }

      logMatchApproved(newMatch)
      await logAudit('ADMIN_SUBMIT_GAME', `Admin submitted ${f.gameType}: ${newMatch.player1} ${s1}-${s2} ${newMatch.player2}`)
      setAdminGameForm({
        player1: '', player2: '', player3: '', player4: '',
        score1: '', score2: '',
        gameType: 'League',
        p1_180s: '', p2_180s: '',
        p1_checkout: '', p2_checkout: '',
        p1_doubles: '', p2_doubles: '',
        p1_avg: '', p2_avg: ''
      })
      triggerDataRefresh('results')
      showToast('Game submitted!', 'success')
    } catch (e) { showToast('Error: ' + e.message, 'error') }
  }

  const handleApprovePayment = async (u) => {
    try {
      const isOverriding = approvingPaymentId === u.id
      const finalSeason = isOverriding ? approvalOverride.season : (u.requestedSeason || adminData?.currentSeason || 'Season 1')
      const paymentAmount = 5.99
      const currentSeasonName = adminData?.currentSeason || 'Season 1'
      const currentSeasons = Array.isArray(u.subscribedSeasons) ? u.subscribedSeasons : []
      const nextSeasons = Array.from(new Set([...currentSeasons, finalSeason]))
      const updates = {
        paymentPending: false,
        subscriptionDate: new Date().toISOString(),
        subscriptionTier: 'elite',
        subscribedSeasons: nextSeasons,
        isSubscribed: u.isSubscribed || (finalSeason === currentSeasonName)
      }
      await setDoc(doc(db, 'users', u.id), updates, { merge: true })
      const currentPot = adminData?.subscriptionPot || 0
      await updateAdminData({ subscriptionPot: currentPot + paymentAmount })
      addToMoneyHistory('subscription', paymentAmount, `Approved payment: ${u.username} for ${finalSeason}`)
      await logAudit('APPROVE_PAYMENT', `Approved payment for ${u.username} (£${paymentAmount}) - ${finalSeason}`)
      setApprovingPaymentId(null)
      triggerDataRefresh('users')
      showToast(`Subscription Approved for ${finalSeason}!`, 'success')
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleUpdateApprovedSubscription = async (u) => {
    try {
      const finalSeason = approvalOverride.season
      const currentSeasons = Array.isArray(u.subscribedSeasons) ? u.subscribedSeasons : []
      const nextSeasons = Array.from(new Set([...currentSeasons, finalSeason]))
      await setDoc(doc(db, 'users', u.id), {
        subscriptionTier: 'elite',
        subscribedSeasons: nextSeasons
      }, { merge: true })
      await logAudit('UPDATE_SUBSCRIPTION', `Admin updated ${u.username} sub to Elite Pass, seasons: ${nextSeasons.join(', ')}`)
      setApprovingPaymentId(null)
      triggerDataRefresh('users')
      showToast(`Subscription updated for ${u.username}`, 'success')
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleUpdateSuperRank = async () => {
    if (!superRankForm.player || !superRankForm.rank) return
    try {
      const isNone = superRankForm.rank === 'None'
      await setDoc(doc(db, 'users', superRankForm.player), {
        superLeagueDivision: isNone ? null : superRankForm.rank
      }, { merge: true })
      showToast?.(`Player updated in Champions League`, 'success')
      setSuperRankForm({ player: '', rank: '' })
      triggerDataRefresh('all')
    } catch (e) { showToast?.('Error updating rank: ' + e.message, 'error') }
  }

  const handleGrantSubscription = async () => {
    if (!grantSubForm.player) return showToast('Select a player', 'error')
    try {
      const target = allPlayers.find(p => p.id === grantSubForm.player)
      const selectedSeason = grantSubForm.season || adminData?.currentSeason || 'Season 1'
      const currentSeasonName = adminData?.currentSeason || 'Season 1'
      const currentSeasons = Array.isArray(target.subscribedSeasons) ? target.subscribedSeasons : []
      const nextSeasons = Array.from(new Set([...currentSeasons, selectedSeason]))
      await setDoc(doc(db, 'users', target.id), {
        isSubscribed: true,
        subscriptionDate: new Date().toISOString(),
        subscriptionTier: 'elite',
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
      const target = allPlayers.find(p => String(p.id) === String(divisionForm.player))
      if (!target) return showToast('Player not found', 'error')
      await setDoc(doc(db, 'users', target.id), { division: divisionForm.division }, { merge: true })
      try {
        const seasons = getSeasons()
        const currentSeasonName = adminData?.currentSeason || 'Season 1'
        const currentSeason = seasons.find(s => s.name === currentSeasonName)
        if (currentSeason && currentSeason.stagedDivisions?.[target.id]) {
          const updated = { ...currentSeason.stagedDivisions }
          delete updated[target.id]
          await setDoc(doc(db, 'seasons', currentSeason.id), { stagedDivisions: updated }, { merge: true })
        }
      } catch (stagingError) { console.log('Could not clear staged division:', stagingError) }
      await logAudit('MOVE_DIVISION', `Moved ${target.username} to ${divisionForm.division}`)
      triggerDataRefresh('users')
      triggerDataRefresh('seasons')
      showToast(`${target.username} moved to ${divisionForm.division}`, 'success')
      setDivisionForm({ player: '', division: '' })
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleBulkAssignDivision = async () => {
    if (selectedMemberIds.length === 0) return showToast('Select at least one member', 'error')
    if (!bulkDivision) return showToast('Select a division', 'error')
    if (!confirm(`Assign ${selectedMemberIds.length} members to ${bulkDivision}?`)) return
    setIsProcessing(true)
    try {
      const batch = writeBatch(db)
      selectedMemberIds.forEach(uid => {
        batch.update(doc(db, 'users', uid), { division: bulkDivision })
      })
      await batch.commit()
      await logAudit('BULK_ASSIGN_DIVISION', `Assigned ${selectedMemberIds.length} members to ${bulkDivision}`)
      triggerDataRefresh('users')
      showToast(`Assigned ${selectedMemberIds.length} members to ${bulkDivision}`, 'success')
      setSelectedMemberIds([])
      setBulkDivision('')
    } catch (e) { showToast(e.message, 'error') }
    setIsProcessing(false)
  }

  const handleBulkGrantElitePass = async () => {
    if (selectedMemberIds.length === 0) return showToast('Select at least one member', 'error')
    const season = bulkSeason || adminData?.currentSeason || 'Season 1'
    if (!confirm(`Grant Elite Pass (${season}) to ${selectedMemberIds.length} members?`)) return
    setIsProcessing(true)
    try {
      const batch = writeBatch(db)
      selectedMemberIds.forEach(uid => {
        const target = allPlayers.find(p => p.id === uid)
        const currentSeasons = Array.isArray(target?.subscribedSeasons) ? target.subscribedSeasons : []
        const nextSeasons = Array.from(new Set([...currentSeasons, season]))
        batch.update(doc(db, 'users', uid), {
          isSubscribed: true,
          subscriptionDate: new Date().toISOString(),
          subscriptionTier: 'elite',
          subscribedSeasons: nextSeasons
        })
      })
      await batch.commit()
      await logAudit('BULK_GRANT_ELITE_PASS', `Granted Elite Pass (${season}) to ${selectedMemberIds.length} members`)
      triggerDataRefresh('users')
      showToast(`Granted Elite Pass to ${selectedMemberIds.length} members`, 'success')
      setSelectedMemberIds([])
      setBulkSeason('')
    } catch (e) { showToast(e.message, 'error') }
    setIsProcessing(false)
  }

  const handleUpdateAdminRole = async (targetId, role, value) => {
    try {
      const target = allPlayers.find(p => String(p.id) === String(targetId))
      await setDoc(doc(db, 'users', targetId), { [role]: value }, { merge: true })
      await logAudit('UPDATE_ROLE', `Updated ${role} to ${value} for ${target?.username || targetId}`)
      triggerDataRefresh('users')
      showToast(`Permissions updated for ${target?.username || 'user'}`, 'success')
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

  const handleAdjustPot = async () => {
    const amount = potAdjust.amount
    const current = adminData?.subscriptionPot || 0
    try {
      await updateAdminData({ subscriptionPot: current + amount })
      addToMoneyHistory('adjustment', amount, `Manual pot adjustment`)
      await logAudit('ADJUST_POT', `Adjusted league pot by £${amount}`)
      showToast('Pot adjusted', 'success')
      setPotAdjust({ amount: 0 })
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
      await setDoc(doc(db, 'users', target.id), { trophies: [...currentTrophies, newTrophy] }, { merge: true })
      await logAudit('AWARD_TROPHY', `Awarded "${trophyForm.name}" to ${target.username}`)
      triggerDataRefresh('users')
      showToast(`Awarded "${trophyForm.name}" to ${target.username}`, 'success')
      setTrophyForm({ ...trophyForm, name: '', icon: '🏆' })
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleAddHallOfFame = async () => {
    if (!hallOfFameForm.player || !hallOfFameForm.name) return showToast('Player and Title required', 'error')
    try {
      const target = allPlayers.find(p => p.id === hallOfFameForm.player)
      const entry = {
        userId: target.id,
        username: target.username,
        name: hallOfFameForm.name,
        icon: hallOfFameForm.icon,
        season: hallOfFameForm.season || adminData?.currentSeason || 'Season 1',
        visible: hallOfFameForm.visible,
        awardedAt: new Date().toISOString()
      }
      const docRef = await addDoc(collection(db, 'hallOfFame'), entry)
      setHallOfFame(prev => [...prev, { id: docRef.id, ...entry }])
      await logAudit('ADD_HALL_OF_FAME', `Added ${target.username} to Hall of Fame: ${hallOfFameForm.name}`)
      showToast('Added to Hall of Fame!', 'success')
      setHallOfFameForm({ player: '', name: '', icon: '🏆', season: '', visible: true })
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleRemoveHallOfFame = async (id) => {
    if (!window.confirm('Remove this entry from Hall of Fame?')) return
    try {
      await deleteDoc(doc(db, 'hallOfFame', id))
      setHallOfFame(prev => prev.filter(h => h.id !== id))
      await logAudit('REMOVE_HALL_OF_FAME', `Removed Hall of Fame entry: ${id}`)
      showToast('Entry removed', 'info')
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleToggleHallOfFameVisibility = async (id, currentVisible) => {
    try {
      await updateDoc(doc(db, 'hallOfFame', id), { visible: !currentVisible })
      setHallOfFame(prev => prev.map(h => h.id === id ? { ...h, visible: !currentVisible } : h))
      showToast(`Visibility updated`, 'success')
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

  const handleBulkSyncAnalytics = async () => {
    const approvedMatches = allResults.filter(r => String(r.status).toLowerCase() === 'approved');
    const users = getAllUsers();
    const currentSeason = adminData?.currentSeason || 'Season 1';
    if (approvedMatches.length === 0) return showToast('No approved matches to sync', 'info');
    if (!window.confirm(`DEEP SYNC ${approvedMatches.length} approved games?`)) return;
    setIsApproving(true);
    try {
      let updatedCount = 0; let currentBatch = writeBatch(db); let opCount = 0;
      const updatesByTargetId = {};
      for (const match of approvedMatches) {
        const updates = {}; const targetId = match.firestoreId || String(match.id);
        const currentResSeason = String(match.season || '').trim();
        const isLegacyLabel = ['2026', 'Legacy', 'legacy', '', 'undefined', 'null', 'Season 1'].includes(currentResSeason);
        if (isLegacyLabel && currentResSeason !== currentSeason) updates.season = currentSeason;
        let p1Id = match.player1Id; let p2Id = match.player2Id;
        if (!p1Id && match.player1) {
          const found = users.find(u => u.username?.toLowerCase() === String(match.player1).toLowerCase() || u.email?.toLowerCase() === String(match.player1).toLowerCase());
          if (found) { p1Id = found.id; updates.player1Id = found.id; }
        }
        if (!p2Id && match.player2) {
          const found = users.find(u => u.username?.toLowerCase() === String(match.player2).toLowerCase() || u.email?.toLowerCase() === String(match.player2).toLowerCase());
          if (found) { p2Id = found.id; updates.player2Id = found.id; }
        }
        const s1 = Number(match.score1) || 0; const s2 = Number(match.score2) || 0;
        const totalLegs = s1 + s2;
        const isStandardFormat = totalLegs <= 8 && totalLegs > 0;
        const isSuperFormat = (s1 === 6 || s2 === 6) && totalLegs <= 11 && totalLegs >= 6;
        let isCupGame = Boolean(match.cupId || match.matchId || match.tournamentId);
        if (!isCupGame && match.fixtureId) {
          const fx = allFixtures.find(f => String(f.id) === String(match.fixtureId));
          if (fx && (fx.cupId || fx.tournamentId || String(fx.gameType).toLowerCase().includes('cup'))) isCupGame = true;
        }
        if (isCupGame) { if (match.gameType !== 'Cup') updates.gameType = 'Cup'; }
        else {
          let targetType = match.gameType;
          if (isSuperFormat) targetType = 'Champions League';
          else if (isStandardFormat) targetType = 'League';
          else if (!match.gameType || match.gameType === 'Unknown') targetType = 'League';
          if (match.gameType !== targetType) updates.gameType = targetType;
        }
        if (!match.division || match.division === 'Unassigned') {
          const p1 = users.find(u => String(u.id) === String(p1Id));
          const p2 = users.find(u => String(u.id) === String(p2Id));
          const division = p1?.division || p2?.division;
          if (division && division !== 'Unassigned') updates.division = division;
        }
        if (!match.approvedAt) updates.approvedAt = match.date ? new Date(match.date).toISOString() : new Date().toISOString();
        if (Object.keys(updates).length > 0) {
          updatesByTargetId[targetId] = updates; currentBatch.update(doc(db, 'results', targetId), updates); updatedCount++; opCount++;
          if (opCount >= 450) { await currentBatch.commit(); currentBatch = writeBatch(db); opCount = 0; }
        }
      }
      if (opCount > 0) await currentBatch.commit();
      await logAudit('BULK_SYNC_ANALYTICS', `Deep Sync ${approvedMatches.length} games. Fixed ${updatedCount} records.`);
      if (updatedCount > 0) {
        const updatedResults = allResults.map(r => { const key = r.firestoreId || String(r.id); const merge = updatesByTargetId[key]; return merge ? { ...r, ...merge } : r })
        updateResults(updatedResults); showToast(`Fixed ${updatedCount} records. Table updated!`, 'success');
      } else showToast('All records already correct.', 'info');
      if (adminData?.leagueTableResetAt) { await updateAdminData({ leagueTableResetAt: null }); triggerDataRefresh('all'); showToast('Soft Reset cleared.', 'success') }
    } catch (e) { console.error('Sync error:', e); showToast('Sync failed: ' + e.message, 'error'); }
    setIsApproving(false);
  };

  const handleFixSeasons = async () => {
    const approvedMatches = allResults.filter(r => String(r.status).toLowerCase() === 'approved')
    const target = approvedMatches.filter(r => {
      const d = new Date(r.date || r.submittedAt || 0).getTime(); const cutoff = new Date('2026-08-01T00:00:00').getTime()
      const isLeague = ['league', 'super league'].includes(String(r.gameType).toLowerCase())
      return d >= cutoff && isLeague && String(r.season || '') !== 'Season 4'
    })
    if (target.length === 0) return showToast('No results to update', 'info')
    if (!window.confirm(`Update ${target.length} results to Season 4?`)) return
    setIsApproving(true)
    try {
      let count = 0; let batch = writeBatch(db); let ops = 0
      for (const r of target) {
        const targetId = r.firestoreId || String(r.id); batch.update(doc(db, 'results', targetId), { season: 'Season 4' }); count++; ops++;
        if (ops >= 450) { await batch.commit(); batch = writeBatch(db); ops = 0; }
      }
      if (ops > 0) await batch.commit()
      await logAudit('FIX_SEASONS', `Updated ${count} results to Season 4`)
      const updatedResults = allResults.map(r => { const match = target.find(t => (t.firestoreId || String(t.id)) === (r.firestoreId || String(r.id))); return match ? { ...r, season: 'Season 4' } : r })
      updateResults(updatedResults); triggerDataRefresh('all'); showToast(`Updated ${count} results to Season 4`, 'success')
    } catch (e) { showToast('Failed: ' + e.message, 'error') }
    setIsApproving(false)
  }

  const handleHealUserDivisions = async () => {
    if (!window.confirm("Restore divisions and permissions from match history?")) return
    setIsApproving(true)
    try {
      const results = allResults.filter(r => String(r.status).toLowerCase() === 'approved').sort((a, b) => new Date(b.date || b.submittedAt || 0) - new Date(a.date || a.submittedAt || 0))
      const users = getAllUsers(); const seasons = getSeasons(); const currentSeasonName = adminData?.currentSeason || 'Season 1'; const currentSeasonDoc = seasons.find(s => s.name === currentSeasonName); const stagedDivisions = currentSeasonDoc?.stagedDivisions || {}
      const userDivisionMap = {}
      results.forEach(r => { const div = r.division; if (!div || div === 'Unassigned' || div === 'Friendly') return; [r.player1Id, r.player2Id].forEach(id => { if (id && !userDivisionMap[String(id)]) userDivisionMap[String(id)] = div }) })
      Object.entries(stagedDivisions).forEach(([uid, div]) => { if (div && div !== 'Unassigned') userDivisionMap[uid] = div })
      const batch = writeBatch(db); let count = 0; let ops = 0
      for (const u of users) {
        let updates = {}; const detectedDiv = userDivisionMap[u.id] || userDivisionMap[String(u.id)]
        if (detectedDiv && u.division !== detectedDiv) updates.division = detectedDiv
        if (u.username?.toLowerCase() === 'diplexicto87' || u.email?.toLowerCase() === 'brentedwards87@gmail.com') { if (!u.isAdmin) updates.isAdmin = true; if (u.division !== 'Elite') updates.division = 'Elite' }
        if (ADMIN_EMAILS.includes(u.email?.toLowerCase())) { if (!u.isAdmin) updates.isAdmin = true }
        if (Object.keys(updates).length > 0) { batch.update(doc(db, 'users', u.id), updates); count++; ops++; }
        if (ops >= 450) { await batch.commit(); ops = 0; }
      }
      if (ops > 0) await batch.commit()
      await logAudit('HEAL_DIVISIONS', `Restored ${count} users.`)
      showToast(`Restored ${count} users!`, 'success'); triggerDataRefresh('all')
    } catch (e) { showToast('Heal failed: ' + e.message, 'error') }
    setIsApproving(false)
  }

  // --- Render Guard ---
  if (authLoading) return <div className="page glass"><div style={{ padding: '60px', textAlign: 'center', color: 'var(--accent-cyan)', fontWeight: 800 }}>Validating Admin Access...</div></div>
  if (!user) return <div className="page glass"><div style={{ padding: '60px', textAlign: 'center' }}>Please sign in to access the Admin Panel.</div></div>
  if (!canAccess) {
    return (
      <div className="page glass">
        <h1 className="page-title">Access Denied</h1>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>You do not have administrative permissions.</p>
      </div>
    )
  }

  const handleSoftResetStandings = async () => {
    if (!window.confirm("Soft Reset will hide current results from standings. Proceed?")) return;
    try {
      const now = new Date().toISOString(); await updateAdminData({ leagueTableResetAt: now }); await logAudit('SOFT_RESET_TABLE', `Reset at ${now}`); triggerDataRefresh('all'); showToast('Standings table reset!', 'success')
    } catch (e) { showToast(e.message, 'error') }
  };

  const handleClearTableReset = async () => {
    if (!window.confirm("Restore all historical matches?")) return;
    try {
      await updateAdminData({ leagueTableResetAt: null }); await logAudit('CLEAR_TABLE_RESET', 'Cleared reset'); triggerDataRefresh('all'); showToast('Full history restored!', 'success')
    } catch (e) { showToast(e.message, 'error') }
  };

  const handleResetSuperLeagueTable = async () => {
    const currentSeason = adminData?.currentSeason || 'Season 4'
    if (!window.confirm(`Reset Champions League standings?`)) return
    setIsApproving(true);
    try {
      const users = getAllUsers(); const results = getResults(); let batch = writeBatch(db); let ops = 0; let userCount = 0; let resultCount = 0
      for (const u of users) { if (u.manualSuperStats) { batch.update(doc(db, 'users', u.id), { manualSuperStats: null }); userCount++; ops++; if (ops >= 450) { await batch.commit(); batch = writeBatch(db); ops = 0 } } }
      const updatesById = {}
      for (const r of results) {
        if (String(r.status).toLowerCase() !== 'approved') continue
        const s1 = Number(r.score1); const s2 = Number(r.score2); const isSuperFormat = (s1 === 6 || s2 === 6) && (s1 + s2) <= 11; const isLabeledSuper = String(r.gameType || '').toLowerCase().includes('super')
        if (isSuperFormat || isLabeledSuper) {
          const updates = {}; if (r.season !== currentSeason) updates.season = currentSeason; if (r.gameType !== 'Champions League') updates.gameType = 'Champions League'
          if (Object.keys(updates).length > 0) { const tid = r.firestoreId || String(r.id); batch.update(doc(db, 'results', tid), updates); updatesById[tid] = updates; resultCount++; ops++; if (ops >= 450) { await batch.commit(); batch = writeBatch(db); ops = 0 } }
        }
      }
      if (ops > 0) await batch.commit()
      await logAudit('RESET_CHAMPIONS_LEAGUE', `Reset CL for ${userCount} users and ${resultCount} matches.`)
      const updatedResults = results.map(r => { const key = r.firestoreId || String(r.id); return updatesById[key] ? { ...r, ...updatesById[key] } : r })
      updateResults(updatedResults); triggerDataRefresh('all'); showToast(`CL Reset Complete`, 'success')
    } catch (e) { showToast('Reset failed: ' + e.message, 'error') }
    setIsApproving(false)
  }

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'results', label: 'Scores', count: pendingResults.length },
    { id: 'payments', label: 'Payments', count: pendingPayments.length + entryRequests.length },
    { id: 'openleague', label: 'Friendly League' },
    { id: 'new', label: 'New Users', count: stats.newUsers },
    { id: 'moneypot', label: 'Finances' },
    { id: 'players', label: 'Member Management' },
    { id: 'admins', label: 'Staff' },
    { id: 'cups', label: 'Cups' },
    { id: 'surveys', label: 'Surveys' },
    { id: 'trophies', label: 'Trophies' },
    { id: 'halloffame', label: 'Hall of Fame' },
    { id: 'practice', label: 'Practice Hub' },
    { id: 'audit', label: 'Audit Logs' },
    { id: 'maintenance', label: 'System' }
  ]

  const toggleSelectResult = (id) => { setSelectedResults(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]) }

  return (
    <div className="page animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <h1 className="page-title text-gradient" style={{ fontSize: '2rem' }}>Admin Control Room</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Comprehensive League Management</p>
      </div>

      <div style={{ display: 'flex', overflowX: 'auto', gap: '10px', marginBottom: '24px', paddingBottom: '12px', WebkitOverflowScrolling: 'touch', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {tabs.map(tab => (
          <button key={tab.id} className={`division-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)} style={{ whiteSpace: 'nowrap', padding: '10px 18px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
              <div className="stat-card glass" onClick={() => setActiveTab('results')} style={{ cursor: 'pointer', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}><div className="stat-label">Pending Results</div><div>🎯</div></div>
                <div className="stat-value" style={{ color: stats.pendingResults > 0 ? 'var(--warning)' : 'var(--success)', fontSize: '2.5rem' }}>{stats.pendingResults}</div>
              </div>
              <div className="stat-card glass" onClick={() => setActiveTab('payments')} style={{ cursor: 'pointer', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}><div className="stat-label">Pending Payments</div><div>💳</div></div>
                <div className="stat-value" style={{ color: stats.pendingPayments > 0 ? 'var(--error)' : 'var(--success)', fontSize: '2.5rem' }}>{stats.pendingPayments}</div>
              </div>
              <div className="stat-card glass" onClick={() => setActiveTab('new')} style={{ cursor: 'pointer', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}><div className="stat-label">New Users (7d)</div><div>👤</div></div>
                <div className="stat-value" style={{ color: 'var(--accent-cyan)', fontSize: '2.5rem' }}>{stats.newUsers}</div>
              </div>
              <div className="stat-card glass" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}><div className="stat-label">League Prize Pot</div><div>💰</div></div>
                <div className="stat-value" style={{ fontSize: '2.5rem' }}>£{adminData?.subscriptionPot?.toFixed(2) || '0.00'}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
              <div className="card glass" style={{ padding: '24px' }}>
                <h3 className="card-title">📊 Analytics Sync</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px' }}>Sync match results with Analytics engine.</p>
                <button className="btn btn-primary btn-block" onClick={handleBulkSyncAnalytics} disabled={isApproving}>{isApproving ? 'Syncing...' : 'Bulk Sync All Approved Games'}</button>
              </div>
              <div className="card glass" style={{ padding: '24px' }}>
                <h3 className="card-title">🚨 Urgent Actions</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {(stats.pendingResults > 0 || stats.pendingPayments > 0) ? (
                    <>
                      {stats.pendingResults > 0 && <div className="glass" style={{ padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid var(--warning)' }}><span>{stats.pendingResults} matches awaiting review.</span><button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('results')}>Review</button></div>}
                      {stats.pendingPayments > 0 && <div className="glass" style={{ padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid var(--error)' }}><span>{stats.pendingPayments} payments to verify.</span><button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('payments')}>Verify</button></div>}
                    </>
                  ) : <div style={{ textAlign: 'center', padding: '20px' }}><p style={{ color: 'var(--text-muted)' }}>System is healthy.</p></div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: RESULTS */}
        {activeTab === 'results' && (
          <div className="card glass">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div><h3>Match History & Review</h3></div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="btn btn-sm btn-secondary glass" onClick={async () => { const ok = await forceFetchResults(); showToast(ok ? 'Sync Complete' : 'Sync Failed', ok ? 'success' : 'warning'); }}>🔄 Sync Standings</button>
                {resultFilter === 'pending' && selectedResults.length > 0 && <button className="btn btn-sm btn-primary" onClick={handleBulkApprove} disabled={isApproving}>Approve Selected ({selectedResults.length})</button>}
                <button className={`btn btn-sm ${showSubmitGame ? 'btn-success' : 'btn-secondary'}`} onClick={() => setShowSubmitGame(!showSubmitGame)}>{showSubmitGame ? 'Close' : '+ Submit Game'}</button>
                {['pending', 'approved', 'rejected'].map(f => <button key={f} className={`btn btn-sm ${resultFilter === f ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setResultFilter(f); setSelectedResults([]); }}>{f.toUpperCase()}</button>)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <input type="text" className="glass" placeholder="🔍 Search players..." style={{ flex: 2, padding: '10px' }} value={resultSearch} onChange={e => setResultSearch(e.target.value)} />
              <select className="glass" style={{ flex: 1, padding: '10px' }} value={resultTypeFilter} onChange={e => setResultTypeFilter(e.target.value)}>
                <option value="all">All Types</option>
                <option value="league">League</option>
                <option value="cup">Cup</option>
                <option value="open league">Friendly League</option>
              </select>
            </div>

            {showSubmitGame && (
              <div className="card glass animate-fade-in" style={{ marginBottom: '24px', padding: '24px', border: '1px solid var(--accent-cyan)', background: 'rgba(0,0,0,0.3)' }}>
                <h3 style={{ marginBottom: '16px', color: 'var(--accent-cyan)' }}>Admin Quick Submit</h3>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.8rem', opacity: 0.7 }}>Game Type</label>
                  <select className="glass" style={{ width: '100%', padding: '10px' }} value={adminGameForm.gameType} onChange={e => setAdminGameForm({...adminGameForm, gameType: e.target.value})}>
                    <option value="League">League</option>
                    <option value="Cup">Cup</option>
                    <option value="Playoff">Playoff</option>
                    <option value="Friendly League Singles">Friendly League Singles</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '0.8rem', opacity: 0.7 }}>Player 1 (Home)</label>
                      <UserSearchSelect
                        users={allPlayers}
                        selectedId={adminGameForm.player1}
                        onSelect={id => setAdminGameForm({...adminGameForm, player1: id})}
                        onQueryChange={searchUsers}
                      />
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '0.8rem', opacity: 0.7 }}>Player 2 (Away)</label>
                      <UserSearchSelect
                        users={allPlayers}
                        selectedId={adminGameForm.player2}
                        onSelect={id => setAdminGameForm({...adminGameForm, player2: id})}
                        onQueryChange={searchUsers}
                      />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                  <div className="form-group"><label style={{ fontSize: '0.8rem', opacity: 0.7 }}>Score 1</label><input type="number" className="glass" style={{ width: '100%' }} value={adminGameForm.score1} onChange={e => setAdminGameForm({...adminGameForm, score1: e.target.value})} placeholder="0" /></div>
                  <div className="form-group"><label style={{ fontSize: '0.8rem', opacity: 0.7 }}>Score 2</label><input type="number" className="glass" style={{ width: '100%' }} value={adminGameForm.score2} onChange={e => setAdminGameForm({...adminGameForm, score2: e.target.value})} placeholder="0" /></div>
                  <div className="form-group"><label style={{ fontSize: '0.8rem', opacity: 0.7 }}>P1 180s</label><input type="number" className="glass" style={{ width: '100%' }} value={adminGameForm.p1_180s} onChange={e => setAdminGameForm({...adminGameForm, p1_180s: e.target.value})} placeholder="0" /></div>
                  <div className="form-group"><label style={{ fontSize: '0.8rem', opacity: 0.7 }}>P2 180s</label><input type="number" className="glass" style={{ width: '100%' }} value={adminGameForm.p2_180s} onChange={e => setAdminGameForm({...adminGameForm, p2_180s: e.target.value})} placeholder="0" /></div>
                  <div className="form-group"><label style={{ fontSize: '0.8rem', opacity: 0.7 }}>P1 Avg</label><input type="number" step="0.01" className="glass" style={{ width: '100%' }} value={adminGameForm.p1_avg} onChange={e => setAdminGameForm({...adminGameForm, p1_avg: e.target.value})} placeholder="0.00" /></div>
                  <div className="form-group"><label style={{ fontSize: '0.8rem', opacity: 0.7 }}>P2 Avg</label><input type="number" step="0.01" className="glass" style={{ width: '100%' }} value={adminGameForm.p2_avg} onChange={e => setAdminGameForm({...adminGameForm, p2_avg: e.target.value})} placeholder="0.00" /></div>
                  <div className="form-group">
                    <label style={{ fontSize: '0.8rem', opacity: 0.7 }}>Season</label>
                    <select className="glass" style={{ width: '100%' }} value={adminGameForm.season} onChange={e => setAdminGameForm({...adminGameForm, season: e.target.value})}>
                      <option value="">Auto (Current)</option>
                      {getSeasons().map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleAdminSubmitGame}>Submit Result</button>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowSubmitGame(false)}>Cancel</button>
                </div>
              </div>
            )}
            {editingResult && (
              <div className="card glass" style={{ marginBottom: '24px', padding: '24px', border: '1px solid var(--accent-cyan)' }}>
                <form onSubmit={handleUpdateResult}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                    <div className="form-group">
                      <label>Player 1</label>
                      <UserSearchSelect
                        users={allPlayers}
                        selectedId={editingResult.player1Id}
                        onSelect={id => {
                          const u = allPlayers.find(up => String(up.id) === String(id));
                          setEditingResult({...editingResult, player1Id: id, player1: u?.username || editingResult.player1})
                        }}
                        onQueryChange={searchUsers}
                        label=""
                      />
                    </div>
                    <div className="form-group">
                      <label>Player 2</label>
                      <UserSearchSelect
                        users={allPlayers}
                        selectedId={editingResult.player2Id}
                        onSelect={id => {
                          const u = allPlayers.find(up => String(up.id) === String(id));
                          setEditingResult({...editingResult, player2Id: id, player2: u?.username || editingResult.player2})
                        }}
                        onQueryChange={searchUsers}
                        label=""
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div className="form-group"><label>Season</label><select value={editingResult.season || ''} onChange={e => setEditingResult({...editingResult, season: e.target.value})}><option value="">Legacy</option>{getSeasons().map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select></div>
                    <div className="form-group"><label>Division</label><select value={editingResult.division || ''} onChange={e => setEditingResult({...editingResult, division: e.target.value})}><option value="">Auto</option>{['Elite', 'Emerald', 'Diamond', 'Platinum', 'Champions'].map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div className="form-group"><label>Score 1 ({editingResult.player1})</label><input type="number" value={editingResult.score1} onChange={e => setEditingResult({...editingResult, score1: parseInt(e.target.value)})} /></div>
                    <div className="form-group"><label>Score 2 ({editingResult.player2})</label><input type="number" value={editingResult.score2} onChange={e => setEditingResult({...editingResult, score2: parseInt(e.target.value)})} /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div className="form-group">
                      <label>P1 3-Dart Avg</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingResult.player1Stats?.avg || ''}
                        onChange={e => setEditingResult({
                          ...editingResult,
                          player1Stats: { ...(editingResult.player1Stats || {}), avg: parseFloat(e.target.value) || 0 }
                        })}
                      />
                    </div>
                    <div className="form-group">
                      <label>P2 3-Dart Avg</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingResult.player2Stats?.avg || ''}
                        onChange={e => setEditingResult({
                          ...editingResult,
                          player2Stats: { ...(editingResult.player2Stats || {}), avg: parseFloat(e.target.value) || 0 }
                        })}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                    <div className="form-group">
                      <label>P1 180s</label>
                      <input
                        type="number"
                        min="0"
                        value={editingResult.player1Stats?.['180s'] || ''}
                        onChange={e => setEditingResult({
                          ...editingResult,
                          player1Stats: { ...(editingResult.player1Stats || {}), '180s': parseInt(e.target.value) || 0 }
                        })}
                      />
                    </div>
                    <div className="form-group">
                      <label>P2 180s</label>
                      <input
                        type="number"
                        min="0"
                        value={editingResult.player2Stats?.['180s'] || ''}
                        onChange={e => setEditingResult({
                          ...editingResult,
                          player2Stats: { ...(editingResult.player2Stats || {}), '180s': parseInt(e.target.value) || 0 }
                        })}
                      />
                    </div>
                    <div className="form-group">
                      <label>P1 High Checkout</label>
                      <input
                        type="number"
                        min="0"
                        max="170"
                        value={editingResult.player1Stats?.highestCheckout || ''}
                        onChange={e => setEditingResult({
                          ...editingResult,
                          player1Stats: { ...(editingResult.player1Stats || {}), highestCheckout: parseInt(e.target.value) || 0 }
                        })}
                      />
                    </div>
                    <div className="form-group">
                      <label>P2 High Checkout</label>
                      <input
                        type="number"
                        min="0"
                        max="170"
                        value={editingResult.player2Stats?.highestCheckout || ''}
                        onChange={e => setEditingResult({
                          ...editingResult,
                          player2Stats: { ...(editingResult.player2Stats || {}), highestCheckout: parseInt(e.target.value) || 0 }
                        })}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}><button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Changes</button><button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditingResult(null)}>Cancel</button></div>
                </form>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredResultsList.map(r => (
                <div key={r.id} className="result-item glass" style={{ padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {resultFilter === 'pending' && <input type="checkbox" checked={selectedResults.includes(r.id)} onChange={() => toggleSelectResult(r.id)} style={{ width: '20px', height: '20px' }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontWeight: 700 }}>{r.player1} <span style={{ color: 'var(--accent-cyan)' }}>vs</span> {r.player2}</span><span style={{ fontWeight: 900, color: 'var(--accent-cyan)' }}>{r.score1}-{r.score2}</span></div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.gameType} | {r.date} {r.excludeFromLeague && <span style={{ color: 'var(--error)' }}>🚫 EXCLUDED</span>}</div>

                    {/* Stats Display for Verification */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                      {(r.player1Stats?.avg || r.player2Stats?.avg) && (
                        <div style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                          Avg: <span style={{ color: 'var(--accent-cyan)' }}>{r.player1Stats?.avg || 0}</span> / <span style={{ color: 'var(--accent-cyan)' }}>{r.player2Stats?.avg || 0}</span>
                        </div>
                      )}
                      {(r.player1Stats?.['180s'] > 0 || r.player2Stats?.['180s'] > 0) && (
                        <div style={{ fontSize: '0.7rem', background: 'rgba(251, 191, 36, 0.1)', padding: '2px 8px', borderRadius: '4px', color: '#fbbf24' }}>
                          180s: {r.player1Stats?.['180s'] || 0} / {r.player2Stats?.['180s'] || 0}
                        </div>
                      )}
                      {(r.player1Stats?.highestCheckout > 0 || r.player2Stats?.highestCheckout > 0) && (
                        <div style={{ fontSize: '0.7rem', background: 'rgba(34, 197, 94, 0.1)', padding: '2px 8px', borderRadius: '4px', color: 'var(--success)' }}>
                          H.Check: {r.player1Stats?.highestCheckout || 0} / {r.player2Stats?.highestCheckout || 0}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
                      {resultFilter === 'pending' && (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={() => handleApproveResult(r.id)}>Approve</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleRejectResult(r.id)}>Reject</button>
                        </>
                      )}
                      {(r.proofImage || r.proofImage2 || r.proofVideo || r.hasProofImage) && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginTop: '10px' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                            {r.proofImage && (
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ background: expandedProofs[`${r.id}_1`] ? 'var(--accent-cyan)' : 'rgba(0, 212, 255, 0.1)', color: expandedProofs[`${r.id}_1`] ? '#000' : '#fff', borderColor: 'rgba(0, 212, 255, 0.3)', whiteSpace: 'nowrap' }}
                                onClick={() => toggleProof(r.id, '1')}
                              >
                                {expandedProofs[`${r.id}_1`] ? 'Hide Proof 1' : '🖼️ View Proof 1'}
                              </button>
                            )}
                            {r.proofImage2 && (
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ background: expandedProofs[`${r.id}_2`] ? 'var(--accent-cyan)' : 'rgba(0, 212, 255, 0.1)', color: expandedProofs[`${r.id}_2`] ? '#000' : '#fff', borderColor: 'rgba(0, 212, 255, 0.3)', whiteSpace: 'nowrap' }}
                                onClick={() => toggleProof(r.id, '2')}
                              >
                                {expandedProofs[`${r.id}_2`] ? 'Hide Proof 2' : '🖼️ View Proof 2'}
                              </button>
                            )}
                            {r.proofVideo && (
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ background: 'rgba(0, 212, 255, 0.1)', borderColor: 'rgba(0, 212, 255, 0.3)', whiteSpace: 'nowrap' }}
                                onClick={() => window.open(r.proofVideo, '_blank')}
                              >
                                🎬 Video
                              </button>
                            )}
                          </div>

                          {expandedProofs[`${r.id}_1`] && r.proofImage && (
                            <div className="animate-fade-in" style={{ width: '100%', background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                              <img src={r.proofImage} style={{ width: '100%', height: 'auto', borderRadius: '4px' }} alt="Proof 1" />
                            </div>
                          )}

                          {expandedProofs[`${r.id}_2`] && r.proofImage2 && (
                            <div className="animate-fade-in" style={{ width: '100%', background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                              <img src={r.proofImage2} style={{ width: '100%', height: 'auto', borderRadius: '4px' }} alt="Proof 2" />
                            </div>
                          )}
                        </div>
                      )}
                      {resultFilter !== 'pending' && (
                        <>
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditingResult({...r})}>✏️</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleApproveResult(r.id)}>🔄</button>
                        </>
                      )}
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteResult(r.id)}>🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: PAYMENTS */}
        {activeTab === 'payments' && (
          <div className="card glass">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div><h3>League & Role Management</h3></div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className={`btn btn-sm ${paymentSubTab === 'pending' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPaymentSubTab('pending')}>Payments ({pendingPayments.length})</button>
                <button className={`btn btn-sm ${paymentSubTab === 'roles' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPaymentSubTab('roles')}>Role Apps ({entryRequests.length})</button>
                <button className={`btn btn-sm ${paymentSubTab === 'approved' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPaymentSubTab('approved')}>Subscribers ({subscribers.length})</button>
              </div>
            </div>

            {paymentSubTab === 'pending' && (
              <div className="animate-fade-in">
                {pendingPayments.length === 0 ? (
                   <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No pending payments.</div>
                ) : (
                  pendingPayments.map(u => (
                    <div key={u.id} className="glass" style={{ padding: '20px', borderRadius: '12px', marginBottom: '15px', borderLeft: '4px solid #fbbf24' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{u.username}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>{u.email}</div>
                          <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem' }}>
                            <span style={{ color: 'var(--accent-cyan)' }}>Season: {u.requestedSeason || 'N/A'}</span>
                            <span style={{ color: 'var(--success)' }}>Plan: {u.requestedPlan || 'Elite'}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          {u.paymentProof && (
                            <button className="btn btn-secondary btn-sm" onClick={() => setPreviewImage(u.paymentProof)}>View Proof</button>
                          )}
                          <button className="btn btn-primary btn-sm" onClick={() => handleApprovePayment(u)}>Approve & Activate</button>
                          <button className="btn btn-danger btn-sm" onClick={async () => {
                            if (confirm(`Reject payment for ${u.username}?`)) {
                              await updateDoc(doc(db, 'users', u.id), { paymentPending: false });
                              triggerDataRefresh('users');
                            }
                          }}>Reject</button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {paymentSubTab === 'roles' && (
              <div className="animate-fade-in">
                {entryRequests.length === 0 ? (
                   <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No pending role applications.</div>
                ) : (
                  entryRequests.map(u => (
                    <div key={u.id} className="glass" style={{ padding: '20px', borderRadius: '12px', marginBottom: '15px', borderLeft: '4px solid var(--accent-cyan)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{u.username}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>{u.email}</div>
                          <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem' }}>
                            <span style={{ color: 'var(--accent-cyan)' }}>Requested: {u.requestDate ? new Date(u.requestDate).toLocaleDateString() : 'Unknown Date'}</span>
                            <span style={{ color: 'var(--warning)' }}>Current Role: {u.division || 'Member'}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <button className="btn btn-primary btn-sm" onClick={async () => {
                            setGrantSubForm({ player: u.id, tier: 'elite', season: u.requestedSeason || '' });
                            setActiveTab('players'); // Or just handle it here
                            showToast('Direct to member management to assign specific roles', 'info');
                          }}>Manage User</button>
                          <button className="btn btn-secondary btn-sm" onClick={async () => {
                            if (confirm(`Clear application for ${u.username}?`)) {
                              await updateDoc(doc(db, 'users', u.id), { adminRequestPending: false });
                              triggerDataRefresh('users');
                            }
                          }}>Clear</button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {paymentSubTab === 'approved' && (
              <div className="animate-fade-in">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                  {subscribers.map(u => (
                    <div key={u.id} className="glass" style={{ padding: '16px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{u.username}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{u.subscriptionTier || 'Elite'} • {Array.isArray(u.subscribedSeasons) ? u.subscribedSeasons.join(', ') : 'S1'}</div>
                      </div>
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/profile/${u.id}`)}>Profile</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: OPEN LEAGUE */}
        {activeTab === 'openleague' && (
          <div className="card glass" style={{ padding: '20px' }}>
            <h3 style={{ marginBottom: '20px' }}>Friendly League Management</h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>

              {/* SINGLES MANAGEMENT */}
              <div className="glass" style={{ padding: '20px', borderRadius: '16px' }}>
                <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>👤</span> Singles Table
                </h4>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '20px' }}>
                  <div style={{ flex: 1 }}>
                    <UserSearchSelect
                      users={allPlayers}
                      selectedId={singlesPlayerForm}
                      onSelect={id => setSinglesPlayerForm(id)}
                      label="Add Player to Singles"
                      onQueryChange={searchUsers}
                    />
                  </div>
                  <button className="btn btn-primary" onClick={handleAddSinglesPlayer} style={{ height: '44px' }}>Add</button>
                </div>

                <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '5px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                    {openLeagueSingles.length} Players Enrolled
                  </div>
                  {openLeagueSingles.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                      No players in singles table.
                    </div>
                  ) : (
                    openLeagueSingles.map(p => {
                      const userData = allPlayers.find(u => String(u.id) === String(p.userId))
                      return (
                        <div key={p.id} className="glass" style={{ padding: '12px 15px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{userData?.username || 'Unknown User'}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)' }}>{userData?.division || 'Unassigned'}</div>
                          </div>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleRemoveSinglesPlayer(p.id)}
                            style={{ padding: '5px 10px' }}
                          >
                            Remove
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB: NEW USERS */}
        {activeTab === 'new' && (
          <div className="card glass">
            <h3>New User Onboarding</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
              {stats.newMembers.map(p => (
                <div key={p.id} className="glass" style={{ padding: '20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between' }}>
                  <div><div style={{ fontWeight: 800 }}>{p.username}</div><div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.email}</div></div>
                  <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/profile/${p.id}`)}>View</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: MONEY POT */}
        {activeTab === 'moneypot' && (
          <div className="card glass">
            <h3>League Financials</h3>
            <div className="glass" style={{ padding: '20px', borderRadius: '12px', marginTop: '20px' }}>
              <div style={{ color: 'var(--text-muted)' }}>Prize Pot</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900 }}>£{subscriptionPot.toFixed(2)}</div>
              <div style={{ marginTop: '15px', display: 'flex', gap: '8px' }}>
                <input type="number" className="glass" style={{ flex: 1 }} placeholder="+/-" onChange={e => setPotAdjust({...potAdjust, amount: parseFloat(e.target.value) || 0})} />
                <button className="btn btn-secondary btn-sm" onClick={handleAdjustPot}>Adjust</button>
              </div>
            </div>
          </div>
        )}

        {/* TAB: STAFF */}
        {activeTab === 'admins' && (
          <div className="card glass">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Staff & Permissions</h3>
            </div>
            <div style={{ marginBottom: '30px', padding: '20px', background: 'rgba(56, 189, 248, 0.05)', borderRadius: '16px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
               <h4 style={{ marginBottom: '10px' }}>Add New Staff Member</h4>
               <UserSearchSelect users={allPlayers} selectedId={''} onSelect={id => handleUpdateAdminRole(id, 'isTournamentAdmin', true)} label="Search User by Name" onQueryChange={searchUsers} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
               {allPlayers.filter(p => p.isAdmin || p.isTournamentAdmin || p.isCupAdmin).map(p => (
                 <div key={p.id} className="glass" style={{ padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div><div style={{ fontWeight: 700 }}>{p.username}</div><div style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)' }}>{p.email}</div></div>
                    <div style={{ display: 'flex', gap: '15px' }}>
                       <label style={{ fontSize: '0.7rem' }}><input type="checkbox" checked={p.isAdmin || false} onChange={e => handleUpdateAdminRole(p.id, 'isAdmin', e.target.checked)} /><br/>Super</label>
                       <label style={{ fontSize: '0.7rem' }}><input type="checkbox" checked={p.isTournamentAdmin || false} onChange={e => handleUpdateAdminRole(p.id, 'isTournamentAdmin', e.target.checked)} /><br/>Tourny</label>
                       <label style={{ fontSize: '0.7rem' }}><input type="checkbox" checked={p.isCupAdmin || false} onChange={e => handleUpdateAdminRole(p.id, 'isCupAdmin', e.target.checked)} /><br/>Cup</label>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        )}

        {/* TAB: PLAYOFFS */}
        {activeTab === 'playoffs' && (
          <div className="card glass">
            <h3>Playoff Match Creation</h3>
            <div className="glass" style={{ padding: '24px', borderRadius: '16px', marginTop: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <UserSearchSelect users={allPlayers} selectedId={playoffForm.player1} onSelect={id => setPlayoffForm({...playoffForm, player1: id})} label="Player 1" onQueryChange={searchUsers} />
                <UserSearchSelect users={allPlayers} selectedId={playoffForm.player2} onSelect={id => setPlayoffForm({...playoffForm, player2: id})} label="Player 2" onQueryChange={searchUsers} />
              </div>
              <button className="btn btn-primary btn-block" style={{ marginTop: '20px' }} onClick={handleCreatePlayoff}>Create Playoff</button>
            </div>
          </div>
        )}

        {/* TAB: SEASONS */}
        {activeTab === 'seasons' && (
          <div className="card glass">
            <h3>Season Management</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
               <div className="glass" style={{ padding: '15px', borderRadius: '12px' }}><strong>ACTIVE:</strong> {adminData?.currentSeason || 'Not Set'}</div>
               {getSeasons().map(s => (
                 <div key={s.id} className="glass" style={{ padding: '12px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{s.name}</span>
                    <button className="btn btn-secondary btn-sm" onClick={async () => { await updateAdminData({ currentSeason: s.name }); triggerDataRefresh('all'); }}>Set Active</button>
                 </div>
               ))}
            </div>
          </div>
        )}

        {/* TAB: CUPS */}
        {activeTab === 'cups' && (
          <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner"></div></div>}>
            <CupManagement />
          </Suspense>
        )}

        {/* TAB: MEMBERS */}
        {activeTab === 'players' && (
          <div className="card glass">
            <h3>Global Membership</h3>

            {/* Bulk action bar */}
            <div className="glass" style={{ padding: '16px', borderRadius: '12px', margin: '16px 0', border: '1px solid rgba(56, 189, 248, 0.2)', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                {selectedMemberIds.length} selected
              </span>
              <select
                className="glass"
                value={bulkDivision}
                onChange={(e) => setBulkDivision(e.target.value)}
                style={{ fontSize: '0.8rem', padding: '6px 10px', minWidth: '120px' }}
              >
                <option value="">Division...</option>
                <option value="Elite">Elite</option>
                <option value="Emerald">Emerald</option>
                <option value="Diamond">Diamond</option>
                <option value="Platinum">Platinum</option>
                <option value="Unassigned">Unassigned</option>
              </select>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleBulkAssignDivision}
                disabled={isProcessing || selectedMemberIds.length === 0 || !bulkDivision}
              >
                Assign Division
              </button>
              <select
                className="glass"
                value={bulkSeason}
                onChange={(e) => setBulkSeason(e.target.value)}
                style={{ fontSize: '0.8rem', padding: '6px 10px', minWidth: '120px' }}
              >
                <option value="">Season...</option>
                {getSeasons().map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
              <button
                className="btn btn-success btn-sm"
                onClick={handleBulkGrantElitePass}
                disabled={isProcessing || selectedMemberIds.length === 0}
              >
                Grant Elite Pass
              </button>
              {selectedMemberIds.length > 0 && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSelectedMemberIds([])}
                >
                  Clear
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
              <input
                className="glass"
                type="text"
                placeholder="Search by name or email..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }}
              />
              {allPlayers
                .filter(p => {
                  if (!memberSearch.trim()) return true
                  const q = memberSearch.toLowerCase()
                  return p.username?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q) || p.nickname?.toLowerCase().includes(q)
                })
                .sort((a, b) => a.username.localeCompare(b.username)).map(p => {
                const isSelected = selectedMemberIds.includes(p.id)
                return (
                  <div
                    key={p.id}
                    className="player-card glass"
                    style={{
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: isSelected ? '2px solid var(--accent-cyan)' : '1px solid transparent',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      setSelectedMemberIds(prev =>
                        prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                      )
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--accent-cyan)' }}
                      />
                      <div>
                        <div style={{ fontWeight: 700 }}>{p.username}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {p.email} • {p.division || 'Unassigned'}
                          {p.isSubscribed && <span style={{ color: 'var(--success)', marginLeft: '8px' }}>✓ Elite Pass</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${p.id}`) }}>View</button>
                      <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); handleUpdateAdminRole(p.id, 'isTournamentAdmin', true); setActiveTab('admins'); }}>Promote</button>
                      {isFullAdmin && <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); handleDeleteUser(p.id) }}>🗑️</button>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* TAB: PRACTICE MONITOR */}
        {activeTab === 'practice' && (
          <div className="card glass">
            <h3>Practice Hub</h3>
            <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={() => triggerDataRefresh('all')}>Refresh Data</button>
          </div>
        )}

        {/* TAB: TROPHIES */}
        {activeTab === 'trophies' && (
          <div className="card glass">
            <h3>Trophy Room</h3>
            <div className="glass" style={{ padding: '24px', borderRadius: '16px', marginTop: '20px' }}>
              <UserSearchSelect users={allPlayers} selectedId={trophyForm.player} onSelect={id => setTrophyForm({...trophyForm, player: id})} label="Player" onQueryChange={searchUsers} />
              <input className="glass" placeholder="Trophy Name" value={trophyForm.name} onChange={e => setTrophyForm({...trophyForm, name: e.target.value})} style={{ marginTop: '15px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }}>
                <input className="glass" placeholder="Icon (emoji)" value={trophyForm.icon} onChange={e => setTrophyForm({...trophyForm, icon: e.target.value})} />
                <select className="glass" value={trophyForm.season} onChange={e => setTrophyForm({...trophyForm, season: e.target.value})}>
                  <option value="">Season...</option>
                  {getSeasons().map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <button className="btn btn-primary btn-block" style={{ marginTop: '15px' }} onClick={handleAwardTrophy}>Award Trophy</button>
            </div>
          </div>
        )}

        {/* TAB: HALL OF FAME */}
        {activeTab === 'halloffame' && (
          <div className="card glass">
            <h3>Hall of Fame Management</h3>
            <div className="glass" style={{ padding: '24px', borderRadius: '16px', marginTop: '20px', marginBottom: '24px' }}>
              <UserSearchSelect users={allPlayers} selectedId={hallOfFameForm.player} onSelect={id => setHallOfFameForm({...hallOfFameForm, player: id})} label="Select Player" onQueryChange={searchUsers} />
              <input className="glass" placeholder="Hall of Fame Title (e.g. Season 1 Champion)" value={hallOfFameForm.name} onChange={e => setHallOfFameForm({...hallOfFameForm, name: e.target.value})} style={{ marginTop: '15px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }}>
                <input className="glass" placeholder="Icon (emoji)" value={hallOfFameForm.icon} onChange={e => setHallOfFameForm({...hallOfFameForm, icon: e.target.value})} />
                <select className="glass" value={hallOfFameForm.season} onChange={e => setHallOfFameForm({...hallOfFameForm, season: e.target.value})}>
                  <option value="">Season...</option>
                  {getSeasons().map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '15px', fontSize: '0.9rem' }}>
                <input type="checkbox" checked={hallOfFameForm.visible} onChange={e => setHallOfFameForm({...hallOfFameForm, visible: e.target.checked})} />
                Visible on Home Screen
              </label>
              <button className="btn btn-primary btn-block" style={{ marginTop: '15px' }} onClick={handleAddHallOfFame}>Add to Hall of Fame</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {hallOfFame.sort((a, b) => new Date(b.awardedAt) - new Date(a.awardedAt)).map(entry => (
                <div key={entry.id} className="glass" style={{ padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ fontSize: '2rem' }}>{entry.icon || '🏆'}</div>
                    <div>
                      <div style={{ fontWeight: 800 }}>{entry.username}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>{entry.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{entry.season}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      className={`btn btn-sm ${entry.visible ? 'btn-success' : 'btn-secondary'}`}
                      onClick={() => handleToggleHallOfFameVisibility(entry.id, entry.visible)}
                    >
                      {entry.visible ? 'Visible' : 'Hidden'}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleRemoveHallOfFame(entry.id)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: SURVEYS */}
        {activeTab === 'surveys' && (
          <div className="card glass">
            <h3>Surveys</h3>
            <div className="card glass" style={{ marginTop: '20px' }}>
              <input value={surveyForm.title} onChange={e => setSurveyForm({...surveyForm, title: e.target.value})} placeholder="Survey Title" />
              <button className="btn btn-primary btn-block" style={{ marginTop: '15px' }} onClick={handleCreateSurvey}>Publish Survey</button>
            </div>
          </div>
        )}

        {/* TAB: MAINTENANCE */}
        {activeTab === 'maintenance' && (
          <div className="card glass" style={{ padding: '32px' }}>
            <h3>System Maintenance</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginTop: '20px' }}>
              <div className="glass" style={{ padding: '24px' }}>
                <h4>Recovery Tools</h4>
                <button className="btn btn-success btn-sm btn-block" onClick={handleHealUserDivisions}>Heal Divisions</button>
                <button className="btn btn-secondary btn-sm btn-block" onClick={handleBulkSyncAnalytics} style={{ marginTop: '10px' }}>Analytics Sync</button>
              </div>
              <div className="glass" style={{ padding: '24px', background: adminData?.isMaintenanceMode ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.05)' }}>
                <h4>Maintenance Mode</h4>
                <button className="btn btn-block" onClick={() => updateAdminData({ isMaintenanceMode: !adminData?.isMaintenanceMode })}>{adminData?.isMaintenanceMode ? 'Disable' : 'Enable'}</button>
              </div>
            </div>
          </div>
        )}

        {/* TAB: AUDIT LOGS */}
        {activeTab === 'audit' && (
          <div className="card glass animate-fade-in">
            <h3 className="card-title">System Audit Log</h3>
            <div className="glass" style={{ maxHeight: '600px', overflowY: 'auto', borderRadius: '12px' }}>
               {loadingLogs ? <div style={{ padding: '40px' }}><div className="spinner"></div></div> : auditLogs.map(log => (
                 <div key={log.id} style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontWeight: 800 }}>{log.action}</span><span>{new Date(log.timestamp).toLocaleString()}</span></div>
                    <div>{log.details}</div>
                 </div>
               ))}
            </div>
          </div>
        )}

      </div>

      {previewImage && (
        <div
          className="modal-overlay animate-fade-in"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.9)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            cursor: 'pointer'
          }}
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            alt="Preview"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 0 40px rgba(0,0,0,0.5)' }}
          />
          <button
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'white',
              color: 'black',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              fontSize: '24px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
            onClick={() => setPreviewImage(null)}
          >×</button>
        </div>
      )}
    </div>
  )
}
