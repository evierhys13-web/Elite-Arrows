import { useEffect, useState } from 'react'

export default function Confetti({ trigger, duration = 3000, colors = ['#818cf8', '#38bdf8', '#fbbf24', '#10b981', '#ef4444'] }) {
  const [pieces, setPieces] = useState([])

  useEffect(() => {
    if (trigger) {
      const newPieces = Array.from({ length: 100 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: -10,
        size: Math.random() * 10 + 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        delay: Math.random() * 0.5,
        duration: Math.random() * 2 + 1.5,
        drift: (Math.random() - 0.5) * 40
      }))
      setPieces(newPieces)

      const timer = setTimeout(() => {
        setPieces([])
      }, duration + 1000)

      return () => clearTimeout(timer)
    }
  }, [trigger, duration, colors])

  if (pieces.length === 0) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: 9999,
      overflow: 'hidden'
    }}>
      {pieces.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size * 0.6}px`,
            background: p.color,
            opacity: 0.8,
            transform: `rotate(${p.rotation}deg)`,
            animation: `confetti-fall-${p.id} ${p.duration}s linear ${p.delay}s forwards`
          }}
        />
      ))}
      <style>{pieces.map(p => `
        @keyframes confetti-fall-${p.id} {
          0% { transform: translateY(0) rotate(${p.rotation}deg); opacity: 0.8; }
          100% { transform: translateY(110vh) translateX(${p.drift}px) rotate(${p.rotation + 720}deg); opacity: 0; }
        }
      `).join('\n')}</style>
    </div>
  )
}
