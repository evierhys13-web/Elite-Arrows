import { useState, useMemo } from 'react'
import { db, doc, setDoc } from '../firebase'
import { useToast } from '../context/ToastContext'
import Confetti from './Confetti'

const MASTER_CHALLENGE_POOL = [
  { id: 'checkout_80', title: 'High Checkout Bauble', desc: 'Secure a checkout of 80 or higher in any match.', icon: '🎄', type: 'stat' },
  { id: 'hit_180', title: 'Snowflake 180', desc: 'Hit a maximum 180 score in a match.', icon: '❄️', type: 'stat' },
  { id: 'avg_50', title: 'Yuletide Average', desc: 'Maintain a 3-dart average of 50+ in any completed match.', icon: '📊', type: 'stat' },
  { id: 'win_match', title: 'Christmas Cracker Win', desc: 'Win any league or cup match.', icon: '🏆', type: 'stat' },
  { id: 'double_finish', title: 'Double Top Stocking', desc: 'Hit 1+ checkout doubles in a match.', icon: '🎯', type: 'stat' },
  { id: 'checkout_100', title: 'Polar Bear Finish', desc: 'Secure a century checkout (100+) in a match.', icon: '🐻', type: 'stat' },
  { id: 'score_120', title: 'Treble Bells', desc: 'Score 120+ points in a single visit.', icon: '🔔', type: 'stat' },
  { id: 'bullseye', title: 'Bullseye Star', desc: 'Hit the bullseye finish (50+ checkout).', icon: '⭐', type: 'stat' },
  { id: 'play_3_matches', title: 'Holiday Marathon', desc: 'Play and submit at least 3 matches in Season 8.', icon: '🏃', type: 'stat' },
  { id: 'checkout_odd', title: 'Candy Cane Checkout', desc: 'Finish a leg with a checkout starting on an odd number.', icon: '🍬', type: 'stat' },
  { id: 'win_by_3', title: 'Festive Blowout', desc: 'Win a match with a margin of 3 or more legs.', icon: '🎁', type: 'stat' },
  { id: 'login_streak', title: 'Festive Dedication', desc: 'Active participation in Elite Arrows Season 8.', icon: '👑', type: 'participation' },
  { id: 'checkout_50', title: 'Frosty Finish', desc: 'Secure a match checkout above 50.', icon: '⛄', type: 'stat' },
  { id: 'win_cup', title: 'Yuletide Knockout', desc: 'Win a cup match or playoff round.', icon: '⚔️', type: 'stat' }
]

// Generates a unique, deterministic 12-day challenge set seeded by user ID
function getUniqueUserChallenges(userId) {
  if (!userId) return MASTER_CHALLENGE_POOL.slice(0, 12).map((c, idx) => ({ ...c, day: idx + 1 }))
  let seed = 0
  for (let i = 0; i < userId.length; i++) {
    seed += userId.charCodeAt(i)
  }
  const pool = [...MASTER_CHALLENGE_POOL]
  for (let i = pool.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280
    const j = Math.floor((seed / 233280) * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, 12).map((c, idx) => ({ ...c, day: idx + 1 }))
}

export default function AdventCalendar({ user, results = [] }) {
  const isRhysAdmin = user?.email && user.email.toLowerCase() === 'rhyshowe2023@outlook.com'
  if (!isRhysAdmin) return null

  const { showToast } = useToast()
  const [selectedDay, setSelectedDay] = useState(null)
  const [triggerConfetti, setTriggerConfetti] = useState(false)
  const [loadingDay, setLoadingDay] = useState(null)
  const [proofImage, setProofImage] = useState('')

  const userId = user?.id || user?.firebaseId || ''
  const adventChallenges = useMemo(() => getUniqueUserChallenges(userId), [userId])
  const progress = user?.adventProgress || {}

  const now = new Date()
  const dec1 = new Date('2026-12-01T00:00:00')
  const isBeforeDec1 = now < dec1

  // Automated verification helpers against user's approved match results
  const userMatches = useMemo(() => {
    if (!userId) return []
    return results.filter(r =>
      String(r.status).toLowerCase() === 'approved' &&
      (String(r.player1Id) === String(userId) || String(r.player2Id) === String(userId) ||
       String(r.team1Id) === String(userId) || String(r.team2Id) === String(userId))
    )
  }, [results, userId])

  const checkChallengeCompletion = (challenge) => {
    if (challenge.type === 'participation') return true
    if (userMatches.length === 0) return false

    return userMatches.some(r => {
      const isP1 = String(r.player1Id || r.team1Id) === String(userId)
      const myStats = isP1 ? r.player1Stats : r.player2Stats
      const myScore = Number(isP1 ? r.score1 : r.score2) || 0
      const theirScore = Number(isP1 ? r.score2 : r.score1) || 0
      const co = Number(myStats?.highestCheckout || 0)
      const count180 = Number(myStats?.['180s'] || 0)
      const avg = Number(myStats?.avg || 0)
      const doubleSucc = Number(myStats?.doubleSuccess || 0)

      switch (challenge.id) {
        case 'checkout_80': return co >= 80
        case 'checkout_100': return co >= 100
        case 'checkout_50': return co > 50
        case 'hit_180': return count180 > 0
        case 'avg_50': return avg >= 50
        case 'win_match': return myScore > theirScore
        case 'double_finish': return doubleSucc > 0 || co > 0
        case 'bullseye': return co >= 50
        case 'play_3_matches': return userMatches.length >= 3
        case 'score_120': return count180 > 0 || co >= 100
        case 'checkout_odd': return co > 0 && co % 2 !== 0
        case 'win_by_3': return myScore > theirScore && (myScore - theirScore) >= 3
        case 'win_cup': return myScore > theirScore && String(r.gameType).toLowerCase() === 'cup'
        default: return myScore > theirScore
      }
    })
  }

  const handleOpenDoor = (item) => {
    const unlockDate = new Date(`2026-12-${String(item.day).padStart(2, '0')}T00:00:00`)
    if (now < unlockDate) {
      showToast(`🔒 Day ${item.day} unlocks on December ${item.day}, 2026!`, 'warning')
      return
    }
    setProofImage('')
    setSelectedDay(item)
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('Image is too large. Please pick an image under 5MB.', 'error')
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        setProofImage(reader.result)
        showToast('Proof screenshot attached successfully!', 'success')
      }
      reader.readAsDataURL(file)
    }
  }

  const handleClaimReward = async (dayNum, challenge) => {
    if (!userId || user?.isGuest) {
      showToast('Please sign in to claim advent calendar rewards!', 'error')
      return
    }

    const isCompleted = checkChallengeCompletion(challenge)
    if (!isCompleted && !proofImage && challenge.type !== 'participation') {
      showToast('Please attach screenshot proof or complete the match requirement to claim!', 'warning')
      return
    }

    setLoadingDay(dayNum)
    try {
      const updatedProgress = {
        ...progress,
        [dayNum]: { claimed: true, proof: proofImage || 'auto_verified', timestamp: new Date().toISOString() }
      }
      await setDoc(doc(db, 'users', String(userId)), { adventProgress: updatedProgress }, { merge: true })

      user.adventProgress = updatedProgress

      setTriggerConfetti(true)
      showToast(`🎁 Day ${dayNum} reward claimed successfully! Unique gift unlocked!`, 'success')
      setTimeout(() => setTriggerConfetti(false), 3000)
      setSelectedDay(null)
    } catch (e) {
      console.error(e)
      showToast('Failed to claim reward. Try again.', 'error')
    } finally {
      setLoadingDay(null)
    }
  }

  return (
    <div className="card glass animate-fade-in" style={{
      marginBottom: '28px',
      padding: '28px',
      borderRadius: '24px',
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, rgba(26, 11, 11, 0.95), rgba(11, 41, 28, 0.95), rgba(26, 11, 11, 0.95))',
      border: '4px solid #b91c1c',
      boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(185, 28, 28, 0.3), inset 0 0 40px rgba(16, 185, 129, 0.2)'
    }}>
      <Confetti trigger={triggerConfetti} />

      {/* Garland / Lights Wire at Top of Calendar Board */}
      <div style={{ position: 'relative', background: 'rgba(5, 10, 8, 0.9)', padding: '8px 12px', margin: '-28px -28px 24px -28px', borderBottom: '2px solid #b91c1c', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '8px', left: 0, right: 0, height: '2px', background: 'rgba(255,255,255,0.3)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2, padding: '0 4px' }}>
          {['#ef4444', '#10b981', '#38bdf8', '#fbbf24', '#ec4899', '#ef4444', '#10b981', '#38bdf8', '#fbbf24', '#ec4899', '#ef4444', '#10b981'].map((color, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '2px', height: '5px', background: 'rgba(255,255,255,0.4)' }} />
              <div style={{
                width: '10px',
                height: '14px',
                borderRadius: '50% 50% 45% 45%',
                backgroundColor: color,
                boxShadow: `0 0 8px ${color}, 0 0 16px ${color}`
              }} />
            </div>
          ))}
        </div>
      </div>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '22px' }}>
        <div style={{ fontSize: '2.2rem', marginBottom: '6px' }}>🎄 12 Days of Christmas Darts 🎁</div>
        <h3 style={{ color: '#fbbf24', fontSize: '1.4rem', margin: '0 0 8px', fontWeight: 900, textShadow: '0 0 10px rgba(251,191,36,0.4)' }}>Season 8 Unique Personalized Advent Calendar</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, maxWidth: '650px', marginLeft: 'auto', marginRight: 'auto' }}>
          Your calendar is uniquely generated for you! Complete your personal daily challenges (auto-verified via match logs or screenshot proof) starting December 1st.
        </p>
      </div>

      {isBeforeDec1 && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '22px',
          textAlign: 'center',
          color: '#fbbf24',
          fontWeight: 800,
          fontSize: '0.88rem'
        }}>
          🔒 Your personalized 12 Days of Christmas Advent Calendar unlocks on 1st December! Doors open day-by-day.
        </div>
      )}

      {/* Advent Calendar Board Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))',
        gap: '14px',
        padding: '10px',
        background: 'rgba(11, 41, 28, 0.6)',
        borderRadius: '16px',
        border: '2px dashed rgba(251, 191, 36, 0.3)'
      }}>
        {adventChallenges.map((item) => {
          const itemProgress = progress[item.day]
          const isOpened = Boolean(itemProgress?.claimed || itemProgress === true)
          const unlockDate = new Date(`2026-12-${String(item.day).padStart(2, '0')}T00:00:00`)
          const isLocked = now < unlockDate
          const isAutoComplete = checkChallengeCompletion(item)

          return (
            <button
              key={item.day}
              onClick={() => handleOpenDoor(item)}
              style={{
                background: isOpened
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.35), rgba(5, 150, 105, 0.45))'
                  : isLocked
                  ? 'linear-gradient(145deg, #0f172a, #090d16)'
                  : isAutoComplete
                  ? 'linear-gradient(145deg, #047857, #065f46)'
                  : 'linear-gradient(145deg, #b91c1c, #991b1b)',
                border: `3px solid ${isOpened ? '#34d399' : isLocked ? 'rgba(255,255,255,0.15)' : isAutoComplete ? '#34d399' : '#fbbf24'}`,
                borderRadius: '14px',
                padding: '18px 10px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: isOpened
                  ? '0 0 20px rgba(52, 211, 153, 0.4), inset 0 0 10px rgba(52, 211, 153, 0.2)'
                  : isLocked
                  ? '0 4px 10px rgba(0,0,0,0.3)'
                  : '0 6px 20px rgba(185, 28, 28, 0.5), inset 0 0 15px rgba(251, 191, 36, 0.3)',
                position: 'relative',
                overflow: 'hidden',
                opacity: isLocked ? 0.75 : 1
              }}
              className="glass-hover"
            >
              {/* Door Ribbon / Corner Tag */}
              <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                background: isOpened ? '#10b981' : isLocked ? '#475569' : isAutoComplete ? '#34d399' : '#fbbf24',
                color: isLocked ? '#fff' : '#0f172a',
                fontSize: '0.6rem',
                fontWeight: 900,
                padding: '2px 8px',
                borderBottomLeftRadius: '8px'
              }}>
                {isOpened ? 'OPEN' : isLocked ? 'LOCKED' : isAutoComplete ? 'READY ✓' : 'DOOR'}
              </div>

              <div style={{ fontSize: '1.6rem', marginBottom: '6px' }}>
                {isOpened ? item.icon : isLocked ? '🔒' : item.icon}
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: isOpened ? '#6ee7b7' : isLocked ? 'var(--text-muted)' : '#fef08a' }}>
                {item.day}
              </div>
              <div style={{ fontSize: '0.65rem', color: isOpened ? '#a7f3d0' : isLocked ? '#94a3b8' : '#fde68a', marginTop: '4px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {isOpened ? 'Claimed' : isLocked ? `Dec ${item.day}` : isAutoComplete ? 'Ready to Claim!' : 'View Challenge'}
              </div>
            </button>
          )
        })}
      </div>

      {/* Modal Popup for Selected Day & Challenge Proof */}
      {selectedDay && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(5, 8, 16, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="card glass animate-bounce-in" style={{
            maxWidth: '460px',
            width: '100%',
            padding: '30px',
            borderRadius: '24px',
            border: '3px solid #fbbf24',
            textAlign: 'center',
            position: 'relative',
            background: 'linear-gradient(135deg, rgba(26, 11, 11, 0.98), rgba(11, 41, 28, 0.98))',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '12px' }}>
              {progress[selectedDay.day] ? '🌟' : selectedDay.icon}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
              Personal Advent Challenge • Day {selectedDay.day}
            </div>
            <h3 style={{ color: '#fff', fontSize: '1.4rem', marginBottom: '12px', fontWeight: 900 }}>
              {selectedDay.title}
            </h3>
            <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '20px' }}>
              {selectedDay.desc}
            </p>

            {/* Verification Status Banner */}
            {checkChallengeCompletion(selectedDay) ? (
              <div style={{ padding: '10px 14px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', borderRadius: '10px', color: '#34d399', fontSize: '0.85rem', fontWeight: 800, marginBottom: '20px' }}>
                ✓ Automatically Verified from your Match Logs!
              </div>
            ) : (
              <div style={{ padding: '12px 14px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', color: '#fca5a5', fontSize: '0.83rem', fontWeight: 700, marginBottom: '20px' }}>
                ⏳ Not yet detected in your match logs. Play matches to auto-verify OR attach screenshot proof below:
              </div>
            )}

            {/* Proof Screenshot Upload */}
            {!progress[selectedDay.day]?.claimed && !progress[selectedDay.day] && !checkChallengeCompletion(selectedDay) && (
              <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', display: 'block', fontWeight: 700 }}>
                  Attach Screenshot Proof (Optional if match log verified):
                </label>
                {proofImage ? (
                  <div style={{ position: 'relative', marginBottom: '8px', textAlign: 'center' }}>
                    <img src={proofImage} alt="Proof" style={{ maxWidth: '100%', maxHeight: '140px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                    <button type="button" onClick={() => setProofImage('')} style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer' }}>×</button>
                  </div>
                ) : (
                  <input type="file" accept="image/*" onChange={handleImageUpload} style={{ fontSize: '0.8rem', width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid var(--border)' }} />
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              {!progress[selectedDay.day] ? (
                <button
                  className="btn btn-primary"
                  onClick={() => handleClaimReward(selectedDay.day, selectedDay)}
                  disabled={loadingDay === selectedDay.day}
                  style={{ padding: '12px 24px', fontWeight: 800, background: 'linear-gradient(135deg, #10b981, #047857)' }}
                >
                  {loadingDay === selectedDay.day ? 'Claiming...' : 'Claim Gift 🎄'}
                </button>
              ) : (
                <div style={{ padding: '10px 20px', background: 'rgba(16, 185, 129, 0.25)', border: '1px solid #10b981', borderRadius: '12px', color: '#34d399', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>✓</span> Reward Claimed & Stored!
                </div>
              )}
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedDay(null)}
                style={{ padding: '12px 20px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
