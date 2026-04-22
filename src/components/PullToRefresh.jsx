import { useState, useRef, useCallback } from 'react'

export default function PullToRefresh({ onRefresh, children }) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startY = useRef(0)
  const currentY = useRef(0)
  const isPulling = useRef(false)

  const handleTouchStart = useCallback((e) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY
      isPulling.current = true
    }
  }, [])

  const handleTouchMove = useCallback((e) => {
    if (!isPulling.current) return
    
    currentY.current = e.touches[0].clientY
    const diff = currentY.current - startY.current
    
    if (diff > 0 && window.scrollY === 0) {
      setPullDistance(Math.min(diff, 80))
    }
  }, [])

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance > 50) {
      setIsRefreshing(true)
      await onRefresh()
      setIsRefreshing(false)
    }
    setPullDistance(0)
    isPulling.current = false
    startY.current = 0
    currentY.current = 0
  }, [pullDistance, onRefresh])

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: 'pan-y' }}
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