import { useState, useRef, useCallback } from 'react'

const DEAD_ZONE = 12
const COMMIT_DISTANCE = 72
const MAX_DISTANCE = 96

export default function PullToRefresh({ onRefresh, children }) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startY = useRef(0)
  const armed = useRef(false)
  const refreshingRef = useRef(false)

  const handleTouchStart = useCallback((e) => {
    const touch = e.touches && e.touches[0]
    if (!touch || refreshingRef.current || window.scrollY > 0) return
    startY.current = touch.clientY
    armed.current = false
  }, [])

  const handleTouchMove = useCallback((e) => {
    const touch = e.touches && e.touches[0]
    if (!touch || refreshingRef.current || window.scrollY > 0) return
    const diff = touch.clientY - startY.current
    if (diff < DEAD_ZONE) return
    if (!armed.current) armed.current = true
    setPullDistance(Math.min(diff, MAX_DISTANCE))
  }, [])

  const handleTouchEnd = useCallback(async () => {
    if (refreshingRef.current) return
    const willRefresh = armed.current && pullDistance >= COMMIT_DISTANCE
    armed.current = false
    startY.current = 0
    setPullDistance(0)
    if (!willRefresh) return
    refreshingRef.current = true
    setIsRefreshing(true)
    try {
      await onRefresh()
    } finally {
      refreshingRef.current = false
      setIsRefreshing(false)
    }
  }, [pullDistance, onRefresh])

  const handleTouchCancel = useCallback(() => {
    armed.current = false
    startY.current = 0
    setPullDistance(0)
  }, [])

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      style={{ touchAction: 'pan-x pan-y' }}
    >
      <div
        style={{
          transform: isRefreshing ? 'translateY(0)' : `translateY(${pullDistance}px)`,
          transition: isRefreshing ? 'transform 0.3s ease' : 'none',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            height: pullDistance > 20 ? `${pullDistance}px` : '0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--accent-primary)',
            color: 'white',
            transition: 'height 0.1s ease'
          }}
        >
          {isRefreshing ? (
            <span style={{ animation: 'spin 1s linear infinite' }}>Refreshing...</span>
          ) : pullDistance > 20 ? (
            <span>↓ Pull to refresh</span>
          ) : null}
        </div>
        {children}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}