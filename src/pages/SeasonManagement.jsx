import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { doc, setDoc } from '../firebase'

export default function SeasonManagement() {
  const { user, getAllUsers } = useAuth()
  const [seasons, setSeasons] = useState([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [newSeasonName, setNewSeasonName] = useState('')
  const [players, setPlayers] = useState([])
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [newDivision, setNewDivision] = useState('')

  useEffect(() => {
    const storedSeasons = JSON.parse(localStorage.getItem('eliteArrowsSeasons') || '[]')
    setSeasons(storedSeasons)
    const users = getAllUsers()
    setPlayers(users)
  }, [])

  const createSeason = () => {
    if (!newSeasonName.trim()) return alert('Please enter a season name')
    
    const newSeason = {
      id: Date.now(),
      name: newSeasonName,
      createdAt: new Date().toISOString(),
      status: 'active',
      isArchived: false
    }
    
    const updatedSeasons = [...seasons, newSeason]
    localStorage.setItem('eliteArrowsSeasons', JSON.stringify(updatedSeasons))
    setSeasons(updatedSeasons)
    localStorage.setItem('eliteArrowsCurrentSeason', newSeasonName)
    setNewSeasonName('')
    setShowCreateForm(false)
    alert(`Season "${newSeasonName}" created and set as active!`)
  }

  const archiveSeason = (seasonId) => {
    if (!confirm('Archive this season? Archived seasons will be hidden from the main view.')) return
    
    const updatedSeasons = seasons.map(s => 
      s.id === seasonId ? { ...s, isArchived: true, status: 'archived' } : s
    )
    localStorage.setItem('eliteArrowsSeasons', JSON.stringify(updatedSeasons))
    setSeasons(updatedSeasons)
    alert('Season archived')
  }

  const restoreSeason = (seasonId) => {
    const updatedSeasons = seasons.map(s => 
      s.id === seasonId ? { ...s, isArchived: false, status: 'active' } : { ...s, status: 'archived' }
    )
    localStorage.setItem('eliteArrowsSeasons', JSON.stringify(updatedSeasons))
    setSeasons(updatedSeasons)
    localStorage.setItem('eliteArrowsCurrentSeason', seasons.find(s => s.id === seasonId)?.name || '')
    alert('Season restored and set as active')
  }

  const resetTable = () => {
    if (!confirm('Are you sure you want to reset all tables? This will clear all results for the current season but keep player data.')) return
    
    const results = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]')
    const currentSeason = localStorage.getItem('eliteArrowsCurrentSeason') || new Date().getFullYear().toString()
    const filteredResults = results.filter(r => r.season !== currentSeason)
    localStorage.setItem('eliteArrowsResults', JSON.stringify(filteredResults))
    setShowResetConfirm(false)
    alert('Table reset! All results for the current season have been cleared.')
  }

  const movePlayerDivision = () => {
    if (!selectedPlayer || !newDivision) return alert('Please select a player and new division')
    
    const users = getAllUsers()
    const userIndex = users.findIndex(u => u.id === selectedPlayer)
    if (userIndex !== -1) {
      users[userIndex].division = newDivision
      localStorage.setItem('eliteArrowsUsers', JSON.stringify(users))
      alert(`${users[userIndex].username} moved to ${newDivision}`)
      setSelectedPlayer('')
      setNewDivision('')
    }
  }

  const setActiveSeason = (seasonName) => {
    localStorage.setItem('eliteArrowsCurrentSeason', seasonName)
    alert(`Active season changed to "${seasonName}"`)
  }

  if (!user.isAdmin) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Access Denied</h1>
        </div>
        <div className="card">
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
            Only admins can access this page.
          </p>
        </div>
      </div>
    )
  }

  const activeSeason = localStorage.getItem('eliteArrowsCurrentSeason') || new Date().getFullYear().toString()
  const archivedSeasons = seasons.filter(s => s.isArchived)
  const activeSeasonsList = seasons.filter(s => !s.isArchived)

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Season Management</h1>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 className="card-title">Current Active Season</h3>
        <div style={{ padding: '15px', background: 'var(--accent-cyan)', color: '#000', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold' }}>
          {activeSeason}
        </div>
        <p style={{ color: 'var(--text-muted)', marginTop: '10px', fontSize: '0.85rem' }}>
          All new results will be recorded under this season.
        </p>
      </div>

      <div className="card" style={{ marginBottom: '20px', border: '2px solid var(--warning)' }}>
        <h3 className="card-title" style={{ color: 'var(--warning)' }}>⚠️ Clear All Divisions</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
          Remove division from all users. Admins will need to reassign divisions.
        </p>
        <button className="btn btn-danger" onClick={async () => {
          if (!confirm('Remove division from ALL users?')) return
          const allUsers = getAllUsers()
          for (const u of allUsers) {
            await setDoc(doc(db, 'users', u.id), { division: null }, { merge: true })
          }
          alert(`Divisions cleared for ${allUsers.length} users!`)
          window.location.reload()
        }}>
          Clear All Divisions
        </button>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 className="card-title" style={{ margin: 0 }}>Seasons</h3>
          <button className="btn btn-primary" onClick={() => setShowCreateForm(!showCreateForm)}>
            {showCreateForm ? 'Cancel' : 'Create New Season'}
          </button>
        </div>

        {showCreateForm && (
          <div style={{ padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '15px' }}>
            <div className="form-group">
              <label>Season Name (e.g., "Winter 2025" or "2025")</label>
              <input 
                type="text" 
                value={newSeasonName}
                onChange={(e) => setNewSeasonName(e.target.value)}
                placeholder="Enter season name"
              />
            </div>
            <button className="btn btn-primary" onClick={createSeason}>Create Season</button>
          </div>
        )}

        {activeSeasonsList.length === 0 && archivedSeasons.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No seasons created yet. Create your first season to get started.</p>
        ) : (
          <>
            {activeSeasonsList.length > 0 && (
              <div style={{ marginBottom: '15px' }}>
                <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '10px' }}>Active Seasons</h4>
                {activeSeasonsList.map(s => (
                  <div key={s.id} className="player-card">
                    <div className="player-info">
                      <h3>{s.name}</h3>
                      <p style={{ fontSize: '0.8rem' }}>Created: {new Date(s.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {s.name !== activeSeason && (
                        <button className="btn btn-secondary btn-sm" onClick={() => setActiveSeason(s.name)}>
                          Set Active
                        </button>
                      )}
                      <button className="btn btn-danger btn-sm" onClick={() => archiveSeason(s.id)}>
                        Archive
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {archivedSeasons.length > 0 && (
              <div>
                <h4 style={{ color: 'var(--text-muted)', marginBottom: '10px' }}>Archived Seasons</h4>
                {archivedSeasons.map(s => (
                  <div key={s.id} className="player-card" style={{ opacity: 0.7 }}>
                    <div className="player-info">
                      <h3>{s.name}</h3>
                      <p style={{ fontSize: '0.8rem' }}>Created: {new Date(s.createdAt).toLocaleDateString()}</p>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => restoreSeason(s.id)}>
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 className="card-title">Reset Table</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
          Clear all results for the current season. This will not delete player accounts or historical data from archived seasons.
        </p>
        <button className="btn btn-danger" onClick={() => setShowResetConfirm(true)}>
          Reset Current Season Table
        </button>

        {showResetConfirm && (
          <div style={{ marginTop: '15px', padding: '15px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--error)', borderRadius: '8px' }}>
            <p style={{ color: 'var(--error)', fontWeight: 'bold' }}>Are you sure?</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              This will permanently delete all results for the "{activeSeason}" season. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button className="btn btn-danger" onClick={resetTable}>Yes, Reset Table</button>
              <button className="btn btn-secondary" onClick={() => setShowResetConfirm(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="card-title">Move Player Between Divisions</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
          Manually transfer a player to a different division based on their 3-dart average.
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <select 
            value={selectedPlayer}
            onChange={(e) => setSelectedPlayer(e.target.value)}
            style={{ flex: 1, minWidth: '150px' }}
          >
            <option value="">Select Player</option>
            {players.map(p => (
              <option key={p.id} value={p.id}>{p.username} ({p.division})</option>
            ))}
          </select>
          <select 
            value={newDivision}
            onChange={(e) => setNewDivision(e.target.value)}
            style={{ flex: 1, minWidth: '150px' }}
          >
            <option value="">Select Division</option>
            <option value="Elite">Elite</option>
            <option value="Diamond">Diamond</option>
            <option value="Platinum">Platinum</option>
            <option value="Gold">Gold</option>
            <option value="Silver">Silver</option>
            <option value="Bronze">Bronze</option>
            <option value="Iron">Iron</option>
          </select>
          <button className="btn btn-primary" onClick={movePlayerDivision}>
            Move Player
          </button>
        </div>
      </div>
    </div>
  )
}