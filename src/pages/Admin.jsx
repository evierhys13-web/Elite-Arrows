import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { db, doc, setDoc, getDoc, getDocs, collection, deleteDoc, updateDoc } from '../firebase'
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
  const [resultFilter, setResultFilter] = useState('pending')

  // Form states
  const [gameForm, setGameForm] = useState({ player1: '', player2: '', score1: '', score2: '', gameType: 'Friendly', division: '' })
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

  // --- Handlers ---

  const handleApproveResult = async (resultId) => {
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

  const handleRejectResult = async (resultId) => {
    try {
      const res = allResults.find(r => String(r.id) === String(resultId))
      if (!res) throw new Error('Result not found')
      await setDoc(doc(db, 'results', String(resultId)), { ...res, status: 'rejected', updatedAt: new Date().toISOString() }, { merge: true })
      triggerDataRefresh('results')
      showSuccess('Result Rejected')
    } catch (e) { alert(e.message) }
  }

  const handleDeleteResult = async (resultId) => {
    if (!window.confirm('Permanently delete this result?')) return
    try {
      await deleteDoc(doc(db, 'results', String(resultId)))
      triggerDataRefresh('results')
      alert('Result Deleted')
    } catch (e) { alert(e.message) }
  }

  const handleAdminSubmitGame = async () => {
    const f = adminGameForm
    if (!f.player1 || !f.player2) return alert('Select both players.')
    if (!f.score1 || !f.score2) return alert('Enter both scores.')
    const s1 = parseInt(f.score1); const s2 = parseInt(f.score2)
    if (isNaN(s1) || isNaN(s2)) return alert('Invalid scores.')

    const p1 = allPlayers.find(u => String(u.id) === String(f.player1))
    const p2 = allPlayers.find(u => String(u.id) === String(f.player2))
    if (!p1 || !p2) return alert('Players not found.')

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
      setAdminGameForm({ player1: '', player2: '', score1: '', score2: '', gameType: 'Friendly', p1_180s: '', p2_180s: '', p1_checkout: '', p2_checkout: '', p1_doubles: '', p2_doubles: '' })
      triggerDataRefresh('results')
      showSuccess('Game submitted!')
    } catch (e) { alert('Error: ' + e.message) }
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

      triggerDataRefresh('users')
      showSuccess('Subscription Approved!')
    } catch (e) { alert(e.message) }
  }

  const handleGrantSubscription = async () => {
    if (!grantSubForm.player) return alert('Select a player')
    try {
      const target = allPlayers.find(p => p.id === grantSubForm.player)
      await setDoc(doc(db, 'users', target.id), {
        isSubscribed: true,
        subscriptionDate: new Date().toISOString(),
        subscriptionTier: grantSubForm.tier
      }, { merge: true })
      triggerDataRefresh('users')
      alert(`Granted ${grantSubForm.tier} subscription to ${target.username}`)
    } catch (e) { alert(e.message) }
  }

  const handleUpdateAdminRole = async (targetId, role, value) => {
    try {
      await setDoc(doc(db, 'users', targetId), { [role]: value }, { merge: true })
      triggerDataRefresh('users')
      alert('Permissions updated')
    } catch (e) { alert(e.message) }
  }

  const handleCreateSeason = async () => {
    if (!seasonForm.name) return alert('Name required')
    try {
      const id = Date.now().toString()
      await setDoc(doc(db, 'seasons', id), { ...seasonForm, id, createdAt: new Date().toISOString(), status: 'active' })
      triggerDataRefresh('seasons')
      alert('Season Created!')
    } catch (e) { alert(e.message) }
  }

  const handleAdjustPot = async (tier) => {
    const amount = tier === 'standard' ? potAdjust.standard : potAdjust.premium
    const key = tier === 'standard' ? 'subscriptionPot' : 'subscriptionPot10'
    const current = tier === 'standard' ? subscriptionPot : subscriptionPot10
    try {
      await updateAdminData({ [key]: current + amount })
      addToMoneyHistory('adjustment', amount, `Manual pot adjustment (${tier})`)
      alert('Pot adjusted')
      setPotAdjust({ ...potAdjust, [tier]: 0 })
    } catch (e) { alert(e.message) }
  }

  const handleAwardTrophy = async () => {
    if (!trophyForm.player || !trophyForm.name) return alert('Player and Trophy Name required')
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

      triggerDataRefresh('users')
      alert(`Awarded "${trophyForm.name}" to ${target.username}`)
      setTrophyForm({ ...trophyForm, name: '', icon: '🏆' })
    } catch (e) { alert(e.message) }
  }

  const tabs = [
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

        {/* TAB: RESULTS */}
        {activeTab === 'results' && (
          <div className="card glass">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
              <h3>Match History & Review</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className={`btn btn-sm ${showSubmitGame ? 'btn-success' : 'btn-secondary'}`} onClick={() => setShowSubmitGame(!showSubmitGame)}>
                  {showSubmitGame ? 'Close' : '+ Submit Game'}
                </button>
                {['pending', 'approved', 'rejected'].map(f => (
                  <button key={f} className={`btn btn-sm ${resultFilter === f ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setResultFilter(f)}>{f.toUpperCase()}</button>
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
                <div key={r.id} className="result-item glass" style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)' }}>
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
              ))}
              {allResults.length === 0 && <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No results found in this category.</p>}
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
                  <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/profile/${p.id}`)}>View</button>
                </div>
              ))}
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
                  const current = target.eliteTokens || 0
                  const next = tokenForm.action === 'add' ? current + tokenForm.amount : Math.max(0, current - tokenForm.amount)
                  await setDoc(doc(db, 'users', tokenForm.player), { eliteTokens: next }, { merge: true })
                  triggerDataRefresh('users')
                  alert('Tokens updated')
               }}>Update Token Balance</button>
            </div>
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div className="card glass">
            <h3>System Status & Broadcast</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', cursor: 'pointer' }}>
              <input type="checkbox" checked={adminData?.isMaintenanceMode || false} onChange={e => updateAdminData({ isMaintenanceMode: e.target.checked })} />
              <span style={{ fontWeight: 600 }}>Global Maintenance Lock</span>
            </label>
            <textarea className="glass" style={{ width: '100%', padding: '15px', borderRadius: '12px', marginBottom: '10px' }} rows={3} placeholder="Banner message..." defaultValue={adminData?.maintenanceMessage || ''} id="maintMsgInput" />
            <button className="btn btn-primary btn-block" onClick={() => updateAdminData({ maintenanceMessage: document.getElementById('maintMsgInput').value })}>Broadcast Update</button>
          </div>
        )}

      </div>
    </div>
  )
}
