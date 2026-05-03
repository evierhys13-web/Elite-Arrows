import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'

const DIVISIONS = ['Elite', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze', 'Development']

export default function Rewards() {
  const { user, getAllUsers, getResults } = useAuth()
  const [showWheel, setShowWheel] = useState(false)
  const [wheelSpinning, setWheelSpinning] = useState(false)
  const [wheelWinner, setWheelWinner] = useState(null)
  const wheelRef = useRef(null)

  const ADMIN_EMAILS = ['rhyshowe2023@outlook.com', 'dhineberry@yahoo.com']
  const isAdmin = ADMIN_EMAILS.includes(user?.email?.toLowerCase()) || user?.isAdmin || user?.isTournamentAdmin

  const allUsers = getAllUsers()
  const results = getResults()
  const approvedResults = results.filter(r => String(r.status || '').toLowerCase() === 'approved')
  const currentSeason = localStorage.getItem('eliteArrowsCurrentSeason') || 'Season 1'
  const promotionDraw = JSON.parse(localStorage.getItem('eliteArrowsPromotionDraw') || '[]')
  const userInDraw = promotionDraw.includes(user?.id)
  const promotionDrawSpun = localStorage.getItem('eliteArrowsPromotionDrawSpun') === 'true'
  const previousWinner = localStorage.getItem('eliteArrowsPromotionWinner')

  const getPlayerGameCount = (playerId, division) => (
    approvedResults.filter(r =>
      r.season === currentSeason &&
      r.division === division &&
      (String(r.player1Id) === String(playerId) || String(r.player2Id) === String(playerId))
    ).length
  )

  const checkWinners = () => {
    const allBets = JSON.parse(localStorage.getItem('eliteArrowsBets') || '[]')
    const drawEntries = JSON.parse(localStorage.getItem('eliteArrowsPromotionDraw') || '[]')

    const getBetPlayerIds = (bet) => {
      if (bet.fixturePlayer1Id && bet.fixturePlayer2Id) {
        return {
          player1Id: bet.fixturePlayer1Id,
          player2Id: bet.fixturePlayer2Id
        }
      }
      if (bet.gameId?.startsWith('fixture_')) {
        const [player1Id, player2Id] = bet.gameId.replace('fixture_', '').split('_')
        return { player1Id, player2Id }
      }
      return { player1Id: null, player2Id: null }
    }

    const scoreForPlayer = (game, playerId) => (
      String(game.player1Id) === String(playerId) ? Number(game.score1) : Number(game.score2)
    )

    const updatedBets = allBets.map(bet => {
      if (bet.won !== null) return bet

      const { player1Id, player2Id } = getBetPlayerIds(bet)
      const game = (
        (bet.fixtureId
          ? approvedResults.find(r => String(r.fixtureId || '') === String(bet.fixtureId))
          : null) ||
        (bet.cupId && bet.matchId
          ? approvedResults.find(r =>
              String(r.cupId || '') === String(bet.cupId) &&
              String(r.matchId || '') === String(bet.matchId)
            )
          : null) ||
        approvedResults.find(r => String(r.id) === String(bet.gameId)) ||
        (player1Id && player2Id
          ? approvedResults.find(r =>
              r.season === currentSeason &&
              (
                (String(r.player1Id) === String(player1Id) && String(r.player2Id) === String(player2Id)) ||
                (String(r.player1Id) === String(player2Id) && String(r.player2Id) === String(player1Id))
              )
            )
          : null)
      )

      if (!game) return bet

      const actualWinnerId = Number(game.score1) > Number(game.score2) ? game.player1Id : game.player2Id
      const predictedWinnerId = bet.predictedWinnerId || (bet.predictedWinner === game.player1 ? game.player1Id : game.player2Id)
      const expectedScore1 = player1Id ? scoreForPlayer(game, player1Id) : Number(game.score1)
      const expectedScore2 = player2Id ? scoreForPlayer(game, player2Id) : Number(game.score2)
      const wonByLegs = Number(bet.predictedScore1) === expectedScore1 && Number(bet.predictedScore2) === expectedScore2

      if (String(actualWinnerId) === String(predictedWinnerId) && wonByLegs) {
        if (!drawEntries.includes(bet.userId)) {
          drawEntries.push(bet.userId)
        }
        return { ...bet, won: true }
      }

      return { ...bet, won: false }
    })

    localStorage.setItem('eliteArrowsBets', JSON.stringify(updatedBets))
    localStorage.setItem('eliteArrowsPromotionDraw', JSON.stringify(drawEntries))
    alert('Bets checked and winners updated!')
  }

  const leaveDraw = () => {
    const newDraw = promotionDraw.filter(id => id !== user?.id)
    localStorage.setItem('eliteArrowsPromotionDraw', JSON.stringify(newDraw))
    alert('You have left the promotion draw')
  }

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
        const winner = allUsers.find(u => String(u.id) === String(winnerId))
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
          Win league games to earn 50 tokens per win.
        </p>
        <p style={{ color: (user?.eliteTokens || 0) >= 100 ? 'var(--success)' : 'var(--warning)', marginTop: '5px', fontSize: '0.85rem' }}>
          Bet on league and cup games from Fixtures &gt; All Fixtures, including unarranged games.
        </p>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 className="card-title">Promotion Draw</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
          Correct bets on league and cup games enter you into the season-end promotion draw.
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
              Place bets from Fixtures &gt; All Fixtures to enter the promotion draw.
            </p>
          </div>
        )}

        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '10px' }}>
          Draw participants: {promotionDraw.length}
        </p>
        {previousWinner && (
          <p style={{ fontSize: '0.85rem', color: 'var(--success)', marginTop: '10px' }}>
            Previous winner: {allUsers.find(u => String(u.id) === String(previousWinner))?.username || 'Unknown'}
          </p>
        )}
        {isAdmin && (
          <div style={{ marginTop: '15px', padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
              Admin Controls
            </p>
            <button className="btn btn-secondary" onClick={checkWinners} style={{ marginBottom: '10px', marginRight: '10px' }}>
              Check Bet Winners
            </button>
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
            const player = allUsers.find(u => String(u.id) === String(id))
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
