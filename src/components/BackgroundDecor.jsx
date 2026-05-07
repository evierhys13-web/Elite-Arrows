export default function BackgroundDecor() {
  const segments = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]

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
      background: '#020617'
    }}>
      {/* Deep Launch Sensation - Vibrant Purple/Blue Gradient */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `
          linear-gradient(135deg, #020617 0%, #1e1b4b 35%, #4338ca 70%, #1e1b4b 100%)
        `
      }} />

      {/* Pulsing Atmospheric Glows */}
      <div style={{
        position: 'absolute',
        top: '10%',
        left: '10%',
        width: '80%',
        height: '80%',
        background: `
          radial-gradient(circle at 20% 30%, rgba(124, 92, 252, 0.3) 0%, transparent 50%),
          radial-gradient(circle at 80% 70%, rgba(0, 212, 255, 0.25) 0%, transparent 50%)
        `,
        filter: 'blur(90px)'
      }} />

      {/* Electric Purple Streak */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        right: '-5%',
        width: '60%',
        height: '60%',
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)',
        filter: 'blur(100px)',
        transform: 'rotate(-15deg)'
      }} />

      {/* Modern Sci-Fi Grid Overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(124, 92, 252, 0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(124, 92, 252, 0.04) 1px, transparent 1px)
        `,
        backgroundSize: '100px 100px',
        maskImage: 'radial-gradient(ellipse at 50% 50%, black 20%, transparent 90%)'
      }} />

      {/* Subtle Ghost Dartboard Pattern */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%) rotate(10deg)',
        width: '1000px',
        height: '1000px',
        opacity: 0.04
      }}>
        <svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
          {segments.map((num, i) => {
            const startAngle = i * segmentAngle - 90 - segmentAngle / 2
            const endAngle = startAngle + segmentAngle
            return (
              <path
                key={`wedge-${i}`}
                d={wedgePath(startAngle, endAngle, 120, 230)}
                fill={i % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'transparent'}
              />
            )
          })}
          <circle cx="250" cy="250" r="245" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
        </svg>
      </div>
    </div>
  )
}
