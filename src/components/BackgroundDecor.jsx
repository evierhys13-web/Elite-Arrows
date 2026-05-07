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
      background: '#0f172a'
    }}>
      {/* High-Contrast Vibrant Launch Gradient */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `
          linear-gradient(135deg,
            #0f172a 0%,
            #312e81 25%,
            #5b21b6 50%,
            #7c3aed 75%,
            #4338ca 100%
          )
        `
      }} />

      {/* Radiant Atmospheric Glows */}
      <div style={{
        position: 'absolute',
        top: '5%',
        left: '5%',
        width: '90%',
        height: '90%',
        background: `
          radial-gradient(circle at 15% 25%, rgba(139, 92, 246, 0.45) 0%, transparent 45%),
          radial-gradient(circle at 85% 75%, rgba(0, 212, 255, 0.35) 0%, transparent 45%),
          radial-gradient(circle at 50% 50%, rgba(124, 92, 252, 0.2) 0%, transparent 60%)
        `,
        filter: 'blur(70px)'
      }} />

      {/* Modern Tech Grid */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.06) 1px, transparent 1px)
        `,
        backgroundSize: '100px 100px',
        maskImage: 'radial-gradient(ellipse at 50% 50%, black 10%, transparent 90%)'
      }} />

      {/* Subtle Dynamic Darts Pattern */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%) rotate(-10deg)',
        width: '1200px',
        height: '1200px',
        opacity: 0.06
      }}>
        <svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
          {segments.map((num, i) => {
            const startAngle = i * segmentAngle - 90 - segmentAngle / 2
            const endAngle = startAngle + segmentAngle
            return (
              <path
                key={`wedge-${i}`}
                d={wedgePath(startAngle, endAngle, 150, 250)}
                fill={i % 2 === 0 ? 'rgba(255,255,255,0.15)' : 'transparent'}
              />
            )
          })}
          <circle cx="250" cy="250" r="248" stroke="rgba(255,255,255,0.1)" strokeWidth="1" fill="none" />
        </svg>
      </div>
    </div>
  )
}
