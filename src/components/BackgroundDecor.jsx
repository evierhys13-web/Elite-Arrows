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
      background: '#0b051d' // Deep Dark Purple Base fallback
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
          background-image: url('/cosmic primary image.png');
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          animation: drift 60s ease-in-out infinite;
        }
      `}</style>

      {/* THIS IS THE ACTUAL IMAGE FILE */}
      <div className="cosmic-background" />

      {/* Dark vignette to ensure edge contrast for text/tables */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 50% 50%, transparent 20%, rgba(0, 0, 0, 0.4) 100%)'
      }} />
    </div>
  )
}
