export default function BackgroundDecor({ division }) {
  const getDivisionColors = (div) => {
    switch (div) {
      case 'Elite':
        return {
          nebula1: 'rgba(251, 191, 36, 0.15)', // Gold
          nebula2: 'rgba(120, 53, 15, 0.2)', // Amber
          nebula3: 'rgba(69, 26, 3, 0.3)', // Deep Brown
          stars: 'rgba(251, 191, 36, 0.5)'
        }
      case 'Emerald':
        return {
          nebula1: 'rgba(16, 185, 129, 0.15)', // Emerald
          nebula2: 'rgba(6, 95, 70, 0.2)', // Deep Green
          nebula3: 'rgba(6, 78, 59, 0.3)', // Darker Green
          stars: 'rgba(52, 211, 153, 0.5)'
        }
      case 'Diamond':
        return {
          nebula1: 'rgba(56, 189, 248, 0.15)', // Cyan
          nebula2: 'rgba(7, 89, 133, 0.2)', // Deep Blue
          nebula3: 'rgba(12, 74, 110, 0.3)', // Darker Blue
          stars: 'rgba(14, 165, 233, 0.5)'
        }
      case 'Platinum':
      default:
        return {
          nebula1: 'rgba(129, 140, 248, 0.15)', // Platinum/Purple
          nebula2: 'rgba(76, 29, 149, 0.2)', // Violet
          nebula3: 'rgba(30, 27, 75, 0.3)', // Deep Indigo
          stars: 'rgba(165, 180, 252, 0.5)'
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
      background: '#020617', // Near Black Space Base
      transition: 'background 1s ease'
    }}>
      <style>{`
        @keyframes nebulaPulse {
          0%, 100% { transform: scale(1) translate(0, 0); opacity: 0.5; }
          50% { transform: scale(1.1) translate(-2%, 2%); opacity: 0.8; }
        }
        @keyframes cosmicDrift {
          from { background-position: 0 0; }
          to { background-position: 1000px 1000px; }
        }
        @keyframes starTwinkle {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        .nebula {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          animation: nebulaPulse 20s infinite ease-in-out;
          mix-blend-mode: screen;
        }
        .stars-container {
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(1px 1px at 20px 30px, white, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 40px 70px, white, rgba(0,0,0,0)),
            radial-gradient(2px 2px at 50px 160px, ${colors.stars}, rgba(0,0,0,0)),
            radial-gradient(2px 2px at 90px 40px, white, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 130px 80px, white, rgba(0,0,0,0)),
            radial-gradient(2px 2px at 160px 120px, ${colors.stars}, rgba(0,0,0,0));
          background-repeat: repeat;
          background-size: 200px 200px;
          opacity: 0.4;
          animation: cosmicDrift 120s linear infinite;
        }
        .stars-fast {
          background-size: 300px 300px;
          animation: cosmicDrift 80s linear infinite;
          opacity: 0.2;
        }
        .stars-tiny {
          background-image: radial-gradient(0.5px 0.5px at 10px 10px, white, rgba(0,0,0,0));
          background-size: 50px 50px;
          opacity: 0.1;
          animation: cosmicDrift 200s linear infinite;
        }
      `}</style>

      {/* Deep Space Background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(circle at 50% 50%, #0f172a 0%, #020617 100%)`
      }} />

      {/* Static Stars */}
      <div className="stars-container" />
      <div className="stars-container stars-fast" />
      <div className="stars-container stars-tiny" />

      {/* Large Nebula Clouds */}
      <div className="nebula" style={{
        top: '-10%', left: '-10%', width: '70%', height: '70%',
        background: colors.nebula3, animationDelay: '0s'
      }} />
      <div className="nebula" style={{
        bottom: '-10%', right: '-10%', width: '70%', height: '70%',
        background: colors.nebula2, animationDelay: '-5s'
      }} />
      <div className="nebula" style={{
        top: '20%', right: '10%', width: '50%', height: '50%',
        background: colors.nebula1, animationDelay: '-10s'
      }} />

      {/* Division Specific Highlight Glow */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '100%',
        height: '100%',
        background: `radial-gradient(circle at 50% 50%, ${colors.nebula1} 0%, transparent 70%)`,
        opacity: 0.4,
        mixBlendMode: 'screen'
      }} />

      {/* Subtle Grid Overlay for structure */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: '100px 100px',
        maskImage: 'radial-gradient(ellipse at 50% 50%, black 10%, transparent 90%)'
      }} />
    </div>
  )
}
