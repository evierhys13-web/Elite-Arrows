export default function BackgroundDecor() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: 'none',
      zIndex: -100, // Move way to the back
      overflow: 'hidden',
      background: '#0b051d' // Deep Dark Purple Base Fallback
    }}>
      <style>{`
        @keyframes drift {
          0% { transform: scale(1.1) translate(0, 0); }
          50% { transform: scale(1.15) translate(-1%, 1%); }
          100% { transform: scale(1.1) translate(0, 0); }
        }
        .cosmic-image-main {
          position: absolute;
          inset: -10%;
          background-image: url('/cosmic%20primary%20image.png');
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          animation: drift 60s ease-in-out infinite;
          opacity: 1;
        }
      `}</style>

      {/* THE ACTUAL IMAGE - PRIMARY LAYER */}
      <div className="cosmic-image-main" />

      {/* Dark vignette for contrast */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 50% 50%, transparent 10%, rgba(0, 0, 0, 0.5) 100%)'
      }} />
    </div>
  )
}
