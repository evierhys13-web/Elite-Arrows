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
      background: `
        linear-gradient(135deg, #0A0F2A 0%, #1A2E7A 50%, #0A0F2A 100%)
      `
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `
          radial-gradient(ellipse at 30% 40%, #4A2E8A 0%, transparent 60%),
          radial-gradient(ellipse at 70% 60%, #1A2E7A 0%, transparent 50%),
          radial-gradient(circle at 0% 0%, rgba(138, 43, 226, 0.15) 0%, transparent 40%),
          radial-gradient(circle at 100% 100%, rgba(26, 46, 122, 0.2) 0%, transparent 40%),
          radial-gradient(circle at 0% 100%, rgba(10, 15, 42, 0.3) 0%, transparent 50%),
          radial-gradient(circle at 100% 0%, rgba(74, 46, 138, 0.12) 0%, transparent 45%),
          radial-gradient(ellipse at 50% 50%, rgba(255, 255, 255, 0.04) 0%, transparent 70%),
          radial-gradient(ellipse at 50% 50%, rgba(26, 46, 122, 0.15) 0%, transparent 80%)
        `
      }} />

      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '550px',
        height: '550px',
        opacity: 0.07
      }}>
        <svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Outer edge / surround */}
          <circle cx="250" cy="250" r="245" fill="rgba(40,40,40,0.8)" />

          {/* 20 segment wedges - outer single area */}
          {segments.map((num, i) => {
            const startAngle = i * segmentAngle - 90 - segmentAngle / 2
            const endAngle = startAngle + segmentAngle
            return (
              <path
                key={`wedge-${i}`}
                d={wedgePath(startAngle, endAngle, 160, 190)}
                fill={i % 2 === 0 ? 'rgba(20,20,20,0.9)' : 'rgba(200,200,200,0.9)'}
                stroke="rgba(180,180,180,0.5)"
                strokeWidth="0.5"
              />
            )
          })}

          {/* Double ring */}
          {segments.map((num, i) => {
            const startAngle = i * segmentAngle - 90 - segmentAngle / 2
            const endAngle = startAngle + segmentAngle
            return (
              <path
                key={`double-${i}`}
                d={wedgePath(startAngle, endAngle, 190, 200)}
                fill={i % 2 === 0 ? 'rgba(200,30,30,0.8)' : 'rgba(30,180,30,0.8)'}
                stroke="rgba(180,180,180,0.5)"
                strokeWidth="0.5"
              />
            )
          })}

          {/* Triple ring */}
          {segments.map((num, i) => {
            const startAngle = i * segmentAngle - 90 - segmentAngle / 2
            const endAngle = startAngle + segmentAngle
            return (
              <path
                key={`triple-${i}`}
                d={wedgePath(startAngle, endAngle, 100, 110)}
                fill={i % 2 === 0 ? 'rgba(200,30,30,0.8)' : 'rgba(30,180,30,0.8)'}
                stroke="rgba(180,180,180,0.5)"
                strokeWidth="0.5"
              />
            )
          })}

          {/* Inner single area (outer) */}
          {segments.map((num, i) => {
            const startAngle = i * segmentAngle - 90 - segmentAngle / 2
            const endAngle = startAngle + segmentAngle
            return (
              <path
                key={`inner-single-${i}`}
                d={wedgePath(startAngle, endAngle, 110, 160)}
                fill={i % 2 === 0 ? 'rgba(20,20,20,0.9)' : 'rgba(200,200,200,0.9)'}
                stroke="rgba(180,180,180,0.5)"
                strokeWidth="0.5"
              />
            )
          })}

          {/* Outer bull (green) */}
          <circle cx="250" cy="250" r="18" fill="rgba(30,180,30,0.8)" stroke="rgba(180,180,180,0.5)" strokeWidth="0.5" />

          {/* Inner bull/bullseye (red) */}
          <circle cx="250" cy="250" r="8" fill="rgba(200,30,30,0.9)" stroke="rgba(180,180,180,0.5)" strokeWidth="0.5" />

          {/* Wire dividers */}
          {segments.map((_, i) => {
            const angle = i * segmentAngle - 90
            const rad = angle * Math.PI / 180
            const x1 = 250 + 50 * Math.cos(rad)
            const y1 = 250 + 50 * Math.sin(rad)
            const x2 = 250 + 200 * Math.cos(rad)
            const y2 = 250 + 200 * Math.sin(rad)
            return (
              <line
                key={`wire-${i}`}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="rgba(180,180,180,0.6)"
                strokeWidth="0.8"
              />
            )
          })}

          {/* Concentric ring wires */}
          <circle cx="250" cy="250" r="200" stroke="rgba(180,180,180,0.6)" strokeWidth="0.8" fill="none" />
          <circle cx="250" cy="250" r="190" stroke="rgba(180,180,180,0.6)" strokeWidth="0.8" fill="none" />
          <circle cx="250" cy="250" r="160" stroke="rgba(180,180,180,0.6)" strokeWidth="0.8" fill="none" />
          <circle cx="250" cy="250" r="110" stroke="rgba(180,180,180,0.6)" strokeWidth="0.8" fill="none" />
          <circle cx="250" cy="250" r="100" stroke="rgba(180,180,180,0.6)" strokeWidth="0.8" fill="none" />
          <circle cx="250" cy="250" r="18" stroke="rgba(180,180,180,0.6)" strokeWidth="0.8" fill="none" />
        </svg>
      </div>

      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '40%',
        height: '40%',
        background: 'radial-gradient(circle at 20% 20%, rgba(138, 43, 226, 0.08) 0%, transparent 70%)',
        filter: 'blur(60px)'
      }} />

      <div style={{
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: '50%',
        height: '50%',
        background: 'radial-gradient(circle at 80% 80%, rgba(26, 46, 122, 0.12) 0%, transparent 70%)',
        filter: 'blur(80px)'
      }} />

      <div style={{
        position: 'absolute',
        top: '10%',
        right: '10%',
        width: '30%',
        height: '30%',
        background: 'radial-gradient(circle, rgba(74, 46, 138, 0.06) 0%, transparent 60%)',
        filter: 'blur(50px)'
      }} />

      <div style={{
        position: 'absolute',
        bottom: '15%',
        left: '5%',
        width: '35%',
        height: '35%',
        background: 'radial-gradient(circle, rgba(10, 15, 42, 0.1) 0%, transparent 60%)',
        filter: 'blur(70px)'
      }} />

      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at 50% 50%, rgba(255, 255, 255, 0.03) 0%, transparent 50%)'
      }} />
    </div>
  )
}
