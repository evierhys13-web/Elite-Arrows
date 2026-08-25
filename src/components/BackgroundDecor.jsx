export default function BackgroundDecor({ division }) {
  const segments = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]

  const getDivisionColors = (div) => {
    switch (div) {
      case 'Elite':
        return {
          primary: '#451a03', // Deep Brown/Amber
          secondary: '#78350f', // Amber
          accent1: '#fbbf24', // Gold
          accent2: '#f59e0b', // Amber-Gold
          glow: 'rgba(251, 191, 36, 0.4)'
        }
      case 'Emerald':
        return {
          primary: '#064e3b', // Deep Green
          secondary: '#065f46', // Emerald
          accent1: '#10b981', // Emerald Green
          accent2: '#34d399', // Light Emerald
          glow: 'rgba(16, 185, 129, 0.4)'
        }
      case 'Diamond':
        return {
          primary: '#0c4a6e', // Deep Blue
          secondary: '#075985', // Sky Blue
          accent1: '#0ea5e9', // Light Blue
          accent2: '#38bdf8', // Cyan
          glow: 'rgba(56, 189, 248, 0.4)'
        }
      case 'Platinum':
        return {
          primary: '#1e1b4b', // Deep Indigo
          secondary: '#312e81', // Indigo
          accent1: '#818cf8', // Platinum/Purple
          accent2: '#a5b4fc', // Light Platinum
          glow: 'rgba(129, 140, 248, 0.4)'
        }
      default:
        return {
          primary: '#1e1b4b',
          secondary: '#312e81',
          accent1: '#818cf8',
          accent2: '#38bdf8',
          glow: 'rgba(129, 140, 248, 0.25)'
        }
    }
  }

  const colors = getDivisionColors(division)

  const wedgePath = (startAngle, endAngle, innerR, outerR) => {
    const cx = 250, cy = 250
    const rad = deg => deg * Math.PI / 180
    const x1 = cx + outerR * Math.cos(rad(startAngle))
    const y1 = cy + outerR * Math.sin(rad(startAngle))
    const x2 = cx + outerR * Math.cos(rad(endAngle))
    const y2 = cy + outerR * Math.sin(rad(endAngle))
    const x3 = cx + innerR * Math.cos(rad(endAngle))
    const y3 = cy + innerR * Math.sin(rad(endAngle))
    const x4 = cx + innerR * Math.cos(rad(startAngle))
    const y4 = cy + innerR * Math.sin(rad(startAngle))
    const largeArc = (endAngle - startAngle) > 180 ? 1 : 0
    return `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z`
  }

  const segmentAngle = 360 / 20

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: 'none',
      zIndex: -1,
      overflow: 'hidden',
      background: colors.primary,
      transition: 'background 1s ease'
    }}>
      {/* Dynamic Gradient based on Division */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `
          linear-gradient(135deg,
            ${colors.primary} 0%,
            ${colors.secondary} 30%,
            ${colors.accent1} 70%,
            ${colors.accent2} 100%
          )
        `,
        opacity: 0.85,
        transition: 'all 1s ease'
      }} />

      {/* Atmospheric Glows */}
      <div style={{
        position: 'absolute',
        top: '5%',
        left: '5%',
        width: '90%',
        height: '90%',
        background: `
          radial-gradient(circle at 20% 30%, ${colors.accent2}44 0%, transparent 50%),
          radial-gradient(circle at 80% 70%, ${colors.accent1}44 0%, transparent 50%),
          radial-gradient(circle at 50% 50%, ${colors.glow} 0%, transparent 60%)
        `,
        filter: 'blur(80px)',
        transition: 'all 1s ease'
      }} />

      {/* Grid Overlay - Brighter/Subtle */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px)
        `,
        backgroundSize: '80px 80px',
        maskImage: 'radial-gradient(ellipse at 50% 50%, black 20%, transparent 95%)'
      }} />

      {/* Dynamic Ghost Dartboard Pattern */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%) rotate(10deg)',
        width: '1200px',
        height: '1200px',
        opacity: 0.08
      }}>
        <svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
          {segments.map((num, i) => {
            const startAngle = i * segmentAngle - 90 - segmentAngle / 2
            const endAngle = startAngle + segmentAngle
            return (
              <path
                key={`wedge-${i}`}
                d={wedgePath(startAngle, endAngle, 140, 245)}
                fill={i % 2 === 0 ? 'rgba(255,255,255,0.2)' : 'transparent'}
                stroke="white"
                strokeWidth="0.5"
              />
            )
          })}
          <circle cx="250" cy="250" r="248" stroke="white" strokeWidth="2" fill="none" />
          <circle cx="250" cy="250" r="140" stroke="white" strokeWidth="1" fill="none" />
        </svg>
      </div>
    </div>
  )
}
