export default function BackgroundDecor({ division }) {
  const getDivisionColors = (div) => {
    switch (div) {
      case 'Elite':
        return {
          nebula1: 'rgba(251, 191, 36, 0.35)',
          nebula2: 'rgba(245, 158, 11, 0.4)',
          stars: 'rgba(251, 191, 36, 0.9)'
        }
      case 'Emerald':
        return {
          nebula1: 'rgba(16, 185, 129, 0.35)',
          nebula2: 'rgba(5, 150, 105, 0.4)',
          stars: 'rgba(52, 211, 153, 0.9)'
        }
      case 'Diamond':
        return {
          nebula1: 'rgba(56, 189, 248, 0.35)',
          nebula2: 'rgba(2, 132, 199, 0.4)',
          stars: 'rgba(14, 165, 233, 0.9)'
        }
      case 'Platinum':
      default:
        return {
          nebula1: 'rgba(217, 70, 239, 0.5)', // Bright Magenta
          nebula2: 'rgba(168, 85, 247, 0.45)', // Vibrant Purple
          stars: 'rgba(240, 171, 252, 0.9)'
        }
    }
  }

  const colors = getDivisionColors(division)

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
      background: '#0b051d', // Dark purple base
      transition: 'background 1s ease'
    }}>
      <style>{`
        @keyframes drift {
          from { transform: scale(1.1) translate(0, 0); }
          to { transform: scale(1.2) translate(-2%, 2%); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 0.9; }
        }
        .cosmic-image {
          position: absolute;
          inset: -10%;
          background-image: url('/cosmic-bg.jpg');
          background-size: cover;
          background-position: center;
          animation: drift 60s alternate infinite ease-in-out;
          filter: saturate(1.2) contrast(1.1);
        }
        .nebula-glow-overlay {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 50%, ${colors.nebula1} 0%, transparent 60%);
          mix-blend-mode: screen;
          animation: pulse 10s infinite ease-in-out;
        }
      `}</style>

      {/* Main Cosmic Background Image */}
      <div className="cosmic-image" />

      {/* Procedural Nebula Clouds (Enhance the image colors) */}
      <div className="nebula-glow-overlay" />

      {/* Dynamic Division Clouds */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '10%',
        width: '60%',
        height: '60%',
        background: `radial-gradient(circle, ${colors.nebula2} 0%, transparent 70%)`,
        mixBlendMode: 'screen',
        opacity: 0.4,
        filter: 'blur(100px)'
      }} />

      {/* Atmospheric Star Layer */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          radial-gradient(1.5px 1.5px at 20px 30px, white, rgba(0,0,0,0)),
          radial-gradient(2px 2px at 150px 260px, ${colors.stars}, rgba(0,0,0,0)),
          radial-gradient(1px 1px at 300px 100px, white, rgba(0,0,0,0))
        `,
        backgroundRepeat: 'repeat',
        backgroundSize: '400px 400px',
        opacity: 0.5
      }} />
    </div>
  )
}
