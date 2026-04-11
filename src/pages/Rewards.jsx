import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Rewards() {
  const { user, getAllUsers, useTokens } = useAuth()
  const [bets, setBets] = useState([])
  const [showBetForm, setShowBetForm] = useState(null)
  const [betAmount, setBetAmount] = useState(10)
  const [predictedWinner, setPredictedWinner] = useState('')
  const [predictedScore1, setPredictedScore1] = useState('')
  const [predictedScore2, setPredictedScore2] = useState('')

  const allUsers = getAllUsers()
  const results = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]')
  const approvedResults = results.filter(r => r.status === 'approved')
  const currentSeason = localStorage.getItem('eliteArrowsCurrentSeason') || new Date().getFullYear().toString()

  useEffect(() => {
    const storedBets = JSON.parse(localStorage.getItem('eliteArrowsBets') || '[]')
    setBets(storedBets.filter(b => b.userId === user.id))
  }, [user.id])

  const playersInDivision = allUsers.filter(u => u.division === user.division)
  
  const getPotentialMatches = () => {
    const matches = []
    for (let i = 0; i < playersInDivision.length; i++) {
      for (let j = i + 1; j < playersInDivision.length; j++) {
        const player1 = playersInDivision[i]
        const player2 = playersInDivision[j]
        
        if (player1.id === user.id || player2.id === user.id) continue
        
        const alreadyPlayed = approvedResults.find(r => 
          r.season === currentSeason && 
          r.division === user.division &&
          ((r.player1Id === player1.id && r.player2Id === player2.id) ||
           (r.player1Id === player2.id && r.player2Id === player1.id))
        )
        
        if (!alreadyPlayed) {
          matches.push({
            id: `fixture_${player1.id}_${player2.id}`,
            player1: player1.username,
            player1Id: player1.id,
            player2: player2.username,
            player2Id: player2.id,
            division: user.division,
            status: 'fixture'
          })
        }
      }
    }
    return matches
  }

  const potentialMatches = getPotentialMatches()

  const getMaxBetsPerDivision = (division) => {
    const playersInDivision = allUsers.filter(u => u.division === division).length
    return Math.min(playersInDivision, 10)
  }

  const getUserBetsInDivision = (division) => {
    return bets.filter(b => {
      const game = approvedResults.find(r => r.id === b.gameId)
      return game && game.division === division
    }).length
  }

  const handlePlaceBet = (gameId) => {
    if ((user?.eliteTokens || 0) < 100) {
      alert('You need at least 100 elite tokens to place bets. Win league games to earn tokens!')
      return
    }

    if (!predictedWinner || !predictedScore1 || !predictedScore2) {
      alert('Please fill in all prediction fields')
      return
    }

    if (!useTokens(betAmount)) {
      alert('Not enough elite tokens!')
      return
    }

    const newBet = {
      id: Date.now(),
      userId: user.id,
      gameId,
      amount: betAmount,
      predictedWinner,
      predictedScore1: parseInt(predictedScore1),
      predictedScore2: parseInt(predictedScore2),
      won: null,
      createdAt: new Date().toISOString()
    }

    const allBets = JSON.parse(localStorage.getItem('eliteArrowsBets') || '[]')
    allBets.push(newBet)
    localStorage.setItem('eliteArrowsBets', JSON.stringify(allBets))

    setBets([...bets, newBet])
    setShowBetForm(null)
    setPredictedWinner('')
    setPredictedScore1('')
    setPredictedScore2('')
    setBetAmount(10)
    alert('Bet placed! Good luck!')
  }

  const promotionDraw = JSON.parse(localStorage.getItem('eliteArrowsPromotionDraw') || '[]')
  const userInDraw = promotionDraw.includes(user.id)

  const checkWinners = () => {
    const allBets = JSON.parse(localStorage.getItem('eliteArrowsBets') || '[]')
    const updatedBets = allBets.map(bet => {
      if (bet.won !== null) return bet
      
      let game = approvedResults.find(r => r.id === bet.gameId)
      
      if (!game && bet.gameId.startsWith('fixture_')) {
        const parts = bet.gameId.replace('fixture_', '').split('_')
        const player1Id = parts[0]
        const player2Id = parts[1]
        
        game = approvedResults.find(r => 
          r.season === currentSeason && 
          r.division === user.division &&
          ((r.player1Id === player1Id && r.player2Id === player2Id) ||
           (r.player1Id === player2Id && r.player2Id === player1Id))
        )
      }
      
      if (!game) return bet
      
      const actualWinner = game.score1 > game.score2 ? game.player1Id : game.player2Id
      const predictedWinnerId = bet.predictedWinner === game.player1 ? game.player1Id : game.player2Id
      
      const wonByLegs = bet.predictedScore1 === game.score1 && bet.predictedScore2 === game.score2
      
      if (actualWinner === predictedWinnerId && wonByLegs) {
        if (!promotionDraw.includes(bet.userId)) {
          const newDraw = [...promotionDraw, bet.userId]
          localStorage.setItem('eliteArrowsPromotionDraw', JSON.stringify(newDraw))
        }
        return { ...bet, won: true }
      }
      return { ...bet, won: false }
    })
    
    localStorage.setItem('eliteArrowsBets', JSON.stringify(updatedBets))
    setBets(updatedBets.filter(b => b.userId === user.id))
    alert('Bets checked and winners updated!')
  }

  const leaveDraw = () => {
    const newDraw = promotionDraw.filter(id => id !== user.id)
    localStorage.setItem('eliteArrowsPromotionDraw', JSON.stringify(newDraw))
    alert('You have left the promotion draw')
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Rewards</h1>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 className="card-title">Your Elite Tokens</h3>
        <div style={{ 
          padding: '20px', 
          background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-cyan))', 
          borderRadius: '12px', 
          textAlign: 'center',
          color: '#000'
        }}>
          <span style={{ fontSize: '3rem', fontWeight: 'bold' }}>{user?.eliteTokens || 0}</span>
          <p style={{ margin: 0, fontSize: '1rem' }}>Elite Tokens</p>
        </div>
        <p style={{ color: 'var(--text-muted)', marginTop: '10px', fontSize: '0.85rem' }}>
          Win league games to earn 50 tokens per win!
        </p>
        <p style={{ color: (user?.eliteTokens || 0) >= 100 ? 'var(--success)' : 'var(--warning)', marginTop: '5px', fontSize: '0.85rem' }}>
          {(user?.eliteTokens || 0) >= 100 
            ? 'You can place bets!' 
            : 'Need 100+ tokens to place bets'}
        </p>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 className="card-title">Promotion Draw</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
          Bet correctly on league games to enter the season-end promotion draw!
        </p>
        
        {userInDraw ? (
          <div style={{ 
            padding: '15px', 
            background: 'rgba(34, 197, 94, 0.1)', 
            border: '1px solid var(--success)', 
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <p style={{ color: 'var(--success)', fontWeight: 'bold', margin: 0 }}>
              You are in the promotion draw!
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Correctly predict game outcomes to stay in the draw.
            </p>
            <button className="btn btn-danger btn-sm" onClick={leaveDraw} style={{ marginTop: '10px' }}>
              Leave Draw
            </button>
          </div>
        ) : (
          <div style={{ 
            padding: '15px', 
            background: 'var(--bg-secondary)', 
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <p style={{ color: 'var(--text-muted)' }}>
              Place bets on league games to enter the promotion draw!
            </p>
          </div>
        )}
        
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '10px' }}>
          Draw participants: {promotionDraw.length}
        </p>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 className="card-title" style={{ margin: 0 }}>Available to Bet</h3>
          {user.isAdmin && (
            <button className="btn btn-secondary btn-sm" onClick={checkWinners}>
              Check Winners (Admin)
            </button>
          )}
        </div>
        
        {potentialMatches.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No fixtures available to bet on. All matches in your division have been played!</p>
        ) : (
          potentialMatches.slice(0, 10).map(match => {
            const maxBets = getMaxBetsPerDivision(match.division)
            const userBetsInDiv = getUserBetsInDivision(match.division)
            const userBetOnGame = bets.find(b => b.gameId === match.id)
            
            return (
              <div key={match.id} style={{ 
                padding: '15px', 
                borderBottom: '1px solid var(--border)',
                background: userBetOnGame ? 'rgba(34, 197, 94, 0.1)' : 'transparent'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div>
                    <strong>{match.player1}</strong> vs <strong>{match.player2}</strong>
                  </div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>
                    {match.division} | Fixture
                  </span>
                </div>
                
                {userBetOnGame ? (
                  <div style={{ 
                    padding: '10px', 
                    background: 'var(--bg-secondary)', 
                    borderRadius: '8px',
                    fontSize: '0.85rem'
                  }}>
                    <p style={{ margin: 0 }}>
                      Your bet: {userBetOnGame.predictedWinner} {userBetOnGame.predictedScore1}-{userBetOnGame.predictedScore2}
                      {userBetOnGame.won === true && <span style={{ color: 'var(--success)', marginLeft: '10px' }}>WINNER!</span>}
                      {userBetOnGame.won === false && <span style={{ color: 'var(--error)', marginLeft: '10px' }}>Lost</span>}
                    </p>
                  </div>
                  ) : userBetsInDiv >= maxBets ? (
                  <p style={{ color: 'var(--warning)', fontSize: '0.85rem' }}>
                    Max bets reached for {match.division}
                  </p>
                ) : (
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowBetForm(match.id)}
                  >
                    Bet on this game
                  </button>
                )}
                
                {showBetForm === match.id && (
                  <div style={{ marginTop: '15px', padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                    <h4 style={{ marginBottom: '10px' }}>Place Bet</h4>
                    <div className="form-group">
                      <label>Bet Amount (Tokens)</label>
                      <select value={betAmount} onChange={(e) => setBetAmount(parseInt(e.target.value))}>
                        <option value="10">10 tokens</option>
                        <option value="20">20 tokens</option>
                        <option value="50">50 tokens</option>
                        <option value="100">100 tokens</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Predict Winner</label>
                      <select value={predictedWinner} onChange={(e) => setPredictedWinner(e.target.value)}>
                        <option value="">Select winner</option>
                        <option value={match.player1}>{match.player1}</option>
                        <option value={match.player2}>{match.player2}</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>{match.player1} Score</label>
                        <input 
                          type="number" 
                          value={predictedScore1}
                          onChange={(e) => setPredictedScore1(e.target.value)}
                          min="0"
                          max="5"
                        />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>{match.player2} Score</label>
                        <input 
                          type="number" 
                          value={predictedScore2}
                          onChange={(e) => setPredictedScore2(e.target.value)}
                          min="0"
                          max="5"
                        />
                      </div>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Correctly predict winner + exact score to win!
                    </p>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button className="btn btn-primary" onClick={() => handlePlaceBet(match.id)}>
                        Place Bet
                      </button>
                      <button className="btn btn-secondary" onClick={() => setShowBetForm(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <div className="card">
        <h3 className="card-title">Your Bet History</h3>
        {bets.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No bets placed yet.</p>
        ) : (
          bets.map(bet => {
            const game = approvedResults.find(r => r.id === bet.gameId)
            return (
              <div key={bet.id} style={{ 
                padding: '12px', 
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>
                    {game ? `${game.player1} vs ${game.player2}` : 'Game not found'}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Bet: {bet.amount} tokens | Pred: {bet.predictedWinner} {bet.predictedScore1}-{bet.predictedScore2}
                  </p>
                </div>
                <span style={{ 
                  color: bet.won === true ? 'var(--success)' : bet.won === false ? 'var(--error)' : 'var(--warning)',
                  fontWeight: 'bold'
                }}>
                  {bet.won === true ? 'WIN' : bet.won === false ? 'LOSE' : 'PENDING'}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}