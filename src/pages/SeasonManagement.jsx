import { useState, useEffect } from 'react'
import { useAuth, DIVISIONS } from '../context/AuthContext'
import { db, doc, setDoc, deleteDoc, collection, addDoc, getDocs, writeBatch } from '../firebase'
import Breadcrumbs from '../components/Breadcrumbs'
import UserSearchSelect from '../components/UserSearchSelect'
import { useToast } from '../context/ToastContext'
import { derivePlayerStatsFromResults } from '../utils/playerStats'

const SUPER_LEAGUE_DIVISIONS = ['Premier', 'Pro', 'Amateur']

export default function SeasonManagement() {
  const { user, getAllUsers, getResults, updateResults, getSeasons, adminData, updateAdminData, triggerDataRefresh } = useAuth()
  const { showToast } = useToast()

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingSeason, setEditingSeason] = useState(null)
  const [newSeasonName, setNewSeasonName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('00:00')
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [newDivision, setNewDivision] = useState('')
  const [selectedSuperPlayer, setSelectedSuperPlayer] = useState('')
  const [newSuperDivision, setNewSuperDivision] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const allPlayers = getAllUsers()
  const seasons = getSeasons()
  const currentSeason = adminData?.currentSeason || 'Season 1'

  const createSeason = async () => {
    if (!newSeasonName.trim()) return showToast('Please enter a season name', 'error')
    if (!startDate) return showToast('Please select a start date', 'error')

    setIsProcessing(true)
    
    try {
      const id = Date.now().toString()
      const startDateTime = new Date(`${startDate}T${startTime}`).toISOString()

      const newSeason = {
        id,
        name: newSeasonName,
        createdAt: new Date().toISOString(),
        startDate: startDateTime,
        status: 'upcoming',
        isArchived: false,
        isLaunched: false
      }

      await setDoc(doc(db, 'seasons', id), newSeason)
      showToast(`Season "${newSeasonName}" created and scheduled for ${new Date(startDateTime).toLocaleString()}`, 'success')
      setNewSeasonName('')
      setStartDate('')
      setStartTime('00:00')
      setShowCreateForm(false)
      triggerDataRefresh('seasons')
    } catch (e) {
      showToast('Error creating season: ' + e.message, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const updateSeason = async () => {
    if (!editingSeason || !newSeasonName.trim()) return
    setIsProcessing(true)
    try {
      const startDateTime = startDate && startTime ? new Date(`${startDate}T${startTime}`).toISOString() : editingSeason.startDate

      const updatedSeason = {
        ...editingSeason,
        name: newSeasonName,
        startDate: startDateTime
      }

      await setDoc(doc(db, 'seasons', editingSeason.id), updatedSeason)

      if (currentSeason === editingSeason.name) {
        await updateAdminData({ currentSeason: newSeasonName })
      }

      showToast('Season updated!', 'success')
      setEditingSeason(null)
      setNewSeasonName('')
      setStartDate('')
      setStartTime('00:00')
      triggerDataRefresh('seasons')
    } catch (e) {
      showToast('Error: ' + e.message, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const setActiveSeason = async (seasonName) => {
    if (!confirm(`Set "${seasonName}" as the active season? All new results will be linked to this. This will also sync player subscriptions for this season.`)) return
    setIsProcessing(true)
    try {
      await updateAdminData({ currentSeason: seasonName })

      const batch = writeBatch(db)
      allPlayers.forEach(u => {
        const isSubscribedForSeason = (u.subscribedSeasons || []).includes(seasonName)
        if (u.isSubscribed !== isSubscribedForSeason) {
          batch.update(doc(db, 'users', u.id), { isSubscribed: isSubscribedForSeason })
        }
      })
      await batch.commit()

      showToast(`Active season updated to ${seasonName} and subscriptions synced.`, 'success')
      triggerDataRefresh('users')
    } catch (e) {
      showToast('Error updating active season: ' + e.message, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const endSeason = async (season) => {
    if (!confirm(`End "${season.name}"? This will archive the season and set the active season to "Off-Season".`)) return
    setIsProcessing(true)
    try {
      await setDoc(doc(db, 'seasons', season.id), { ...season, isArchived: true, status: 'archived', endedAt: new Date().toISOString() }, { merge: true })
      await updateAdminData({ currentSeason: 'Off-Season' })
      showToast(`Season ${season.name} has ended!`, 'success')
      triggerDataRefresh('seasons')
    } catch (e) {
      showToast('Error ending season', 'error')
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

  const runSeasonTransitions = async (fromSeasonName) => {
    if (!fromSeasonName) return showToast('No previous season found', 'error')
    if (!confirm(`Are you sure you want to transition divisions based on "${fromSeasonName}" standings? This will update ALL players' divisions.`)) return

    setIsProcessing(true)
    try {
      const results = getResults()
      const users = getAllUsers()

      const stats = derivePlayerStatsFromResults(users, results, {
        adminData,
        leagueOnly: true,
        currentSeason: fromSeasonName
      })

      const batch = writeBatch(db)
      const updates = []

      // Process each division
      DIVISIONS.forEach((div, divIndex) => {
        const playersInDiv = users
          .filter(u => u.division === div)
          .map(p => ({
            id: p.id,
            stats: stats[p.id] || { points: 0, legsWon: 0, legsLost: 0, average: 0 }
          }))
          .sort((a, b) => {
            if (b.stats.points !== a.stats.points) return b.stats.points - a.stats.points
            const aDiff = a.stats.legsWon - a.stats.legsLost
            const bDiff = b.stats.legsWon - b.stats.legsLost
            if (bDiff !== aDiff) return bDiff - aDiff
            return (b.stats.average || 0) - (a.stats.average || 0)
          })

        if (playersInDiv.length === 0) return

        playersInDiv.forEach((player, index) => {
          let nextDivision = div

          // Promotion (Top 2)
          if (index < 2 && divIndex > 0) {
            nextDivision = DIVISIONS[divIndex - 1]
          }
          // Relegation (Bottom 2)
          else if (index >= playersInDiv.length - 2 && playersInDiv.length > 4 && divIndex < DIVISIONS.length - 1) {
            nextDivision = DIVISIONS[divIndex + 1]
          }

          if (nextDivision !== div) {
            updates.push({ id: player.id, old: div, new: nextDivision })
            batch.update(doc(db, 'users', player.id), { division: nextDivision })
          }
        })
      })

      await batch.commit()
      showToast(`Transition complete! ${updates.length} players moved divisions.`, 'success')
      triggerDataRefresh('users')
    } catch (e) {
      console.error(e)
      showToast('Error during transition: ' + e.message, 'error')
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

  const updateSuperLeagueDivision = async () => {
    if (!selectedSuperPlayer || !newSuperDivision) return showToast('Select both player and division', 'error')
    setIsProcessing(true)
    try {
      await setDoc(doc(db, 'users', selectedSuperPlayer), { superLeagueDivision: newSuperDivision === 'None' ? null : newSuperDivision }, { merge: true })
      const p = allPlayers.find(u => u.id === selectedSuperPlayer)
      showToast(`${p?.username} ${newSuperDivision === 'None' ? 'removed from' : 'added to'} Super League ${newSuperDivision}`, 'success')
      setSelectedSuperPlayer('')
      setNewSuperDivision('')
      triggerDataRefresh('users')
    } catch (e) {
      showToast('Error: ' + e.message, 'error')
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
            <button className="btn btn-secondary btn-block" onClick={() => { setEditingSeason(null); setShowCreateForm(!showCreateForm); }}>
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

      {(showCreateForm || editingSeason) && (
        <div className="card glass animate-slide-up" style={{ marginBottom: '32px', border: '1px solid var(--accent-cyan)' }}>
          <h3 className="card-title">{editingSeason ? 'Edit Season' : 'Schedule New Season'}</h3>
          <div className="form-group">
            <label>Season Name</label>
            <input
              type="text"
              value={newSeasonName}
              onChange={(e) => setNewSeasonName(e.target.value)}
              placeholder="e.g. Season 2, Winter 2025..."
              className="glass"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="glass"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="glass"
              />
            </div>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            New seasons are only visible to admins until their start date.
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-primary btn-block" onClick={editingSeason ? updateSeason : createSeason} disabled={isProcessing}>
              {isProcessing ? 'Processing...' : editingSeason ? 'Update Season' : 'Schedule Season'}
            </button>
            <button className="btn btn-secondary" onClick={() => { setEditingSeason(null); setNewSeasonName(''); setStartDate(''); setStartTime('00:00'); setShowCreateForm(false); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* PLAYER SEEDING */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', marginBottom: '40px' }}>
        <div className="card glass">
          <h3 className="card-title">Standard Seeding</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.85rem' }}>Move players in the regular league.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <UserSearchSelect users={allPlayers} selectedId={selectedPlayer} onSelect={setSelectedPlayer} label="Player" />
            <select value={newDivision} onChange={e => setNewDivision(e.target.value)} className="glass">
              <option value="">Select Division...</option>
              {DIVISIONS.map(div => <option key={div} value={div}>{div}</option>)}
              <option value="Unassigned">Unassigned</option>
            </select>
            <button className="btn btn-primary" onClick={movePlayerDivision} disabled={isProcessing || !selectedPlayer || !newDivision}>
              Update Division
            </button>
          </div>
        </div>

        <div className="card glass" style={{ borderLeft: '4px solid var(--warning)' }}>
          <h3 className="card-title">Super League Seeding</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.85rem' }}>Add/remove players from Super League.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <UserSearchSelect users={allPlayers} selectedId={selectedSuperPlayer} onSelect={setSelectedSuperPlayer} label="Player" />
            <select value={newSuperDivision} onChange={e => setNewSuperDivision(e.target.value)} className="glass">
              <option value="">Select Super Division...</option>
              {SUPER_LEAGUE_DIVISIONS.map(div => <option key={div} value={div}>{div}</option>)}
              <option value="None">Remove from Super League</option>
            </select>
            <button className="btn btn-primary" onClick={updateSuperLeagueDivision} disabled={isProcessing || !selectedSuperPlayer || !newSuperDivision}>
              Assign Super Rank
            </button>
          </div>
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
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Created {new Date(s.createdAt).toLocaleDateString()}
                    {s.endedAt && ` • Ended ${new Date(s.endedAt).toLocaleDateString()}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => {
                    setEditingSeason(s);
                    setNewSeasonName(s.name);
                    if (s.startDate) {
                      const d = new Date(s.startDate);
                      setStartDate(d.toISOString().split('T')[0]);
                      setStartTime(d.toTimeString().split(' ')[0].substring(0, 5));
                    }
                    setShowCreateForm(false);
                  }}>Edit</button>
                  {s.name !== currentSeason && (
                    <button className="btn btn-secondary btn-sm" onClick={() => runSeasonTransitions(currentSeason)}>Seed from {currentSeason}</button>
                  )}
                  {s.name !== currentSeason && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setActiveSeason(s.name)}>Set Active</button>
                  )}
                  {!s.isArchived ? (
                    <button className="btn btn-danger btn-sm" onClick={() => endSeason(s)}>End Season</button>
                  ) : (
                    <button className="btn btn-secondary btn-sm" onClick={() => archiveSeason({ ...s, isArchived: false, status: 'active' })}>Restore</button>
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
