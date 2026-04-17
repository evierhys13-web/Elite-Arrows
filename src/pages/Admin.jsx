import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { db, doc, setDoc, getDoc, deleteDoc, updateDoc } from '../firebase'
import AdminCupResults from './AdminCupResults'

export default function Admin() {
  const { user, getAllUsers, updateUser, getResults, adminData, updateAdminData, addToMoneyHistory } = useAuth()
  const navigate = useNavigate()
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
  const [pendingResults, setPendingResults] = useState([])
  const [activeTab, setActiveTab] = useState('results')
  const [showColorsForm, setShowColorsForm] = useState(false)
  const [colors, setColors] = useState({
    primary: localStorage.getItem('eliteArrowsColors') ? JSON.parse(localStorage.getItem('eliteArrowsColors')).primary : '#00d4ff',
    background: localStorage.getItem('eliteArrowsColors') ? JSON.parse(localStorage.getItem('eliteArrowsColors')).background : '#0a0a1a',
    button: localStorage.getItem('eliteArrowsColors') ? JSON.parse(localStorage.getItem('eliteArrowsColors')).button : '#00d4ff'
  })

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

  useEffect(() => {
    const results = getResults();
    const pending = results.filter(r => r.status === 'pending');
    if (user.isTournamentAdmin && !user.isAdmin) {
      setPendingResults(pending.filter(r => r.gameType === 'Tournament'));
    } else {
      setPendingResults(pending);
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
  }, [user.isAdmin, user.isTournamentAdmin]);

  const approveResult = async (resultId) => {
    const results = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]');
    const index = results.findIndex(r => r.id === resultId);
    if (index === -1) {
      alert('Result not found')
      return
    }
    
    try {
      const result = results[index]
      results[index].status = 'approved';
      localStorage.setItem('eliteArrowsResults', JSON.stringify(results));
      
      await updateDoc(doc(db, 'results', resultId), { status: 'approved' })
      
      if (result.gameType === 'Cup') {
        const cups = JSON.parse(localStorage.getItem('eliteArrowsCups') || '[]')
        const cupIndex = cups.findIndex(c => c.id === result.cupId)
        if (cupIndex !== -1) {
          const cup = cups[cupIndex]
          const matchIndex = cup.matches.findIndex(m => m.id === result.matchId)
          if (matchIndex !== -1) {
            const winnerId = result.score1 > result.score2 ? result.player1Id : result.player2Id
            cup.matches[matchIndex].winner = winnerId
            
            if (cup.matches[matchIndex].nextMatchId) {
              const nextMatchIndex = cup.matches.findIndex(m => m.id === cup.matches[matchIndex].nextMatchId)
              if (nextMatchIndex !== -1) {
                if (cup.matches[nextMatchIndex].player1 === null) {
                  cup.matches[nextMatchIndex].player1 = winnerId
                } else {
                  cup.matches[nextMatchIndex].player2 = winnerId
                }
              }
            }
            
            const allRoundsComplete = Array.from(new Set(cup.matches.map(m => m.round))).every(round => {
              return cup.matches.filter(m => m.round === round).every(m => m.winner)
            })
            
            if (allRoundsComplete) {
              cup.status = 'completed'
            } else {
              const activeRound = Array.from(new Set(cup.matches.map(m => m.round))).sort((a, b) => a - b).find(round => {
                return !cup.matches.filter(m => m.round === round).every(m => m.winner)
              })
              cup.currentRound = activeRound || cup.currentRound
            }
            
            cups[cupIndex] = cup
            localStorage.setItem('eliteArrowsCups', JSON.stringify(cups))
          }
        }
      }
      
      if (result.player1Id) {
        const p1Doc = await getDoc(doc(db, 'users', result.player1Id))
        if (p1Doc.exists()) {
          const p1Data = p1Doc.data()
          const p1Stats = p1Data.stats || { played: 0, wins: 0, losses: 0, legsWon: 0, legsLost: 0, '180s': 0, '170s': 0, highestCheckout: 0, doubleSuccess: 0 }
          p1Stats.played = (p1Stats.played || 0) + 1
          p1Stats.legsWon = (p1Stats.legsWon || 0) + result.score1
          p1Stats.legsLost = (p1Stats.legsLost || 0) + result.score2
          p1Stats['180s'] = (p1Stats['180s'] || 0) + (result.player1Stats?.['180s'] || 0)
          if ((result.player1Stats?.highestCheckout || 0) >= 170) {
            p1Stats['170s'] = (p1Stats['170s'] || 0) + 1
          }
          if ((result.player1Stats?.highestCheckout || 0) > (p1Stats.highestCheckout || 0)) {
            p1Stats.highestCheckout = result.player1Stats.highestCheckout
          }
          if (result.score1 > result.score2) {
            p1Stats.wins = (p1Stats.wins || 0) + 1
          } else if (result.score1 < result.score2) {
            p1Stats.losses = (p1Stats.losses || 0) + 1
          }
          await setDoc(doc(db, 'users', result.player1Id), { stats: p1Stats }, { merge: true })
        }
      }
      
      if (result.player2Id) {
        const p2Doc = await getDoc(doc(db, 'users', result.player2Id))
        if (p2Doc.exists()) {
          const p2Data = p2Doc.data()
          const p2Stats = p2Data.stats || { played: 0, wins: 0, losses: 0, legsWon: 0, legsLost: 0, '180s': 0, '170s': 0, highestCheckout: 0, doubleSuccess: 0 }
          p2Stats.played = (p2Stats.played || 0) + 1
          p2Stats.legsWon = (p2Stats.legsWon || 0) + result.score2
          p2Stats.legsLost = (p2Stats.legsLost || 0) + result.score1
          p2Stats['180s'] = (p2Stats['180s'] || 0) + (result.player2Stats?.['180s'] || 0)
          if ((result.player2Stats?.highestCheckout || 0) >= 170) {
            p2Stats['170s'] = (p2Stats['170s'] || 0) + 1
          }
          if ((result.player2Stats?.highestCheckout || 0) > (p2Stats.highestCheckout || 0)) {
            p2Stats.highestCheckout = result.player2Stats.highestCheckout
          }
          if (result.score2 > result.score1) {
            p2Stats.wins = (p2Stats.wins || 0) + 1
          } else if (result.score2 < result.score1) {
            p2Stats.losses = (p2Stats.losses || 0) + 1
          }
          await setDoc(doc(db, 'users', result.player2Id), { stats: p2Stats }, { merge: true })
        }
      }
      
      setPendingResults(prev => prev.filter(r => r.id !== resultId));
      alert(result.gameType === 'Cup' ? 'Result approved! Cup bracket updated.' : 'Result approved!')
    } catch (e) {
      console.error('Error approving result:', e)
      alert('Error approving result: ' + e.message)
    }
  };

  const rejectResult = (resultId) => {
    const results = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]');
    const index = results.findIndex(r => r.id === resultId);
    if (index !== -1) {
      results[index].status = 'rejected';
      localStorage.setItem('eliteArrowsResults', JSON.stringify(results));
      setPendingResults(prev => prev.filter(r => r.id !== resultId));
    }
  };

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

  const submitAdminGame = () => {
    if (!gameForm.player1 || !gameForm.player2 || !gameForm.score1 || !gameForm.score2) {
      alert('Please fill in all required fields')
      return
    }

    const player1User = getAllUsers().find(u => u.id === gameForm.player1)
    const player2User = getAllUsers().find(u => u.id === gameForm.player2)

    const results = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]')
    results.push({
      id: Date.now(),
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
      bestOf: '3',
      firstTo: '3',
      proofImage: '',
      submittedBy: 'admin',
      status: 'approved'
    })
    localStorage.setItem('eliteArrowsResults', JSON.stringify(results))

    alert('Game submitted and approved!')
    setShowSubmitGame(false)
    setGameForm({ player1: '', player2: '', score1: '', score2: '', gameType: 'Friendly', division: '' })
  }

  const pendingAdmins = getAllUsers().filter(u => u.adminRequestPending && !u.isAdmin && !u.isTournamentAdmin)
  const pendingPayments = getAllUsers().filter(u => u.paymentPending && !u.isSubscribed)
  const subscribers = getAllUsers().filter(u => u.isSubscribed)
  const freeUsers = getAllUsers().filter(u => !u.isSubscribed && !u.paymentPending)
  const tournamentAdmins = getAllUsers().filter(u => u.isTournamentAdmin)

  const ADMIN_EMAILS = ['rhyshowe2023@outlook.com', 'dhineberry@yahoo.com']
  const isEmailAdmin = ADMIN_EMAILS.includes(user?.email?.toLowerCase())
  const isDbAdmin = user?.isAdmin === true
  const canAccess = isEmailAdmin || isDbAdmin || user?.isTournamentAdmin
  
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

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Admin Panel</h1>
      </div>

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
        <div className="card">
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
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-primary" onClick={() => approveResult(result.id)}>
                    Approve
                  </button>
                  <button className="btn btn-danger" onClick={() => rejectResult(result.id)}>
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
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
              <label>Player 1</label>
              <select 
                value={gameForm.player1}
                onChange={(e) => {
                  const selected = getAllUsers().find(u => u.id === e.target.value)
                  setGameForm({...gameForm, player1: e.target.value, division: selected?.division || ''})
                }}
              >
                <option value="">Select player</option>
                {getAllUsers().map(u => (
                  <option key={u.id} value={u.id}>{u.username} ({u.division})</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Player 2</label>
              <select 
                value={gameForm.player2}
                onChange={(e) => setGameForm({...gameForm, player2: e.target.value})}
              >
                <option value="">Select player</option>
                {getAllUsers().filter(u => u.id !== gameForm.player1).map(u => (
                  <option key={u.id} value={u.id}>{u.username} ({u.division})</option>
                ))}
              </select>
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
              <option value="Gold">Gold</option>
              <option value="Silver">Silver</option>
              <option value="Bronze">Bronze</option>
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
              const supportRequests = JSON.parse(localStorage.getItem('eliteArrowsSupportRequests') || '[]')
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
                    style={{ marginTop: '8px' }}
                    onClick={() => {
                      const all = JSON.parse(localStorage.getItem('eliteArrowsSupportRequests') || '[]')
                      const idx = all.findIndex(r => r.id === request.id)
                      if (idx !== -1) {
                        all[idx].status = 'resolved'
                        localStorage.setItem('eliteArrowsSupportRequests', JSON.stringify(all))
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
            <select 
              id="assignDivisionUser"
              style={{ width: '100%', padding: '12px', marginBottom: '12px' }}
            >
              <option value="">Select user</option>
              {getAllUsers().map(u => (
                <option key={u.id} value={u.id}>{u.username} - {u.division || 'Unassigned'}</option>
              ))}
            </select>
            
            <select 
              id="assignDivision"
              style={{ width: '100%', padding: '12px', marginBottom: '12px' }}
            >
              <option value="">Select Division</option>
              <option value="Unassigned">Unassigned</option>
              <option value="Elite">Elite</option>
              <option value="Diamond">Diamond</option>
              <option value="Gold">Gold</option>
              <option value="Silver">Silver</option>
              <option value="Bronze">Bronze</option>
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
                const userId = document.getElementById('assignDivisionUser').value
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
                
                // Update local state
                users[index] = { ...users[index], ...cleanUpdates }
                localStorage.setItem('eliteArrowsUsers', JSON.stringify(users))
                
                // Update Firestore
                await setDoc(doc(db, 'users', userId), cleanUpdates, { merge: true })
                
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
            <select 
              style={{ width: '100%', padding: '12px', marginBottom: '12px' }}
              onChange={(e) => {
                if (!e.target.value) return
                if (!confirm('Are you sure you want to remove this subscription?')) return
                const users = getAllUsers()
                const index = users.findIndex(u => u.id === e.target.value)
                if (index !== -1) {
                  users[index].isSubscribed = false
                  users[index].freeAdminSubscription = false
                  localStorage.setItem('eliteArrowsUsers', JSON.stringify(users))
                  alert('Subscription removed')
                  e.target.value = ''
                }
              }}
            >
              <option value="">Select user to remove subscription</option>
              {getAllUsers().filter(u => u.isSubscribed).map(u => (
                <option key={u.id} value={u.id}>{u.username} ({u.email})</option>
              ))}
            </select>
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
                  {u.id !== user.id && (
                    <button 
                      className="btn btn-danger btn-sm"
                      style={{ marginTop: '5px' }}
                      onClick={async () => {
                        if (confirm(`Remove ${u.username} from the league entirely?`)) {
                          const userIdToDelete = u.id
                          await deleteDoc(doc(db, 'users', userIdToDelete))
                          setUsersList(prev => prev.filter(us => us.id !== userIdToDelete))
                          setTimeout(() => setUsersList(prev => prev.filter(us => us.id !== userIdToDelete)), 500)
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
              const seasons = JSON.parse(localStorage.getItem('eliteArrowsSeasons') || '[]')
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
              <button className="btn btn-primary" onClick={() => {
                const name = prompt('Enter season name:')
                if (name) {
                  const startDate = prompt('Enter start date (YYYY-MM-DD):', '2025-05-01')
                  const endDate = prompt('Enter end date (YYYY-MM-DD):', '2025-06-01')
                  if (startDate && endDate) {
                    const seasons = JSON.parse(localStorage.getItem('eliteArrowsSeasons') || '[]')
                    const newSeason = { id: Date.now(), name, createdAt: new Date().toISOString(), status: 'active', isArchived: false, startDate, endDate }
                    seasons.push(newSeason)
                    localStorage.setItem('eliteArrowsSeasons', JSON.stringify(seasons))
                    localStorage.setItem('eliteArrowsCurrentSeason', name)
                    alert(`Season "${name}" created! (${startDate} - ${endDate})`)
                  }
                }
              }}>Create New Season</button>
            </div>

            {(() => {
              const seasons = JSON.parse(localStorage.getItem('eliteArrowsSeasons') || '[]')
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
                                alert(`Active season changed to "${s.name}"`)
                              }}>Set Active</button>
                            )}
                            <button className="btn btn-danger btn-sm" onClick={() => {
                              if (confirm('Archive this season?')) {
                                const updated = seasons.map(season => season.id === s.id ? { ...season, isArchived: true, status: 'archived' } : season)
                                localStorage.setItem('eliteArrowsSeasons', JSON.stringify(updated))
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
                          <button className="btn btn-secondary btn-sm" onClick={() => {
                            const updated = seasons.map(season => season.id === s.id ? { ...season, isArchived: false, status: 'active' } : { ...season, status: 'archived' })
                            localStorage.setItem('eliteArrowsSeasons', JSON.stringify(updated))
                            localStorage.setItem('eliteArrowsCurrentSeason', s.name)
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
              Clear all results for the current season.
            </p>
            <button className="btn btn-danger" onClick={() => {
              const currentSeason = localStorage.getItem('eliteArrowsCurrentSeason') || new Date().getFullYear().toString()
              if (confirm(`Reset all results for "${currentSeason}" season?`)) {
                const results = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]')
                const filtered = results.filter(r => r.season !== currentSeason)
                localStorage.setItem('eliteArrowsResults', JSON.stringify(filtered))
                alert('Table reset!')
              }
            }}>Reset Current Season Table</button>
          </div>

          <div className="card">
            <h3 className="card-title">Move Player Between Divisions</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <select 
                id="movePlayerDivision"
                style={{ flex: 1, minWidth: '150px' }}
                onChange={(e) => {
                  if (!e.target.value) return
                  const division = prompt('Enter new division (Elite, Diamond, Gold, Silver, Bronze):')
                  if (division && ['Elite', 'Diamond', 'Gold', 'Silver', 'Bronze'].includes(division)) {
                    const users = getAllUsers()
                    const index = users.findIndex(u => u.id === e.target.value)
                    if (index !== -1) {
                      users[index].division = division
                      localStorage.setItem('eliteArrowsUsers', JSON.stringify(users))
                      alert(`${users[index].username} moved to ${division}`)
                      e.target.value = ''
                    }
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
              onClick={() => {
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
                  users[index].eliteTokens = (users[index].eliteTokens || 0) + (action === 'add' ? amount : -amount)
                  localStorage.setItem('eliteArrowsUsers', JSON.stringify(users))
                  alert(`${action === 'add' ? 'Added' : 'Removed'} ${amount} tokens ${action === 'add' ? 'to' : 'from'} ${users[index].username}`)
                  document.getElementById('tokenPlayerSelect').value = ''
                  document.getElementById('tokenAmount').value = 0
                }
              }}
            >
              Update Tokens
            </button>
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

          <div className="card" style={{ marginTop: '20px' }}>
            <h3 className="card-title" style={{ marginBottom: '15px' }}>Manual Cup Result Entry</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
              Manually enter results for cup matches
            </p>
            <AdminCupResults />
          </div>

          <div className="card" style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 className="card-title" style={{ margin: 0 }}>Money Pot History</h3>
              <button 
                className="btn btn-danger"
                onClick={() => {
                  if (confirm('Are you sure you want to reset all money history? This cannot be undone.')) {
                    localStorage.setItem('eliteArrowsMoneyHistory', JSON.stringify([]))
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
        </div>
      )}
    </div>
  )
}