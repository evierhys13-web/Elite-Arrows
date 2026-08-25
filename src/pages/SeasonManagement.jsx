import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContextInternal'
import { DIVISIONS } from '../context/constants'
import { db, doc, setDoc, deleteDoc, collection, addDoc, getDocs, writeBatch } from '../firebase'
import Breadcrumbs from '../components/Breadcrumbs'
import UserSearchSelect from '../components/UserSearchSelect'
import { useToast } from '../context/ToastContext'
import { derivePlayerStatsFromResults } from '../utils/playerStats'

const CHAMPIONS_LEAGUE_DIVISIONS = ['Champions']

export default function SeasonManagement() {
  const { user, getAllUsers, getResults, updateResults, getSeasons, adminData, updateAdminData, triggerDataRefresh, searchUsers } = useAuth()
  const { showToast } = useToast()

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingSeason, setEditingSeason] = useState(null)
  const [newSeasonName, setNewSeasonName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('00:00')
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [newDivision, setNewDivision] = useState('')
  const [seedingSeasonId, setSeedingSeasonId] = useState('current')
  const [seedingFilter, setSeedingFilter] = useState('all')
  const [showChampionsInQuickList, setShowChampionsInQuickList] = useState(false)
  const [selectedChampionsPlayer, setSelectedChampionsPlayer] = useState('')
  const [newChampionsDivision, setNewChampionsDivision] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedLiveSeason, setSelectedLiveSeason] = useState('')

  const allPlayers = getAllUsers()
  const seasons = getSeasons()
  const currentSeason = adminData?.currentSeason || 'Season 1'
  const championsLeagueSeason = adminData?.championsLeagueSeason || currentSeason

  const targetSeasonDoc = useMemo(() =>
    seedingSeasonId === 'current' ? null : seasons.find(s => s.id === seedingSeasonId)
  , [seasons, seedingSeasonId])

  const playersBySeeding = useMemo(() => {
    const players = allPlayers.map(u => {
      let div = u.division || 'Unassigned'
      if (seedingSeasonId !== 'current' && targetSeasonDoc) {
        div = targetSeasonDoc.stagedDivisions?.[u.id] || 'Unassigned'
      }
      return { ...u, effectiveDiv: div }
    })

    if (seedingFilter === 'unassigned') return players.filter(p => p.effectiveDiv === 'Unassigned')
    if (DIVISIONS.includes(seedingFilter)) return players.filter(p => p.effectiveDiv === seedingFilter)
    return players
  }, [allPlayers, seedingSeasonId, targetSeasonDoc, seedingFilter])

  useEffect(() => {
    if (showCreateForm && !startDate) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 7); // Default to 7 days away
      setStartDate(tomorrow.toISOString().split('T')[0]);
    }
  }, [showCreateForm, startDate]);

  const updateChampionsLeagueSeason = async (seasonName) => {
    if (!confirm(`Set "${seasonName}" as the active Champions League season?`)) return
    setIsProcessing(true)
    try {
      await updateAdminData({ championsLeagueSeason: seasonName })
      showToast(`Champions League is now using "${seasonName}"`, 'success')
      triggerDataRefresh('admin')
    } catch (e) {
      showToast('Error: ' + e.message, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const archiveSeason4Special = async () => {
    const s4 = seasons.find(s => s.name === 'Season 4')
    if (!s4) return showToast('Season 4 record not found', 'error')

    setIsProcessing(true)
    try {
      await setDoc(doc(db, 'seasons', s4.id), { ...s4, isArchived: true, status: 'archived', endedAt: new Date().toISOString() }, { merge: true })
      if (currentSeason === 'Season 4') {
        await updateAdminData({ currentSeason: 'Off-Season' })
      }
      showToast('Season 4 has been archived!', 'success')
      triggerDataRefresh('seasons')
    } catch (e) {
      showToast('Error archiving Season 4', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

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
    const seasonDoc = seasons.find(s => s.name === seasonName)
    const stagedDivisions = seasonDoc?.stagedDivisions || {}

    if (!confirm(`Set "${seasonName}" as the active season? This will:
1. Link all new results to this season.
2. Sync player subscriptions.
3. Apply drafted divisions for this season (everyone else will be Unassigned).
4. Clear all manual stat overrides.`)) return

    setIsProcessing(true)
    try {
      await updateAdminData({ currentSeason: seasonName })

      const batch = writeBatch(db)
      allPlayers.forEach(u => {
        const updates = {}
        // For Season 1, we assume everyone who has any record of subscription should be active (Legacy support)
        const isSubscribedForSeason = (u.subscribedSeasons || []).includes(seasonName)
        const shouldBeSubscribed = isSubscribedForSeason || (seasonName === 'Season 1' && (u.isSubscribed || (u.subscribedSeasons && u.subscribedSeasons.length > 0)))

        if (u.isSubscribed !== shouldBeSubscribed) updates.isSubscribed = shouldBeSubscribed

        // Apply Staged Divisions - If not in staged list, they start as Unassigned for the new season
        const nextDiv = stagedDivisions[u.id] || 'Unassigned'
        if (u.division !== nextDiv) updates.division = nextDiv

        // Clear manual stats for a fresh season start
        if (u.manualStats) updates.manualStats = null

        if (Object.keys(updates).length > 0) {
          batch.update(doc(db, 'users', u.id), updates)
        }
      })
      await batch.commit()

      showToast(`Season ${seasonName} is now LIVE. Table wiped and seeding applied.`, 'success')
      triggerDataRefresh('all')
    } catch (e) {
      showToast('Error updating active season: ' + e.message, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const emergencyRevert = async () => {
    if (!confirm("This will set 'Season 1' as the active season and restore ALL previous subscribers. Use this if a new season launched accidentally.")) return
    setIsProcessing(true)
    try {
      // 1. Reset current season
      await updateAdminData({ currentSeason: 'Season 1' })

      // 2. Fix launched flags
      const launchedSeasons = seasons.filter(s => s.isLaunched && s.name !== 'Season 1')
      const batch = writeBatch(db)
      launchedSeasons.forEach(s => {
        batch.update(doc(db, 'seasons', s.id), { isLaunched: false, status: 'upcoming' })
      })

      // 3. Restore subscriptions (Assume anyone who was a subscriber is restored)
      allPlayers.forEach(u => {
        if (!u.isSubscribed && (u.isTournamentAdmin || u.isAdmin || u.subscribedSeasons?.length > 0 || u.division)) {
          batch.update(doc(db, 'users', u.id), { isSubscribed: true })
        }
      })

      await batch.commit()
      showToast("Emergency Revert Successful! 'Season 1' is live again.", "success")
      triggerDataRefresh('all')
    } catch (e) {
      showToast("Error during revert: " + e.message, "error")
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

  const runSeasonTransitions = async (targetSeason, fromSeasonName) => {
    if (!fromSeasonName) return showToast('No previous season found', 'error')
    if (!confirm(`This will calculate promotions/relegations based on "${fromSeasonName}" and save them as a DRAFT for "${targetSeason.name}". It will NOT update players yet. Proceed?`)) return

    setIsProcessing(true)
    try {
      const results = getResults()
      const users = getAllUsers()

      const stats = derivePlayerStatsFromResults(users, results, {
        adminData,
        leagueOnly: true,
        currentSeason: fromSeasonName
      })

      const stagedDivisions = {}

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
          if (index < 2 && divIndex > 0) nextDivision = DIVISIONS[divIndex - 1]
          else if (index >= playersInDiv.length - 2 && playersInDiv.length > 4 && divIndex < DIVISIONS.length - 1) nextDivision = DIVISIONS[divIndex + 1]

          stagedDivisions[player.id] = nextDivision
        })
      })

      await setDoc(doc(db, 'seasons', targetSeason.id), { ...targetSeason, stagedDivisions }, { merge: true })
      showToast(`Draft divisions saved for ${targetSeason.name}!`, 'success')
      triggerDataRefresh('seasons')
    } catch (e) {
      showToast('Error: ' + e.message, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const movePlayerDivision = async () => {
    if (!selectedPlayer || !newDivision) return showToast('Select both player and division', 'error')
    
    setIsProcessing(true)
    try {
      if (seedingSeasonId === 'current') {
        // Update live division on user profile
        await setDoc(doc(db, 'users', selectedPlayer), { division: newDivision }, { merge: true })
        const p = allPlayers.find(u => u.id === selectedPlayer)
        showToast(`${p?.username} moved to ${newDivision} in LIVE season`, 'success')
      } else {
        // Update staged division in the selected season document
        const targetSeason = seasons.find(s => s.id === seedingSeasonId)
        if (!targetSeason) throw new Error('Target season not found')

        const stagedDivisions = { ...(targetSeason.stagedDivisions || {}) }
        if (newDivision === 'Unassigned') {
          delete stagedDivisions[selectedPlayer]
        } else {
          stagedDivisions[selectedPlayer] = newDivision
        }

        await setDoc(doc(db, 'seasons', seedingSeasonId), { stagedDivisions }, { merge: true })
        const p = allPlayers.find(u => u.id === selectedPlayer)
        showToast(`${p?.username} assigned to ${newDivision} for ${targetSeason.name}`, 'success')
      }

      setSelectedPlayer('')
      setNewDivision('')
      triggerDataRefresh('all')
    } catch (e) {
      showToast('Error: ' + e.message, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const updateChampionsLeagueDivision = async () => {
    if (!selectedChampionsPlayer || !newChampionsDivision) return showToast('Select both player and division', 'error')
    setIsProcessing(true)
    try {
      await setDoc(doc(db, 'users', selectedChampionsPlayer), { superLeagueDivision: newChampionsDivision === 'None' ? null : newChampionsDivision }, { merge: true })
      const p = allPlayers.find(u => u.id === selectedChampionsPlayer)
      showToast(`${p?.username} ${newChampionsDivision === 'None' ? 'removed from' : 'added to'} Champions League ${newChampionsDivision}`, 'success')
      setSelectedChampionsPlayer('')
      setNewChampionsDivision('')
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

  const clearStagedSeeding = async () => {
    if (seedingSeasonId === 'current') return showToast('Cannot wipe live seeding here. Use "Reset All Divisions" instead.', 'warning')
    const targetSeason = seasons.find(s => s.id === seedingSeasonId)
    if (!targetSeason) return

    if (!confirm(`Wipe ALL drafted seeding for "${targetSeason.name}"? This cannot be undone.`)) return

    setIsProcessing(true)
    try {
      await setDoc(doc(db, 'seasons', seedingSeasonId), { stagedDivisions: {} }, { merge: true })
      showToast(`Draft seeding for ${targetSeason.name} wiped.`, 'success')
      triggerDataRefresh('seasons')
    } catch (e) {
      showToast('Error wiping seeding', 'error')
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', margin: '12px 0' }}>
            <div style={{ padding: '16px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '16px' }}>
              <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-cyan)', fontWeight: 800, marginBottom: '4px' }}>League Season</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'white' }}>{currentSeason}</div>
            </div>
            <div style={{ padding: '16px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '16px' }}>
              <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#fbbf24', fontWeight: 800, marginBottom: '4px' }}>Champions Season</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'white' }}>{championsLeagueSeason}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
            <select
              className="glass"
              value={selectedLiveSeason}
              onChange={(e) => setSelectedLiveSeason(e.target.value)}
              style={{ flex: 1, fontSize: '0.8rem', padding: '8px' }}
            >
              <option value="">Select a season to set live...</option>
              {seasons.filter(s => s.name !== currentSeason).map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { if (selectedLiveSeason) setActiveSeason(selectedLiveSeason) }}
              disabled={!selectedLiveSeason || isProcessing}
            >
              Set Live
            </button>
          </div>

          {seasons.find(s => s.name === 'Season 4' && !s.isArchived) && (
            <button className="btn btn-danger btn-sm btn-block" onClick={archiveSeason4Special} disabled={isProcessing} style={{ marginTop: '8px' }}>
              Archive Season 4 Now
            </button>
          )}
        </div>

        {/* QUICK ACTIONS */}
        <div className="card glass">
          <h3 className="card-title">Maintenance Tools</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
            <button className="btn btn-secondary btn-block" onClick={() => { setEditingSeason(null); setShowCreateForm(!showCreateForm); }}>
              {showCreateForm ? 'Close Form' : '+ New Season Entry'}
            </button>
            {currentSeason !== 'Season 1' && (
              <button className="btn btn-warning btn-block" onClick={emergencyRevert} disabled={isProcessing}>
                Emergency Revert to Season 1
              </button>
            )}
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
              placeholder="e.g. Season 4, Autumn 2026..."
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
            <label style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: 800 }}>Target Season</label>
            <select value={seedingSeasonId} onChange={e => setSeedingSeasonId(e.target.value)} className="glass">
              <option value="current">Current Live Season ({currentSeason})</option>
              {seasons.filter(s => s.name !== currentSeason).map(s => (
                <option key={s.id} value={s.id}>{s.name} {s.isArchived ? '(Archived)' : '(Upcoming)'}</option>
              ))}
            </select>

            <UserSearchSelect users={allPlayers} selectedId={selectedPlayer} onSelect={setSelectedPlayer} label="Player" onQueryChange={searchUsers} />

            <select value={newDivision} onChange={e => setNewDivision(e.target.value)} className="glass">
              <option value="">Select Division...</option>
              {DIVISIONS.map(div => <option key={div} value={div}>{div}</option>)}
              <option value="Unassigned">Unassigned / Remove</option>
            </select>

            <button className="btn btn-primary" onClick={movePlayerDivision} disabled={isProcessing || !selectedPlayer || !newDivision}>
              {seedingSeasonId === 'current' ? 'Update Live Division' : 'Update Draft Seeding'}
            </button>
            {seedingSeasonId !== 'current' && (
              <button className="btn btn-danger btn-sm" onClick={clearStagedSeeding} disabled={isProcessing} style={{ marginTop: '8px' }}>
                Wipe Season Draft Seeding
              </button>
            )}
          </div>
        </div>

        <div className="card glass">
          <h3 className="card-title">Champions League Seeding</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.85rem' }}>Add/remove players from Champions League.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <UserSearchSelect users={allPlayers} selectedId={selectedChampionsPlayer} onSelect={setSelectedChampionsPlayer} label="Player" onQueryChange={searchUsers} />
            <select value={newChampionsDivision} onChange={e => setNewChampionsDivision(e.target.value)} className="glass">
              <option value="">Select Champions Division...</option>
              {CHAMPIONS_LEAGUE_DIVISIONS.map(div => <option key={div} value={div}>{div}</option>)}
              <option value="None">Remove from Champions League</option>
            </select>
            <button className="btn btn-primary" onClick={updateChampionsLeagueDivision} disabled={isProcessing || !selectedChampionsPlayer || !newChampionsDivision}>
              Assign Champions Rank
            </button>
          </div>
        </div>
      </div>

      {/* QUICK ASSIGNMENT LIST */}
      <div className="card glass" style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 className="card-title">Season Seeding Overview</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Quickly manage assignments for: <strong style={{ color: 'var(--accent-cyan)' }}>{seedingSeasonId === 'current' ? currentSeason : targetSeasonDoc?.name}</strong>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            <button
              className={`btn btn-sm ${showChampionsInQuickList ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowChampionsInQuickList(!showChampionsInQuickList)}
              style={{ marginRight: '16px' }}
            >
              {showChampionsInQuickList ? 'Hide Champions League' : 'Manage Champions League'}
            </button>
            <button className={`btn btn-sm ${seedingFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSeedingFilter('all')}>All</button>
            <button className={`btn btn-sm ${seedingFilter === 'unassigned' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSeedingFilter('unassigned')}>Unassigned</button>
            {DIVISIONS.map(d => (
              <button key={d} className={`btn btn-sm ${seedingFilter === d ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSeedingFilter(d)}>{d}</button>
            ))}
          </div>
        </div>

        <div style={{ maxHeight: '500px', overflowY: 'auto', paddingRight: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {playersBySeeding.sort((a,b) => a.username.localeCompare(b.username)).map(p => (
              <div key={p.id} className="glass" style={{ padding: '12px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.username}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {p.effectiveDiv} {p.superLeagueDivision ? `• Super: ${p.superLeagueDivision}` : ''}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <select
                    className="glass"
                    value={p.effectiveDiv}
                    style={{ fontSize: '0.75rem', padding: '4px 8px', width: '130px' }}
                    onChange={async (e) => {
                      const val = e.target.value
                      setIsProcessing(true)
                      try {
                        if (seedingSeasonId === 'current') {
                          await setDoc(doc(db, 'users', p.id), { division: val }, { merge: true })
                        } else {
                          const staged = { ...(targetSeasonDoc.stagedDivisions || {}) }
                          if (val === 'Unassigned') delete staged[p.id]
                          else staged[p.id] = val
                          await setDoc(doc(db, 'seasons', seedingSeasonId), { stagedDivisions: staged }, { merge: true })
                        }
                        triggerDataRefresh('all')
                      } catch (err) { showToast(err.message, 'error') }
                      setIsProcessing(false)
                    }}
                  >
                    <option value="Unassigned">League: None</option>
                    {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>

                  {showChampionsInQuickList && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px', background: 'rgba(251, 191, 36, 0.05)', borderRadius: '8px', border: '1px solid rgba(251, 191, 36, 0.1)' }}>
                      <span style={{ fontSize: '0.6rem', color: '#fbbf24', fontWeight: 800 }}>Champions League Rank</span>
                      <select
                        className="glass"
                        value={p.superLeagueDivision || 'None'}
                        style={{ fontSize: '0.75rem', padding: '4px 8px', width: '130px', borderColor: p.superLeagueDivision ? '#fbbf24' : 'transparent' }}
                        onChange={async (e) => {
                          const val = e.target.value
                          setIsProcessing(true)
                          try {
                            await setDoc(doc(db, 'users', p.id), { superLeagueDivision: val === 'None' ? null : val }, { merge: true })
                            showToast?.(`${p.username} updated in Champions League`, 'success')
                            triggerDataRefresh('all')
                          } catch (err) { showToast(err.message, 'error') }
                          setIsProcessing(false)
                        }}
                      >
                        <option value="None">None</option>
                        {CHAMPIONS_LEAGUE_DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            ))}
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
                  {s.name !== currentSeason && !s.isLaunched && !s.isArchived && (
                    <button className="btn btn-secondary btn-sm" onClick={() => runSeasonTransitions(s, currentSeason)}>Draft Seeding from {currentSeason}</button>
                  )}
                  {s.name !== currentSeason && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setActiveSeason(s.name)}>Set League Active</button>
                  )}
                  {s.name !== currentSeason && !s.isArchived && (
                    <button className="btn btn-secondary btn-sm" onClick={() => archiveSeason(s)}>Archive</button>
                  )}
                  {s.name !== championsLeagueSeason && (
                    <button className="btn btn-warning btn-sm" onClick={() => updateChampionsLeagueSeason(s.name)}>Set Champions Active</button>
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
