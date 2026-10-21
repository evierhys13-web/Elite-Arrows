import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContextInternal'
import { DIVISIONS } from '../context/constants'
import { db, doc, setDoc, deleteDoc, collection, addDoc, getDocs, writeBatch } from '../firebase'
import Breadcrumbs from '../components/Breadcrumbs'
import UserSearchSelect from '../components/UserSearchSelect'
import { useToast } from '../context/ToastContext'
import { derivePlayerStatsFromResults } from '../utils/playerStats'
import { buildSeasonReportCard } from '../utils/seasonReport'
import { computeDivisionStandings, getDivisionsForSeason } from '../utils/leagueStandings'

export default function SeasonManagement() {
  const { user, getAllUsers, getResults, updateResults, getSeasons, adminData, updateAdminData, triggerDataRefresh, searchUsers, getFixtures } = useAuth()
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
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedLiveSeason, setSelectedLiveSeason] = useState('')

  const allPlayers = getAllUsers()
  const seasons = getSeasons()
  const currentSeason = adminData?.currentSeason || 'Season 1'

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
      tomorrow.setDate(tomorrow.getDate() + 7);
      setStartDate(tomorrow.toISOString().split('T')[0]);
    }
  }, [showCreateForm, startDate]);

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
      showToast(`Season "${newSeasonName}" scheduled successfully!`, 'success')
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

      showToast('Season updated successfully!', 'success')
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
      await setDoc(doc(db, 'seasons', seasonDoc?.id), { ...(seasonDoc || {}), isLaunched: true, status: 'active', setLiveAt: new Date().toISOString() }, { merge: true })

      const batch = writeBatch(db)
      allPlayers.forEach(u => {
        const updates = {}
        const isSubscribedForSeason = (u.subscribedSeasons || []).includes(seasonName)
        const shouldBeSubscribed = u.isSubscribed || isSubscribedForSeason || (seasonName === 'Season 1' && (u.isSubscribed || (u.subscribedSeasons && u.subscribedSeasons.length > 0)))

        if (u.isSubscribed !== shouldBeSubscribed) updates.isSubscribed = shouldBeSubscribed

        const nextDiv = stagedDivisions[u.id] || u.division
        if (u.division !== nextDiv) updates.division = nextDiv

        if (u.manualStats) updates.manualStats = null

        if (Object.keys(updates).length > 0) {
          batch.update(doc(db, 'users', u.id), updates)
        }
      })
      await batch.commit()

      showToast(`Season ${seasonName} is now LIVE. Seeding applied successfully.`, 'success')
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
      await updateAdminData({ currentSeason: 'Season 1' })

      const launchedSeasons = seasons.filter(s => s.isLaunched && s.name !== 'Season 1')
      const batch = writeBatch(db)
      launchedSeasons.forEach(s => {
        batch.update(doc(db, 'seasons', s.id), { isLaunched: false, status: 'upcoming' })
      })

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

  const generateReportCards = async (season) => {
    if (!season?.name) return showToast('Select a season first', 'error')
    if (!confirm(`Generate season report cards for "${season.name}" for all players? Only the 1st place finisher in each division is added to the Hall of Fame.`)) return

    setIsProcessing(true)
    try {
      const allResults = getResults()
      const fixtures = getFixtures() || []
      const batch = writeBatch(db)
      let count = 0
      let championCount = 0

      allPlayers.forEach(player => {
        const card = buildSeasonReportCard({ user: player, results: allResults, fixtures, season: season.name })
        if (!card) return
        const docId = `${season.name.replace(/[^a-zA-Z0-9]/g, '_')}_${player.id}`
        batch.set(doc(db, 'seasonReports', docId), card)
        count++
      })

      const existingSnap = await getDocs(collection(db, 'hallOfFame'))
      const existingKeys = new Set(existingSnap.docs.map(d => {
        const data = d.data()
        return `${data.userId}:${data.season}`
      }))

      const divisions = getDivisionsForSeason(season.name, adminData).filter(d => d !== 'Overall')
      for (const div of divisions) {
        const standings = computeDivisionStandings({
          allUsers: allPlayers,
          results: allResults,
          fixtures,
          adminData,
          seasonName: season.name,
          seasonDoc: season,
          division: div
        })
        const champion = standings.find(p => p.stats.played >= 1)
        if (!champion) continue
        const key = `${champion.id}:${season.name}`
        if (existingKeys.has(key)) continue
        batch.set(doc(collection(db, 'hallOfFame')), {
          userId: champion.id,
          username: champion.username || champion.nickname || 'Unknown',
          name: `${div} Division Champion`,
          icon: '🏆',
          season: season.name,
          visible: true,
          awardedAt: new Date().toISOString()
        })
        championCount++
      }

      await batch.commit()
      showToast(`Generated ${count} report cards${championCount ? ` + ${championCount} Hall of Fame champion(s)` : ''} for ${season.name}`, 'success')
      triggerDataRefresh('seasons')
    } catch (e) {
      showToast('Error generating report cards: ' + e.message, 'error')
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
    if (!confirm('Permanently delete this season record? Match results will NOT be deleted.')) return
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
    if (!confirm(`DANGER: This will permanently delete ALL approved and pending results for "${currentSeason}". This cannot be undone.`)) return
    
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
    if (!confirm(`Calculate promotions/relegations based on "${fromSeasonName}" and save as a DRAFT for "${targetSeason.name}"?`)) return

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
        await setDoc(doc(db, 'users', selectedPlayer), { division: newDivision }, { merge: true })
        const p = allPlayers.find(u => u.id === selectedPlayer)
        showToast(`${p?.username} moved to ${newDivision} in LIVE season`, 'success')
      } else {
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

  const clearAllDivisions = async () => {
    if (!confirm('Set division to "Unassigned" for EVERY player in the league?')) return

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

    if (!confirm(`Wipe ALL drafted seeding for "${targetSeason.name}"?`)) return

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
    <div className="page animate-fade-in" style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '60px' }}>
      <Breadcrumbs items={[{ label: 'Admin', path: '/admin' }, { label: 'Seasons Control' }]} />

      <div className="page-header" style={{ marginBottom: '32px' }}>
        <h1 className="page-title text-gradient">🗓️ Season & League Control Hub</h1>
        <p style={{ color: 'var(--text-muted)' }}>Manage league phases, season scheduling, divisions, and player seeding seamlessly.</p>
      </div>

      {/* SECTION 1: LIVE ENVIRONMENT & QUICK ACTIONS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div className="card glass" style={{ borderLeft: '4px solid var(--accent-cyan)' }}>
          <h3 className="card-title">⚡ Live Season Control</h3>
          <div style={{ padding: '16px', background: 'rgba(0,0,0,0.25)', borderRadius: '14px', marginBottom: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-cyan)', fontWeight: 800, marginBottom: '4px' }}>Active League Season</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'white' }}>{currentSeason}</div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              className="glass"
              value={selectedLiveSeason}
              onChange={(e) => setSelectedLiveSeason(e.target.value)}
              style={{ flex: 1, fontSize: '0.85rem', padding: '10px' }}
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
            <button className="btn btn-danger btn-sm btn-block" onClick={archiveSeason4Special} disabled={isProcessing} style={{ marginTop: '12px' }}>
              Archive Season 4 Now
            </button>
          )}
        </div>

        <div className="card glass">
          <h3 className="card-title">🛠️ Admin Maintenance Tools</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
            <button className="btn btn-primary btn-block" onClick={() => { setEditingSeason(null); setShowCreateForm(!showCreateForm); }}>
              {showCreateForm ? 'Close Schedule Form' : '+ Schedule New Season'}
            </button>
            {currentSeason !== 'Season 1' && (
              <button className="btn btn-warning btn-block" onClick={emergencyRevert} disabled={isProcessing}>
                Emergency Revert to Season 1
              </button>
            )}
            <button className="btn btn-danger btn-block" onClick={clearAllDivisions} disabled={isProcessing}>
              Reset All Divisions (Unassigned)
            </button>
            <button className="btn btn-danger btn-block" onClick={resetCurrentSeasonTable} disabled={isProcessing}>
              Clear Current Season Results
            </button>
          </div>
        </div>
      </div>

      {/* SCHEDULE FORM MODAL / CARD */}
      {(showCreateForm || editingSeason) && (
        <div className="card glass animate-fade-in" style={{ marginBottom: '32px', border: '1px solid var(--accent-cyan)' }}>
          <h3 className="card-title">{editingSeason ? 'Edit Season Details' : 'Schedule New Season'}</h3>
          <div className="form-group">
            <label>Season Name</label>
            <input
              type="text"
              value={newSeasonName}
              onChange={(e) => setNewSeasonName(e.target.value)}
              placeholder="e.g. Season 5, Spring 2027..."
              className="glass"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
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
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Scheduled seasons remain hidden from members until activated by an admin.
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={editingSeason ? updateSeason : createSeason} disabled={isProcessing}>
              {isProcessing ? 'Processing...' : editingSeason ? 'Save Changes' : 'Publish Season'}
            </button>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setEditingSeason(null); setNewSeasonName(''); setStartDate(''); setStartTime('00:00'); setShowCreateForm(false); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* SECTION 2: PLAYER SEEDING & ASSIGNMENT HUB */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div className="card glass">
          <h3 className="card-title">🎯 Player Division Seeding</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.85rem' }}>Assign players to divisions for live or upcoming seasons.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Target Season</label>
              <select value={seedingSeasonId} onChange={e => setSeedingSeasonId(e.target.value)} className="glass">
                <option value="current">Current Live Season ({currentSeason})</option>
                {seasons.filter(s => s.name !== currentSeason).map(s => (
                  <option key={s.id} value={s.id}>{s.name} {s.isArchived ? '(Archived)' : '(Upcoming)'}</option>
                ))}
              </select>
            </div>

            <UserSearchSelect users={allPlayers} selectedId={selectedPlayer} onSelect={setSelectedPlayer} label="Select Player" onQueryChange={searchUsers} />

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>New Division</label>
              <select value={newDivision} onChange={e => setNewDivision(e.target.value)} className="glass">
                <option value="">Select Division...</option>
                {DIVISIONS.map(div => <option key={div} value={div}>{div}</option>)}
                <option value="Unassigned">Unassigned / Remove</option>
              </select>
            </div>

            <button className="btn btn-primary" onClick={movePlayerDivision} disabled={isProcessing || !selectedPlayer || !newDivision}>
              {seedingSeasonId === 'current' ? 'Update Live Division' : 'Update Draft Seeding'}
            </button>
            {seedingSeasonId !== 'current' && (
              <button className="btn btn-danger btn-sm" onClick={clearStagedSeeding} disabled={isProcessing}>
                Wipe Draft Seeding for this Season
              </button>
            )}
          </div>
        </div>

        {/* SEEDING OVERVIEW GRID */}
        <div className="card glass">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 className="card-title" style={{ margin: 0 }}>📋 Seeding Roster</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: 700 }}>
              {seedingSeasonId === 'current' ? currentSeason : targetSeasonDoc?.name}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '14px' }}>
            <button className={`btn btn-sm ${seedingFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSeedingFilter('all')}>All</button>
            <button className={`btn btn-sm ${seedingFilter === 'unassigned' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSeedingFilter('unassigned')}>Unassigned</button>
            {DIVISIONS.map(d => (
              <button key={d} className={`btn btn-sm ${seedingFilter === d ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSeedingFilter(d)}>{d}</button>
            ))}
          </div>

          <div style={{ maxHeight: '360px', overflowY: 'auto', paddingRight: '4px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {playersBySeeding.sort((a,b) => a.username.localeCompare(b.username)).map(p => (
                <div key={p.id} className="glass" style={{ padding: '10px 14px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.username}</div>
                  </div>
                  <select
                    className="glass"
                    value={p.effectiveDiv}
                    style={{ fontSize: '0.75rem', padding: '6px 10px', width: '130px' }}
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
                    <option value="Unassigned">Unassigned</option>
                    {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: SEASON ARCHIVE & MANAGEMENT */}
      <div className="card glass">
        <h3 className="card-title">🏛️ Season Archive & Management</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
          {seasons.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No historical seasons recorded yet.</p>
          ) : (
            seasons.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(s => (
              <div key={s.id} className="glass" style={{ padding: '18px', borderRadius: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    {s.name}
                    {s.name === currentSeason && <span style={{ fontSize: '0.65rem', background: 'var(--success)', color: 'black', padding: '2px 8px', borderRadius: '99px', fontWeight: 800 }}>LIVE</span>}
                    {s.isArchived && <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '99px' }}>ARCHIVED</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Created {new Date(s.createdAt).toLocaleDateString()}
                    {s.setLiveAt && ` • Went live ${new Date(s.setLiveAt).toLocaleDateString()}`}
                    {s.endedAt && ` • Ended ${new Date(s.endedAt).toLocaleDateString()}`}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
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
                    <button className="btn btn-secondary btn-sm" onClick={() => runSeasonTransitions(s, currentSeason)}>Draft Seeding</button>
                  )}
                  {s.name !== currentSeason && (
                    <button className="btn btn-primary btn-sm" onClick={() => setActiveSeason(s.name)}>Set Live</button>
                  )}
                  <button className="btn btn-secondary btn-sm" onClick={() => generateReportCards(s)}>Report Cards & HoF</button>
                  {!s.isArchived ? (
                    <button className="btn btn-warning btn-sm" onClick={() => endSeason(s)}>End Season</button>
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
