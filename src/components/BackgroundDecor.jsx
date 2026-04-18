export default function BackgroundDecor() {
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
        width: '500px',
        height: '500px',
        opacity: 0.06
      }}>
        <svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="250" cy="250" r="240" stroke="rgba(255,255,255,0.5)" strokeWidth="4" />
          <circle cx="250" cy="250" r="200" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
          <circle cx="250" cy="250" r="160" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
          <circle cx="250" cy="250" r="120" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
          <circle cx="250" cy="250" r="80" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
          <circle cx="250" cy="250" r="40" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
          <circle cx="250" cy="250" r="15" fill="rgba(255,255,255,0.6)" />
          <line x1="250" y1="10" x2="250" y2="490" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
          <line x1="10" y1="250" x2="490" y2="250" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
          <line x1="80" y1="80" x2="420" y2="420" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
          <line x1="420" y1="80" x2="80" y2="420" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
          <line x1="140" y1="30" x2="360" y2="470" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
          <line x1="360" y1="30" x2="140" y2="470" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
          <line x1="30" y1="140" x2="470" y2="360" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
          <line x1="470" y1="140" x2="30" y2="360" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
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
