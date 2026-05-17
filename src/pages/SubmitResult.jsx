import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSearchParams } from 'react-router-dom'
import { db, doc, setDoc } from '../firebase'

const INITIAL_RESULT_FORM = {
  gameType: 'Friendly',
  opponent: '',
  yourScore: '',
  opponentScore: '',
  bestOf: '3',
  firstTo: '3',
  your180s: '',
  opponent180s: '',
  yourHighestCheckout: '',
  opponentHighestCheckout: '',
  yourDoubleSuccess: '',
  opponentDoubleSuccess: '',
  proofImage: ''
}

export default function SubmitResult() {
  const { user, getAllUsers, getFixtures, getResults, updateResults, updateFixtures, addTokens, triggerDataRefresh, notifyAdmins, adminData } = useAuth()
  const [searchParams] = useSearchParams()
  const cameraInputRef = useRef(null)
  const uploadInputRef = useRef(null)
  const [formData, setFormData] = useState(INITIAL_RESULT_FORM)
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [submittedFixtureId, setSubmittedFixtureId] = useState(null)

  const allUsers = getAllUsers()
  const availablePlayers = allUsers.filter(u => u.id !== user.id)
  const opponentOptions = formData.gameType === 'League'
    ? availablePlayers.filter(u => u.division === user.division)
    : formData.gameType === 'Super League'
      ? availablePlayers.filter(u => u.superLeagueDivision && u.superLeagueDivision === user.superLeagueDivision)
      : availablePlayers
  const fixtureIdParam = searchParams.get('fixtureId')
  const allFixtures = getFixtures()
  const allResults = getResults()

  const currentSeasonLabel = adminData?.currentSeason || 'Season 1'

  const userSubmittedResults = allResults
    .filter(result => (
      String(result.submittedBy || '') === String(user.id) ||
      String(result.player1Id || '') === String(user.id) ||
      String(result.player2Id || '') === String(user.id)
    ))
    .filter(result => ['pending', 'approved', 'rejected'].includes(String(result.status || '').toLowerCase()))
    .sort((a, b) => new Date(b.submittedAt || b.updatedAt || b.approvedAt || b.date || 0) - new Date(a.submittedAt || a.updatedAt || a.approvedAt || a.date || 0))
    .slice(0, 5)

  const getFixturePlayerIds = (fixture) => {
    const player1Id = fixture.player1Id || fixture.player1
    const player2Id = fixture.player2Id || fixture.player2
    return { player1Id, player2Id }
  }

  const getFixtureOpponentId = (fixture) => {
    const { player1Id, player2Id } = getFixturePlayerIds(fixture)
    if (String(player1Id) === String(user.id)) return player2Id
    if (String(player2Id) === String(user.id)) return player1Id
    return null
  }

  const cupFixtures = allFixtures.filter((fixture) => {
    if (!fixture.cupId || fixture.status !== 'accepted') return false
    const { player1Id, player2Id } = getFixturePlayerIds(fixture)
    return String(player1Id) === String(user.id) || String(player2Id) === String(user.id)
  })
  const cups = JSON.parse(localStorage.getItem('eliteArrowsCups') || '[]')

  const opponentUser = availablePlayers.find(p => p.id === formData.opponent)

  const getDisplayName = (profile, fallback = 'Unknown player') => (
    profile?.username || profile?.name || profile?.displayName || profile?.email || fallback
  )
  const currentUserName = getDisplayName(user, 'You')
  const selectedFixture = fixtureIdParam && String(fixtureIdParam) !== String(submittedFixtureId)
    ? allFixtures.find((fixture) => String(fixture.id) === String(fixtureIdParam))
    : null

  useEffect(() => {
    if (!selectedFixture) return

    const opponentId = getFixtureOpponentId(selectedFixture)
    if (!opponentId) return

    setFormData((prev) => ({
      ...prev,
      gameType: selectedFixture.cupId ? 'Cup' : (selectedFixture.gameType || 'Friendly'),
      opponent: opponentId,
      bestOf: selectedFixture.bestOf ? selectedFixture.bestOf.toString() : prev.bestOf,
      firstTo: selectedFixture.firstTo ? selectedFixture.firstTo.toString() : prev.firstTo
    }))
  }, [selectedFixture, user.id])

  const checkExistingLeagueMatch = (opponentId) => {
    const approvedResults = allResults.filter(r => String(r.status).toLowerCase() === 'approved')
    
    const existingMatch = approvedResults.find(r => {
      const isSameSeason = r.season === currentSeasonLabel
      const isLeagueGame = r.gameType === 'League'
      const sameDivision = r.division === user.division
      const isBetweenPlayers = (String(r.player1Id) === String(user.id) && String(r.player2Id) === String(opponentId)) ||
                                 (String(r.player2Id) === String(user.id) && String(r.player1Id) === String(opponentId))
      return isSameSeason && isLeagueGame && sameDivision && isBetweenPlayers
    })
    
    return existingMatch
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setSubmitted(false)
    setSuccessMessage('')
    if (name === 'opponent' || name === 'gameType') {
      setError('')
    }
    if (name === 'gameType') {
      if (value === 'League') {
        setFormData(prev => ({
          ...prev,
          opponent: availablePlayers.find(p => p.id === prev.opponent)?.division === user.division ? prev.opponent : '',
          bestOf: '8',
          firstTo: '5'
        }))
      } else if (value === 'Super League') {
        setFormData(prev => ({
          ...prev,
          opponent: availablePlayers.find(p => p.id === prev.opponent)?.superLeagueDivision === user.superLeagueDivision ? prev.opponent : '',
          bestOf: '11',
          firstTo: '6'
        }))
      } else if (value === 'Cup') {
        setFormData(prev => ({ ...prev, opponent: '', bestOf: '3', firstTo: '2' }))
      } else {
        setFormData(prev => ({ ...prev, bestOf: '3', firstTo: '2' }))
      }
    }
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be less than 5MB')
        return
      }

      const reader = new FileReader()
      reader.onloadend = () => {
        const image = new Image()
        image.onload = () => {
          const canvas = document.createElement('canvas')
          const maxDimension = 1200
          const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
          canvas.width = Math.max(1, Math.round(image.width * scale))
          canvas.height = Math.max(1, Math.round(image.height * scale))

          const ctx = canvas.getContext('2d')
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

          let quality = 0.75
          let compressed = canvas.toDataURL('image/jpeg', quality)
          while (compressed.length > 850000 && quality > 0.35) {
            quality -= 0.1
            compressed = canvas.toDataURL('image/jpeg', quality)
          }

          if (compressed.length > 950000) {
            setError('Image is still too large. Please upload a smaller screenshot/photo.')
            return
          }

          setFormData(prev => ({ ...prev, proofImage: compressed }))
        }
        image.onerror = () => setError('Could not read that image. Please try another photo.')
        image.src = reader.result
      }
      reader.readAsDataURL(file)
    }
  }

  const clearProofInputs = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.value = ''
    }
    if (uploadInputRef.current) {
      uploadInputRef.current.value = ''
    }
  }

  const removeImage = () => {
    setFormData(prev => ({ ...prev, proofImage: '' }))
    clearProofInputs()
  }

  const resetFormAfterSuccessfulSubmit = (fixtureId = null) => {
    if (fixtureId) {
      setSubmittedFixtureId(String(fixtureId))
    }
    setFormData({ ...INITIAL_RESULT_FORM })
    clearProofInputs()
    if (typeof window !== 'undefined' && window.location.pathname.includes('submit-result')) {
      window.history.replaceState(null, '', '/submit-result')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')
    
    if (!formData.opponent) {
      setError('Please select an opponent')
      return
    }
    
    if (!formData.yourScore || !formData.opponentScore) {
      setError('Please enter both scores')
      return
    }

    if (formData.gameType === 'League' && !formData.proofImage) {
      setError('Proof of result (screenshot/photo) is required for League games')
      return
    }
    
    const allUsers = getAllUsers()
    const opponentUser = allUsers.find(u => u.id === formData.opponent)
    const submitterName = getDisplayName(user, 'You')
    const opponentName = getDisplayName(opponentUser, formData.opponent || 'Selected opponent')
    
    if (formData.gameType === 'League' && opponentUser) {
      if (opponentUser.division !== user?.division) {
        setError('League results can only be submitted against players in your division.')
        return
      }

      const existingMatch = checkExistingLeagueMatch(opponentUser.id)
      if (existingMatch) {
        setError(`You've already played ${opponentName} in a league match this season. Only one league match per opponent is allowed.`)
        return
      }
    }

    if (formData.gameType === 'League' && (formData.bestOf !== '8' || formData.firstTo !== '5')) {
      setError('League games must be Best of 8 (First to 5 legs)')
      return
    }

    if (formData.gameType === 'Super League') {
      if (formData.bestOf !== '11' || formData.firstTo !== '6') {
        setError('Super League games must be First to 6 legs (Best of 11)')
        return
      }
      if (parseInt(formData.yourScore) === parseInt(formData.opponentScore)) {
        setError('Draws are not permitted in the Super League. A winner must be decided.')
        return
      }
    }

    let cupFixture = null
    let cupId = null
    let matchId = null
    if (formData.gameType === 'Cup') {
      cupFixture = selectedFixture?.cupId
        ? selectedFixture
        : cupFixtures.find(f => {
          const opponentId = getFixtureOpponentId(f)
          return opponentId === formData.opponent
        })
      if (!cupFixture) {
        setError('Please select a valid cup match')
        return
      }
      if (cupFixture) {
        cupId = cupFixture.cupId
        matchId = cupFixture.matchId
      }
    }

    const duplicateResult = allResults.find((result) => {
      if (formData.gameType === 'Cup' && cupId && matchId) {
        return result.cupId === cupId && result.matchId === matchId && String(result.status).toLowerCase() !== 'rejected'
      }

      if (selectedFixture?.id) {
        return String(result.fixtureId || '') === String(selectedFixture.id) && String(result.status).toLowerCase() !== 'rejected'
      }

      return false
    })

    if (duplicateResult) {
      setError('A result for this fixture has already been submitted.')
      return
    }

    try {
      setIsSubmitting(true)
      const results = [...allResults]
      const resultId = Date.now().toString()
      const fixtureForResult = cupFixture || selectedFixture
      const newResult = {
        id: resultId,
        firestoreId: resultId,
        player1: submitterName,
        player1Id: user.id,
        player2: opponentName,
        player2Id: opponentUser?.id || formData.opponent,
        score1: parseInt(formData.yourScore),
        score2: parseInt(formData.opponentScore),
        division: user.division,
        gameType: formData.gameType,
        season: currentSeasonLabel,
        date: new Date().toISOString().split('T')[0],
        submittedAt: new Date().toISOString(),
        bestOf: formData.bestOf,
        firstTo: formData.firstTo,
        proofImage: formData.proofImage,
        player1Stats: {
          '180s': parseInt(formData.your180s) || 0,
          highestCheckout: parseInt(formData.yourHighestCheckout) || 0,
          doubleSuccess: parseFloat(formData.yourDoubleSuccess) || 0
        },
        player2Stats: {
          '180s': parseInt(formData.opponent180s) || 0,
          highestCheckout: parseInt(formData.opponentHighestCheckout) || 0,
          doubleSuccess: parseFloat(formData.opponentDoubleSuccess) || 0
        },
        status: 'pending',
        submittedBy: user.id,
        ...(fixtureForResult?.id && { fixtureId: fixtureForResult.id }),
        ...(cupId && { cupId, matchId }),
        ...(cupFixture?.cupName && { cupName: cupFixture.cupName }),
        ...(cupFixture?.startScore && { startScore: cupFixture.startScore })
      }

      await setDoc(doc(db, 'results', resultId), newResult, { merge: true })

      results.push(newResult)
      try {
        updateResults(results)
      } catch (storageError) {
        console.log('Result saved to Firestore but local cache update failed:', storageError)
      }

    const fixtureToUpdate = cupFixture || selectedFixture
    if (fixtureToUpdate) {
      const updatedFixtures = [...getFixtures()]
      const fixtureIndex = updatedFixtures.findIndex((fixture) => String(fixture.id) === String(fixtureToUpdate.id))
      if (fixtureIndex !== -1) {
        updatedFixtures[fixtureIndex] = {
          ...updatedFixtures[fixtureIndex],
          status: 'result_submitted',
          resultId,
          submittedResultId: resultId,
          updatedAt: new Date().toISOString()
        }
        updateFixtures(updatedFixtures)
        try {
          await setDoc(
            doc(db, 'fixtures', updatedFixtures[fixtureIndex].id.toString()),
            updatedFixtures[fixtureIndex],
            { merge: true }
          )
        } catch (e) {
          console.log('Error updating fixture in Firestore:', e)
        }
      }
    }

    const isWin = parseInt(formData.yourScore) > parseInt(formData.opponentScore)

    if (typeof triggerDataRefresh === 'function') {
      triggerDataRefresh('results')
      triggerDataRefresh('fixtures')
    }
    
    setSubmitted(true)
    setError('')
    setSuccessMessage('Result submitted for admin approval.')
    resetFormAfterSuccessfulSubmit(fixtureToUpdate?.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => {
      setSubmitted(false)
      setSuccessMessage('')
    }, 5000)

    Promise.resolve().then(() => notifyAdmins(
      'New Result Pending',
      `${submitterName} submitted a result: ${newResult.player1} ${newResult.score1}-${newResult.score2} ${newResult.player2} (${newResult.gameType})`,
      { type: 'result_submitted', resultId: newResult.id, url: '/admin?tab=results' }
    )).catch((notificationError) => {
      console.log('Result saved, but admin notification failed:', notificationError)
    })

    if (isWin) {
      Promise.resolve().then(() => addTokens(50)).catch((tokenError) => {
        console.log('Result saved, but token award failed:', tokenError)
      })
    }
    } catch (e) {
      console.error('FATAL: Error submitting result:', e.code, e.message)
      setError('Error submitting result: ' + (e.message || 'Please try again.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const getOpponentStatus = (opponentId, opponentName) => {
    if (formData.gameType === 'Friendly') return null
    const existingMatch = checkExistingLeagueMatch(opponentId)
    if (existingMatch) {
      return { played: true, result: existingMatch }
    }
    return { played: false }
  }

  const getResultStatusDisplay = (status) => {
    const normalized = String(status || 'pending').toLowerCase()
    if (normalized === 'approved') return { label: 'Approved', color: 'var(--success)' }
    if (normalized === 'rejected') return { label: 'Rejected', color: 'var(--error)' }
    return { label: 'Pending admin approval', color: 'var(--warning)' }
  }

  return (
    <div className="page" style={{ maxWidth: '800px', margin: '0 auto', padding: '15px' }}>
      <div className="page-header" style={{ marginBottom: '25px', textAlign: 'center' }}>
        <h1 className="page-title" style={{ fontSize: '1.8rem', color: 'var(--accent-cyan)' }}>Submit Match Result</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Enter the details of your recent match for league or friendly play.</p>
      </div>

      <div className="card" style={{ padding: '25px', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
        <form className="submit-result-form" onSubmit={handleSubmit} style={{ maxWidth: 'none' }}>
          <div className="form-group" style={{ marginBottom: '25px' }}>
            <label style={{ fontWeight: '600', marginBottom: '10px', display: 'block' }}>Match Type</label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {['Friendly', 'League', 'Super League', 'Cup'].map(type => (
                <button
                  key={type}
                  type="button"
                  className={`btn ${formData.gameType === (type === 'Cup' ? 'Cup' : type) ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => handleChange({ target: { name: 'gameType', value: type === 'Cup' ? 'Cup' : type } })}
                  style={{ flex: 1, minWidth: '100px' }}
                >
                  {type === 'Cup' ? 'Cup Match' : type}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ 
              padding: '12px', 
              background: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid #ef4444',
              borderRadius: '8px',
              color: '#ef4444',
              marginBottom: '20px',
              fontSize: '0.9rem'
            }}>
              {error}
            </div>
          )}

          {successMessage && (
            <div style={{
              padding: '12px',
              background: 'rgba(34, 197, 94, 0.12)',
              border: '1px solid var(--success)',
              borderRadius: '8px',
              color: 'var(--success)',
              marginBottom: '20px',
              fontSize: '0.9rem',
              fontWeight: 700,
              textAlign: 'center'
            }}>
              {successMessage}
            </div>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: '15px',
            marginBottom: '30px',
            background: 'var(--bg-secondary)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid var(--border)'
          }} className="match-players-grid">
            <div style={{ textAlign: 'center' }}>
              <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>You</label>
              <div style={{ 
                padding: '12px', 
                background: 'var(--bg-primary)',
                borderRadius: '8px',
                fontWeight: 'bold',
                border: '1px solid var(--border)',
                color: 'var(--accent-cyan)'
              }}>
                {currentUserName}
              </div>
            </div>

            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>VS</div>

            <div style={{ textAlign: 'center' }}>
              <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Opponent</label>
              <div>
                {formData.gameType === 'Cup' ? (
                  <select
                    name="opponent"
                    value={formData.opponent}
                    onChange={handleChange}
                    required
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  >
                    <option value="">Select match</option>
                    {cupFixtures.map(f => {
                      const cup = cups.find(c => c.id === f.cupId)
                      const opponentId = getFixtureOpponentId(f)
                      const opponent = allUsers.find(u => u.id === opponentId)
                      return (
                        <option key={f.id} value={opponentId}>
                          {cup?.name || 'Cup'} - vs {getDisplayName(opponent, 'Unknown')}
                        </option>
                      )
                    })}
                  </select>
                ) : (
                  <select
                    name="opponent"
                    value={formData.opponent}
                    onChange={handleChange}
                    required
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  >
                    <option value="">Select opponent</option>
                    {opponentOptions.map(p => {
                      const status = getOpponentStatus(p.id, getDisplayName(p))
                      return (
                        <option key={p.id} value={p.id}>
                          {getDisplayName(p)} ({p.division}){formData.gameType === 'League' && status?.played ? ' - Played' : ''}
                        </option>
                      )
                    })}
                  </select>
                )}
              </div>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            marginBottom: '30px'
          }}>
            <div className="form-group">
              <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Your Legs Won</label>
              <input
                type="number"
                name="yourScore"
                value={formData.yourScore}
                onChange={handleChange}
                min="0"
                required
                style={{ fontSize: '1.2rem', textAlign: 'center', padding: '15px' }}
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Opponent Legs Won</label>
              <input
                type="number"
                name="opponentScore"
                value={formData.opponentScore}
                onChange={handleChange}
                min="0"
                required
                style={{ fontSize: '1.2rem', textAlign: 'center', padding: '15px' }}
                placeholder="0"
              />
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            marginBottom: '30px',
            padding: '20px',
            background: 'var(--bg-secondary)',
            borderRadius: '12px'
          }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '0.85rem' }}>Best of (legs)</label>
              <select name="bestOf" value={formData.bestOf} onChange={handleChange} style={{ background: 'var(--bg-primary)' }}>
                <option value="1">Best of 1</option>
                <option value="3">Best of 3</option>
                <option value="5">Best of 5</option>
                <option value="7">Best of 7</option>
                <option value="8">Best of 8</option>
                <option value="9">Best of 9</option>
                <option value="11">Best of 11</option>
                <option value="13">Best of 13</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '0.85rem' }}>First to (legs)</label>
              <input
                type="number"
                name="firstTo"
                value={formData.firstTo}
                onChange={handleChange}
                min="1"
                style={{ background: 'var(--bg-primary)' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
            <div style={{
              padding: '20px',
              background: 'rgba(77, 168, 218, 0.05)',
              borderRadius: '12px',
              border: '1px solid rgba(77, 168, 218, 0.2)'
            }}>
              <h4 style={{ marginBottom: '15px', color: 'var(--accent-cyan)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Your Stats</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.8rem' }}>180s</label>
                  <input
                    type="number"
                    name="your180s"
                    value={formData.your180s}
                    onChange={handleChange}
                    min="0"
                    placeholder="0"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.8rem' }}>Highest Checkout</label>
                  <input
                    type="number"
                    name="yourHighestCheckout"
                    value={formData.yourHighestCheckout}
                    onChange={handleChange}
                    min="0"
                    placeholder="0"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.8rem' }}>Checkout Success %</label>
                  <input
                    type="number"
                    name="yourDoubleSuccess"
                    value={formData.yourDoubleSuccess}
                    onChange={handleChange}
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <div style={{
              padding: '20px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '12px',
              border: '1px solid var(--border)'
            }}>
              <h4 style={{ marginBottom: '15px', color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Opponent Stats</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.8rem' }}>180s</label>
                  <input
                    type="number"
                    name="opponent180s"
                    value={formData.opponent180s}
                    onChange={handleChange}
                    min="0"
                    placeholder="0"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.8rem' }}>Highest Checkout</label>
                  <input
                    type="number"
                    name="opponentHighestCheckout"
                    value={formData.opponentHighestCheckout}
                    onChange={handleChange}
                    min="0"
                    placeholder="0"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.8rem' }}>Checkout Success %</label>
                  <input
                    type="number"
                    name="opponentDoubleSuccess"
                    value={formData.opponentDoubleSuccess}
                    onChange={handleChange}
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '30px' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: '600', display: 'block', marginBottom: '12px' }}>Proof of Result (Photo/Screenshot)</label>
            
            {!formData.proofImage ? (
              <div
                className="result-proof-picker"
                style={{ 
                  border: '2px dashed var(--border)', 
                  borderRadius: '12px',
                  padding: '30px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'var(--bg-secondary)',
                  width: '100%',
                  color: 'var(--text)'
                }}
              >
                <div className="result-proof-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <div className="result-proof-native-button result-proof-camera" style={{ flex: 1, maxWidth: '150px' }}>
                    <span style={{ fontSize: '0.85rem' }}>📷 Take Photo</span>
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      aria-label="Take Photo"
                      onClick={(e) => { e.currentTarget.value = '' }}
                      onChange={handleImageUpload}
                      className="result-proof-input"
                    />
                  </div>
                  <div className="result-proof-native-button result-proof-upload" style={{ flex: 1, maxWidth: '150px' }}>
                    <span style={{ fontSize: '0.85rem' }}>📁 Upload</span>
                    <input
                      ref={uploadInputRef}
                      type="file"
                      accept="image/*"
                      aria-label="Upload Screenshot"
                      onClick={(e) => { e.currentTarget.value = '' }}
                      onChange={handleImageUpload}
                      className="result-proof-input"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ position: 'relative', textAlign: 'center' }}>
                <img 
                  src={formData.proofImage} 
                  alt="Proof" 
                  style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '12px', border: '1px solid var(--border)' }}
                />
                <button
                  type="button"
                  onClick={() => removeImage()}
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    cursor: 'pointer',
                    fontSize: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
                  }}
                >
                  ×
                </button>
              </div>
            )}
          </div>

          <button 
            type="submit"
            className={`btn ${submitted ? 'btn-success' : 'btn-primary'} btn-block`}
            disabled={submitted || isSubmitting}
            style={{ padding: '18px', fontSize: '1.1rem', fontWeight: '700', borderRadius: '12px' }}
          >
            {isSubmitting ? '🔄 Submitting...' : submitted ? '✅ Submitted Successfully!' : '🚀 Submit for Approval'}
          </button>

          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '15px' }}>
            Results are sent to admins for approval
          </p>
        </form>
      </div>

      {userSubmittedResults.length > 0 && (
        <div className="card" style={{ marginTop: '30px', padding: '20px' }}>
          <h3 className="card-title" style={{ fontSize: '1.1rem', marginBottom: '20px' }}>Your Recent Submissions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {userSubmittedResults.map(result => {
              const statusDisplay = getResultStatusDisplay(result.status)
              const proofUploaded = Boolean(result.proofImage || result.hasProofImage)
              return (
                <div
                  key={result.id || result.firestoreId}
                  style={{
                    padding: '15px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    display: 'grid',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                    <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>
                      {result.player1} <span style={{ color: 'var(--accent-cyan)' }}>{result.score1}-{result.score2}</span> {result.player2}
                    </span>
                    <span style={{
                      color: statusDisplay.color,
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      padding: '4px 8px',
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: '4px'
                    }}>
                      {statusDisplay.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    <span>{result.gameType} • {result.date}</span>
                    <span>{proofUploaded ? '🖼️ Proof Attached' : '❌ No Proof'}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
