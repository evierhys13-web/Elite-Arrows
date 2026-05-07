import { useEffect, useRef } from 'react'

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
    <div className="background-decor-root" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: 'none',
      zIndex: -1,
      overflow: 'hidden',
      background: '#040614'
    }}>
      {/* Ultra-Vibrant Launch Sensation Gradient */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `
          linear-gradient(135deg,
            #050816 0%,
            #1e1b4b 20%,
            #4338ca 45%,
            #7c3aed 70%,
            #1e40af 100%
          )
        `,
        opacity: 1
      }} />

      {/* Animated Pulsing Orbs - Brighter Sensation */}
      <div className="glow-orb orb-1" style={{
        position: 'absolute',
        top: '10%',
        left: '10%',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(124, 92, 252, 0.4) 0%, transparent 70%)',
        filter: 'blur(80px)',
        animation: 'pulse 12s infinite alternate'
      }} />

      <div className="glow-orb orb-2" style={{
        position: 'absolute',
        bottom: '5%',
        right: '5%',
        width: '700px',
        height: '700px',
        background: 'radial-gradient(circle, rgba(0, 212, 255, 0.3) 0%, transparent 70%)',
        filter: 'blur(100px)',
        animation: 'pulse 15s infinite alternate-reverse'
      }} />

      {/* Deep Violet Highlight */}
      <div style={{
        position: 'absolute',
        top: '40%',
        left: '30%',
        width: '800px',
        height: '800px',
        background: 'radial-gradient(circle, rgba(91, 33, 182, 0.25) 0%, transparent 65%)',
        filter: 'blur(120px)'
      }} />

      {/* Modern Tech Grid - High Contrast */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(255, 255, 255, 0.05) 1.5px, transparent 1.5px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1.5px, transparent 1.5px)
        `,
        backgroundSize: '80px 80px',
        maskImage: 'radial-gradient(ellipse at 50% 50%, black 30%, transparent 95%)'
      }} />

      {/* Dynamic Dartboard Sensation */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%) rotate(10deg)',
        width: '1300px',
        height: '1300px',
        opacity: 0.08
      }}>
        <svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
          {segments.map((num, i) => {
            const startAngle = i * segmentAngle - 90 - segmentAngle / 2
            const endAngle = startAngle + segmentAngle
            return (
              <path
                key={`wedge-${i}`}
                d={wedgePath(startAngle, endAngle, 160, 248)}
                fill={i % 2 === 0 ? 'rgba(255,255,255,0.2)' : 'transparent'}
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="0.5"
              />
            )
          })}
          <circle cx="250" cy="250" r="248" stroke="rgba(255,255,255,0.2)" strokeWidth="2" fill="none" />
          <circle cx="250" cy="250" r="160" stroke="rgba(255,255,255,0.2)" strokeWidth="2" fill="none" />
        </svg>
      </div>

      <style>{`
        @keyframes pulse {
          0% { transform: scale(1) translate(0, 0); opacity: 0.6; }
          50% { transform: scale(1.1) translate(20px, -20px); opacity: 0.8; }
          100% { transform: scale(0.9) translate(-10px, 10px); opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}
