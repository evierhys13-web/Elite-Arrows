import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { db, doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, collection, query, where } from '../firebase'
import UserSearchSelect from '../components/UserSearchSelect'
import CupManagement from './CupManagement'
import { getNormalizedResultSignature, getResultOverrideKeys, getResultSignature } from '../utils/resultIdentity'
import { derivePlayerStatsFromResults, getPersistedPlayerStats } from '../utils/playerStats'

const ADMIN_EMAILS = ['rhyshowe2023@outlook.com', 'dhineberry@yahoo.com']

export default function Admin() {
  const {
    user,
    loading: authLoading,
    notifications,
    getAllUsers,
    updateUser,
    updateOtherUser,
    getResults,
    updateResults,
    getFixtures,
    updateFixtures,
    getCups,
    getSupportRequests,
    getSeasons,
    getNews,
    postNews,
    deleteNews,
    togglePinNews,
    adminData,
    updateAdminData,
    addToMoneyHistory,
    triggerDataRefresh,
    dataRefreshTrigger,
    notifyUser,
    notifyAllSubscribers
  } = useAuth()

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [refreshKey, setRefreshKey] = useState(0)

  // Critical Guard: Don't run any logic until user and adminData are loaded
  if (authLoading) return <div className="page glass"><div style={{ padding: '60px', textAlign: 'center', color: 'var(--accent-cyan)', fontWeight: 800 }}>Loading Admin Control...</div></div>
  if (!user) return <div className="page glass"><div style={{ padding: '60px', textAlign: 'center' }}>Identity validation failed. Please sign in.</div></div>

  const subscriptionPot = adminData?.subscriptionPot || 0
  const subscriptionPot10 = adminData?.subscriptionPot10 || 0
  const tournamentPot = adminData?.tournamentPot || 0
  const moneyHistory = adminData?.moneyHistory || []

  const [gameForm, setGameForm] = useState({
    player1: '',
    player2: '',
    score1: '',
    score2: '',
    gameType: 'Friendly',
    division: ''
  })

  useEffect(() => {
    setRefreshKey(prev => prev + 1)
  }, [dataRefreshTrigger])

  const [pendingResults, setPendingResults] = useState([])
  const [resultFilter, setResultFilter] = useState('pending')
  const [approvedResults, setApprovedResults] = useState([])
  const [isApprovingAllResults, setIsApprovingAllResults] = useState(false)
  const [toast, setToast] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [activeTab, setActiveTab] = useState('results')
  const [showConfirmModal, setShowConfirmModal] = useState(null)
  const [proofPreviewResult, setProofPreviewResult] = useState(null)
  const [showColorsForm, setShowColorsForm] = useState(false)

  const allUsersSource = getAllUsers() || []
  const allResultsSource = getResults() || []

  const [colors, setColors] = useState(() => {
    try {
      const stored = localStorage.getItem('eliteArrowsColors')
      const parsed = stored ? JSON.parse(stored) : null
      return {
        primary: parsed?.primary || '#00d4ff',
        background: parsed?.background || '#0a0a1a',
        button: parsed?.button || '#00d4ff'
      }
    } catch (e) {
      return { primary: '#00d4ff', background: '#0a0a1a', button: '#00d4ff' }
    }
  })

  const [selectedAssignUser, setSelectedAssignUser] = useState('')
  const [selectedRemoveSubUser, setSelectedRemoveSubUser] = useState('')
  const [showSeasonModal, setShowSeasonModal] = useState(false)
  const [seasonForm, setSeasonForm] = useState({ name: '', startDate: '2025-05-01', endDate: '2025-06-01' })
  const [showDivisionModal, setShowDivisionModal] = useState(false)

  useEffect(() => {
    const tab = searchParams.get('tab')
    const allowedTabs = new Set(['results', 'submit-game', 'payments', 'moneypot', 'cups', 'players', 'support', 'fixture-activity', 'news', 'subscriptions', 'admins', 'seasons', 'tokens', 'games', 'appearance', 'maintenance'])
    if (tab && allowedTabs.has(tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [refreshKey])

  const getManagedResultStatus = (result) => String(result?.status || '').trim().toLowerCase()

  useEffect(() => {
    async function loadManagedResults() {
      if (!user) return;
      const results = await getResults() || [];
      const managedStatuses = new Set(['pending', 'approved', 'rejected']);
      const managed = results.filter(r => managedStatuses.has(getManagedResultStatus(r)));
      const visibleResults = user.isTournamentAdmin && !user.isAdmin
        ? managed.filter(r => r.gameType === 'Tournament')
        : managed;
      const pending = visibleResults.filter(r => getManagedResultStatus(r) === 'pending');
      setPendingResults(pending);
      setApprovedResults(visibleResults);
    }
    loadManagedResults()
  }, [user?.id, dataRefreshTrigger])

  const isEmailAdmin = ADMIN_EMAILS.includes(user?.email?.toLowerCase())
  const isDbAdmin = user?.isAdmin === true
  const canAccess = isEmailAdmin || isDbAdmin || user?.isTournamentAdmin || user?.isCupAdmin

  if (!canAccess) {
    return (
      <div className="page glass">
        <h1 className="page-title">Access Denied</h1>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>You do not have permission to view the Admin Panel.</p>
      </div>
    );
  }

  const isFullAdmin = user?.isAdmin || ADMIN_EMAILS.includes(user?.email?.toLowerCase())
  const filteredManagedResults = approvedResults.filter(result => getManagedResultStatus(result) === resultFilter)

  const allPlayers = getAllUsers() || []
  const pendingAdmins = allPlayers.filter(u => u?.adminRequestPending && !u?.isAdmin && !u?.isTournamentAdmin)
  const pendingPayments = allPlayers.filter(u => u?.paymentPending && !u?.isSubscribed)
  const subscribers = allPlayers.filter(u => u?.isSubscribed)
  const freeUsers = allPlayers.filter(u => !u?.isSubscribed && !u?.paymentPending)
  const tournamentAdmins = allPlayers.filter(u => u?.isTournamentAdmin)
  const fixtureActivity = (notifications || []).filter(n => n?.type === 'fixture_activity').slice(0, 50)

  // Standard functions (Approve, Reject, etc.)
  const showSuccessMessage = (message) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(''), 1800)
  }

  const approveResult = async (resultId) => {
    try {
      const results = await getResults()
      const res = results.find(r => String(r.id) === String(resultId))
      if (!res) return alert('Result not found')
      const updated = { ...res, status: 'approved', approvedAt: new Date().toISOString() }
      await setDoc(doc(db, 'results', String(resultId)), updated, { merge: true })
      showSuccessMessage('Result Approved')
      triggerDataRefresh('results')
    } catch (e) { alert(e.message) }
  }

  const rejectResult = async (resultId) => {
    try {
      const results = await getResults()
      const res = results.find(r => String(r.id) === String(resultId))
      if (!res) return alert('Result not found')
      const updated = { ...res, status: 'rejected', updatedAt: new Date().toISOString() }
      await setDoc(doc(db, 'results', String(resultId)), updated, { merge: true })
      triggerDataRefresh('results')
    } catch (e) { alert(e.message) }
  }

  const approvePayment = async (userId) => {
    try {
      const target = allPlayers.find(u => u.id === userId)
      if (!target) return
      const updates = { isSubscribed: true, paymentPending: false, subscriptionDate: new Date().toISOString() }
      await setDoc(doc(db, 'users', userId), updates, { merge: true })
      triggerDataRefresh('users')
      alert('Payment Approved')
    } catch (e) { alert(e.message) }
  }

  return (
    <div className="page animate-fade-in">
      {successMessage && (
        <div className="modal-overlay" style={{ zIndex: 11000 }}>
          <div className="card glass" style={{ border: '2px solid var(--success)', padding: '40px', textAlign: 'center' }}>
            <h2 style={{ color: 'var(--success)', marginBottom: '10px' }}>Success</h2>
            <p>{successMessage}</p>
          </div>
        </div>
      )}

      <div className="page-header">
        <h1 className="page-title text-gradient">Admin Dashboard</h1>
      </div>

      {isFullAdmin && (
        <div className="home-stats-grid" style={{ marginBottom: '24px' }}>
          <div className="stat-card glass">
            <div className="stat-value">{pendingResults.length}</div>
            <div className="stat-label">Pending Scores</div>
          </div>
          <div className="stat-card glass">
            <div className="stat-value">{pendingPayments.length}</div>
            <div className="stat-label">New Payments</div>
          </div>
          <div className="stat-card glass">
            <div className="stat-value" style={{ color: 'var(--success)' }}>£{subscriptionPot + subscriptionPot10}</div>
            <div className="stat-label">League Pot</div>
          </div>
          <div className="stat-card glass">
            <div className="stat-value">{allPlayers.length}</div>
            <div className="stat-label">Players</div>
          </div>
        </div>
      )}

      <div className="division-tabs" style={{ marginBottom: '24px' }}>
        {isFullAdmin && <button className={`division-tab ${activeTab === 'results' ? 'active' : ''}`} onClick={() => setActiveTab('results')}>Manage Results</button>}
        {isFullAdmin && <button className={`division-tab ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')}>Payments ({pendingPayments.length})</button>}
        {(isFullAdmin || user?.isCupAdmin) && <button className={`division-tab ${activeTab === 'cups' ? 'active' : ''}`} onClick={() => setActiveTab('cups')}>Cup Control</button>}
        <button className={`division-tab ${activeTab === 'players' ? 'active' : ''}`} onClick={() => setActiveTab('players')}>Player List</button>
        <button className={`division-tab ${activeTab === 'news' ? 'active' : ''}`} onClick={() => setActiveTab('news')}>Announcements</button>
        {isFullAdmin && <button className={`division-tab ${activeTab === 'admins' ? 'active' : ''}`} onClick={() => setActiveTab('admins')}>Staff & Members</button>}
        {isFullAdmin && <button className={`division-tab ${activeTab === 'maintenance' ? 'active' : ''}`} onClick={() => setActiveTab('maintenance')}>Maintenance</button>}
      </div>

      <div className="admin-content-area">
        {activeTab === 'results' && (
          <div className="card glass">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3>Recent Match Submissions</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['pending', 'approved', 'rejected'].map(f => (
                  <button key={f} className={`btn btn-sm ${resultFilter === f ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setResultFilter(f)}>
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            {filteredManagedResults.map(r => (
              <div key={r.id} className="result-item glass" style={{ marginBottom: '12px', padding: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{r.player1} vs {r.player2}</strong>
                  <span style={{ color: 'var(--accent-cyan)' }}>{r.score1} - {r.score2}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '5px' }}>{r.gameType} | {r.date}</div>
                {getManagedResultStatus(r) === 'pending' && (
                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => approveResult(r.id)}>Approve</button>
                    <button className="btn btn-danger btn-sm" onClick={() => rejectResult(r.id)}>Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="card glass">
            <h3>Pending Subscriptions</h3>
            {pendingPayments.map(u => (
              <div key={u.id} className="player-card glass" style={{ marginBottom: '10px' }}>
                <div className="player-info">
                  <h4>{u.username}</h4>
                  <p>{u.email}</p>
                </div>
                <button className="btn btn-primary" onClick={() => approvePayment(u.id)}>Approve £5</button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'cups' && <CupManagement />}

        {activeTab === 'news' && (
          <div className="card glass">
            <h3>Global Announcement</h3>
            <textarea id="newsMsg" placeholder="Type your message..." rows={4} className="glass" style={{ width: '100%', marginBottom: '10px', padding: '15px' }} />
            <button className="btn btn-primary btn-block" onClick={async () => {
              const msg = document.getElementById('newsMsg').value
              if (msg) {
                await postNews("Notice", msg, true)
                alert('Posted!')
              }
            }}>Push to All Users</button>
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div className="card glass">
            <h3>Maintenance Control</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', cursor: 'pointer' }}>
              <input type="checkbox" checked={adminData?.isMaintenanceMode || false} onChange={e => updateAdminData({ isMaintenanceMode: e.target.checked })} />
              Enable Global Maintenance Banner
            </label>
            <textarea id="maintMsg" defaultValue={adminData?.maintenanceMessage || ''} className="glass" style={{ width: '100%', padding: '15px' }} rows={3} />
            <button className="btn btn-primary btn-block" style={{ marginTop: '10px' }} onClick={() => updateAdminData({ maintenanceMessage: document.getElementById('maintMsg').value })}>Update Message</button>
          </div>
        )}

        {activeTab === 'players' && (
          <div className="card glass">
             <h3>Active Players ({allPlayers.length})</h3>
             <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {allPlayers.map(p => (
                  <div key={p.id} className="player-card glass" style={{ marginBottom: '8px' }}>
                    <strong>{p.username}</strong>
                    <span style={{ fontSize: '0.8rem' }}>{p.division || 'Unassigned'}</span>
                  </div>
                ))}
             </div>
          </div>
        )}
      </div>
    </div>
  )
}
