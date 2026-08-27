export default function BackgroundDecor({ division }) {
  const getDivisionColors = (div) => {
    switch (div) {
      case 'Elite':
        return {
          nebula1: 'rgba(251, 191, 36, 0.2)', // Gold
          nebula2: 'rgba(120, 53, 15, 0.25)', // Amber
          nebula3: 'rgba(217, 119, 6, 0.3)', // Deep Amber
          stars: 'rgba(251, 191, 36, 0.6)'
        }
      case 'Emerald':
        return {
          nebula1: 'rgba(16, 185, 129, 0.2)', // Emerald
          nebula2: 'rgba(6, 95, 70, 0.25)', // Deep Green
          nebula3: 'rgba(4, 120, 87, 0.3)', // Vibrant Green
          stars: 'rgba(52, 211, 153, 0.6)'
        }
      case 'Diamond':
        return {
          nebula1: 'rgba(56, 189, 248, 0.2)', // Cyan
          nebula2: 'rgba(7, 89, 133, 0.25)', // Deep Blue
          nebula3: 'rgba(3, 105, 161, 0.3)', // Vibrant Blue
          stars: 'rgba(14, 165, 233, 0.6)'
        }
      case 'Platinum':
      default:
        return {
          nebula1: 'rgba(139, 92, 246, 0.3)', // Vibrant Purple
          nebula2: 'rgba(192, 38, 211, 0.25)', // Magenta/Fuchsia
          nebula3: 'rgba(76, 29, 149, 0.4)', // Deep Violet
          stars: 'rgba(232, 121, 249, 0.6)' // Pinkish Stars
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
      background: '#0f0a2e', // Deep Cosmic Purple Base
      transition: 'background 1s ease'
    }}>
      <style>{`
        @keyframes nebulaPulse {
          0%, 100% { transform: scale(1) translate(0, 0); opacity: 0.6; }
          50% { transform: scale(1.15) translate(-3%, 3%); opacity: 0.9; }
        }
        @keyframes cosmicDrift {
          from { background-position: 0 0; }
          to { background-position: 1000px 1000px; }
        }
        .nebula {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          animation: nebulaPulse 25s infinite ease-in-out;
          mix-blend-mode: screen;
        }
        .stars-container {
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(1.2px 1.2px at 20px 30px, white, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 40px 70px, rgba(255,255,255,0.8), rgba(0,0,0,0)),
            radial-gradient(2px 2px at 50px 160px, ${colors.stars}, rgba(0,0,0,0)),
            radial-gradient(2.5px 2.5px at 90px 40px, white, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 130px 80px, rgba(255,255,255,0.5), rgba(0,0,0,0)),
            radial-gradient(2px 2px at 160px 120px, ${colors.stars}, rgba(0,0,0,0));
          background-repeat: repeat;
          background-size: 250px 250px;
          opacity: 0.5;
          animation: cosmicDrift 150s linear infinite;
        }
        .stars-fast {
          background-size: 400px 400px;
          animation: cosmicDrift 100s linear infinite;
          opacity: 0.3;
        }
        .stars-tiny {
          background-image: radial-gradient(0.8px 0.8px at 10px 10px, white, rgba(0,0,0,0));
          background-size: 80px 80px;
          opacity: 0.2;
          animation: cosmicDrift 250s linear infinite;
        }
      `}</style>

      {/* Rich Purple Space Background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(circle at 50% 50%, #1e1b4b 0%, #0f0a2e 100%)`
      }} />

      {/* Layered Starfield */}
      <div className="stars-container" />
      <div className="stars-container stars-fast" />
      <div className="stars-container stars-tiny" />

      {/* Vibrant Nebula Clouds (Inspired by logo photo) */}
      <div className="nebula" style={{
        top: '-15%', left: '-10%', width: '80%', height: '80%',
        background: colors.nebula3, animationDelay: '0s'
      }} />
      <div className="nebula" style={{
        bottom: '-15%', right: '-10%', width: '80%', height: '80%',
        background: colors.nebula2, animationDelay: '-7s'
      }} />
      <div className="nebula" style={{
        top: '25%', right: '5%', width: '60%', height: '60%',
        background: colors.nebula1, animationDelay: '-12s'
      }} />

      {/* Center Glow Overlay */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '100%',
        height: '100%',
        background: `radial-gradient(circle at 50% 50%, ${colors.nebula1} 0%, transparent 60%)`,
        opacity: 0.5,
        mixBlendMode: 'screen'
      }} />

      {/* Subtle Structural Overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
        `,
        backgroundSize: '120px 120px',
        maskImage: 'radial-gradient(ellipse at 50% 50%, black 10%, transparent 80%)'
      }} />
    </div>
  )
}
