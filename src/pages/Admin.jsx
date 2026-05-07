import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { db, doc, setDoc, getDocs, collection, deleteDoc } from '../firebase'
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
    getSeasons,
    getNews,
    postNews,
    deleteNews,
    togglePinNews,
    adminData,
    updateAdminData,
    addToMoneyHistory,
    updateOtherUser,
    triggerDataRefresh,
    dataRefreshTrigger
  } = useAuth()

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState('results')
  const [refreshKey, setRefreshKey] = useState(0)
  const [isApproving, setIsApproving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  // Form states
  const [gameForm, setGameForm] = useState({ player1: '', player2: '', score1: '', score2: '', gameType: 'Friendly', division: '' })
  const [tokenForm, setTokenForm] = useState({ player: '', amount: 0, action: 'add' })
  const [seasonForm, setSeasonForm] = useState({ name: '', startDate: '2025-05-01', endDate: '2025-06-01' })

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

  const showSuccess = (msg) => {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(''), 1800)
  }

  const approveResult = async (resultId) => {
    if (isApproving) return
    setIsApproving(true)
    try {
      const res = allResults.find(r => String(r.id) === String(resultId))
      if (!res) throw new Error('Result not found')
      await setDoc(doc(db, 'results', String(resultId)), { ...res, status: 'approved', approvedAt: new Date().toISOString() }, { merge: true })
      triggerDataRefresh('results')
      showSuccess('Result Approved!')
    } catch (e) { alert(e.message) }
    setIsApproving(false)
  }

  const rejectResult = async (resultId) => {
    try {
      const res = allResults.find(r => String(r.id) === String(resultId))
      if (!res) throw new Error('Result not found')
      await setDoc(doc(db, 'results', String(resultId)), { ...res, status: 'rejected', updatedAt: new Date().toISOString() }, { merge: true })
      triggerDataRefresh('results')
      showSuccess('Result Rejected')
    } catch (e) { alert(e.message) }
  }

  const approvePayment = async (userId) => {
    try {
      const target = allPlayers.find(u => u.id === userId)
      if (!target) return
      await setDoc(doc(db, 'users', userId), { isSubscribed: true, paymentPending: false, subscriptionDate: new Date().toISOString() }, { merge: true })

      const amount = 5
      await updateAdminData({ subscriptionPot: subscriptionPot + amount })
      addToMoneyHistory('subscription', amount, `Payment from ${target.username}`)

      triggerDataRefresh('users')
      alert('Payment Approved!')
    } catch (e) { alert(e.message) }
  }

  const tabs = [
    { id: 'results', label: 'Scores', count: pendingResults.length },
    { id: 'payments', label: 'Payments', count: pendingPayments.length },
    { id: 'moneypot', label: 'Finances' },
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
          <div className="card glass" style={{ border: '2px solid var(--success)', padding: '40px', textAlign: 'center', maxWidth: '400px' }}>
            <h2 style={{ color: 'var(--success)', marginBottom: '10px' }}>Success</h2>
            <p>{successMessage}</p>
          </div>
        </div>
      )}

      <div className="page-header" style={{ marginBottom: '20px' }}>
        <h1 className="page-title text-gradient" style={{ fontSize: '2rem' }}>Admin Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Welcome, {user.username}</p>
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
        {activeTab === 'results' && (
          <div className="card glass">
            <h3 style={{ marginBottom: '20px' }}>Pending Score Approvals</h3>
            {pendingResults.length === 0 ? <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No scores pending review.</p> :
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {pendingResults.map(r => (
                  <div key={r.id} className="glass" style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontWeight: 700 }}>{r.player1} <span style={{ color: 'var(--accent-cyan)' }}>vs</span> {r.player2}</span>
                      <span style={{ fontWeight: 900, color: 'var(--accent-cyan)' }}>{r.score1}-{r.score2}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '10px' }}>{r.gameType} | {r.date}</div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button className="btn btn-primary btn-sm btn-block" onClick={() => approveResult(r.id)} disabled={isApproving}>Approve</button>
                      <button className="btn btn-danger btn-sm btn-block" onClick={() => rejectResult(r.id)}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="card glass">
            <h3 style={{ marginBottom: '20px' }}>Subscription Approvals</h3>
            {pendingPayments.length === 0 ? <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No payments to review.</p> :
              pendingPayments.map(u => (
                <div key={u.id} className="player-card glass" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{u.username}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => approvePayment(u.id)}>Approve £5</button>
                </div>
              ))
            }
          </div>
        )}

        {activeTab === 'moneypot' && (
          <div className="card glass">
            <h3>League Pot Control</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '20px' }}>
               <div style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Standard (£5)</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--accent-cyan)' }}>£{subscriptionPot.toFixed(2)}</div>
               </div>
               <div style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Premium (£10)</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fbbf24' }}>£{subscriptionPot10.toFixed(2)}</div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'cups' && <CupManagement />}

        {activeTab === 'players' && (
          <div className="card glass">
            <h3 style={{ marginBottom: '20px' }}>League Members ({allPlayers.length})</h3>
            <div style={{ maxHeight: '500px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {allPlayers.map(p => (
                <div key={p.id} className="player-card glass" style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.username}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', fontWeight: 800 }}>{p.division || 'Unassigned'}</div>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/profile/${p.id}`)}>View</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'news' && (
          <div className="card glass">
            <h3 style={{ marginBottom: '20px' }}>Global Announcements</h3>
            <textarea id="newsContent" className="glass" placeholder="Write message..." rows={4} style={{ width: '100%', padding: '15px', borderRadius: '12px', marginBottom: '12px' }} />
            <button className="btn btn-primary btn-block" onClick={async () => {
              const msg = document.getElementById('newsContent').value
              if (msg) {
                await postNews("Notice", msg, true)
                document.getElementById('newsContent').value = ''
                alert('Published to everyone!')
              }
            }}>Publish Notice</button>

            <div style={{ marginTop: '30px' }}>
               <h4>Past Posts</h4>
               {getNews().map(item => (
                 <div key={item.id} style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.85rem' }}>{item.title} - {new Date(item.createdAt).toLocaleDateString()}</div>
                    <button className="btn btn-danger btn-sm" style={{ padding: '2px 8px' }} onClick={() => deleteNews(item.id)}>Del</button>
                 </div>
               ))}
            </div>
          </div>
        )}

        {activeTab === 'admins' && (
          <div className="card glass">
            <h3>Staff & Admins</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
               {allPlayers.filter(u => u.isAdmin || u.isTournamentAdmin || u.isCupAdmin).map(u => (
                 <div key={u.id} className="glass" style={{ padding: '12px', borderRadius: '10px' }}>
                    <div style={{ fontWeight: 700 }}>{u.username}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)' }}>
                       {u.isAdmin && '[SUPER ADMIN] '}
                       {u.isTournamentAdmin && '[TOURNAMENT] '}
                       {u.isCupAdmin && '[CUP ADMIN] '}
                    </div>
                 </div>
               ))}
            </div>
          </div>
        )}

        {activeTab === 'seasons' && (
          <div className="card glass">
            <h3>Season Management</h3>
            <div style={{ marginBottom: '20px', padding: '15px', background: 'var(--accent-cyan)', color: 'black', borderRadius: '8px', fontWeight: 800, textAlign: 'center' }}>
               CURRENT: {localStorage.getItem('eliteArrowsCurrentSeason') || 'Season 1'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
               {getSeasons().map(s => (
                 <div key={s.id} className="glass" style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{s.name}</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => { localStorage.setItem('eliteArrowsCurrentSeason', s.name); alert('Active season changed'); window.location.reload(); }}>Set Active</button>
                 </div>
               ))}
            </div>
          </div>
        )}

        {activeTab === 'tokens' && (
          <div className="card glass">
            <h3>Elite Token Control</h3>
            <UserSearchSelect users={allPlayers} selectedId={tokenForm.player} onSelect={id => setTokenForm({...tokenForm, player: id})} label="Select Player" />
            <input type="number" className="glass" style={{ width: '100%', marginTop: '15px', padding: '12px' }} placeholder="Amount" onChange={e => setTokenForm({...tokenForm, amount: parseInt(e.target.value)})} />
            <button className="btn btn-primary btn-block" style={{ marginTop: '15px' }} onClick={async () => {
               if (!tokenForm.player || !tokenForm.amount) return alert('Fill fields')
               const target = allPlayers.find(u => u.id === tokenForm.player)
               const next = (target.eliteTokens || 0) + tokenForm.amount
               await updateOtherUser(tokenForm.player, { eliteTokens: next })
               alert('Tokens added!')
            }}>Grant Tokens</button>
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div className="card glass">
            <h3>System Status</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', cursor: 'pointer' }}>
              <input type="checkbox" checked={adminData?.isMaintenanceMode || false} onChange={e => updateAdminData({ isMaintenanceMode: e.target.checked })} />
              <span style={{ fontWeight: 600 }}>Enable Maintenance Banner</span>
            </label>
            <textarea className="glass" style={{ width: '100%', padding: '15px', borderRadius: '12px', marginBottom: '10px' }} rows={3} placeholder="Message..." defaultValue={adminData?.maintenanceMessage || ''} id="maintInput" />
            <button className="btn btn-primary btn-block" onClick={() => updateAdminData({ maintenanceMessage: document.getElementById('maintInput').value })}>Update Global Message</button>
          </div>
        )}
      </div>
    </div>
  )
}
