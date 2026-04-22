import { useState, useRef } from 'react'

export function SwipeItem({ children, onSwipeLeft, onSwipeRight, leftAction, rightAction }) {
  const [translateX, setTranslateX] = useState(0)
  const startX = useRef(0)
  const currentX = useRef(0)
  const isSwiping = useRef(false)

  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX
    isSwiping.current = true
  }

  const handleTouchMove = (e) => {
    if (!isSwiping.current) return
    currentX.current = e.touches[0].clientX
    const diff = currentX.current - startX.current
    setTranslateX(diff)
  }

  const handleTouchEnd = () => {
    isSwiping.current = false
    if (translateX < -80 && onSwipeLeft) {
      onSwipeLeft()
    } else if (translateX > 80 && onSwipeRight) {
      onSwipeRight()
    }
    setTranslateX(0)
    startX.current = 0
    currentX.current = 0
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
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