import { useState, useEffect } from 'react'
import { useAuth, DIVISIONS } from '../context/AuthContext'
import { db, doc, setDoc, deleteDoc, collection, addDoc, getDocs, writeBatch } from '../firebase'
import Breadcrumbs from '../components/Breadcrumbs'
import UserSearchSelect from '../components/UserSearchSelect'
import { useToast } from '../context/ToastContext'

export default function SeasonManagement() {
  const { user, getAllUsers, getResults, updateResults, getSeasons, adminData, updateAdminData, triggerDataRefresh } = useAuth()
  const { showToast } = useToast()

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newSeasonName, setNewSeasonName] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [newDivision, setNewDivision] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const allPlayers = getAllUsers()
  const seasons = getSeasons()
  const currentSeason = adminData?.currentSeason || 'Season 1'

  const createSeason = async () => {
    if (!newSeasonName.trim()) return showToast('Please enter a season name', 'error')
    setIsProcessing(true)
    
    try {
      const id = Date.now().toString()
      const newSeason = {
        id,
        name: newSeasonName,
        createdAt: new Date().toISOString(),
        status: 'active',
        isArchived: false
      }

      await setDoc(doc(db, 'seasons', id), newSeason)
      showToast(`Season "${newSeasonName}" created!`, 'success')
      setNewSeasonName('')
      setShowCreateForm(false)
      triggerDataRefresh('seasons')
    } catch (e) {
      showToast('Error creating season: ' + e.message, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const setActiveSeason = async (seasonName) => {
    if (!confirm(`Set "${seasonName}" as the active season? All new results will be linked to this.`)) return
    setIsProcessing(true)
    try {
      await updateAdminData({ currentSeason: seasonName })
      showToast(`Active season updated to ${seasonName}`, 'success')
    } catch (e) {
      showToast('Error updating active season', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const archiveSeason = async (season) => {
    if (!confirm(`Archive "${season.name}"?`)) return
    setIsProcessing(true)
    try {
      await setDoc(doc(db, 'seasons', season.id), { ...season, isArchived: true, status: 'archived' }, { merge: true })
      showToast('Season archived', 'info')
      triggerDataRefresh('seasons')
    } catch (e) {
      showToast('Error archiving season', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const deleteSeason = async (id) => {
    if (!confirm('Permanently delete this season record? Match results will NOT be deleted, but they will no longer be linked to this season entry.')) return
    setIsProcessing(true)
    try {
      await deleteDoc(doc(db, 'seasons', id))
      showToast('Season record deleted', 'info')
      triggerDataRefresh('seasons')
    } catch (e) {
      showToast('Error deleting season', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const resetCurrentSeasonTable = async () => {
    if (!confirm(`DANGER: This will permanently delete ALL approved and pending results for "${currentSeason}". This cannot be undone. Are you absolutely sure?`)) return
    
    setIsProcessing(true)
    try {
      const results = getResults()
      const seasonResults = results.filter(r => r.season === currentSeason)

      const batch = writeBatch(db)
      seasonResults.forEach(r => {
        batch.delete(doc(db, 'results', String(r.firestoreId || r.id)))
      })

      await batch.commit()
      showToast(`Cleared ${seasonResults.length} results for ${currentSeason}`, 'success')
      triggerDataRefresh('results')
    } catch (e) {
      showToast('Error resetting table: ' + e.message, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const movePlayerDivision = async () => {
    if (!selectedPlayer || !newDivision) return showToast('Select both player and division', 'error')
    
    setIsProcessing(true)
    try {
      await setDoc(doc(db, 'users', selectedPlayer), { division: newDivision }, { merge: true })
      const p = allPlayers.find(u => u.id === selectedPlayer)
      showToast(`${p?.username} moved to ${newDivision}`, 'success')
      setSelectedPlayer('')
      setNewDivision('')
      triggerDataRefresh('users')
    } catch (e) {
      showToast('Error moving player', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const clearAllDivisions = async () => {
    if (!confirm('This will set the division to "Unassigned" for EVERY player in the league. Proceed?')) return

    setIsProcessing(true)
    try {
      const batch = writeBatch(db)
      allPlayers.forEach(u => {
        batch.update(doc(db, 'users', u.id), { division: 'Unassigned' })
      })
      await batch.commit()
      showToast(`Cleared divisions for ${allPlayers.length} players`, 'success')
      triggerDataRefresh('users')
    } catch (e) {
      showToast('Error clearing divisions', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  if (!user.isAdmin) {
    return (
      <div className="page glass">
        <h1 className="page-title">Access Denied</h1>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>You do not have administrative permissions.</p>
      </div>
    )
  }

  return (
    <div className="page animate-fade-in">
      <Breadcrumbs items={[{ label: 'Admin', path: '/admin' }, { label: 'Seasons' }]} />

      <div className="page-header" style={{ marginBottom: '32px' }}>
        <h1 className="page-title text-gradient">Season Control</h1>
        <p style={{ color: 'var(--text-muted)' }}>Manage league phases, transitions, and player seeding</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '40px' }}>

        {/* CURRENT STATUS */}
        <div className="card glass" style={{ borderLeft: '4px solid var(--accent-cyan)' }}>
          <h3 className="card-title">Live Environment</h3>
          <div style={{ padding: '24px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', margin: '12px 0' }}>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent-cyan)', fontWeight: 800, marginBottom: '8px' }}>Active Season</div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: 'white' }}>{currentSeason}</div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            All scoring and table calculations currently use this label.
          </p>
        </div>

        {/* QUICK ACTIONS */}
        <div className="card glass">
          <h3 className="card-title">Maintenance Tools</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
            <button className="btn btn-secondary btn-block" onClick={() => setShowCreateForm(!showCreateForm)}>
              {showCreateForm ? 'Close Form' : '+ New Season Entry'}
            </button>
            <button className="btn btn-danger btn-block" style={{ opacity: 0.8 }} onClick={clearAllDivisions} disabled={isProcessing}>
              Reset All Divisions
            </button>
            <button className="btn btn-danger btn-block" onClick={resetCurrentSeasonTable} disabled={isProcessing}>
              Clear Season Results
            </button>
          </div>
        </div>
      </div>

      {showCreateForm && (
        <div className="card glass animate-slide-up" style={{ marginBottom: '32px', border: '1px solid var(--accent-cyan)' }}>
          <h3 className="card-title">Launch New Season</h3>
          <div className="form-group">
            <label>Season Identifier</label>
            <input
              type="text"
              value={newSeasonName}
              onChange={(e) => setNewSeasonName(e.target.value)}
              placeholder="e.g. Season 2, Winter 2025..."
              className="glass"
            />
          </div>
          <button className="btn btn-primary btn-block" onClick={createSeason} disabled={isProcessing}>
            {isProcessing ? 'Processing...' : 'Create Season Record'}
          </button>
        </div>
      )}

      {/* PLAYER SEEDING */}
      <div className="card glass" style={{ marginBottom: '40px' }}>
        <h3 className="card-title">Player Seeding & Transfers</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>Move players between divisions based on promotion/relegation or 3-dart average changes.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', alignItems: 'end' }}>
          <UserSearchSelect
            users={allPlayers}
            selectedId={selectedPlayer}
            onSelect={setSelectedPlayer}
            label="Target Player"
          />
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>New Division</label>
            <select value={newDivision} onChange={e => setNewDivision(e.target.value)} className="glass">
              <option value="">Select...</option>
              {DIVISIONS.map(div => <option key={div} value={div}>{div}</option>)}
              <option value="Unassigned">Unassigned</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={movePlayerDivision} disabled={isProcessing || !selectedPlayer || !newDivision} style={{ height: '48px' }}>
            Update Seeding
          </button>
        </div>
      </div>

      {/* SEASON LIST */}
      <div className="card glass">
        <h3 className="card-title">Season Archive</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
          {seasons.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No historical seasons recorded.</p>
          ) : (
            seasons.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(s => (
              <div key={s.id} className="glass" style={{ padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {s.name}
                    {s.name === currentSeason && <span style={{ fontSize: '0.6rem', background: 'var(--success)', color: 'black', padding: '2px 6px', borderRadius: '4px' }}>LIVE</span>}
                    {s.isArchived && <span style={{ fontSize: '0.6rem', background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: '4px' }}>ARCHIVED</span>}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Created {new Date(s.createdAt).toLocaleDateString()}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {s.name !== currentSeason && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setActiveSeason(s.name)}>Set Active</button>
                  )}
                  {!s.isArchived && (
                    <button className="btn btn-secondary btn-sm" onClick={() => archiveSeason(s)}>Archive</button>
                  )}
                  <button className="btn btn-danger btn-sm" onClick={() => deleteSeason(s.id)}>🗑️</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  )
}
