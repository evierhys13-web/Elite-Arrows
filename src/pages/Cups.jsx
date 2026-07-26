import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'
import { db, doc, setDoc, deleteDoc, getDoc, collection, query, where, getDocs, writeBatch } from '../firebase'
import { ADMIN_EMAILS } from '../config'
import UserSearchSelect from '../components/UserSearchSelect'
import { useToast } from '../context/ToastContext'

export default function CupTournaments() {
  const { user, getAllUsers, getCups, getFixtures, triggerDataRefresh, searchUsers } = useAuth()
  const { showToast } = useToast()
  const [showCreate, setShowCreate] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    entryFee: 5,
    maxPlayers: 8,
    type: 'knockout', // knockout, groups, world_cup, group_knockout
    playersPerGroup: 4,
    advancePerGroup: 2,
    allowBestThird: true,
    targetDurationDays: 14
  })
  const [selectedPlayers, setSelectedPlayers] = useState([])
  const [matches, setMatches] = useState([])
  const [groups, setGroups] = useState([])
  const [roundFormats, setRoundFormats] = useState({})
  const [refreshKey, setRefreshKey] = useState(0)
  const [expandedCups, setExpandedCups] = useState({})
  const [showSwapModal, setShowSwapModal] = useState(false)
  const [swapCup, setSwapCup] = useState(null)
  const [playerToRemove, setPlayerToRemove] = useState('')
  const [playerToAdd, setPlayerToAdd] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('active')

  const toggleCup = (cupId) => {
    setExpandedCups(prev => ({
      ...prev,
      [cupId]: !prev[cupId]
    }))
  }

  const handleSwapPlayer = async () => {
    if (!swapCup || !playerToRemove || !playerToAdd) return showToast?.('Please select both players', 'error')

    setIsSubmitting(true)
    try {
      const cupRef = doc(db, 'cups', String(swapCup.id))
      const cupSnap = await getDoc(cupRef)
      if (!cupSnap.exists()) throw new Error('Cup not found')

      const cupData = cupSnap.data()
      const newPlayer = allUsers.find(u => u.id === playerToAdd)
      if (!newPlayer) throw new Error('New player not found')

      // 1. Update participants list
      const updatedPlayers = cupData.players.map(pid => String(pid) === String(playerToRemove) ? playerToAdd : pid)

      // 2. Update groups
      const updatedGroups = (cupData.groups || []).map(g => ({
        ...g,
        players: g.players.map(pid => String(pid) === String(playerToRemove) ? playerToAdd : pid)
      }))

      // 3. Update all matches
      const updatedMatches = cupData.matches.map(m => ({
        ...m,
        player1: String(m.player1) === String(playerToRemove) ? playerToAdd : m.player1,
        player2: String(m.player2) === String(playerToRemove) ? playerToAdd : m.player2,
        winner: String(m.winner) === String(playerToRemove) ? playerToAdd : m.winner
      }))

      await setDoc(cupRef, { ...cupData, players: updatedPlayers, groups: updatedGroups, matches: updatedMatches }, { merge: true })

      // 4. Update Fixtures
      const fixturesSnap = await getDocs(query(collection(db, 'fixtures'), where('cupId', '==', parseInt(swapCup.id))))
      const batch = writeBatch(db)
      let fixtureCount = 0

      fixturesSnap.docs.forEach(fDoc => {
        const fData = fDoc.data()
        let changed = false
        const updates = {}

        if (String(fData.player1Id) === String(playerToRemove)) {
          updates.player1Id = playerToAdd
          updates.player1 = newPlayer.username
          changed = true
        }
        if (String(fData.player2Id) === String(playerToRemove)) {
          updates.player2Id = playerToAdd
          updates.player2 = newPlayer.username
          changed = true
        }

        if (changed) {
          batch.update(fDoc.ref, updates)
          fixtureCount++
        }
      })

      if (fixtureCount > 0) await batch.commit()

      showToast?.(`Swapped player in bracket and ${fixtureCount} fixtures.`, 'success')
      setShowSwapModal(false)
      setPlayerToRemove('')
      setPlayerToAdd('')
      triggerDataRefresh('all')
      setRefreshKey(prev => prev + 1)
    } catch (e) {
      showToast?.('Error: ' + e.message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isEmailAdmin = user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())
  const isAdmin = isEmailAdmin || user?.isAdmin || user?.isTournamentAdmin || user?.isCupAdmin
  const isSubscribed = user?.isSubscribed === true || isAdmin

  const allUsers = getAllUsers()
  const cups = getCups()
  const selectablePlayers = allUsers.filter(u => !selectedPlayers.includes(u.id))

  const handlePlayerSelect = (playerId) => {
    if (selectedPlayers.includes(playerId)) {
      setSelectedPlayers(selectedPlayers.filter(id => id !== playerId))
      setMatches([])
    } else if (selectedPlayers.length < formData.maxPlayers) {
      setSelectedPlayers([...selectedPlayers, playerId])
      setMatches([])
    }
  }

  const generateTournament = () => {
    if (selectedPlayers.length < 2) return alert('Need at least 2 players')
    
    const shuffled = [...selectedPlayers].sort(() => Math.random() - 0.5)
    let newMatches = []
    let newGroups = []
    let numKnockoutRounds = 0
    let totalPlayersInKnockout = 0

    const defaultFormats = {}

    if (formData.type === 'knockout') {
      numKnockoutRounds = Math.ceil(Math.log2(shuffled.length))
      totalPlayersInKnockout = shuffled.length

      for (let r = 1; r <= numKnockoutRounds; r++) {
        defaultFormats[r] = getFormatForRound(r, numKnockoutRounds)
      }

      newMatches = buildKnockoutMatches(shuffled, numKnockoutRounds, 1)
    }
    else if (formData.type === 'groups' || formData.type === 'world_cup' || formData.type === 'group_knockout') {
      const pPerG = formData.playersPerGroup
      const numGroups = Math.ceil(shuffled.length / pPerG)

      // Assign players to groups
      for (let i = 0; i < numGroups; i++) {
        const groupPlayers = shuffled.slice(i * pPerG, (i + 1) * pPerG)
        newGroups.push({
          id: String.fromCharCode(65 + i), // A, B, C...
          players: groupPlayers
        })

        // Generate round-robin matches for this group
        // Stage 0 will be the group stage
        for (let j = 0; j < groupPlayers.length; j++) {
          for (let k = j + 1; k < groupPlayers.length; k++) {
            newMatches.push({
              id: `g_${newGroups[i].id}_${j}_${k}`,
              stage: 'groups',
              group: newGroups[i].id,
              player1: groupPlayers[j],
              player2: groupPlayers[k],
              winner: null,
              score1: null,
              score2: null
            })
          }
        }
      }

      defaultFormats[0] = { startScore: 501, bestOf: 3, firstTo: 2 } // Group stage format

      if (formData.type === 'world_cup' || formData.type === 'group_knockout') {
        const advanceCount = formData.type === 'group_knockout' ? (formData.advancePerGroup || 2) : 2
        const totalAdvancers = numGroups * advanceCount

        // If best 3rd is disabled, we only take the direct advancers and fill with Byes
        const effectiveAdvancers = (formData.type === 'world_cup' && !formData.allowBestThird) ? totalAdvancers : totalAdvancers

        totalPlayersInKnockout = Math.pow(2, Math.ceil(Math.log2(totalAdvancers)))
        const numExtraNeeded = totalPlayersInKnockout - totalAdvancers

        numKnockoutRounds = Math.ceil(Math.log2(totalPlayersInKnockout))

        for (let r = 1; r <= numKnockoutRounds; r++) {
          defaultFormats[r] = getFormatForRound(r, numKnockoutRounds)
        }

        // Build empty knockout bracket starting from round 1
        const knockoutMatches = buildKnockoutMatches(new Array(totalPlayersInKnockout).fill(null), numKnockoutRounds, 1)

        // Label the initial knockout matches with their source
        // Implementation of crossover: A1 vs B2, B1 vs C2, C1 vs D2... (Shifted Crossover)
        // This satisfies the "Top 1 of Group A vs Top 2 of Group B" requirement

        // 1. Assign Winners (Position 1)
        for (let g = 0; g < numGroups && g < knockoutMatches.length; g++) {
          knockoutMatches[g].sourceP1 = { group: String.fromCharCode(65 + g), position: 1 }
        }

        // 2. Assign Runners-up (Position 2) with a shift
        // Pairing: Winner of Group G vs Runner-up of Group G+1
        if (advanceCount >= 2) {
          for (let g = 0; g < numGroups && g < knockoutMatches.length; g++) {
            const runnerUpGroupIdx = (g + 1) % numGroups
            knockoutMatches[g].sourceP2 = { group: String.fromCharCode(65 + runnerUpGroupIdx), position: 2 }
          }
        }

        // 3. Assign best next-placed players to fill remaining bracket spots (if enabled)
        if (formData.type === 'group_knockout' || (formData.type === 'world_cup' && formData.allowBestThird)) {
          // Find all empty slots (P1 or P2) in knockout round 1
          const emptySlots = []
          knockoutMatches.forEach((m, idx) => {
            if (!m.sourceP1) emptySlots.push({ mIdx: idx, target: 'sourceP1' })
            if (!m.sourceP2) emptySlots.push({ mIdx: idx, target: 'sourceP2' })
          })

          for (let i = 0; i < numExtraNeeded && i < emptySlots.length; i++) {
            const { mIdx, target } = emptySlots[i]
            knockoutMatches[mIdx][target] = { bestExtra: true, position: i + 1 }
          }
        }

        newMatches = [...newMatches, ...knockoutMatches]
      }
    }

    // Calculate stage duration estimates
    const totalStages = (formData.type === 'knockout') ? numKnockoutRounds : (1 + numKnockoutRounds)
    const stageDays = Math.max(1, Math.round((formData.targetDurationDays / totalStages) * 10) / 10)

    setRoundFormats({ ...defaultFormats, _stageDays: stageDays })
    setMatches(newMatches)
    setGroups(newGroups)
  }

  const getFormatForRound = (round, totalRounds) => {
    if (round === totalRounds) return { startScore: 501, bestOf: 11, firstTo: 6 }
    if (round === totalRounds - 1 && totalRounds > 1) return { startScore: 501, bestOf: 9, firstTo: 5 }
    if (round === totalRounds - 2 && totalRounds > 2) return { startScore: 501, bestOf: 7, firstTo: 4 }
    return { startScore: 501, bestOf: 3, firstTo: 2 }
  }

  const buildKnockoutMatches = (players, numRounds, startRoundId) => {
    const knockoutMatches = []
    let matchId = 1000 // Offset for knockout IDs if needed, or just unique
    let roundStartId = 1001
    
    // We need to know how many matches per round to link them
    const roundMatchesCount = []
    for (let r = 1; r <= numRounds; r++) {
      roundMatchesCount[r] = Math.ceil(players.length / Math.pow(2, r))
    }

    let globalMatchId = 1000
    const matchesByRound = {}

    for (let round = 1; round <= numRounds; round++) {
      const count = roundMatchesCount[round]
      matchesByRound[round] = []
      
      for (let i = 0; i < count; i++) {
        const m = {
          id: globalMatchId++,
          stage: 'knockout',
          round,
          matchNum: i + 1,
          player1: round === 1 ? (players[i * 2] || null) : null,
          player2: round === 1 ? (players[i * 2 + 1] || null) : null,
          winner: null,
          nextMatchId: null
        }
        matchesByRound[round].push(m)
        knockoutMatches.push(m)
      }
    }

    // Link matches
    for (let round = 1; round < numRounds; round++) {
      const currentRoundMatches = matchesByRound[round]
      const nextRoundMatches = matchesByRound[round + 1]

      currentRoundMatches.forEach((m, idx) => {
        const nextM = nextRoundMatches[Math.floor(idx / 2)]
        if (nextM) m.nextMatchId = nextM.id
      })
    }

    return knockoutMatches
  }

  const updateRoundFormat = (round, field, value) => {
    const val = parseInt(value) || 0
    setRoundFormats(prev => {
      const current = prev[round] || { startScore: 501, bestOf: 3, firstTo: 2, entryMode: 'bestOf' }
      const newFormat = { ...current, [field]: val }

      if (field === 'entryMode') {
        newFormat.entryMode = value // value is string here
      } else if (field === 'bestOf') {
        newFormat.firstTo = Math.ceil(val / 2)
      } else if (field === 'firstTo') {
        newFormat.bestOf = (val * 2) - 1
      }

      return { ...prev, [round]: newFormat }
    })
  }

  const renderFormatEntry = (round, label) => {
    const format = roundFormats[round] || { startScore: 501, bestOf: 3, firstTo: 2, entryMode: 'bestOf' }
    const mode = format.entryMode || 'bestOf'

    return (
      <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '12px', marginBottom: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h5 style={{ color: 'var(--accent-cyan)', marginBottom: '12px', fontSize: '0.8rem', textTransform: 'uppercase' }}>{label}</h5>

        <div className="form-group" style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '0.7rem', opacity: 0.6 }}>Start Score</label>
          <select
            value={format.startScore}
            onChange={(e) => updateRoundFormat(round, 'startScore', e.target.value)}
            style={{ fontSize: '0.8rem', padding: '8px' }}
          >
            <option value={301}>301</option>
            <option value={501}>501</option>
            <option value={601}>601</option>
            <option value={701}>701</option>
          </select>
        </div>

        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '4px', marginBottom: '12px' }}>
          <button
            className={`btn btn-xs ${mode === 'bestOf' ? 'btn-primary' : ''}`}
            style={{ flex: 1, fontSize: '0.65rem', padding: '4px', background: mode === 'bestOf' ? '' : 'transparent', border: 'none' }}
            onClick={() => updateRoundFormat(round, 'entryMode', 'bestOf')}
          >
            Best Of
          </button>
          <button
            className={`btn btn-xs ${mode === 'firstTo' ? 'btn-primary' : ''}`}
            style={{ flex: 1, fontSize: '0.65rem', padding: '4px', background: mode === 'firstTo' ? '' : 'transparent', border: 'none' }}
            onClick={() => updateRoundFormat(round, 'entryMode', 'firstTo')}
          >
            First To
          </button>
        </div>

        {mode === 'bestOf' ? (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <select
              value={format.bestOf}
              onChange={(e) => updateRoundFormat(round, 'bestOf', e.target.value)}
              style={{ fontSize: '0.8rem', padding: '8px' }}
            >
              {[1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21].map(v => (
                <option key={v} value={v}>Best of {v} legs</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                min="1"
                value={format.firstTo}
                onChange={(e) => updateRoundFormat(round, 'firstTo', e.target.value)}
                style={{ fontSize: '0.8rem', padding: '8px 12px', width: '100%' }}
                placeholder="Target legs"
              />
              <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', opacity: 0.5 }}>legs</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  const saveCup = async () => {
    if (!formData.name) return alert('Enter cup name')
    if (matches.length === 0) return alert('Generate a bracket first')
    
    const newCup = {
      id: Date.now(),
      ...formData,
      players: selectedPlayers,
      matches,
      groups,
      roundFormats,
      createdAt: new Date().toISOString(),
      status: 'active',
      currentRound: 1
    }
    
    const initialMatches = matches.filter(m => m.stage === 'groups' || (m.stage === 'knockout' && m.round === 1))
    const existingFixtures = getFixtures()
    
      const newFixtures = initialMatches.filter(m => m.player1 && m.player2).map(m => {
      const format = roundFormats[m.round || 0] || { startScore: 501, bestOf: 3, firstTo: 2 }
      return {
        id: Date.now() + m.id,
        cupId: newCup.id,
        cupName: formData.name,
        startScore: format.startScore || 501,
        bestOf: format.bestOf || 3,
        firstTo: format.firstTo || Math.ceil((format.bestOf || 3) / 2),
        player1: m.player1,
        player1Id: m.player1,
        player2: m.player2,
        player2Id: m.player2,
        matchId: m.id,
        round: m.round || 0,
        stage: m.stage,
        group: m.group || null,
        date: '',
        time: '',
        scheduledBy: m.player1,
        status: 'accepted',
        proposalStatus: 'accepted',
        proposedDate: '',
        proposedTime: '',
        counterDate: '',
        counterTime: '',
        createdAt: new Date().toISOString()
      }
    })
    
    localStorage.setItem('eliteArrowsFixtures', JSON.stringify([...existingFixtures, ...newFixtures]))
    localStorage.setItem('eliteArrowsCups', JSON.stringify([...cups, newCup]))
    
    try {
      await setDoc(doc(db, 'cups', newCup.id.toString()), newCup)
      for (const fixture of newFixtures) {
        await setDoc(doc(db, 'fixtures', fixture.id.toString()), fixture)
      }
      triggerDataRefresh('cups')
      triggerDataRefresh('fixtures')
    } catch (e) {
      console.log('Error saving to Firebase:', e)
    }
    
    alert('Cup tournament created! Fixtures have been created for Round 1 matches. ' + newFixtures.length + ' fixtures made.')
    setShowCreate(false)
    setSelectedPlayers([])
    setMatches([])
    setRefreshKey(prev => prev + 1)
  }

  if (!isSubscribed && !isAdmin) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Cup Tournaments</h1>
        </div>
        <div className="card">
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
            Subscribe to access Cup Tournaments.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Cup Tournaments</h1>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Create Cup
          </button>
        )}
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 className="card-title">Create Cup Tournament</h3>
          <div className="form-group">
            <label>Cup Name</label>
            <input 
              type="text" 
              value={formData.name} 
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="e.g., Winter Cup 2024"
            />
          </div>
          <div className="form-group">
            <label>Tournament Style</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginTop: '5px' }}>
              <button
                type="button"
                className={`btn ${formData.type === 'knockout' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '10px 5px' }}
                onClick={() => { setFormData({...formData, type: 'knockout'}); setMatches([]); }}
              >
                🎯 Knockout
              </button>
              <button
                type="button"
                className={`btn ${formData.type === 'groups' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '10px 5px' }}
                onClick={() => { setFormData({...formData, type: 'groups'}); setMatches([]); }}
              >
                📊 Groups Only
              </button>
              <button
                type="button"
                className={`btn ${formData.type === 'group_knockout' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '10px 5px', border: formData.type === 'group_knockout' ? '2px solid var(--accent-cyan)' : 'none' }}
                onClick={() => { setFormData({...formData, type: 'group_knockout'}); setMatches([]); }}
              >
                📋 Groups → KO
              </button>
              <button
                type="button"
                className={`btn ${formData.type === 'world_cup' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '10px 5px', border: formData.type === 'world_cup' ? '2px solid gold' : 'none' }}
                onClick={() => { setFormData({...formData, type: 'world_cup'}); setMatches([]); }}
              >
                🏆 World Cup
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              {formData.type === 'knockout' && 'Standard single-elimination bracket. Losers are out instantly.'}
              {formData.type === 'groups' && 'Players split into groups and play everyone in their group. No knockout phase.'}
              {formData.type === 'group_knockout' && 'Group stage followed by a knockout bracket for qualifiers.'}
              {formData.type === 'world_cup' && 'The professional format: Group stage followed by a knockout bracket for qualifiers.'}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div className="form-group">
              <label>Entry Fee (£)</label>
              <input
                type="number"
                value={formData.entryFee}
                onChange={(e) => setFormData({...formData, entryFee: parseInt(e.target.value)})}
              />
            </div>
            <div className="form-group">
              <label>Max Players</label>
              <select
                value={formData.maxPlayers}
                onChange={(e) => {
                  const maxPlayers = parseInt(e.target.value)
                  setFormData({...formData, maxPlayers})
                  setSelectedPlayers(prev => prev.slice(0, maxPlayers))
                  setMatches([])
                }}
              >
                {[4, 8, 12, 16, 24, 32, 48, 64].map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Target Total Duration (Days)</label>
            <input
              type="number"
              min="1"
              value={formData.targetDurationDays}
              onChange={(e) => setFormData({...formData, targetDurationDays: parseInt(e.target.value)})}
              placeholder="e.g. 14"
            />
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Used to calculate recommended deadlines for each stage.
            </p>
          </div>

          {(formData.type === 'groups' || formData.type === 'world_cup' || formData.type === 'group_knockout') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className="form-group">
                <label>Players per Group</label>
                <select
                  value={formData.playersPerGroup}
                  onChange={(e) => setFormData({...formData, playersPerGroup: parseInt(e.target.value)})}
                >
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                  <option value={6}>6</option>
                </select>
              </div>
              {formData.type === 'world_cup' && (
                <div className="form-group">
                  <label>Advancement Rule</label>
                  <div style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.85rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <span style={{ color: 'var(--success)', fontWeight: 800 }}>✓ Top 2</span> from every group advance.<br/>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '8px', color: formData.allowBestThird ? 'white' : 'var(--text-muted)' }}>
                      <input
                        type="checkbox"
                        checked={formData.allowBestThird}
                        onChange={(e) => setFormData({...formData, allowBestThird: e.target.checked})}
                      />
                      <span>Include best 3rd placed players to fill bracket</span>
                    </label>
                  </div>
                </div>
              )}
              {formData.type === 'group_knockout' && (
                <div className="form-group">
                  <label>Advance per Group</label>
                  <select
                    value={formData.advancePerGroup}
                    onChange={(e) => setFormData({...formData, advancePerGroup: parseInt(e.target.value)})}
                  >
                    <option value={1}>1 (Winner only)</option>
                    <option value={2}>2 (Top 2)</option>
                    <option value={3}>3 (Top 3)</option>
                    <option value={4}>4 (Top 4)</option>
                  </select>
                </div>
              )}
            </div>
          )}

          <h4 style={{ marginTop: '20px', marginBottom: '10px' }}>Select Players ({selectedPlayers.length}/{formData.maxPlayers})</h4>
          {selectedPlayers.length < formData.maxPlayers ? (
            <UserSearchSelect
              users={selectablePlayers}
              selectedId={null}
              onSelect={handlePlayerSelect}
              placeholder="Search by name, nickname, or DartCounter..."
              label=""
              maxResults={50}
              onQueryChange={searchUsers}
            />
          ) : (
            <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Maximum players selected. Remove someone below to add another player.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px', marginTop: '15px' }}>
            {selectedPlayers.map((playerId, index) => {
              const player = allUsers.find(u => u.id === playerId)
              if (!player) return null
              return (
                <div
                  key={player.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    padding: '8px 10px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px'
                  }}
                >
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {index + 1}. {player.username}
                  </span>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handlePlayerSelect(player.id)}
                    style={{ padding: '4px 8px', flexShrink: 0 }}
                  >
                    Remove
                  </button>
                </div>
              )
            })}
          </div>
          {selectedPlayers.length < 2 && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '10px' }}>
              Search and add at least 2 players to create a cup
            </p>
          )}

          {selectedPlayers.length >= 2 && (
            <button className="btn btn-primary btn-block" style={{ marginTop: '20px' }} onClick={generateTournament}>
              Generate Bracket
            </button>
          )}

          {matches.length > 0 && (
            <>
              <h4 style={{ marginTop: '20px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                {formData.type === 'world_cup' ? '🏆 World Cup Structure' : formData.type === 'group_knockout' ? '📋 Groups → Knockout Structure' : 'Bracket Preview & Round Formats'}
                {formData.type === 'world_cup' && <span style={{ fontSize: '0.7rem', background: 'gold', color: 'black', padding: '2px 8px', borderRadius: '4px', fontWeight: 900 }}>ELITE FORMAT</span>}
              </h4>

                {formData.type === 'world_cup' && (
                <div style={{ background: 'rgba(255,215,0,0.05)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(255,215,0,0.2)', marginBottom: '20px' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <strong>Phase 1:</strong> {groups.length} Groups of {formData.playersPerGroup} players. Top 2 from each group {formData.allowBestThird ? '+ best 3rd placed ' : ''}qualify.<br/>
                    <strong>Phase 2:</strong> {Math.ceil(Math.log2(matches.filter(m => m.stage === 'knockout' && m.round === 1).length * 2))}-round knockout bracket ({matches.filter(m => m.stage === 'knockout' && m.round === 1).length * 2} players).<br/>
                    <strong style={{ color: 'var(--accent-cyan)' }}>⏱ Estimated Pace:</strong> {roundFormats._stageDays} days per stage.
                  </p>
                </div>
              )}

              {formData.type === 'group_knockout' && (
                <div style={{ background: 'rgba(56,189,248,0.05)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(56,189,248,0.2)', marginBottom: '20px' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <strong>Phase 1:</strong> {groups.length} Groups of {formData.playersPerGroup} players. Top {formData.advancePerGroup || 2} from each group qualify.<br/>
                    <strong>Phase 2:</strong> {Math.ceil(Math.log2(matches.filter(m => m.stage === 'knockout' && m.round === 1).length * 2))}-round knockout bracket ({matches.filter(m => m.stage === 'knockout' && m.round === 1).length * 2} players).<br/>
                    <strong style={{ color: 'var(--accent-cyan)' }}>⏱ Estimated Pace:</strong> {roundFormats._stageDays} days per stage.
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', gap: '20px', overflowX: 'auto', padding: '10px' }}>
                {formData.type !== 'knockout' && (
                  <div style={{ minWidth: '220px' }}>
                    {renderFormatEntry(0, 'Group Stage')}
                    {groups.map(g => (
                      <div key={g.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', marginBottom: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontWeight: 900, fontSize: '0.75rem', color: 'var(--accent-cyan)', marginBottom: '5px' }}>GROUP {g.id}</div>
                        {g.players.map(pid => (
                          <div key={pid} style={{ fontSize: '0.75rem', opacity: 0.8 }}>• {allUsers.find(u => u.id === pid)?.username}</div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {Array.from(new Set(matches.filter(m => m.stage === 'knockout').map(m => m.round))).sort((a, b) => a - b).map(round => (
                  <div key={round} style={{ minWidth: '200px' }}>
                    {renderFormatEntry(round,
                      round === Math.max(...matches.filter(m => m.stage === 'knockout').map(m => m.round)) ? 'Final' :
                      round === Math.max(...matches.filter(m => m.stage === 'knockout').map(m => m.round)) - 1 ? 'Semi-Final' :
                      round === Math.max(...matches.filter(m => m.stage === 'knockout').map(m => m.round)) - 2 ? 'Quarter-Final' : `KO Round ${round}`
                    )}
                    
                    {matches.filter(m => m.round === round && m.stage === 'knockout').map(match => (
                      <div key={match.id} style={{ 
                        background: 'var(--bg-secondary)', 
                        padding: '10px', 
                        borderRadius: '8px',
                        marginBottom: '10px',
                        border: '1px solid rgba(255,255,255,0.05)'
                      }}>
                        <div style={{ fontSize: '0.85rem', textAlign: 'center' }}>
                          {match.sourceP1 ? `Group ${match.sourceP1.group} P${match.sourceP1.position}` : (allUsers.find(u => u.id === match.player1)?.username || 'TBD')}
                          <br/>vs<br/>
                          {match.sourceP2 ? `Group ${match.sourceP2.group} P${match.sourceP2.position}` : (allUsers.find(u => u.id === match.player2)?.username || 'TBD')}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <button className="btn btn-primary btn-block" style={{ marginTop: '20px', background: formData.type === 'world_cup' ? 'linear-gradient(45deg, #f59e0b, #d97706)' : '' }} onClick={saveCup}>
                {formData.type === 'world_cup' ? '🏆 Create World Cup' : formData.type === 'group_knockout' ? '📋 Create Groups → Knockout Cup' : 'Create Cup Tournament'}
              </button>
            </>
          )}

          <button className="btn btn-secondary btn-block" style={{ marginTop: '10px' }} onClick={() => { setShowCreate(false); setSelectedPlayers([]); setMatches([]); }}>
            Cancel
          </button>
        </div>
      )}

      <div className="division-tabs" style={{ marginBottom: '24px' }}>
        <button
          className={`division-tab ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          Active Cups
        </button>
        <button
          className={`division-tab ${activeTab === 'played' ? 'active' : ''}`}
          onClick={() => setActiveTab('played')}
        >
          Played Cups
        </button>
      </div>

      {cups.filter(c => activeTab === 'active' ? (c.status !== 'completed') : (c.status === 'completed')).length === 0 && !showCreate && (
        <div className="card">
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
            {activeTab === 'active' ? 'No active cup tournaments.' : 'No completed cup tournaments.'}
          </p>
        </div>
      )}

      {cups.filter(c => activeTab === 'active' ? (c.status !== 'completed') : (c.status === 'completed')).map(cup => {
        const prizePot = cup.entryFee * (cup.players?.length || 0)
        const isExpanded = expandedCups[cup.id]

        return (
          <div key={cup.id} className="card" style={{ marginTop: '20px', padding: '0' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px',
                cursor: 'pointer'
              }}
              onClick={() => toggleCup(cup.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{
                  fontSize: '1.2rem',
                  transition: 'transform 0.2s',
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                }}>▶</span>
                <h3 className="card-title" style={{ margin: 0 }}>{cup.name}</h3>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                <Link to={`/cups/${cup.id}`} className="btn btn-primary btn-sm">
                  View Bracket
                </Link>
                {isAdmin && (
                  <>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSwapCup(cup)
                        setShowSwapModal(true)
                      }}
                    >
                      🔄 Swap
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                    onClick={async () => {
                      if (confirm(`Are you sure you want to delete "${cup.name}"?`)) {
                        const updatedCups = cups.filter(c => c.id !== cup.id)
                        localStorage.setItem('eliteArrowsCups', JSON.stringify(updatedCups))
                        
                        const fixtures = getFixtures()
                        const updatedFixtures = fixtures.filter(f => f.cupId !== cup.id)
                        localStorage.setItem('eliteArrowsFixtures', JSON.stringify(updatedFixtures))
                        
                        try {
                          await deleteDoc(doc(db, 'cups', cup.id.toString()))
                          for (const fixture of fixtures.filter(f => f.cupId === cup.id)) {
                            await deleteDoc(doc(db, 'fixtures', fixture.id.toString()))
                          }
                          triggerDataRefresh('cups')
                          triggerDataRefresh('fixtures')
                        } catch (e) {
                          console.log('Error deleting from Firebase:', e)
                        }
                        
                        setRefreshKey(prev => prev + 1)
                      }
                    }}
                  >
                    Delete
                  </button>
                  </>
                )}
              </div>
            </div>

            {isExpanded && (
              <div style={{
                padding: '0 20px 20px 20px',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                marginTop: '0'
              }} className="animate-fade-in">
                {isAdmin && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '15px', marginBottom: '15px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, background: 'rgba(255,255,255,0.05)' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSwapCup(cup)
                        setShowSwapModal(true)
                      }}
                    >
                      🔄 Swap Participant
                    </button>
                    {cup.type === 'world_cup' && !cup.groupsAdvanced && (
                      <Link
                        to="/cup-management"
                        className="btn btn-primary btn-sm"
                        style={{ flex: 1, background: 'linear-gradient(to right, #f59e0b, #d97706)', color: 'black' }}
                      >
                        ⚡ Finalize Groups
                      </Link>
                    )}
                  </div>
                )}
                <div style={{
                  background: cup.type === 'world_cup' ? 'rgba(251, 191, 36, 0.05)' : 'rgba(255,255,255,0.02)',
                  padding: '15px',
                  borderRadius: '12px',
                  marginTop: '15px',
                  border: cup.type === 'world_cup' ? '1px solid rgba(251, 191, 36, 0.1)' : '1px solid rgba(255,255,255,0.05)'
                }}>
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                    Entry: £{cup.entryFee} | Players: {cup.players?.length || 0} | Prize Pot: £{prizePot}
                  </p>
                  {cup.type === 'world_cup' && (
                    <div style={{ marginTop: '12px' }}>
                      <p style={{ color: '#fbbf24', fontSize: '0.8rem', fontWeight: 800, margin: 0, textTransform: 'uppercase' }}>
                        {cup.groupsAdvanced ? '✓ Knockout Phase In Progress' : '⏳ Group Stage In Progress'}
                      </p>
                      {cup.roundFormats?._stageDays && (
                        <p style={{ color: 'var(--accent-cyan)', fontSize: '0.75rem', marginTop: '4px' }}>
                          ⏱ Estimated Pace: {cup.roundFormats._stageDays} days per stage
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {cup.roundFormats && (
                  <div style={{
                    fontSize: '0.85rem',
                    color: 'var(--accent-cyan)',
                    marginTop: '8px',
                    background: 'rgba(0,0,0,0.2)',
                    padding: '10px',
                    borderRadius: '8px'
                  }}>
                    <strong style={{ display: 'block', marginBottom: '5px', color: 'white' }}>Format:</strong>
                    {Object.entries(cup.roundFormats).filter(([key]) => key !== '_stageDays').map(([round, format]) => {
                      const roundName = parseInt(round) === cup.currentRound ? 'Current' : ''
                      return (
                        <div key={round} style={{ display: 'inline-block', marginRight: '15px' }}>
                          <span style={{ opacity: 0.7 }}>{roundName}{roundName ? ' ' : ''}R{round}:</span> {format.startScore} / {format.firstTo ? `FT${format.firstTo}` : `Bo${format.bestOf}`}
                        </div>
                      )
                    })}
                  </div>
                )}
                <p style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', marginTop: '12px', fontWeight: 'bold' }}>
                  Status: {cup.status === 'completed' ? 'Completed' : `Active - Round ${cup.currentRound || 1}`}
                </p>
              </div>
            )}
          </div>
        )
      })}

      {showSwapModal && (
        <div className="modal-overlay">
          <div className="modal-content glass" style={{ maxWidth: '400px' }}>
            <h3 style={{ marginBottom: '20px' }}>Swap Player in Cup</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Replace a participant throughout the entire bracket and all fixtures for <strong>{swapCup?.name}</strong>.
            </p>

            <div className="form-group">
              <label>Player to Remove</label>
              <select
                className="glass"
                value={playerToRemove}
                onChange={e => setPlayerToRemove(e.target.value)}
              >
                <option value="">Select participant...</option>
                {swapCup?.players?.map(pid => {
                  const p = allUsers.find(u => u.id === pid)
                  return <option key={pid} value={pid}>{p?.username || pid}</option>
                })}
              </select>
            </div>

            <div className="form-group">
              <label>Replacement Player</label>
              <UserSearchSelect
                users={allUsers.filter(u => !(swapCup?.players || []).includes(u.id))}
                selectedId={playerToAdd}
                onSelect={setPlayerToAdd}
                label=""
                placeholder="Search for new player..."
                onQueryChange={searchUsers}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
              <button className="btn btn-secondary btn-block" onClick={() => setShowSwapModal(false)}>Cancel</button>
              <button
                className="btn btn-primary btn-block"
                onClick={handleSwapPlayer}
                disabled={isSubmitting || !playerToRemove || !playerToAdd}
              >
                {isSubmitting ? 'Swapping...' : 'Perform Swap'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
