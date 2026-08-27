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
      background: '#0b051d' // Deep Dark Purple Base
    }}>
      <style>{`
        @keyframes drift {
          0% { transform: scale(1.05) translate(0, 0); }
          50% { transform: scale(1.1) translate(-1%, 1%); }
          100% { transform: scale(1.05) translate(0, 0); }
        }
        .cosmic-background {
          position: absolute;
          inset: -5%;
          background-image: url('/cosmic-bg.jpg');
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          animation: drift 40s ease-in-out infinite;
        }
        .overlay-stars {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(1px 1px at 20% 30%, white, transparent),
                            radial-gradient(1.5px 1.5px at 50% 70%, white, transparent),
                            radial-gradient(1px 1px at 80% 40%, white, transparent);
          background-size: 300px 300px;
          opacity: 0.3;
        }
      `}</style>

      {/* THE ACTUAL IMAGE */}
      <div className="cosmic-background" />

      {/* Very subtle star overlay to add slight depth/twinkle to the static image */}
      <div className="overlay-stars" />

      {/* Dark vignette to ensure edge contrast */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 50% 50%, transparent 40%, rgba(11, 5, 29, 0.4) 100%)'
      }} />
    </div>
  )
}
