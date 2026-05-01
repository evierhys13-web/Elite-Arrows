import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'

const DIVISIONS = ['Elite', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze', 'Development']

export default function Rewards() {
  const { user, getAllUsers, useTokens, updateUser } = useAuth()
  const [bets, setBets] = useState([])
  const [showBetForm, setShowBetForm] = useState(null)
  const [betAmount, setBetAmount] = useState(10)
  const [predictedWinner, setPredictedWinner] = useState('')
  const [predictedScore1, setPredictedScore1] = useState('')
  const [predictedScore2, setPredictedScore2] = useState('')
  const [selectedDivision, setSelectedDivision] = useState(user?.division || 'All')
  const [showWheel, setShowWheel] = useState(false)
  const [wheelSpinning, setWheelSpinning] = useState(false)
  const [wheelWinner, setWheelWinner] = useState(null)
  const wheelRef = useRef(null)

  const ADMIN_EMAILS = ['rhyshowe2023@outlook.com', 'dhineberry@yahoo.com']
  const isAdmin = ADMIN_EMAILS.includes(user?.email?.toLowerCase()) || user?.isAdmin || user?.isTournamentAdmin
  const userDivision = user?.division || 'Unassigned'
  const canViewAllBettingDivisions = Boolean(isAdmin)

  const allUsers = getAllUsers()
  const results = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]')
  const approvedResults = results.filter(r => r.status === 'approved')
  const currentSeason = localStorage.getItem('eliteArrowsCurrentSeason') || 'Season 1'
  
  const seasons = JSON.parse(localStorage.getItem('eliteArrowsSeasons') || '[]')
  const activeSeason = seasons.find(s => s.status === 'active')
  const seasonStartDate = activeSeason?.startDate ? new Date(activeSeason.startDate) : null
  const seasonEnded = seasonStartDate && new Date() > seasonStartDate

  useEffect(() => {
    const storedBets = JSON.parse(localStorage.getItem('eliteArrowsBets') || '[]')
    setBets(storedBets.filter(b => b.userId === user.id))
  }, [user.id])

  useEffect(() => {
    if (!canViewAllBettingDivisions && selectedDivision !== userDivision) {
      setSelectedDivision(userDivision)
    }
  }, [canViewAllBettingDivisions, selectedDivision, userDivision])

  const fixtures = JSON.parse(localStorage.getItem('eliteArrowsFixtures') || '[]')
  const acceptedFixtures = fixtures.filter(f => 
    (f.player1Id === user.id || f.player2Id === user.id) && f.status === 'accepted'
  )

  const getPlayerGameCount = (playerId, division) => {
    return approvedResults.filter(r => 
      r.season === currentSeason && 
      r.division === division &&
      (r.player1Id === playerId || r.player2Id === playerId)
    ).length
  }

  const getDivisionMaxGames = (division) => {
    const playersInDiv = allUsers.filter(u => u.division === division)
    return Math.max(0, playersInDiv.length - 1)
  }

  const visibleBettingDivision = canViewAllBettingDivisions ? selectedDivision : userDivision

  const getPotentialMatches = () => {
    const divisionsToCheck = visibleBettingDivision === 'All' ? DIVISIONS : [visibleBettingDivision].filter(Boolean)
    const matches = []

    divisionsToCheck.forEach(division => {
      const maxGames = getDivisionMaxGames(division)
      const playersInDiv = allUsers.filter(u => u.division === division && u.id !== user.id)
      
      playersInDiv.forEach(player1 => {
        playersInDiv.forEach(player2 => {
          if (player1.id >= player2.id) return
          
          const player1GamesPlayed = getPlayerGameCount(player1.id, division)
          const player2GamesPlayed = getPlayerGameCount(player2.id, division)
          
          if (player1GamesPlayed >= maxGames || player2GamesPlayed >= maxGames) return

          const alreadyPlayed = approvedResults.find(r => 
            r.season === currentSeason && 
            r.division === division &&
            ((r.player1Id === player1.id && r.player2Id === player2.id) ||
             (r.player1Id === player2.id && r.player2Id === player1.id))
          )

          if (!alreadyPlayed) {
            const alreadyBet = bets.find(b => b.gameId === `fixture_${player1.id}_${player2.id}`)
            
            matches.push({
              id: `fixture_${player1.id}_${player2.id}`,
              player1: player1.username,
              player1Id: player1.id,
              player2: player2.username,
              player2Id: player2.id,
              division,
              status: 'fixture',
              player1GamesPlayed,
              player2GamesPlayed,
              maxGames: maxGames,
              alreadyBet: !!alreadyBet
            })
          }
        })
      })
    })

    return matches
  }

  const getMatchesByDivision = () => {
    const matches = getPotentialMatches()
    const byDivision = {}
    
    matches.forEach(match => {
      if (!byDivision[match.division]) {
        byDivision[match.division] = []
      }
      byDivision[match.division].push(match)
    })

    return byDivision
  }

  const potentialMatches = getPotentialMatches()
  const matchesByDivision = getMatchesByDivision()

  const handlePlaceBet = (matchId) => {
    if ((user?.eliteTokens || 0) < betAmount) {
      alert('Not enough elite tokens!')
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
      gameId: matchId,
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

  const checkWinners = () => {
    const allBets = JSON.parse(localStorage.getItem('eliteArrowsBets') || '[]')
    const promotionDraw = JSON.parse(localStorage.getItem('eliteArrowsPromotionDraw') || '[]')
    
    const updatedBets = allBets.map(bet => {
      if (bet.won !== null) return bet
      
      const game = approvedResults.find(r => r.id === bet.gameId)
      
      if (!game && bet.gameId.startsWith('fixture_')) {
        const parts = bet.gameId.replace('fixture_', '').split('_')
        const player1Id = parts[0]
        const player2Id = parts[1]
        
        const foundGame = approvedResults.find(r => 
          r.season === currentSeason && 
          ((r.player1Id === player1Id && r.player2Id === player2Id) ||
           (r.player1Id === player2Id && r.player2Id === player1Id))
        )
        
        if (foundGame) {
          const actualWinner = foundGame.score1 > foundGame.score2 ? foundGame.player1Id : foundGame.player2Id
          const predictedWinnerId = bet.predictedWinner === foundGame.player1 ? foundGame.player1Id : foundGame.player2Id
          const wonByLegs = bet.predictedScore1 === foundGame.score1 && bet.predictedScore2 === foundGame.score2
          
          if (actualWinner === predictedWinnerId && wonByLegs) {
            if (!promotionDraw.includes(bet.userId)) {
              promotionDraw.push(bet.userId)
              localStorage.setItem('eliteArrowsPromotionDraw', JSON.stringify(promotionDraw))
            }
            return { ...bet, won: true }
          }
          return { ...bet, won: false }
        }
      }
      
      if (game) {
        const actualWinner = game.score1 > game.score2 ? game.player1Id : game.player2Id
        const predictedWinnerId = bet.predictedWinner === game.player1 ? game.player1Id : game.player2Id
        const wonByLegs = bet.predictedScore1 === game.score1 && bet.predictedScore2 === game.score2
        
        if (actualWinner === predictedWinnerId && wonByLegs) {
          if (!promotionDraw.includes(bet.userId)) {
            promotionDraw.push(bet.userId)
            localStorage.setItem('eliteArrowsPromotionDraw', JSON.stringify(promotionDraw))
          }
          return { ...bet, won: true }
        }
        return { ...bet, won: false }
      }
      return bet
    })
    
    localStorage.setItem('eliteArrowsBets', JSON.stringify(updatedBets))
    setBets(updatedBets.filter(b => b.userId === user.id))
    alert('Bets checked and winners updated!')
  }

  const promotionDraw = JSON.parse(localStorage.getItem('eliteArrowsPromotionDraw') || '[]')
  const userInDraw = promotionDraw.includes(user.id)

  const leaveDraw = () => {
    const newDraw = promotionDraw.filter(id => id !== user.id)
    localStorage.setItem('eliteArrowsPromotionDraw', JSON.stringify(newDraw))
    alert('You have left the promotion draw')
  }

  const getUserStats = () => {
    if (!userDivision || userDivision === 'Unassigned') return { totalGames: 0, gamesPlayed: 0 }

    const maxGames = getDivisionMaxGames(userDivision)
    const gamesPlayed = getPlayerGameCount(user.id, userDivision)
    const totalGames = maxGames
    return { totalGames, gamesPlayed }
  }

  const userStats = getUserStats()

  const checkAllGamesComplete = () => {
    for (const division of DIVISIONS) {
      const playersInDiv = allUsers.filter(u => u.division === division)
      const maxGames = playersInDiv.length - 1
      if (maxGames <= 0) continue
      
      for (const player of playersInDiv) {
        const gamesPlayed = getPlayerGameCount(player.id, division)
        if (gamesPlayed < maxGames) {
          return false
        }
      }
    }
    return true
  }

  const allGamesComplete = checkAllGamesComplete()

  const spinWheel = () => {
    if (promotionDraw.length === 0) {
      alert('No participants in the promotion draw!')
      return
    }
    if (!allGamesComplete) {
      alert('Cannot spin the wheel until all league games are complete!')
      return
    }
    setShowWheel(true)
    setWheelSpinning(true)
    setWheelWinner(null)
    
    const wheelElement = wheelRef.current
    if (wheelElement) {
      const segmentAngle = 360 / promotionDraw.length
      const randomSegment = Math.floor(Math.random() * promotionDraw.length)
      const randomOffset = Math.random() * segmentAngle * 0.8
      const totalRotation = 360 * 5 + (randomSegment * segmentAngle) + randomOffset
      
      wheelElement.style.transition = 'transform 4s ease-out'
      wheelElement.style.transform = `rotate(${totalRotation}deg)`
      
      setTimeout(() => {
        setWheelSpinning(false)
        const winnerId = promotionDraw[randomSegment]
        const winner = allUsers.find(u => u.id === winnerId)
        setWheelWinner(winner?.username || 'Unknown')
        
        localStorage.setItem('eliteArrowsPromotionWinner', winnerId)
        localStorage.setItem('eliteArrowsPromotionDrawSpun', 'true')
      }, 4000)
    }
  }

  const resetWheel = () => {
    setShowWheel(false)
    setWheelWinner(null)
    if (wheelRef.current) {
      wheelRef.current.style.transition = 'none'
      wheelRef.current.style.transform = 'rotate(0deg)'
    }
  }

  const promotionDrawSpun = localStorage.getItem('eliteArrowsPromotionDrawSpun') === 'true'
  const previousWinner = localStorage.getItem('eliteArrowsPromotionWinner')

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
        <h3 className="card-title">Your Games Progress</h3>
        <div style={{ marginBottom: '15px' }}>
          {userDivision === 'Unassigned' ? (
            <p style={{ color: 'var(--text-muted)' }}>You have not been assigned to a division yet.</p>
          ) : (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span>{userDivision} ({allUsers.filter(u => u.division === userDivision).length} players)</span>
                <span>{userStats.gamesPlayed}/{userStats.totalGames} games</span>
              </div>
              <div style={{
                height: '8px',
                background: 'var(--bg-secondary)',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: userStats.totalGames > 0 ? `${Math.min(100, (userStats.gamesPlayed / userStats.totalGames) * 100)}%` : '0%',
                  height: '100%',
                  background: userStats.gamesPlayed >= userStats.totalGames && userStats.totalGames > 0 ? 'var(--success)' : 'var(--accent-cyan)',
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>
          )}
        </div>
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
        {previousWinner && (
          <p style={{ fontSize: '0.85rem', color: 'var(--success)', marginTop: '10px' }}>
            Previous winner: {allUsers.find(u => u.id === previousWinner)?.username || 'Unknown'}
          </p>
        )}
        {isAdmin && (
          <div style={{ marginTop: '15px', padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
              Admin Controls
            </p>
            {!allGamesComplete ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--warning)' }}>
                All league games must be complete before spinning the wheel
              </p>
            ) : promotionDrawSpun ? (
              <button className="btn btn-secondary" onClick={resetWheel}>
                Reset Wheel
              </button>
            ) : (
              <button className="btn btn-primary" onClick={spinWheel}>
                Spin the Wheel
              </button>
            )}
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              {allGamesComplete ? 'All league games complete! Ready to spin.' : 'Waiting for all league games to complete...'}
            </p>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 className="card-title" style={{ margin: 0 }}>Available to Bet ({potentialMatches.length})</h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {canViewAllBettingDivisions ? (
              <select
                value={selectedDivision}
                onChange={(e) => setSelectedDivision(e.target.value)}
                style={{ padding: '8px', borderRadius: '6px' }}
              >
                <option value="All">All Divisions</option>
                {DIVISIONS.map(div => (
                  <option key={div} value={div}>{div}</option>
                ))}
              </select>
            ) : (
              <span style={{
                padding: '8px 10px',
                background: 'var(--bg-secondary)',
                borderRadius: '6px',
                color: 'var(--accent-cyan)',
                fontSize: '0.85rem',
                fontWeight: 700
              }}>
                {userDivision}
              </span>
            )}
            {user.isAdmin && (
              <button className="btn btn-secondary btn-sm" onClick={checkWinners}>
                Check Winners (Admin)
              </button>
            )}
          </div>
        </div>
        
        {potentialMatches.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No fixtures available to bet on. All matches in {canViewAllBettingDivisions && visibleBettingDivision === 'All' ? 'these divisions' : 'your division'} have been played!</p>
        ) : (
          visibleBettingDivision === 'All' ? (
            Object.entries(matchesByDivision).map(([division, matches]) => (
              <div key={division} style={{ marginBottom: '20px' }}>
                <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '10px' }}>{division}</h4>
                {matches.map(match => (
                  <MatchCard 
                    key={match.id} 
                    match={match} 
                    bets={bets}
                    showBetForm={showBetForm}
                    setShowBetForm={setShowBetForm}
                    betAmount={betAmount}
                    setBetAmount={setBetAmount}
                    predictedWinner={predictedWinner}
                    setPredictedWinner={setPredictedWinner}
                    predictedScore1={predictedScore1}
                    setPredictedScore1={setPredictedScore1}
                    predictedScore2={predictedScore2}
                    setPredictedScore2={setPredictedScore2}
                    onPlaceBet={handlePlaceBet}
                  />
                ))}
              </div>
            ))
          ) : (
            (matchesByDivision[visibleBettingDivision] || []).map(match => (
              <MatchCard 
                key={match.id} 
                match={match} 
                bets={bets}
                showBetForm={showBetForm}
                setShowBetForm={setShowBetForm}
                betAmount={betAmount}
                setBetAmount={setBetAmount}
                predictedWinner={predictedWinner}
                setPredictedWinner={setPredictedWinner}
                predictedScore1={predictedScore1}
                setPredictedScore1={setPredictedScore1}
                predictedScore2={predictedScore2}
                setPredictedScore2={setPredictedScore2}
                onPlaceBet={handlePlaceBet}
              />
            ))
          )
        )}
      </div>

      <div className="card">
        <h3 className="card-title">Your Bet History</h3>
        {bets.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No bets placed yet.</p>
        ) : (
          bets.map(bet => (
            <div key={bet.id} style={{ 
              padding: '12px', 
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                  {bet.predictedWinner} {bet.predictedScore1}-{bet.predictedScore2}
                </p>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Bet: {bet.amount} tokens
                </p>
              </div>
              <span style={{ 
                color: bet.won === true ? 'var(--success)' : bet.won === false ? 'var(--error)' : 'var(--warning)',
                fontWeight: 'bold'
              }}>
                {bet.won === true ? 'WIN' : bet.won === false ? 'LOSE' : 'PENDING'}
              </span>
            </div>
          ))
        )}

        {acceptedFixtures.length > 0 && (
          <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '2px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h4 style={{ color: 'var(--success)', margin: 0 }}>Upcoming Fixtures ({acceptedFixtures.length})</h4>
              <a href="/fixtures" className="btn btn-secondary btn-sm">
                View All →
              </a>
            </div>
            {acceptedFixtures.slice(0, 2).map(fixture => (
              <div key={fixture.id} style={{ 
                padding: '12px', 
                background: 'rgba(34, 197, 94, 0.1)', 
                border: '1px solid var(--success)',
                borderRadius: '8px',
                marginBottom: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{fixture.player1Name}</strong> vs <strong>{fixture.player2Name}</strong>
                  </div>
                  <span style={{ color: 'var(--success)', fontSize: '0.85rem' }}>
                    {fixture.fixtureDate}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SpinWheelModal 
        isOpen={showWheel}
        onClose={() => setShowWheel(false)}
        promotionDraw={promotionDraw}
        allUsers={allUsers}
        wheelSpinning={wheelSpinning}
        wheelWinner={wheelWinner}
        wheelRef={wheelRef}
      />
    </div>
  )
}

function MatchCard({ match, bets, showBetForm, setShowBetForm, betAmount, setBetAmount, predictedWinner, setPredictedWinner, predictedScore1, setPredictedScore1, predictedScore2, setPredictedScore2, onPlaceBet }) {
  const userBetOnGame = bets.find(b => b.gameId === match.id)

  return (
    <div style={{ 
      padding: '15px', 
      borderBottom: '1px solid var(--border)',
      background: userBetOnGame ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
      marginBottom: '10px',
      borderRadius: '8px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div>
          <strong>{match.player1}</strong> vs <strong>{match.player2}</strong>
        </div>
        <span style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>
          {match.division}
        </span>
      </div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
        {match.player1}: {match.player1GamesPlayed}/{match.maxGames} | {match.player2}: {match.player2GamesPlayed}/{match.maxGames}
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
            <button className="btn btn-primary" onClick={() => onPlaceBet(match.id)}>
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
}

function SpinWheelModal({ isOpen, onClose, promotionDraw, allUsers, wheelSpinning, wheelWinner, wheelRef }) {
  if (!isOpen) return null
  
  const colors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899', '#06b6d4', '#f97316']
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.9)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <h2 style={{ color: '#fff', marginBottom: '30px' }}>Promotion Draw</h2>
      
      <div style={{ position: 'relative', width: '300px', height: '300px', marginBottom: '30px' }}>
        <div style={{
          position: 'absolute',
          top: '-15px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '15px solid transparent',
          borderRight: '15px solid transparent',
          borderTop: '25px solid #fff',
          zIndex: 10
        }} />
        <div 
          ref={wheelRef}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: `conic-gradient(${promotionDraw.map((id, i) => {
              const player = allUsers.find(u => u.id === id)
              const color = colors[i % colors.length]
              const startAngle = (i / promotionDraw.length) * 360
              const endAngle = ((i + 1) / promotionDraw.length) * 360
              return `${color} ${startAngle}deg ${endAngle}deg`
            }).join(', ')})`,
            boxShadow: '0 0 20px rgba(0,0,0,0.5)',
            border: '5px solid #fff'
          }}
        >
          {promotionDraw.map((id, i) => {
            const player = allUsers.find(u => u.id === id)
            const angle = (i / promotionDraw.length) * 360 + (180 / promotionDraw.length)
            const playerName = player?.username || 'Unknown'
            const shortName = playerName.length > 6 ? playerName.substring(0, 6) + '...' : playerName
            return (
              <div
                key={id}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: `rotate(${angle}deg) translateX(80px) rotate(90deg)`,
                  transformOrigin: 'center',
                  fontSize: '0.7rem',
                  color: '#fff',
                  textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                  whiteSpace: 'nowrap'
                }}
              >
                {shortName}
              </div>
            )
          })}
        </div>
      </div>
      
      {wheelSpinning && (
        <p style={{ color: '#fff', fontSize: '1.2rem', animation: 'pulse 0.5s infinite' }}>
          Spinning...
        </p>
      )}
      
      {wheelWinner && !wheelSpinning && (
        <div style={{
          padding: '20px 40px',
          background: 'linear-gradient(135deg, #22c55e, #16a34a)',
          borderRadius: '12px',
          textAlign: 'center',
          marginBottom: '20px'
        }}>
          <p style={{ color: '#fff', margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>
            Winner!
          </p>
          <p style={{ color: '#fff', margin: '10px 0 0 0', fontSize: '2rem', fontWeight: 'bold' }}>
            {wheelWinner}
          </p>
        </div>
      )}
      
      <button 
        className="btn btn-secondary" 
        onClick={onClose}
        disabled={wheelSpinning}
      >
        Close
      </button>
    </div>
  )
}
