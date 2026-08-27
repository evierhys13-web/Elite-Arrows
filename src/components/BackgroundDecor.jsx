export default function BackgroundDecor({ division }) {
  const getDivisionColors = (div) => {
    switch (div) {
      case 'Elite':
        return {
          nebula1: 'rgba(251, 191, 36, 0.25)', // Gold
          nebula2: 'rgba(245, 158, 11, 0.3)', // Amber
          stars: 'rgba(251, 191, 36, 0.7)'
        }
      case 'Emerald':
        return {
          nebula1: 'rgba(16, 185, 129, 0.25)', // Emerald
          nebula2: 'rgba(5, 150, 105, 0.3)', // Deep Green
          stars: 'rgba(52, 211, 153, 0.7)'
        }
      case 'Diamond':
        return {
          nebula1: 'rgba(56, 189, 248, 0.25)', // Cyan
          nebula2: 'rgba(2, 132, 199, 0.3)', // Deep Blue
          stars: 'rgba(14, 165, 233, 0.7)'
        }
      case 'Platinum':
      default:
        return {
          nebula1: 'rgba(217, 70, 239, 0.4)', // Bright Magenta
          nebula2: 'rgba(168, 85, 247, 0.35)', // Vibrant Purple
          stars: 'rgba(240, 171, 252, 0.7)'
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
      background: '#0f0724',
      transition: 'background 1s ease'
    }}>
      <style>{`
        @keyframes nebulaPulse {
          0%, 100% { transform: scale(1) translate(0, 0); opacity: 0.7; }
          50% { transform: scale(1.1) translate(-2%, 2%); opacity: 0.9; }
        }
        @keyframes cosmicDrift {
          from { background-position: 0 0; }
          to { background-position: 1000px 1000px; }
        }
        @keyframes starTwinkle {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        .twinkle-star {
          position: absolute;
          background: white;
          border-radius: 50%;
          box-shadow: 0 0 10px white, 0 0 20px ${colors.stars};
          animation: starTwinkle 4s infinite ease-in-out;
        }
        .nebula-overlay {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          animation: nebulaPulse 25s infinite ease-in-out;
          mix-blend-mode: screen;
          opacity: 0.5;
        }
        .stars-container {
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(1.5px 1.5px at 20px 30px, white, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 150px 50px, rgba(255,255,255,0.8), rgba(0,0,0,0)),
            radial-gradient(2px 2px at 80px 260px, ${colors.stars}, rgba(0,0,0,0)),
            radial-gradient(3px 3px at 300px 100px, white, rgba(0,0,0,0)),
            radial-gradient(1.5px 1.5px at 450px 200px, rgba(255,255,255,0.6), rgba(0,0,0,0)),
            radial-gradient(2.5px 2.5px at 200px 400px, ${colors.stars}, rgba(0,0,0,0));
          background-repeat: repeat;
          background-size: 500px 500px;
          opacity: 0.6;
          animation: cosmicDrift 180s linear infinite;
        }
      `}</style>

      {/* Primary Cosmic Image Background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: "url('/cosmic-bg.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 1
      }} />

      {/* Layered Starfield */}
      <div className="stars-container" />

      {/* Hand-placed Twinkling Stars for Depth */}
      {[
        { t: '15%', l: '10%', s: '3px', d: '0s' },
        { t: '25%', l: '85%', s: '2px', d: '1s' },
        { t: '65%', l: '20%', s: '4px', d: '2s' },
        { t: '80%', l: '75%', s: '2px', d: '0.5s' }
      ].map((star, i) => (
        <div key={i} className="twinkle-star" style={{ top: star.t, left: star.l, width: star.s, height: star.s, animationDelay: star.d }} />
      ))}

      {/* Dynamic Division Nebula Clusters on top of image */}
      <div className="nebula-overlay" style={{ top: '-10%', left: '0%', width: '80%', height: '80%', background: `radial-gradient(circle, ${colors.nebula1} 0%, transparent 70%)` }} />
      <div className="nebula-overlay" style={{ bottom: '0%', right: '0%', width: '70%', height: '70%', background: `radial-gradient(circle, ${colors.nebula2} 0%, transparent 70%)`, animationDelay: '-10s' }} />

      {/* Subtle Structural Overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(255, 255, 255, 0.01) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.01) 1px, transparent 1px)
        `,
        backgroundSize: '150px 120px',
        maskImage: 'radial-gradient(ellipse at 50% 50%, black 5%, transparent 95%)',
        opacity: 0.3
      }} />
    </div>
  )
}
