import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'

export default function SubmitResult() {
  const { user, getAllUsers, addTokens } = useAuth()
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
  const fixtures = JSON.parse(localStorage.getItem('eliteArrowsFixtures') || '[]')
  const myFixtures = fixtures.filter(f => f.player1Id === user.id || f.player2Id === user.id)

  const opponentUser = availablePlayers.find(p => p.id === formData.opponent)
  const currentSeason = new Date().getFullYear().toString()

  const checkExistingLeagueMatch = (opponentId) => {
    const results = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]')
    const approvedResults = results.filter(r => r.status === 'approved')
    
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
    if (name === 'gameType' && value === 'League') {
      setFormData(prev => ({ ...prev, bestOf: '8', firstTo: '5' }))
    }
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
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

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.opponent || !formData.yourScore || !formData.opponentScore) {
      return
    }

    if (formData.gameType === 'League' && !formData.proofImage) {
      setError('Proof of result (screenshot/photo) is required for League games')
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

    const results = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]')
    const newResult = {
      id: Date.now(),
      player1: user.username,
      player1Id: user.id,
      player2: formData.opponent,
      player2Id: opponentUser?.id,
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
      status: 'pending'
    }

    results.push(newResult)
    localStorage.setItem('eliteArrowsResults', JSON.stringify(results))

    const isWin = parseInt(formData.yourScore) > parseInt(formData.opponentScore)
    if (isWin) {
      const tokensToAdd = 50
      addTokens(tokensToAdd)
    }

    setSubmitted(true)
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
    }, 2000)
  }

  const getOpponentStatus = (opponentId, opponentName) => {
    if (formData.gameType === 'Friendly') return null
    const existingMatch = checkExistingLeagueMatch(opponentId)
    if (existingMatch) {
      return { played: true, result: existingMatch }
    }
    return { played: false }
  }

  const handleCreateFixture = () => {
    if (!formData.opponent || !opponentUser) {
      alert('Please select an opponent first')
      return
    }

    const existingFixture = fixtures.find(f => 
      (f.player1Id === user.id && f.player2Id === opponentUser.id) ||
      (f.player1Id === opponentUser.id && f.player2Id === user.id)
    )

    if (existingFixture) {
      alert('A fixture already exists with this player')
      return
    }

    const newFixture = {
      id: Date.now(),
      player1Id: user.id,
      player1Name: user.username,
      player2Id: opponentUser.id,
      player2Name: opponentUser.username,
      division: user.division,
      gameType: formData.gameType,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      status: 'pending'
    }

    fixtures.push(newFixture)
    localStorage.setItem('eliteArrowsFixtures', JSON.stringify(fixtures))
    alert(`Fixture created! ${opponentUser.username} has been notified.`)
  }

  const handleCancelFixture = (fixtureId) => {
    if (!confirm('Cancel this fixture?')) return
    const updatedFixtures = fixtures.filter(f => f.id !== fixtureId)
    localStorage.setItem('eliteArrowsFixtures', JSON.stringify(updatedFixtures))
  }

  const handleAcceptFixture = (fixtureId) => {
    const updatedFixtures = fixtures.map(f => 
      f.id === fixtureId ? { ...f, status: 'accepted' } : f
    )
    localStorage.setItem('eliteArrowsFixtures', JSON.stringify(updatedFixtures))
    alert('Fixture accepted!')
  }

  const handleDeclineFixture = (fixtureId) => {
    if (!confirm('Decline this fixture?')) return
    const updatedFixtures = fixtures.filter(f => f.id !== fixtureId)
    localStorage.setItem('eliteArrowsFixtures', JSON.stringify(updatedFixtures))
    alert('Fixture declined.')
  }

  const pendingFixtures = fixtures.filter(f => f.player2Id === user.id && f.status === 'pending')
  const myCreatedFixtures = fixtures.filter(f => f.createdBy === user.id)
  const acceptedFixtures = fixtures.filter(f => 
    (f.player1Id === user.id || f.player2Id === user.id) && f.status === 'accepted'
  )

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Submit Result</h1>
      </div>

      {pendingFixtures.length > 0 && (
        <div className="card" style={{ marginBottom: '20px', border: '2px solid var(--warning)' }}>
          <h3 className="card-title" style={{ color: 'var(--warning)' }}>Pending Fixture Requests</h3>
          {pendingFixtures.map(fixture => (
            <div key={fixture.id} style={{ 
              padding: '12px', 
              background: 'var(--bg-secondary)', 
              borderRadius: '8px',
              marginBottom: '10px'
            }}>
              <p style={{ margin: '0 0 10px 0' }}>
                <strong>{fixture.player1Name}</strong> wants to play you in a <strong>{fixture.gameType}</strong> match
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-primary btn-sm" onClick={() => handleAcceptFixture(fixture.id)}>
                  Accept
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleDeclineFixture(fixture.id)}>
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 className="card-title">Your Fixtures</h3>
        {myCreatedFixtures.length === 0 && acceptedFixtures.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No fixtures created yet.</p>
        ) : (
          <>
            {myCreatedFixtures.map(fixture => (
              <div key={fixture.id} style={{ 
                padding: '12px', 
                background: 'var(--bg-secondary)', 
                borderRadius: '8px',
                marginBottom: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0 }}>
                      You vs <strong>{fixture.player2Name}</strong> ({fixture.gameType})
                    </p>
                    <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Status: {fixture.status === 'pending' ? 'Waiting for response...' : 'Accepted'}
                    </p>
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => handleCancelFixture(fixture.id)}>
                    Cancel
                  </button>
                </div>
              </div>
            ))}
            {acceptedFixtures.map(fixture => (
              <div key={fixture.id} style={{ 
                padding: '12px', 
                background: 'rgba(34, 197, 94, 0.1)', 
                border: '1px solid var(--success)',
                borderRadius: '8px',
                marginBottom: '10px'
              }}>
                <p style={{ margin: 0, color: 'var(--success)' }}>
                  Accepted: <strong>{fixture.player1Name}</strong> vs <strong>{fixture.player2Name}</strong> ({fixture.gameType})
                </p>
              </div>
            ))}
          </>
        )}
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
                    <option key={p.id} value={p.username}>
                      {p.username} ({p.division}){formData.gameType === 'League' && status?.played ? ' - Played' : ''}
                    </option>
                  )
                })}
              </select>
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
            <label>Proof of Result (Screenshot/Photo) *Required for League games</label>
            <div style={{ 
              border: '2px dashed var(--border)', 
              borderRadius: '8px', 
              padding: '20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'var(--bg-secondary)'
            }} onClick={() => fileInputRef.current?.click()}>
              {formData.proofImage ? (
                <div style={{ position: 'relative' }}>
                  <img 
                    src={formData.proofImage} 
                    alt="Proof" 
                    style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px' }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeImage()
                    }}
                    style={{
                      position: 'absolute',
                      top: '-10px',
                      right: '-10px',
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      cursor: 'pointer'
                    }}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '10px' }}>
                    Click to upload a screenshot or photo of the game result
                  </p>
                  <span style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem' }}>
                    📷 Upload Image
                  </span>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <button 
              type="button"
              className="btn btn-secondary btn-block"
              onClick={handleCreateFixture}
              disabled={!formData.opponent || !opponentUser}
              style={{ flex: 1 }}
            >
              Create Fixture with Opponent
            </button>
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