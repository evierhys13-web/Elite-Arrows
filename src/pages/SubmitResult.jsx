import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSearchParams } from 'react-router-dom'
import { db, collection, addDoc, doc, setDoc } from '../firebase'

export default function SubmitResult() {
  const { user, getAllUsers, getFixtures, getResults, addTokens, triggerDataRefresh, notifyAdmins } = useAuth()
  const [searchParams] = useSearchParams()
  const fileInputRef = useRef(null)
  const [formData, setFormData] = useState({
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
  })
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const allUsers = getAllUsers()
  const availablePlayers = allUsers.filter(u => u.id !== user.id)
  const fixtureIdParam = searchParams.get('fixtureId')
  const allFixtures = getFixtures()
  const allResults = getResults()

  const getFixturePlayerIds = (fixture) => {
    const player1Id = fixture.player1Id || fixture.player1
    const player2Id = fixture.player2Id || fixture.player2
    return { player1Id, player2Id }
  }

  const getFixtureOpponentId = (fixture) => {
    const { player1Id, player2Id } = getFixturePlayerIds(fixture)
    if (player1Id === user.id) return player2Id
    if (player2Id === user.id) return player1Id
    return null
  }

  const cupFixtures = allFixtures.filter((fixture) => {
    if (!fixture.cupId || fixture.status !== 'accepted') return false
    const { player1Id, player2Id } = getFixturePlayerIds(fixture)
    return player1Id === user.id || player2Id === user.id
  })
  const cups = JSON.parse(localStorage.getItem('eliteArrowsCups') || '[]')

  const opponentUser = availablePlayers.find(p => p.id === formData.opponent)
  const currentSeason = new Date().getFullYear().toString()
  const selectedFixture = fixtureIdParam
    ? allFixtures.find((fixture) => fixture.id.toString() === fixtureIdParam)
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
    const approvedResults = allResults.filter(r => r.status === 'approved')
    
    const existingMatch = approvedResults.find(r => {
      const isSameSeason = r.season === currentSeason
      const isLeagueGame = r.gameType === 'League'
      const sameDivision = r.division === user.division
      const isBetweenPlayers = (r.player1Id === user.id && r.player2Id === opponentId) || 
                                 (r.player2Id === user.id && r.player1Id === opponentId)
      return isSameSeason && isLeagueGame && sameDivision && isBetweenPlayers
    })
    
    return existingMatch
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (name === 'opponent' || name === 'gameType') {
      setError('')
    }
    if (name === 'gameType') {
      if (value === 'League') {
        setFormData(prev => ({ ...prev, bestOf: '8', firstTo: '5' }))
      } else if (value === 'Cup') {
        setFormData(prev => ({ ...prev, bestOf: '3', firstTo: '2' }))
      } else {
        setFormData(prev => ({ ...prev, bestOf: '3', firstTo: '2' }))
      }
    }
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be less than 5MB')
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, proofImage: reader.result }))
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setFormData(prev => ({ ...prev, proofImage: '' }))
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
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
    const opponentName = opponentUser?.name || opponentUser?.username || formData.opponent
    
    if (!window.confirm(`Submit result: ${user.name} ${formData.yourScore} - ${formData.opponentScore} ${opponentName}?`)) {
      return
    }
    
    if (formData.gameType === 'League' && opponentUser) {
      const existingMatch = checkExistingLeagueMatch(opponentUser.id)
      if (existingMatch) {
        setError(`You've already played ${formData.opponent} in a league match this season. Only one league match per opponent is allowed.`)
        return
      }
    }

    if (formData.gameType === 'League' && (formData.bestOf !== '8' || formData.firstTo !== '5')) {
      setError('League games must be Best of 8 (First to 5 legs)')
      return
    }

    let cupFixture = null
    let cupId = null
    let matchId = null
    if (formData.gameType === 'Cup') {
      cupFixture = cupFixtures.find(f => {
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
        return result.cupId === cupId && result.matchId === matchId && result.status !== 'rejected'
      }
      const isSamePlayers =
        (result.player1Id === user.id && result.player2Id === formData.opponent) ||
        (result.player2Id === user.id && result.player1Id === formData.opponent)
      return isSamePlayers &&
        result.gameType === formData.gameType &&
        result.date === new Date().toISOString().split('T')[0] &&
        result.status !== 'rejected'
    })

    if (duplicateResult) {
      setError('A result for this fixture has already been submitted.')
      return
    }

    const results = [...allResults]
    
    const newResult = {
      id: Date.now(),
      player1: user.username,
      player1Id: user.id,
      player2: opponentUser?.username || allUsers.find(u => u.id === formData.opponent)?.username || formData.opponent,
      player2Id: opponentUser?.id || formData.opponent,
      score1: parseInt(formData.yourScore),
      score2: parseInt(formData.opponentScore),
      division: user.division,
      gameType: formData.gameType,
      season: currentSeason,
      date: new Date().toISOString().split('T')[0],
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
      ...(cupId && { cupId, matchId })
    }

    results.push(newResult)
    localStorage.setItem('eliteArrowsResults', JSON.stringify(results))
    
    try {
      await addDoc(collection(db, 'results'), newResult)
    } catch (e) {
      console.log('Error saving to Firestore:', e)
    }

    const fixtureToUpdate = cupFixture || selectedFixture
    if (fixtureToUpdate) {
      const updatedFixtures = [...allFixtures]
      const fixtureIndex = updatedFixtures.findIndex((fixture) => fixture.id === fixtureToUpdate.id)
      if (fixtureIndex !== -1) {
        updatedFixtures[fixtureIndex] = {
          ...updatedFixtures[fixtureIndex],
          status: 'result_submitted'
        }
        localStorage.setItem('eliteArrowsFixtures', JSON.stringify(updatedFixtures))
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

    notifyAdmins(
      'New Result Pending',
      `${user.username} submitted a result: ${newResult.player1} ${newResult.score1}-${newResult.score2} ${newResult.player2} (${newResult.gameType})`,
      { type: 'result_submitted', resultId: newResult.id }
    )

    const isWin = parseInt(formData.yourScore) > parseInt(formData.opponentScore)
    if (isWin) {
      const tokensToAdd = 50
      addTokens(tokensToAdd)
    }

triggerDataRefresh('results')
    triggerDataRefresh('fixtures')
    
    // Show success state
    setSubmitted(true)
    setError('')
    
    // Reset form after delay
    setTimeout(() => {
      setSubmitted(false)
      setFormData({
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
      })
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }, 3000)
  }
  
  // Success message display
  const showSuccess = submitted && !error

  const getOpponentStatus = (opponentId, opponentName) => {
    if (formData.gameType === 'Friendly') return null
    const existingMatch = checkExistingLeagueMatch(opponentId)
    if (existingMatch) {
      return { played: true, result: existingMatch }
    }
    return { played: false }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Submit Result</h1>
      </div>

      <div className="card">
        <form className="submit-result-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Game Type</label>
              <select 
                name="gameType" 
                value={formData.gameType} 
                onChange={handleChange}
              >
                <option value="Friendly">Friendly</option>
                <option value="League">League</option>
                <option value="Cup">Cup Match</option>
              </select>
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

          <div className="match-setup">
            <div className="player-select">
              <label>You ({user.division})</label>
              <div style={{ 
                padding: '12px', 
                background: 'var(--bg-secondary)', 
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                {user.username}
              </div>
            </div>

            <span className="vs-text">vs</span>

            <div className="player-select">
              <label>Opponent</label>
              {formData.gameType === 'Cup' ? (
                <select 
                  name="opponent" 
                  value={formData.opponent} 
                  onChange={handleChange}
                  required
                >
                  <option value="">Select cup match</option>
                  {cupFixtures.map(f => {
                    const cup = cups.find(c => c.id === f.cupId)
                    const opponentId = getFixtureOpponentId(f)
                    const opponent = allUsers.find(u => u.id === opponentId)
                    return (
                      <option key={f.id} value={opponentId}>
                        {cup?.name || 'Cup'} - vs {opponent?.username || 'Unknown'} (Round {f.round})
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
                >
                  <option value="">Select opponent</option>
                  {availablePlayers.map(p => {
                    const status = getOpponentStatus(p.id, p.username)
                    return (
                      <option key={p.id} value={p.id}>
                        {p.username} ({p.division}){formData.gameType === 'League' && status?.played ? ' - Played' : ''}
                      </option>
                    )
                  })}
                </select>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Your Legs Won</label>
              <input
                type="number"
                name="yourScore"
                value={formData.yourScore}
                onChange={handleChange}
                min="0"
                required
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Opponent Legs Won</label>
              <input
                type="number"
                name="opponentScore"
                value={formData.opponentScore}
                onChange={handleChange}
                min="0"
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Best of (legs)</label>
              <select name="bestOf" value={formData.bestOf} onChange={handleChange}>
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
            <div className="form-group" style={{ flex: 1 }}>
              <label>First to (legs)</label>
              <input
                type="number"
                name="firstTo"
                value={formData.firstTo}
                onChange={handleChange}
                min="1"
              />
            </div>
          </div>

          <div style={{ 
            padding: '15px', 
            background: 'var(--bg-secondary)', 
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h4 style={{ marginBottom: '15px', color: 'var(--accent-cyan)' }}>Your Stats</h4>
            <div style={{ display: 'flex', gap: '15px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>180s</label>
                <input
                  type="number"
                  name="your180s"
                  value={formData.your180s}
                  onChange={handleChange}
                  min="0"
                  placeholder="0"
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Highest Checkout</label>
                <input
                  type="number"
                  name="yourHighestCheckout"
                  value={formData.yourHighestCheckout}
                  onChange={handleChange}
                  min="0"
                  placeholder="0"
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Double %</label>
                <input
                  type="number"
                  name="yourDoubleSuccess"
                  value={formData.yourDoubleSuccess}
                  onChange={handleChange}
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <div style={{ 
            padding: '15px', 
            background: 'var(--bg-secondary)', 
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h4 style={{ marginBottom: '15px', color: 'var(--text-muted)' }}>Opponent Stats</h4>
            <div style={{ display: 'flex', gap: '15px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>180s</label>
                <input
                  type="number"
                  name="opponent180s"
                  value={formData.opponent180s}
                  onChange={handleChange}
                  min="0"
                  placeholder="0"
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Highest Checkout</label>
                <input
                  type="number"
                  name="opponentHighestCheckout"
                  value={formData.opponentHighestCheckout}
                  onChange={handleChange}
                  min="0"
                  placeholder="0"
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Double %</label>
                <input
                  type="number"
                  name="opponentDoubleSuccess"
                  value={formData.opponentDoubleSuccess}
                  onChange={handleChange}
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label style={{ fontSize: '0.9rem', display: 'block', marginBottom: '8px' }}>Proof of Result (Photo/Screenshot) - Required for League</label>
            
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
            
            {/* Upload area - button */}
            {!formData.proofImage ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{ 
                  border: '2px dashed var(--border)', 
                  borderRadius: '8px', 
                  padding: '30px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'var(--bg-secondary)',
                  width: '100%',
                  color: 'var(--text)'
                }}
              >
                <p style={{ color: 'var(--text-muted)', marginBottom: '10px' }}>
                  Tap to take photo or upload screenshot
                </p>
                <span style={{ color: 'var(--accent-cyan)', fontSize: '1rem', fontWeight: 'bold' }}>
                  📷 Take Photo / Upload
                </span>
              </button>
            ) : (
              <div style={{ position: 'relative' }}>
                <img 
                  src={formData.proofImage} 
                  alt="Proof" 
                  style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px' }}
                />
                <button
                  type="button"
                  onClick={() => removeImage()}
                  style={{
                    position: 'absolute',
                    top: '-10px',
                    right: '-10px',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '28px',
                    height: '28px',
                    cursor: 'pointer',
                    fontSize: '18px'
                  }}
                >
                  ×
                </button>
              </div>
            )}
          </div>

          <button 
            type="submit"
            className="btn btn-primary btn-block"
            disabled={submitted}
          >
            {submitted ? 'Submitted for Approval!' : 'Submit Result (Awaiting Approval)'}
          </button>

          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '10px' }}>
            Results are sent to admins for approval
          </p>
        </form>
      </div>
    </div>
  )
}
