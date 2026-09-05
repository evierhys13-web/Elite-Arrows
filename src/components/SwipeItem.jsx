import { useState, useRef } from 'react'

const SWIPE_DEAD_ZONE = 10
const SWIPE_COMMIT_DISTANCE = 100

export function SwipeItem({ children, onSwipeLeft, onSwipeRight, leftAction, rightAction }) {
  const [translateX, setTranslateX] = useState(0)
  const startX = useRef(0)
  const startY = useRef(0)
  const isSwiping = useRef(false)

  const handleTouchStart = (e) => {
    if (!e.touches || !e.touches[0]) return
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    isSwiping.current = false
    setTranslateX(0)
  }

  const handleTouchMove = (e) => {
    if (!e.touches || !e.touches[0]) return
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current
    if (!isSwiping.current) {
      if (Math.abs(dx) < SWIPE_DEAD_ZONE || Math.abs(dx) < Math.abs(dy)) return
      isSwiping.current = true
    }
    setTranslateX(dx)
  }

  const handleTouchEnd = () => {
    const committed = isSwiping.current
    const distance = translateX
    isSwiping.current = false
    startX.current = 0
    startY.current = 0
    setTranslateX(0)
    if (committed && distance <= -SWIPE_COMMIT_DISTANCE && onSwipeLeft) {
      onSwipeLeft()
    } else if (committed && distance >= SWIPE_COMMIT_DISTANCE && onSwipeRight) {
      onSwipeRight()
    }
  }

  const handleTouchCancel = () => {
    isSwiping.current = false
    startX.current = 0
    startY.current = 0
    setTranslateX(0)
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      style={{
        position: 'relative',
        overflow: 'hidden',
        touchAction: 'pan-y'
      }}
    >
      {leftAction && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${Math.max(0, translateX)}px`,
            background: 'var(--success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            opacity: translateX > 0 ? 1 : 0,
            transition: 'opacity 0.2s'
          }}
        >
          {leftAction}
        </div>
      )}
      {rightAction && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: `${Math.max(0, -translateX)}px`,
            background: 'var(--error)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            opacity: translateX < 0 ? 1 : 0,
            transition: 'opacity 0.2s'
          }}
        >
          {rightAction}
        </div>
      )}
      <div
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isSwiping.current ? 'none' : 'transform 0.2s ease',
          background: 'var(--bg-card)'
        }}
      >
        {children}
      </div>
    </div>
  )
}

export default SwipeItem;