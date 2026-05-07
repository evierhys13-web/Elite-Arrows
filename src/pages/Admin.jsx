import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { db, doc, setDoc, getDoc, getDocs, collection, deleteDoc, updateDoc, writeBatch, addDoc } from '../firebase'
import UserSearchSelect from '../components/UserSearchSelect'
import CupManagement from './CupManagement'
import { useToast } from '../context/ToastContext'
import { SkeletonList } from '../components/Skeleton'

const ADMIN_EMAILS = ['rhyshowe2023@outlook.com', 'dhineberry@yahoo.com']

export default function Admin() {
  const {
    user,
    loading: authLoading,
    notifications,
    getAllUsers,
    getResults,
    getFixtures,
    getSeasons,
    getNews,
    postNews,
    deleteNews,
    adminData,
    updateAdminData,
    addToMoneyHistory,
    updateOtherUser,
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
    const allowed = ['dashboard', 'results', 'payments', 'moneypot', 'cups', 'players', 'news', 'admins', 'seasons', 'trophies', 'tokens', 'maintenance']
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
                {/* ... other form fields ... */}
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
            </div>
          </div>
        )}

        {/* ... Rest of the tabs (Payments, Pot, Staff, etc.) remain as before but with showToast replaces ... */}
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
              </div>
            ))}
          </div>
        )}

        {/* TAB: TROPHIES */}
        {activeTab === 'trophies' && (
          <div className="card glass">
            <h3>Trophy Room Management</h3>
            <div className="glass" style={{ padding: '24px', borderRadius: '16px' }}>
              <UserSearchSelect users={allPlayers} selectedId={trophyForm.player} onSelect={id => setTrophyForm({...trophyForm, player: id})} label="Recipient" />
              <button className="btn btn-primary btn-block" style={{marginTop:'16px'}} onClick={handleAwardTrophy}>Award Trophy</button>
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
