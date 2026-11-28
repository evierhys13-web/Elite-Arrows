import { useState } from 'react'
import { db, doc, setDoc } from '../firebase'
import { useToast } from '../context/ToastContext'
import Confetti from './Confetti'

const ADVENT_DAYS = [
  { day: 1, title: '🎁 Day 1: Festive Login', desc: 'Log in to Season 8 and claim your opening present! (Auto-claimable)' },
  { day: 2, title: '🎯 Day 2: Double Top Stocking', desc: 'Hit at least 1 double finish in any league or friendly match.' },
  { day: 3, title: '💯 Day 3: Treble Bells', desc: 'Register a score of 100+ or hit a treble in your match log.' },
  { day: 4, title: '🐟 Day 4: High Checkout Bauble', desc: 'Secure a checkout of 80 or higher to hang on the tree.' },
  { day: 5, title: '⭐ Day 5: Bullseye Star', desc: 'Hit the bullseye or land a match-winning dart.' },
  { day: 6, title: '❄️ Day 6: Snowflake 180', desc: 'Hit a maximum 180 score during Season 6/8 matches.' },
  { day: 7, title: '📈 Day 7: Yuletide Average', desc: 'Maintain a 3-dart average of 50+ in any completed match.' },
  { day: 8, title: '🍬 Day 8: Candy Cane Checkout', desc: 'Finish a leg with a checkout starting on an odd number.' },
  { day: 9, title: '🏆 Day 9: Christmas Cracker Win', desc: 'Win any league or cup match against a division opponent.' },
  { day: 10, title: '🚀 Day 10: North Pole Nine-Dart', desc: 'Submit a match with an exceptional 9-dart running average.' },
  { day: 11, title: '⛄ Day 11: Frosty Finish', desc: 'Secure a match victory with a checkout above 50.' },
  { day: 12, title: '👑 Day 12: Season 8 Christmas Champion', desc: 'Grand Finale! Complete all challenges and claim your Season 8 Christmas Crown badge.' }
]

export default function AdventCalendar({ user }) {
  const { showToast } = useToast()
  const [selectedDay, setSelectedDay] = useState(null)
  const [triggerConfetti, setTriggerConfetti] = useState(false)
  const [loadingDay, setLoadingDay] = useState(null)

  const progress = user?.adventProgress || {}

  const handleOpenDoor = async (item) => {
    setSelectedDay(item)
  }

  const handleClaimReward = async (dayNum) => {
    if (!user?.id || user?.isGuest) {
      showToast('Please sign in to claim advent calendar rewards!', 'error')
      return
    }

    setLoadingDay(dayNum)
    try {
      const updatedProgress = { ...progress, [dayNum]: true }
      await setDoc(doc(db, 'users', String(user.id)), { adventProgress: updatedProgress }, { merge: true })

      // Update local user object if possible or rely on state update
      user.adventProgress = updatedProgress

      setTriggerConfetti(true)
      showToast(`🎁 Day ${dayNum} reward claimed successfully! Happy Holidays!`, 'success')
      setTimeout(() => setTriggerConfetti(false), 3000)
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
      padding: '24px',
      borderRadius: '20px',
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(16, 185, 129, 0.1), rgba(15, 23, 42, 0.95))',
      border: '2px solid rgba(16, 185, 129, 0.3)',
      boxShadow: '0 10px 40px rgba(0,0,0,0.4), inset 0 0 30px rgba(16, 185, 129, 0.1)'
    }}>
      <Confetti trigger={triggerConfetti} />

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <div style={{ fontSize: '2rem', marginBottom: '6px' }}>🎄 12 Days of Christmas Darts 🎁</div>
        <h3 style={{ color: 'var(--accent-cyan)', fontSize: '1.3rem', margin: '0 0 8px', fontWeight: 900 }}>Season 8 Advent Calendar</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
          Open a door each day during Elite Arrows Season 8 to complete festive darting challenges and claim your holiday rewards!
        </p>
      </div>

      {/* Grid of 12 Doors */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
        gap: '14px'
      }}>
        {ADVENT_DAYS.map((item) => {
          const isOpened = Boolean(progress[item.day])
          return (
            <button
              key={item.day}
              onClick={() => handleOpenDoor(item)}
              style={{
                background: isOpened ? 'rgba(16, 185, 129, 0.2)' : 'linear-gradient(145deg, #1e293b, #0f172a)',
                border: `2px solid ${isOpened ? '#10b981' : 'rgba(251, 191, 36, 0.4)'}`,
                borderRadius: '14px',
                padding: '16px 10px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: isOpened ? '0 0 15px rgba(16, 185, 129, 0.3)' : '0 4px 15px rgba(0,0,0,0.3)',
                position: 'relative',
                overflow: 'hidden'
              }}
              className="glass-hover"
            >
              <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>
                {isOpened ? '✨' : '🚪'}
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 900, color: isOpened ? '#34d399' : '#fbbf24' }}>
                Day {item.day}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 700, textTransform: 'uppercase' }}>
                {isOpened ? 'Claimed' : 'Tap to Open'}
              </div>
            </button>
          )
        })}
      </div>

      {/* Modal Popup for Selected Day */}
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
            maxWidth: '440px',
            width: '100%',
            padding: '30px',
            borderRadius: '20px',
            border: '2px solid var(--accent-cyan)',
            textAlign: 'center',
            position: 'relative'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>
              {progress[selectedDay.day] ? '🌟' : '🎁'}
            </div>
            <h3 style={{ color: 'var(--accent-cyan)', fontSize: '1.4rem', marginBottom: '12px', fontWeight: 900 }}>
              {selectedDay.title}
            </h3>
            <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '24px' }}>
              {selectedDay.desc}
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              {!progress[selectedDay.day] ? (
                <button
                  className="btn btn-primary"
                  onClick={() => handleClaimReward(selectedDay.day)}
                  disabled={loadingDay === selectedDay.day}
                  style={{ padding: '12px 24px', fontWeight: 800 }}
                >
                  {loadingDay === selectedDay.day ? 'Claiming...' : 'Claim Gift 🎄'}
                </button>
              ) : (
                <div style={{ padding: '10px 20px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', borderRadius: '10px', color: '#34d399', fontWeight: 800 }}>
                  ✓ Reward Claimed!
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
