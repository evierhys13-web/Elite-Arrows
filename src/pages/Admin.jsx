import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { db, doc, setDoc, getDocs, collection } from '../firebase'
import UserSearchSelect from '../components/UserSearchSelect'
import CupManagement from './CupManagement'

const ADMIN_EMAILS = ['rhyshowe2023@outlook.com', 'dhineberry@yahoo.com']

export default function Admin() {
  const {
    user,
    loading: authLoading,
    notifications,
    getAllUsers,
    getResults,
    getFixtures,
    getCups,
    getNews,
    postNews,
    deleteNews,
    adminData,
    updateAdminData,
    triggerDataRefresh,
    dataRefreshTrigger
  } = useAuth()

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState('results')
  const [refreshKey, setRefreshKey] = useState(0)
  const [isApproving, setIsApproving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  // UI State for forms
  const [gameForm, setGameForm] = useState({ player1: '', player2: '', score1: '', score2: '', gameType: 'Friendly', division: '' })

  // Critical Guard: wait for auth and identify permissions
  if (authLoading) return <div className="page glass"><div style={{ padding: '60px', textAlign: 'center', color: 'var(--accent-cyan)', fontWeight: 800 }}>Authenticating Admin Access...</div></div>
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

  // Data Selectors
  const allPlayers = getAllUsers() || []
  const allResults = getResults() || []
  const pendingResults = allResults.filter(r => String(r.status).toLowerCase() === 'pending')
  const pendingPayments = allPlayers.filter(u => u?.paymentPending && !u?.isSubscribed)

  const subscriptionPot = adminData?.subscriptionPot || 0
  const subscriptionPot10 = adminData?.subscriptionPot10 || 0

  useEffect(() => {
    const tab = searchParams.get('tab')
    const allowed = ['results', 'payments', 'moneypot', 'cups', 'players', 'news', 'admins', 'seasons', 'tokens', 'maintenance']
    if (tab && allowed.includes(tab)) setActiveTab(tab)
  }, [searchParams])

  useEffect(() => {
    setRefreshKey(prev => prev + 1)
  }, [dataRefreshTrigger])

  const approveResult = async (resultId) => {
    if (isApproving) return
    setIsApproving(true)
    try {
      const res = allResults.find(r => String(r.id) === String(resultId))
      if (!res) throw new Error('Result not found')
      await setDoc(doc(db, 'results', String(resultId)), { ...res, status: 'approved', approvedAt: new Date().toISOString() }, { merge: true })
      triggerDataRefresh('results')
      setSuccessMessage('Result Approved')
      setTimeout(() => setSuccessMessage(''), 1800)
    } catch (e) { alert(e.message) }
    setIsApproving(false)
  }

  const rejectResult = async (resultId) => {
    try {
      const res = allResults.find(r => String(r.id) === String(resultId))
      if (!res) throw new Error('Result not found')
      await setDoc(doc(db, 'results', String(resultId)), { ...res, status: 'rejected', updatedAt: new Date().toISOString() }, { merge: true })
      triggerDataRefresh('results')
      setSuccessMessage('Result Rejected')
      setTimeout(() => setSuccessMessage(''), 1800)
    } catch (e) { alert(e.message) }
  }

  const approvePayment = async (userId) => {
    try {
      const target = allPlayers.find(u => u.id === userId)
      if (!target) return
      await setDoc(doc(db, 'users', userId), { isSubscribed: true, paymentPending: false, subscriptionDate: new Date().toISOString() }, { merge: true })
      triggerDataRefresh('users')
      alert('Payment Approved!')
    } catch (e) { alert(e.message) }
  }

  const tabs = [
    { id: 'results', label: 'Scores', count: pendingResults.length },
    { id: 'payments', label: 'Payments', count: pendingPayments.length },
    { id: 'moneypot', label: 'Pot' },
    { id: 'cups', label: 'Cups' },
    { id: 'players', label: 'Players' },
    { id: 'news', label: 'News' },
    { id: 'admins', label: 'Staff' },
    { id: 'seasons', label: 'Seasons' },
    { id: 'tokens', label: 'Tokens' },
    { id: 'maintenance', label: 'System' }
  ]

  return (
    <div className="page animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {successMessage && (
        <div className="modal-overlay" style={{ zIndex: 11000 }}>
          <div className="card glass" style={{ border: '2px solid var(--success)', padding: '40px', textAlign: 'center' }}>
            <h2 style={{ color: 'var(--success)', marginBottom: '10px' }}>Success</h2>
            <p>{successMessage}</p>
          </div>
        </div>
      )}

      <div className="page-header" style={{ marginBottom: '20px' }}>
        <h1 className="page-title text-gradient" style={{ fontSize: '2rem' }}>Admin Control</h1>
      </div>

      {/* Modern Stats Bar */}
      <div style={{
        display: 'flex',
        overflowX: 'auto',
        gap: '12px',
        marginBottom: '24px',
        paddingBottom: '10px',
        scrollbarWidth: 'none'
      }}>
        <div className="stat-card glass" style={{ minWidth: '140px', padding: '15px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>Pending</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--accent-cyan)' }}>{pendingResults.length}</div>
        </div>
        <div className="stat-card glass" style={{ minWidth: '140px', padding: '15px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>Payments</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--warning)' }}>{pendingPayments.length}</div>
        </div>
        <div className="stat-card glass" style={{ minWidth: '140px', padding: '15px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>Total Pot</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--success)' }}>£{(subscriptionPot + subscriptionPot10).toFixed(0)}</div>
        </div>
      </div>

      {/* Tabs Row */}
      <div style={{
        display: 'flex',
        overflowX: 'auto',
        gap: '8px',
        marginBottom: '24px',
        paddingBottom: '10px',
        scrollbarWidth: 'none'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`division-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            style={{ whiteSpace: 'nowrap', padding: '10px 20px', fontSize: '0.8rem' }}
          >
            {tab.label}
            {tab.count > 0 && <span style={{ marginLeft: '6px', background: 'white', color: 'black', padding: '1px 5px', borderRadius: '10px', fontSize: '0.6rem', fontWeight: 900 }}>{tab.count}</span>}
          </button>
        ))}
      </div>

      <div className="admin-view">
        {activeTab === 'results' && (
          <div className="card glass">
            <h3>Match Submissions</h3>
            {pendingResults.length === 0 ? <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No results pending review.</p> :
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                {pendingResults.map(r => (
                  <div key={r.id} className="glass" style={{ padding: '15px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontWeight: 700 }}>{r.player1} vs {r.player2}</span>
                      <span style={{ fontWeight: 900, color: 'var(--accent-cyan)' }}>{r.score1}-{r.score2}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-primary btn-sm btn-block" onClick={() => approveResult(r.id)} disabled={isApproving}>Approve</button>
                      <button className="btn btn-danger btn-sm btn-block" onClick={() => rejectResult(r.id)}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
        )}

        {activeTab === 'moneypot' && (
          <div className="card glass">
            <h3>League Finances</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
              <div style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '5px' }}>Standard (£5)</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--accent-cyan)' }}>£{subscriptionPot.toFixed(2)}</div>
              </div>
              <div style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '5px' }}>Premium (£10)</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fbbf24' }}>£{subscriptionPot10.toFixed(2)}</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cups' && <CupManagement />}

        {activeTab === 'maintenance' && (
          <div className="card glass">
            <h3>System Status</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', cursor: 'pointer' }}>
              <input type="checkbox" checked={adminData?.isMaintenanceMode || false} onChange={e => updateAdminData({ isMaintenanceMode: e.target.checked })} />
              <span style={{ fontWeight: 600 }}>Maintenance Mode Banner</span>
            </label>
            <textarea className="glass" style={{ width: '100%', padding: '15px', borderRadius: '12px', marginBottom: '10px' }} rows={3} placeholder="Maintenance message..." defaultValue={adminData?.maintenanceMessage || ''} id="maintInput" />
            <button className="btn btn-primary btn-block" onClick={() => updateAdminData({ maintenanceMessage: document.getElementById('maintInput').value })}>Save Message</button>
          </div>
        )}

        {/* Fallback for complex management tabs */}
        {['players', 'news', 'admins', 'seasons', 'tokens', 'payments'].includes(activeTab) && (
          <div className="card glass">
            <h3>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Control</h3>
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>This section is being optimized for mobile. Please use desktop for full access or check back shortly.</p>
            {activeTab === 'players' && <div style={{ maxHeight: '300px', overflowY: 'auto' }}>{allPlayers.map(p => <div key={p.id} style={{ padding: '10px', borderBottom: '1px solid var(--border)' }}>{p.username} ({p.division})</div>)}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
