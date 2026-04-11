import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { db, doc, setDoc } from '../firebase'

export default function Admin() {
  const { user, getAllUsers, updateUser } = useAuth()
  const navigate = useNavigate()
  const [pendingResults, setPendingResults] = useState([])
  const [activeTab, setActiveTab] = useState('results')
  const [showTournamentForm, setShowTournamentForm] = useState(false)
  const [showColorsForm, setShowColorsForm] = useState(false)
  const [tournamentForm, setTournamentForm] = useState({ 
    name: '', type: 'knockout', divisions: [], entryFee: 0,
    isCashBased: false, prizeInfo: '', maxParticipants: 16,
    entryDeadline: '', daysBetweenRounds: 3,
    formatR1: '3', formatR2: '3', formatQF: '3', formatSF: '5', formatF: '7'
  })
  const [colors, setColors] = useState(() => JSON.parse(localStorage.getItem('eliteArrowsColors') || '{"primary": "#4da8da", "background": "#0a1628", "button": "#4da8da"}'))
  const [subscriptionPot, setSubscriptionPot] = useState(() => parseFloat(localStorage.getItem('eliteArrowsSubscriptionPot') || '0'))
  const [tournamentPot, setTournamentPot] = useState(() => parseFloat(localStorage.getItem('eliteArrowsTournamentPot') || '0'))
  const [showSubmitGame, setShowSubmitGame] = useState(false)
  const [gameForm, setGameForm] = useState({
    player1: '',
    player2: '',
    score1: '',
    score2: '',
    gameType: 'Friendly',
    division: ''
  })

  useEffect(() => {
    const results = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]');
    const pending = results.filter(r => r.status === 'pending');
    if (user.isTournamentAdmin && !user.isAdmin) {
      setPendingResults(pending.filter(r => r.gameType === 'Tournament'));
    } else {
      setPendingResults(pending);
    }

    if (user?.isAdmin && !localStorage.getItem('eliteArrowsCurrentSeason')) {
      const seasons = JSON.parse(localStorage.getItem('eliteArrowsSeasons') || '[]')
      if (seasons.length === 0) {
        const defaultSeason = { id: Date.now(), name: 'Season 1', createdAt: new Date().toISOString(), status: 'active', isArchived: false, startDate: '2026-05-01', endDate: '2026-06-01' }
        seasons.push(defaultSeason)
        localStorage.setItem('eliteArrowsSeasons', JSON.stringify(seasons))
        localStorage.setItem('eliteArrowsCurrentSeason', 'Season 1')
      }
    }
  }, [user.isAdmin, user.isTournamentAdmin]);

  const approveResult = (resultId) => {
    const results = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]');
    const index = results.findIndex(r => r.id === resultId);
    if (index !== -1) {
      results[index].status = 'approved';
      localStorage.setItem('eliteArrowsResults', JSON.stringify(results));
      setPendingResults(prev => prev.filter(r => r.id !== resultId));
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

  const approvePayment = (userId) => {
    const users = getAllUsers()
    const index = users.findIndex(u => u.id === userId)
    if (index !== -1) {
      users[index].isSubscribed = true
      users[index].paymentPending = false
      localStorage.setItem('eliteArrowsUsers', JSON.stringify(users))
      const newPot = subscriptionPot + 5
      setSubscriptionPot(newPot)
      localStorage.setItem('eliteArrowsSubscriptionPot', newPot.toString())
      addToMoneyHistory('subscription', 5, `Payment from ${users[index].username}`)
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

  const addToMoneyHistory = (type, amount, description) => {
    const history = JSON.parse(localStorage.getItem('eliteArrowsMoneyHistory') || '[]')
    history.push({
      date: new Date().toISOString(),
      type,
      amount,
      description
    })
    localStorage.setItem('eliteArrowsMoneyHistory', JSON.stringify(history))
  }

  const submitAdminGame = () => {
    if (!gameForm.player1 || !gameForm.player2 || !gameForm.score1 || !gameForm.score2) {
      alert('Please fill in all required fields')
      return
    }

    const player1User = allUsers.find(u => u.id === gameForm.player1)
    const player2User = allUsers.find(u => u.id === gameForm.player2)

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

  const allUsers = getAllUsers()
  const pendingAdmins = allUsers.filter(u => u.adminRequestPending && !u.isAdmin && !u.isTournamentAdmin)
  const pendingPayments = allUsers.filter(u => u.paymentPending && !u.isSubscribed)
  const subscribers = allUsers.filter(u => u.isSubscribed)
  const freeUsers = allUsers.filter(u => !u.isSubscribed && !u.paymentPending)
  const tournamentAdmins = allUsers.filter(u => u.isTournamentAdmin)

  if (!user.isAdmin && !user.isTournamentAdmin) {
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

  const isFullAdmin = user.isAdmin

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
          className={`division-tab ${activeTab === 'tournaments' ? 'active' : ''}`}
          onClick={() => setActiveTab('tournaments')}
        >
          Tournaments
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
                  const selected = allUsers.find(u => u.id === e.target.value)
                  setGameForm({...gameForm, player1: e.target.value, division: selected?.division || ''})
                }}
              >
                <option value="">Select player</option>
                {allUsers.map(u => (
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
                {allUsers.filter(u => u.id !== gameForm.player1).map(u => (
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
                  onClick={() => {
                    const users = getAllUsers()
                    const index = users.findIndex(us => us.id === u.id)
                    if (index !== -1) {
                      users[index].isSubscribed = true
                      users[index].freeAdminSubscription = true
                      localStorage.setItem('eliteArrowsUsers', JSON.stringify(users))
                      alert(`${u.username} now has free subscription (admin granted)`)
                    }
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
          {allUsers.length === 0 ? (
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
                {allUsers.map(player => (
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
        <div>
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="card-title">Grant Free Admin Subscription</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
              Give a user free subscription (admin granted)
            </p>
            <select 
              id="grantFreeSub"
              style={{ width: '100%', padding: '12px', marginBottom: '12px' }}
              onChange={(e) => {
                if (!e.target.value) return
                const users = getAllUsers()
                const index = users.findIndex(u => u.id === e.target.value)
                if (index !== -1) {
                  users[index].isSubscribed = true
                  users[index].freeAdminSubscription = true
                  localStorage.setItem('eliteArrowsUsers', JSON.stringify(users))
                  alert('Free subscription granted!')
                  e.target.value = ''
                }
              }}
            >
              <option value="">Select user to grant free subscription</option>
              {allUsers.filter(u => !u.isSubscribed).map(u => (
                <option key={u.id} value={u.id}>{u.username} ({u.email})</option>
              ))}
            </select>
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
              {allUsers.filter(u => u.isSubscribed).map(u => (
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
        </div>
      )}

      {activeTab === 'admins' && isFullAdmin && (
        <div>
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="card-title">Existing Admins</h3>
            {allUsers.filter(u => u.isAdmin).map(u => (
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
                      alert(`${u.username} ${u.isTournamentAdmin ? 'removed from' : 'added as'} tournament admin`)
                    }}
                  >
                    {u.isTournamentAdmin ? 'Remove Tournament Admin' : 'Add Tournament Admin'}
                  </button>
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
                        alert(`${u.username} is no longer a tournament admin`)
                      }
                    }}
                  >
                    Remove
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
                  alert(`User is now a tournament admin`)
                  e.target.value = ''
                }}
              >
                <option value="">Select user to make Tournament Admin</option>
                {allUsers.filter(u => !u.isAdmin && !u.isTournamentAdmin).map(u => (
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
                alert(`User is now a full admin`)
                e.target.value = ''
              }}
            >
              <option value="">Select user to make Admin</option>
              {allUsers.filter(u => !u.isAdmin).map(u => (
                <option key={u.id} value={u.id}>{u.username} ({u.email})</option>
              ))}
            </select>
          </div>

          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="card-title">All Members - Remove Users</h3>
            {allUsers.map(u => (
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
                    onClick={() => {
                      if (confirm(`Are you sure you want to remove ${u.username} from the league?`)) {
                        const users = getAllUsers()
                        const filtered = users.filter(us => us.id !== u.id)
                        localStorage.setItem('eliteArrowsUsers', JSON.stringify(filtered))
                        alert(`${u.username} has been removed`)
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

      {activeTab === 'tournaments' && (
        <div>
          <div className="card" style={{ marginBottom: '20px' }}>
            <button className="btn btn-primary btn-block" onClick={() => setShowTournamentForm(true)} style={{ marginBottom: '20px' }}>
              Create New Tournament
            </button>

            {showTournamentForm && (
              <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '15px' }}>Create Tournament</h4>
                <div className="form-group">
                  <label>Tournament Name</label>
                  <input 
                    type="text" 
                    value={tournamentForm.name}
                    onChange={(e) => setTournamentForm({...tournamentForm, name: e.target.value})}
                    placeholder="Enter tournament name"
                  />
                </div>
                <div className="form-group">
                  <label>Max Participants</label>
                  <select value={tournamentForm.maxParticipants} onChange={(e) => setTournamentForm({...tournamentForm, maxParticipants: parseInt(e.target.value)})}>
                    <option value="8">8 Players</option>
                    <option value="16">16 Players</option>
                    <option value="32">32 Players</option>
                    <option value="64">64 Players</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Tournament Format</label>
                  <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
                    <label><input type="radio" checked={!tournamentForm.isCashBased} onChange={() => setTournamentForm({...tournamentForm, isCashBased: false, entryFee: 0})} /> Free / Reward</label>
                    <label><input type="radio" checked={tournamentForm.isCashBased} onChange={() => setTournamentForm({...tournamentForm, isCashBased: true})} /> Cash Entry</label>
                  </div>
                </div>
                {tournamentForm.isCashBased && (
                  <div className="form-group">
                    <label>Entry Fee (£)</label>
                    <input type="number" value={tournamentForm.entryFee} onChange={(e) => setTournamentForm({...tournamentForm, entryFee: parseFloat(e.target.value) || 0})} min="0" step="0.01" />
                  </div>
                )}
                {!tournamentForm.isCashBased && (
                  <div className="form-group">
                    <label>Prize / Reward Info</label>
                    <input type="text" value={tournamentForm.prizeInfo} onChange={(e) => setTournamentForm({...tournamentForm, prizeInfo: e.target.value})} placeholder="e.g., Weekly leaderboard prizes" />
                  </div>
                )}
                <div className="form-group">
                  <label>Entry Deadline</label>
                  <input type="datetime-local" value={tournamentForm.entryDeadline} onChange={(e) => setTournamentForm({...tournamentForm, entryDeadline: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Days Between Rounds</label>
                  <select value={tournamentForm.daysBetweenRounds} onChange={(e) => setTournamentForm({...tournamentForm, daysBetweenRounds: parseInt(e.target.value)})}>
                    <option value="1">1 Day</option>
                    <option value="2">2 Days</option>
                    <option value="3">3 Days</option>
                    <option value="4">4 Days</option>
                    <option value="5">5 Days</option>
                    <option value="6">6 Days</option>
                    <option value="7">1 Week</option>
                  </select>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '15px', marginTop: '15px' }}>
                  <h4 style={{ marginBottom: '15px' }}>Best Of Settings (First to X legs)</h4>
                  <div className="form-group">
                    <label>Round 1 / Round of 32/16</label>
                    <select value={tournamentForm.formatR1} onChange={(e) => setTournamentForm({...tournamentForm, formatR1: e.target.value})}>
                      {[1,2,3,4,5,6,7,8,9,10,11,12,13].map(n => <option key={n} value={n}>First to {n}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Round 2 / Round of 16/8</label>
                    <select value={tournamentForm.formatR2} onChange={(e) => setTournamentForm({...tournamentForm, formatR2: e.target.value})}>
                      {[1,2,3,4,5,6,7,8,9,10,11,12,13].map(n => <option key={n} value={n}>First to {n}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Quarter Finals</label>
                    <select value={tournamentForm.formatQF} onChange={(e) => setTournamentForm({...tournamentForm, formatQF: e.target.value})}>
                      {[1,2,3,4,5,6,7,8,9,10,11,12,13].map(n => <option key={n} value={n}>First to {n}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Semi Finals</label>
                    <select value={tournamentForm.formatSF} onChange={(e) => setTournamentForm({...tournamentForm, formatSF: e.target.value})}>
                      {[1,2,3,4,5,6,7,8,9,10,11,12,13].map(n => <option key={n} value={n}>First to {n}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Final</label>
                    <select value={tournamentForm.formatF} onChange={(e) => setTournamentForm({...tournamentForm, formatF: e.target.value})}>
                      {[1,2,3,4,5,6,7,8,9,10,11,12,13].map(n => <option key={n} value={n}>First to {n}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group" style={{ marginTop: '15px' }}>
                  <label>Divisions</label>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                    {['Elite', 'Diamond', 'Gold', 'Silver', 'Bronze'].map(div => (
                      <label key={div}>
                        <input type="checkbox" checked={tournamentForm.divisions.includes(div)}
                          onChange={(e) => setTournamentForm({...tournamentForm, divisions: e.target.checked ? [...tournamentForm.divisions, div] : tournamentForm.divisions.filter(d => d !== div)})} />
                        {' '}{div}
                      </label>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                  <button className="btn btn-primary" onClick={createTournament}>Create</button>
                  <button className="btn btn-secondary" onClick={() => setShowTournamentForm(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="card-title">All Tournaments</h3>
            {(() => {
              const tournaments = JSON.parse(localStorage.getItem('eliteArrowsTournaments') || '[]')
              const tournamentSignups = JSON.parse(localStorage.getItem('eliteArrowsTournamentSignups') || '[]')
              
              if (tournaments.length === 0) {
                return <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No tournaments yet</p>
              }
              
              return tournaments.map(t => {
                const signups = tournamentSignups.filter(s => s.tournamentId === t.id && s.status === 'approved')
                const isClosed = t.entryDeadline && new Date(t.entryDeadline) < new Date()
                
                return (
                  <div key={t.id} style={{ padding: '15px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div>
                        <h4>{t.name}</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t.type} • {t.divisions?.join(', ') || 'All divisions'}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ color: t.status === 'open' ? 'var(--success)' : 'var(--accent-cyan)' }}>
                          {t.status === 'open' ? (isClosed ? 'Closing' : 'Open') : 'In Progress'}
                        </span>
                        <button onClick={() => {
                          if (confirm('Delete this tournament?')) {
                            localStorage.setItem('eliteArrowsTournaments', JSON.stringify(tournaments.filter(tour => tour.id !== t.id)))
                            localStorage.setItem('eliteArrowsTournamentSignups', JSON.stringify(tournamentSignups.filter(s => s.tournamentId !== t.id)))
                            alert('Tournament deleted')
                          }
                        }} style={{ display: 'block', background: 'none', border: 'none', color: 'var(--error)', fontSize: '0.8rem', cursor: 'pointer', marginTop: '5px' }}>
                          Delete
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.85rem', padding: '4px 8px', background: 'var(--bg-secondary)', borderRadius: '4px' }}>
                        {t.isCashBased ? `£${t.entryFee} Entry` : 'Free Entry'}
                      </span>
                      <span style={{ fontSize: '0.85rem', padding: '4px 8px', background: 'var(--bg-secondary)', borderRadius: '4px' }}>
                        {signups.length} / {t.maxParticipants} Players
                      </span>
                      {t.entryDeadline && (
                        <span style={{ fontSize: '0.85rem', padding: '4px 8px', background: isClosed ? 'var(--error)' : 'var(--warning)', color: isClosed ? '#fff' : '#000', borderRadius: '4px' }}>
                          {isClosed ? 'Closed: ' : 'Ends: '}{new Date(t.entryDeadline).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            })()}
          </div>
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
                {allUsers.map(p => (
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
                {allUsers.map(p => (
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
            {allUsers
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

      {activeTab === 'moneypot' && isFullAdmin && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            <div className="card">
              <h3 className="card-title">Subscription Pot</h3>
              <div style={{ 
                padding: '30px', 
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-cyan))',
                borderRadius: '12px',
                textAlign: 'center',
                marginBottom: '20px'
              }}>
                <p style={{ fontSize: '0.9rem', marginBottom: '5px', opacity: 0.9 }}>Total Collected</p>
                <p style={{ fontSize: '3rem', fontWeight: 'bold', margin: 0 }}>£{subscriptionPot.toFixed(2)}</p>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                From £5/month subscriptions ({subscribers.length} active subscribers)
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
                    onClick={() => {
                      const amount = parseFloat(document.getElementById('subPotAdjust').value) || 0
                      if (amount !== 0) {
                        const newPot = subscriptionPot + amount
                        setSubscriptionPot(newPot)
                        localStorage.setItem('eliteArrowsSubscriptionPot', newPot.toString())
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
                    onClick={() => {
                      const amount = parseFloat(document.getElementById('tourPotAdjust').value) || 0
                      if (amount !== 0) {
                        const newPot = tournamentPot + amount
                        setTournamentPot(newPot)
                        localStorage.setItem('eliteArrowsTournamentPot', newPot.toString())
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
            <h3 className="card-title">Money Pot History</h3>
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