export default function BackgroundDecor({ division }) {
  const getDivisionColors = (div) => {
    switch (div) {
      case 'Elite':
        return {
          nebula1: 'rgba(251, 191, 36, 0.25)', // Gold
          nebula2: 'rgba(245, 158, 11, 0.3)', // Amber
          nebula3: 'rgba(217, 119, 6, 0.35)', // Deep Amber
          stars: 'rgba(251, 191, 36, 0.7)'
        }
      case 'Emerald':
        return {
          nebula1: 'rgba(16, 185, 129, 0.25)', // Emerald
          nebula2: 'rgba(5, 150, 105, 0.3)', // Deep Green
          nebula3: 'rgba(4, 120, 87, 0.35)', // Vibrant Green
          stars: 'rgba(52, 211, 153, 0.7)'
        }
      case 'Diamond':
        return {
          nebula1: 'rgba(56, 189, 248, 0.25)', // Cyan
          nebula2: 'rgba(2, 132, 199, 0.3)', // Deep Blue
          nebula3: 'rgba(3, 105, 161, 0.35)', // Vibrant Blue
          stars: 'rgba(14, 165, 233, 0.7)'
        }
      case 'Platinum':
      default:
        return {
          nebula1: 'rgba(217, 70, 239, 0.4)', // Bright Magenta (mimics photo)
          nebula2: 'rgba(168, 85, 247, 0.35)', // Vibrant Purple
          nebula3: 'rgba(107, 33, 168, 0.45)', // Deep Purple-Violet
          stars: 'rgba(240, 171, 252, 0.7)' // Light Purple Stars
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
      background: '#2e1065', // Brighter Purple Base
      transition: 'background 1s ease'
    }}>
      <style>{`
        @keyframes nebulaPulse {
          0%, 100% { transform: scale(1) translate(0, 0); opacity: 0.7; }
          50% { transform: scale(1.2) translate(-2%, 2%); opacity: 1; }
        }
        @keyframes cosmicDrift {
          from { background-position: 0 0; }
          to { background-position: 1200px 1200px; }
        }
        @keyframes starTwinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        .twinkle-star {
          position: absolute;
          background: white;
          border-radius: 50%;
          box-shadow: 0 0 10px white, 0 0 20px ${colors.stars};
          animation: starTwinkle 4s infinite ease-in-out;
        }
        .nebula-cloud {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          animation: nebulaPulse 20s infinite ease-in-out;
          mix-blend-mode: screen;
          opacity: 0.8;
        }
        .stars-overlay {
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(1.5px 1.5px at 20px 30px, white, rgba(0,0,0,0)),
            radial-gradient(1.2px 1.2px at 150px 50px, white, rgba(0,0,0,0)),
            radial-gradient(2px 2px at 80px 260px, ${colors.stars}, rgba(0,0,0,0)),
            radial-gradient(1.8px 1.8px at 300px 100px, white, rgba(0,0,0,0)),
            radial-gradient(1.5px 1.5px at 450px 200px, ${colors.stars}, rgba(0,0,0,0)),
            radial-gradient(2px 2px at 200px 400px, white, rgba(0,0,0,0));
          background-repeat: repeat;
          background-size: 400px 400px;
          opacity: 0.7;
          animation: cosmicDrift 150s linear infinite;
        }
        .stars-tiny {
          background-image: radial-gradient(0.8px 0.8px at 10px 10px, white, rgba(0,0,0,0));
          background-size: 100px 100px;
          opacity: 0.3;
          animation: cosmicDrift 300s linear infinite;
        }
      `}</style>

      {/* Main Gradient Base (Brighter Purple) */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(circle at 50% 50%, #4c1d95 0%, #2e1065 100%)`,
        opacity: 0.8
      }} />

      {/* Layered Starfield */}
      <div className="stars-overlay" />
      <div className="stars-overlay stars-tiny" />

      {/* Hand-placed Twinkling Stars for Contrast */}
      {[
        { t: '15%', l: '10%', s: '3px', d: '0s' },
        { t: '25%', l: '85%', s: '2px', d: '1s' },
        { t: '65%', l: '20%', s: '4px', d: '2s' },
        { t: '80%', l: '75%', s: '2px', d: '0.5s' },
        { t: '40%', l: '45%', s: '3px', d: '1.5s' },
        { t: '10%', l: '60%', s: '2px', d: '3s' },
        { t: '90%', l: '15%', s: '3px', d: '2.5s' }
      ].map((star, i) => (
        <div
          key={i}
          className="twinkle-star"
          style={{
            top: star.t,
            left: star.l,
            width: star.s,
            height: star.s,
            animationDelay: star.d
          }}
        />
      ))}

      {/* Large Vibrant Nebula Clouds (Photo Style) */}
      <div className="nebula-cloud" style={{
        top: '-10%', left: '0%', width: '90%', height: '90%',
        background: `radial-gradient(circle, ${colors.nebula1} 0%, transparent 70%)`,
        animationDelay: '0s'
      }} />
      <div className="nebula-cloud" style={{
        bottom: '5%', right: '-10%', width: '85%', height: '85%',
        background: `radial-gradient(circle, ${colors.nebula2} 0%, transparent 70%)`,
        animationDelay: '-10s'
      }} />
      <div className="nebula-cloud" style={{
        top: '30%', right: '10%', width: '60%', height: '60%',
        background: `radial-gradient(circle, ${colors.nebula3} 0%, transparent 70%)`,
        animationDelay: '-20s'
      }} />

      {/* Center Atmospheric Glow */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '120%',
        height: '120%',
        background: `radial-gradient(circle at 50% 50%, ${colors.nebula2} 0%, transparent 60%)`,
        opacity: 0.4,
        mixBlendMode: 'screen'
      }} />

      {/* Subtle Digital Grid Overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
        `,
        backgroundSize: '100px 100px',
        maskImage: 'radial-gradient(ellipse at 50% 50%, black 5%, transparent 95%)',
        opacity: 0.5
      }} />
    </div>
  )
}
