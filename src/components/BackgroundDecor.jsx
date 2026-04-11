import { useState, useEffect } from 'react'

const dartThemes = [
  { icon: '🎯', name: 'Bullseye' },
  { icon: '🎯', name: 'Target' },
  { icon: '🏆', name: 'Trophy' },
  { icon: '🥇', name: 'Gold' },
  { icon: '⭐', name: 'Star' },
  { icon: '💎', name: 'Diamond' },
  { icon: '🔥', name: 'Fire' },
  { icon: '⚡', name: 'Lightning' },
  { icon: '🎯', name: 'Dart' },
  { icon: '🎯', name: 'Score' },
  { icon: '⚔️', name: 'Battle' },
  { icon: '🎯', name: 'Aim' },
  { icon: '🏅', name: 'Medal' },
  { icon: '🎖️', name: 'Award' },
  { icon: '👑', name: 'Crown' },
]

export default function BackgroundDecor() {
  const [decorations, setDecorations] = useState([])

  useEffect(() => {
    const items = []
    for (let i = 0; i < 20; i++) {
      items.push({
        ...dartThemes[i % dartThemes.length],
        id: i,
        ...getRandomStyle(i)
      })
    }
    setDecorations(items)
  }, [])

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: 'none',
      zIndex: -1,
      overflow: 'hidden'
    }}>
      {decorations.map((item) => (
        <div
          key={item.id}
          style={{
            position: 'absolute',
            ...item.position,
            fontSize: `${item.size}rem`,
            color: item.color,
            opacity: item.opacity,
            transform: `rotate(${item.rotation}deg)`,
            animation: `float ${item.duration}s ease-in-out infinite`,
            animationDelay: `${item.delay}s`,
            filter: 'blur(0.5px)',
            textShadow: `0 0 20px ${item.color}`,
            transition: 'all 0.3s ease'
          }}
        >
          {item.icon}
        </div>
      ))}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(var(--rotation)); }
          50% { transform: translateY(-20px) rotate(calc(var(--rotation) + 10deg)); }
        }
      `}</style>
    </div>
  )
}

function getRandomStyle(index) {
  const colors = [
    '#00d4ff',
    '#4da8da',
    '#22c55e',
    '#f59e0b',
    '#ef4444',
    '#a855f7',
    '#ec4899',
    '#06b6d4',
    '#84cc16',
    '#f97316',
  ]
  
  const positions = [
    { top: '3%', left: '5%' },
    { top: '8%', left: '20%' },
    { top: '5%', right: '10%' },
    { top: '15%', right: '25%' },
    { top: '20%', left: '8%' },
    { top: '25%', right: '5%' },
    { top: '30%', left: '15%' },
    { top: '35%', right: '18%' },
    { top: '40%', left: '3%' },
    { top: '45%', right: '12%' },
    { top: '50%', left: '25%' },
    { top: '55%', right: '8%' },
    { top: '60%', left: '10%' },
    { top: '65%', right: '22%' },
    { top: '70%', left: '5%' },
    { top: '75%', right: '15%' },
    { top: '80%', left: '18%' },
    { top: '85%', right: '10%' },
    { top: '90%', left: '12%' },
    { top: '88%', right: '25%' },
  ]
  
  const rotations = [-45, -30, -20, -10, 0, 10, 20, 30, 45, 60, -60, 15, -15, 25, -25, 35, -35, 40, -40, 50]
  const sizes = [2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 3.2, 3.8, 4.2, 4.8, 5.2]
  const opacities = [0.12, 0.15, 0.18, 0.2, 0.14, 0.16, 0.19]
  const durations = [8, 10, 12, 15, 7, 9, 11, 14, 6, 13]
  const delays = [0, 1, 2, 3, 0.5, 1.5, 2.5, 3.5, 4, 4.5]

  return {
    position: positions[index % positions.length],
    rotation: rotations[index % rotations.length],
    size: sizes[index % sizes.length],
    color: colors[index % colors.length],
    opacity: opacities[index % opacities.length],
    duration: durations[index % durations.length],
    delay: delays[index % delays.length]
  }
}