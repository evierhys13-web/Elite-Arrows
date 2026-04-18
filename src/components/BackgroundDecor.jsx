import { useState, useEffect } from 'react'

const DartThrowerSVG = () => (
  <svg viewBox="0 0 100 160" fill="currentColor">
    <ellipse cx="50" cy="22" rx="14" ry="18" />
    <path d="M50 40 L45 70 L35 110 L30 155 L42 155 L48 120 L52 120 L58 155 L70 155 L65 110 L55 70 Z" />
    <path d="M55 50 L75 45 L88 38 L85 35 L72 42 L58 47 Z" />
    <circle cx="90" cy="36" r="3" />
  </svg>
)

const AimingPlayerSVG = () => (
  <svg viewBox="0 0 100 160" fill="currentColor">
    <ellipse cx="50" cy="22" rx="14" ry="18" />
    <path d="M50 40 L45 70 L35 110 L30 155 L42 155 L48 120 L52 120 L58 155 L70 155 L65 110 L55 70 Z" />
    <path d="M55 50 L70 35 L82 28 L80 25 L68 32 L58 47 Z" />
    <circle cx="84" cy="26" r="2.5" />
    <path d="M45 55 L30 65 L28 62 L43 52 Z" />
  </svg>
)

const CelebratingPlayerSVG = () => (
  <svg viewBox="0 0 120 160" fill="currentColor">
    <ellipse cx="60" cy="22" rx="14" ry="18" />
    <path d="M60 40 L55 70 L45 110 L40 155 L52 155 L58 120 L62 120 L68 155 L80 155 L75 110 L65 70 Z" />
    <path d="M55 50 L25 20 L20 15 L23 12 L30 18 L58 47 Z" />
    <path d="M65 50 L95 20 L100 15 L97 12 L90 18 L62 47 Z" />
  </svg>
)

const ReadyStanceSVG = () => (
  <svg viewBox="0 0 100 160" fill="currentColor">
    <ellipse cx="50" cy="22" rx="14" ry="18" />
    <path d="M50 40 L42 70 L35 110 L30 155 L42 155 L48 120 L52 120 L58 155 L70 155 L65 110 L58 70 Z" />
    <path d="M55 50 L72 55 L85 50 L83 47 L70 52 L58 47 Z" />
    <circle cx="87" cy="48" r="2.5" />
    <path d="M42 55 L28 60 L26 57 L40 52 Z" />
  </svg>
)

const DartboardSVG = () => (
  <svg viewBox="0 0 100 100" fill="currentColor">
    <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="4" />
    <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="2" />
    <circle cx="50" cy="50" r="28" fill="none" stroke="currentColor" strokeWidth="2" />
    <circle cx="50" cy="50" r="18" fill="none" stroke="currentColor" strokeWidth="2" />
    <circle cx="50" cy="50" r="8" fill="currentColor" />
    <line x1="50" y1="2" x2="50" y2="98" stroke="currentColor" strokeWidth="1.5" />
    <line x1="2" y1="50" x2="98" y2="50" stroke="currentColor" strokeWidth="1.5" />
    <line x1="16" y1="16" x2="84" y2="84" stroke="currentColor" strokeWidth="1.5" />
    <line x1="84" y1="16" x2="16" y2="84" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="45" cy="35" r="2" fill="currentColor" />
    <circle cx="62" cy="42" r="2" fill="currentColor" />
    <circle cx="55" cy="60" r="2" fill="currentColor" />
  </svg>
)

const FlyingDartSVG = () => (
  <svg viewBox="0 0 120 40" fill="currentColor">
    <path d="M0 18 L15 15 L15 25 L0 22 Z" />
    <path d="M15 15 L18 8 L22 10 L19 17 Z" />
    <path d="M15 25 L18 32 L22 30 L19 23 Z" />
    <rect x="22" y="17" width="60" height="6" rx="1" />
    <path d="M82 14 L95 20 L82 26 Z" />
    <circle cx="97" cy="20" r="3" />
  </svg>
)

const svgThemes = [
  { component: DartThrowerSVG, name: 'Throwing' },
  { component: AimingPlayerSVG, name: 'Aiming' },
  { component: CelebratingPlayerSVG, name: 'Celebrating' },
  { component: ReadyStanceSVG, name: 'Ready' },
  { component: DartboardSVG, name: 'Dartboard' },
  { component: FlyingDartSVG, name: 'Flying Dart' },
]

export default function BackgroundDecor() {
  const [decorations, setDecorations] = useState([])

  useEffect(() => {
    const items = []
    for (let i = 0; i < 20; i++) {
      items.push({
        ...svgThemes[i % svgThemes.length],
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
      {decorations.map((item) => {
        const Component = item.component
        return (
          <div
            key={item.id}
            style={{
              position: 'absolute',
              ...item.position,
              width: `${item.size}rem`,
              height: `${item.size}rem`,
              color: item.color,
              opacity: item.opacity
            }}
          >
            <Component />
          </div>
        )
      })}
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
  
  const sizes = [2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 3.2, 3.8, 4.2, 4.8, 5.2]
  const opacities = [0.12, 0.15, 0.18, 0.2, 0.14, 0.16, 0.19]

  return {
    position: positions[index % positions.length],
    size: sizes[index % sizes.length],
    color: colors[index % colors.length],
    opacity: opacities[index % opacities.length]
  }
}
