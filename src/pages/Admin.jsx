import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { db, doc, setDoc, getDoc, getDocs, collection, deleteDoc, updateDoc, writeBatch, addDoc } from '../firebase'
import UserSearchSelect from '../components/UserSearchSelect'
import CupManagement from './CupManagement'
import { useToast } from '../context/ToastContext'

const ADMIN_EMAILS = ['rhyshowe2023@outlook.com', 'dhineberry@yahoo.com']

export default function Admin() {
  const {
    user,
    loading: authLoading,
    getAllUsers,
    getResults,
    getCups,
    bets,
    getSeasons,
    adminData,
    updateAdminData,
    addToMoneyHistory,
    triggerDataRefresh,
    dataRefreshTrigger
  } = useAuth()

  const navigate = useNavigate()
  const { showToast } = useToast()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [refreshKey, setRefreshKey] = useState(0)
  const [isApproving, setIsApproving] = useState(false)
  const [resultFilter, setResultFilter] = useState('pending')
  const [selectedResults, setSelectedResults] = useState([])

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
  const [grantSubForm, setGrantSubForm] = useState({ player: '', tier: 'standard' })
  const [potAdjust, setPotAdjust] = useState({ standard: 0, premium: 0 })
  const [trophyForm, setTrophyForm] = useState({ player: '', name: '', icon: '🏆', season: '' })

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
  const pendingResults = allResults.filter(r => String(r.status).toLowerCase() === 'pending')
  const approvedResults = allResults.filter(r => String(r.status).toLowerCase() === 'approved')
  const rejectedResults = allResults.filter(r => String(r.status).toLowerCase() === 'rejected')

  const pendingPayments = allPlayers.filter(u => u?.paymentPending && !u?.isSubscribed)
  const subscribers = allPlayers.filter(u => u?.isSubscribed)

  const subscriptionPot = adminData?.subscriptionPot || 0
  const subscriptionPot10 = adminData?.subscriptionPot10 || 0

  useEffect(() => {
    const tab = searchParams.get('tab')
    const allowed = ['dashboard', 'results', 'payments', 'moneypot', 'cups', 'players', 'admins', 'seasons', 'trophies', 'tokens', 'maintenance']
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
      await setDoc(doc(db, 'results', String(resultId)), { ...res, status: 'approved', approvedAt: new Date().toISOString() }, { merge: true })
      await logAudit('APPROVE_RESULT', `Approved match: ${res.player1} vs ${res.player2}`)
      triggerDataRefresh('results')
      showToast('Result Approved!', 'success')
    } catch (e) { showToast(e.message, 'error') }
    setIsApproving(false)
  }

  const handleBulkApprove = async () => {
    if (selectedResults.length === 0 || isApproving) return
    setIsApproving(true)
    try {
      const batch = writeBatch(db)
      selectedResults.forEach(id => {
        const res = allResults.find(r => String(r.id) === String(id))
        if (res) {
          batch.update(doc(db, 'results', String(id)), { status: 'approved', approvedAt: new Date().toISOString() })
        }
      })
      await batch.commit()
      await logAudit('BULK_APPROVE', `Approved ${selectedResults.length} matches`)
      setSelectedResults([])
      triggerDataRefresh('results')
      showToast(`Approved ${selectedResults.length} matches!`, 'success')
    } catch (e) { showToast(e.message, 'error') }
    setIsApproving(false)
  }

  const handleRejectResult = async (resultId) => {
    try {
      const res = allResults.find(r => String(r.id) === String(resultId))
      if (!res) throw new Error('Result not found')
      await setDoc(doc(db, 'results', String(resultId)), { ...res, status: 'rejected', updatedAt: new Date().toISOString() }, { merge: true })
      await logAudit('REJECT_RESULT', `Rejected match: ${res.player1} vs ${res.player2}`)
      triggerDataRefresh('results')
      showToast('Result Rejected', 'info')
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleDeleteResult = async (resultId) => {
    if (!window.confirm('Permanently delete this result?')) return
    try {
      const res = allResults.find(r => String(r.id) === String(resultId))
      await deleteDoc(doc(db, 'results', String(resultId)))
      await logAudit('DELETE_RESULT', `Deleted result: ${res?.player1} vs ${res?.player2}`)
      triggerDataRefresh('results')
      showToast('Result Deleted', 'info')
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
      await setDoc(doc(db, 'results', resultId), {
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
      })
      await logAudit('ADMIN_SUBMIT_GAME', `Admin submitted game: ${p1.username} ${s1}-${s2} ${p2.username}`)
      setAdminGameForm({ player1: '', player2: '', score1: '', score2: '', gameType: 'Friendly', p1_180s: '', p2_180s: '', p1_checkout: '', p2_checkout: '', p1_doubles: '', p2_doubles: '' })
      triggerDataRefresh('results')
      showToast('Game submitted!', 'success')
    } catch (e) { showToast('Error: ' + e.message, 'error') }
  }

  const handleApprovePayment = async (u) => {
    try {
      const tier = u.paymentMethod === 'paypal10' ? 10 : 5
      const updates = {
        isSubscribed: true,
        paymentPending: false,
        subscriptionDate: new Date().toISOString(),
        subscriptionTier: tier === 10 ? 'premium' : 'standard'
      }
      await setDoc(doc(db, 'users', u.id), updates, { merge: true })

      const potKey = tier === 10 ? 'subscriptionPot10' : 'subscriptionPot'
      const currentPot = tier === 10 ? subscriptionPot10 : subscriptionPot
      await updateAdminData({ [potKey]: currentPot + tier })
      addToMoneyHistory('subscription', tier, `Approved payment: ${u.username}`)
      await logAudit('APPROVE_PAYMENT', `Approved payment for ${u.username} (£${tier})`)

      triggerDataRefresh('users')
      showToast('Subscription Approved!', 'success')
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleGrantSubscription = async () => {
    if (!grantSubForm.player) return showToast('Select a player', 'error')
    try {
      const target = allPlayers.find(p => p.id === grantSubForm.player)
      await setDoc(doc(db, 'users', target.id), {
        isSubscribed: true,
        subscriptionDate: new Date().toISOString(),
        subscriptionTier: grantSubForm.tier
      }, { merge: true })
      await logAudit('GRANT_SUBSCRIPTION', `Manually granted ${grantSubForm.tier} sub to ${target.username}`)
      triggerDataRefresh('users')
      showToast(`Granted ${grantSubForm.tier} subscription to ${target.username}`, 'success')
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

  const stats = useMemo(() => {
    const lastWeek = new Date()
    lastWeek.setDate(lastWeek.getDate() - 7)

    return {
      newUsers: allPlayers.filter(u => new Date(u.createdAt) > lastWeek).length,
      pendingResults: pendingResults.length,
      pendingPayments: pendingPayments.length,
      totalPot: subscriptionPot + subscriptionPot10
    }
  }, [allPlayers, pendingResults, pendingPayments, subscriptionPot, subscriptionPot10])

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'results', label: 'Scores', count: pendingResults.length },
    { id: 'payments', label: 'Payments', count: pendingPayments.length },
    { id: 'moneypot', label: 'Finances' },
    { id: 'admins', label: 'Staff' },
    { id: 'cups', label: 'Cups' },
    { id: 'players', label: 'Members' },
    { id: 'seasons', label: 'Seasons' },
    { id: 'trophies', label: 'Trophies' },
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

      <div style={{ display: 'flex', overflowX: 'auto', gap: '10px', marginBottom: '24px', paddingBottom: '10px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
              <div className="stat-card glass" onClick={() => setActiveTab('results')} style={{ cursor: 'pointer' }}>
                <div className="stat-value" style={{ color: stats.pendingResults > 0 ? 'var(--warning)' : 'var(--success)' }}>{stats.pendingResults}</div>
                <div className="stat-label">Pending Results</div>
              </div>
              <div className="stat-card glass" onClick={() => setActiveTab('payments')} style={{ cursor: 'pointer' }}>
                <div className="stat-value" style={{ color: stats.pendingPayments > 0 ? 'var(--error)' : 'var(--success)' }}>{stats.pendingPayments}</div>
                <div className="stat-label">Pending Payments</div>
              </div>
              <div className="stat-card glass">
                <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>{stats.newUsers}</div>
                <div className="stat-label">New Users (7d)</div>
              </div>
              <div className="stat-card glass">
                <div className="stat-value">£{stats.totalPot.toFixed(0)}</div>
                <div className="stat-label">Total Sub Pot</div>
              </div>
            </div>

            <div className="card glass">
              <h3 className="card-title">🚨 Urgent Actions</h3>
              {(stats.pendingResults > 0 || stats.pendingPayments > 0) ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {stats.pendingResults > 0 && (
                    <div className="glass" style={{ padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid var(--warning)' }}>
                      <span>{stats.pendingResults} match results are waiting for approval.</span>
                      <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('results')}>Review Scores</button>
                    </div>
                  )}
                  {stats.pendingPayments > 0 && (
                    <div className="glass" style={{ padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid var(--error)' }}>
                      <span>{stats.pendingPayments} players have pending membership payments.</span>
                      <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('payments')}>Verify Payments</button>
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No urgent tasks. Everything is up to date! ✅</p>
              )}
            </div>
          </div>
        )}

        {/* TAB: RESULTS */}
        {activeTab === 'results' && (
          <div className="card glass">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <h3>Match History & Review</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
              {(resultFilter === 'pending' ? pendingResults : resultFilter === 'approved' ? approvedResults : rejectedResults).map(r => (
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
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {resultFilter === 'pending' && <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => handleApproveResult(r.id)}>Approve</button>}
                      {resultFilter === 'pending' && <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => handleRejectResult(r.id)}>Reject</button>}
                      {resultFilter !== 'pending' && <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => handleApproveResult(r.id)}>Restore/Reset</button>}
                      <button className="btn btn-danger btn-sm" style={{ padding: '8px' }} onClick={() => handleDeleteResult(r.id)}>🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
              {((resultFilter === 'pending' ? pendingResults : resultFilter === 'approved' ? approvedResults : rejectedResults).length === 0) && <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No results found in this category.</p>}
            </div>
          </div>
        )}

        {/* TAB: PAYMENTS */}
        {activeTab === 'payments' && (
          <div className="card glass">
            <h3 style={{ marginBottom: '20px' }}>Pending Subscriptions</h3>
            {pendingPayments.map(u => (
              <div key={u.id} className="glass" style={{ padding: '20px', borderRadius: '12px', marginBottom: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                   <div>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{u.username}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{u.email}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', marginTop: '4px' }}>Method: {u.paymentMethod || 'Unknown'}</div>
                   </div>
                   <button className="btn btn-primary btn-sm" onClick={() => handleApprovePayment(u)}>Approve Access</button>
                </div>
                {u.paymentProof && (
                  <div style={{ marginTop: '10px' }}>
                    <p style={{ fontSize: '0.75rem', marginBottom: '8px', color: 'var(--text-muted)' }}>Payment Receipt:</p>
                    <img src={u.paymentProof} alt="Proof" style={{ width: '100%', maxWidth: '300px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                  </div>
                )}
              </div>
            ))}
            {pendingPayments.length === 0 && <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No payments awaiting approval.</p>}
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

            <div style={{ marginBottom: '30px', padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '15px' }}>
               <h4>Manually Grant Elite Pass</h4>
               <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '12px' }}>
                  <UserSearchSelect users={allPlayers} selectedId={grantSubForm.player} onSelect={id => setGrantSubForm({...grantSubForm, player: id})} label="Target Player" />
                  <select className="glass" style={{ padding: '10px' }} value={grantSubForm.tier} onChange={e => setGrantSubForm({...grantSubForm, tier: e.target.value})}>
                     <option value="standard">Standard (£5)</option>
                     <option value="premium">Premium (£10)</option>
                  </select>
                  <button className="btn btn-primary" onClick={handleGrantSubscription}>Activate Pass</button>
               </div>
            </div>

            <div style={{ maxHeight: '500px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {allPlayers.map(p => (
                <div key={p.id} className="player-card glass" style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.username} {p.isSubscribed && <span style={{ color: 'var(--success)', fontSize: '0.6rem', border: '1px solid var(--success)', padding: '1px 4px', borderRadius: '4px', marginLeft: '5px' }}>PASSED</span>}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{p.email} | Div: {p.division || 'Unassigned'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/profile/${p.id}`)}>View</button>
                    {isFullAdmin && (
                      <button className="btn btn-danger btn-sm" style={{ padding: '8px' }} onClick={() => handleDeleteUser(p.id)}>🗑️</button>
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

        {/* TAB: MAINTENANCE */}
        {activeTab === 'maintenance' && (
          <div className="card glass">
            <h3>System Status</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', cursor: 'pointer' }}>
              <input type="checkbox" checked={adminData?.isMaintenanceMode || false} onChange={e => updateAdminData({ isMaintenanceMode: e.target.checked })} />
              <span style={{ fontWeight: 600 }}>Global Maintenance Lock</span>
            </label>
            <textarea className="glass" style={{ width: '100%', padding: '15px', borderRadius: '12px', marginBottom: '10px' }} rows={3} placeholder="Banner message..." defaultValue={adminData?.maintenanceMessage || ''} id="maintMsgInput" />
            <button className="btn btn-primary btn-block" onClick={() => { updateAdminData({ maintenanceMessage: document.getElementById('maintMsgInput').value }); showToast('Message updated', 'success'); }}>Broadcast Update</button>
          </div>
        )}

      </div>
    </div>
  )
}
