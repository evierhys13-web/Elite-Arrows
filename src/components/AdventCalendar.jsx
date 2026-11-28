import { useState } from 'react'
import { db, doc, setDoc } from '../firebase'
import { useToast } from '../context/ToastContext'
import Confetti from './Confetti'

const ADVENT_DAYS = [
  { day: 1, title: '🎁 Day 1: Festive Login', desc: 'Log in on December 1st and claim your opening present!', icon: '🎁' },
  { day: 2, title: '🎯 Day 2: Double Top Stocking', desc: 'Hit at least 1 double finish in any league or friendly match.', icon: '🎯' },
  { day: 3, title: '💯 Day 3: Treble Bells', desc: 'Register a score of 100+ or hit a treble in your match log.', icon: '🔔' },
  { day: 4, title: '🐟 Day 4: High Checkout Bauble', desc: 'Secure a checkout of 80 or higher to hang on the tree.', icon: '🎄' },
  { day: 5, title: '⭐ Day 5: Bullseye Star', desc: 'Hit the bullseye or land a match-winning dart.', icon: '⭐' },
  { day: 6, title: '❄️ Day 6: Snowflake 180', desc: 'Hit a maximum 180 score during Season 6/8 matches.', icon: '❄️' },
  { day: 7, title: '📈 Day 7: Yuletide Average', desc: 'Maintain a 3-dart average of 50+ in any completed match.', icon: '📊' },
  { day: 8, title: '🍬 Day 8: Candy Cane Checkout', desc: 'Finish a leg with a checkout starting on an odd number.', icon: '🍬' },
  { day: 9, title: '🏆 Day 9: Christmas Cracker Win', desc: 'Win any league or cup match against a division opponent.', icon: '🏆' },
  { day: 10, title: '🚀 Day 10: North Pole Nine-Dart', desc: 'Submit a match with an exceptional 9-dart running average.', icon: '🚀' },
  { day: 11, title: '⛄ Day 11: Frosty Finish', desc: 'Secure a match victory with a checkout above 50.', icon: '⛄' },
  { day: 12, title: '👑 Day 12: Season 8 Christmas Champion', desc: 'Grand Finale! Complete all challenges and claim your Season 8 Christmas Crown badge.', icon: '👑' }
]

export default function AdventCalendar({ user }) {
  const { showToast } = useToast()
  const [selectedDay, setSelectedDay] = useState(null)
  const [triggerConfetti, setTriggerConfetti] = useState(false)
  const [loadingDay, setLoadingDay] = useState(null)

  const progress = user?.adventProgress || {}

  const now = new Date()
  const dec1 = new Date('2026-12-01T00:00:00')
  const isBeforeDec1 = now < dec1

  const handleOpenDoor = (item) => {
    const unlockDate = new Date(`2026-12-${String(item.day).padStart(2, '0')}T00:00:00`)
    if (now < unlockDate) {
      showToast(`🔒 Day ${item.day} unlocks on December ${item.day}, 2026!`, 'warning')
      return
    }
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
        <h3 style={{ color: '#fbbf24', fontSize: '1.4rem', margin: '0 0 8px', fontWeight: 900, textShadow: '0 0 10px rgba(251,191,36,0.4)' }}>Season 8 Advent Calendar</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
          Open your daily advent calendar door starting December 1st to unlock festive darting challenges and claim your holiday rewards!
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
          🔒 The 12 Days of Christmas Advent Calendar unlocks on 1st December! Doors open day-by-day starting December 1st.
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
        {ADVENT_DAYS.map((item) => {
          const isOpened = Boolean(progress[item.day])
          const unlockDate = new Date(`2026-12-${String(item.day).padStart(2, '0')}T00:00:00`)
          const isLocked = now < unlockDate

          return (
            <button
              key={item.day}
              onClick={() => handleOpenDoor(item)}
              style={{
                background: isOpened
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.35), rgba(5, 150, 105, 0.45))'
                  : isLocked
                  ? 'linear-gradient(145deg, #0f172a, #090d16)'
                  : 'linear-gradient(145deg, #b91c1c, #991b1b)',
                border: `3px solid ${isOpened ? '#34d399' : isLocked ? 'rgba(255,255,255,0.15)' : '#fbbf24'}`,
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
                background: isOpened ? '#10b981' : isLocked ? '#475569' : '#fbbf24',
                color: isLocked ? '#fff' : '#0f172a',
                fontSize: '0.6rem',
                fontWeight: 900,
                padding: '2px 8px',
                borderBottomLeftRadius: '8px'
              }}>
                {isOpened ? 'OPEN' : isLocked ? 'LOCKED' : 'DOOR'}
              </div>

              <div style={{ fontSize: '1.6rem', marginBottom: '6px' }}>
                {isOpened ? item.icon : isLocked ? '🔒' : '🚪'}
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: isOpened ? '#6ee7b7' : isLocked ? 'var(--text-muted)' : '#fef08a' }}>
                {item.day}
              </div>
              <div style={{ fontSize: '0.65rem', color: isOpened ? '#a7f3d0' : isLocked ? '#94a3b8' : '#fde68a', marginTop: '4px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {isOpened ? 'Claimed' : isLocked ? `Dec ${item.day}` : 'Open Door'}
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
            borderRadius: '24px',
            border: '3px solid #fbbf24',
            textAlign: 'center',
            position: 'relative',
            background: 'linear-gradient(135deg, rgba(26, 11, 11, 0.98), rgba(11, 41, 28, 0.98))'
          }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '12px' }}>
              {progress[selectedDay.day] ? '🌟' : selectedDay.icon}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
              Advent Calendar • Day {selectedDay.day}
            </div>
            <h3 style={{ color: '#fff', fontSize: '1.4rem', marginBottom: '12px', fontWeight: 900 }}>
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
