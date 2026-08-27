export default function BackgroundDecor() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: 'none',
      zIndex: -100,
      overflow: 'hidden',
      background: '#0b051d'
    }}>
      <style>{`
        @keyframes drift {
          0% { transform: scale(1.1) translate(0, 0); }
          50% { transform: scale(1.15) translate(-1%, 1%); }
          100% { transform: scale(1.1) translate(0, 0); }
        }
        @keyframes nebula-drift {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(2%, -2%) scale(1.08); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
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
        .nebula {
          position: absolute;
          border-radius: 50%;
          filter: blur(60px);
          mix-blend-mode: screen;
          opacity: 0.55;
        }
        .nebula-1 {
          width: 55vw;
          height: 55vw;
          top: -15%;
          left: -10%;
          background: radial-gradient(circle, rgba(124, 58, 237, 0.55) 0%, rgba(59, 7, 100, 0.4) 40%, transparent 70%);
          animation: nebula-drift 45s ease-in-out infinite;
        }
        .nebula-2 {
          width: 45vw;
          height: 45vw;
          bottom: -12%;
          right: -8%;
          background: radial-gradient(circle, rgba(56, 189, 248, 0.45) 0%, rgba(8, 51, 68, 0.35) 45%, transparent 72%);
          animation: nebula-drift 55s ease-in-out infinite reverse;
        }
        .nebula-3 {
          width: 40vw;
          height: 40vw;
          top: 30%;
          right: 12%;
          background: radial-gradient(circle, rgba(217, 70, 239, 0.4) 0%, rgba(88, 28, 135, 0.3) 45%, transparent 70%);
          animation: nebula-drift 50s ease-in-out infinite;
          animation-delay: -20s;
        }
        .nebula-4 {
          width: 35vw;
          height: 35vw;
          bottom: 5%;
          left: 18%;
          background: radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, rgba(30, 27, 75, 0.3) 45%, transparent 72%);
          animation: nebula-drift 60s ease-in-out infinite reverse;
          animation-delay: -35s;
        }
        .starfield, .starfield-2 {
          position: absolute;
          inset: 0;
          background-repeat: repeat;
        }
        .starfield {
          background-image:
            radial-gradient(1.5px 1.5px at 20px 30px, #ffffff 50%, transparent 50%),
            radial-gradient(1px 1px at 40px 70px, #f0f9ff 50%, transparent 50%),
            radial-gradient(1.5px 1.5px at 50px 160px, #e0f2fe 50%, transparent 50%),
            radial-gradient(1px 1px at 90px 40px, #ffffff 50%, transparent 50%),
            radial-gradient(1px 1px at 130px 80px, #dbeafe 50%, transparent 50%),
            radial-gradient(1.5px 1.5px at 160px 120px, #ffffff 50%, transparent 50%);
          background-size: 200px 200px;
          animation: twinkle 4s ease-in-out infinite;
        }
        .starfield-2 {
          background-image:
            radial-gradient(1px 1px at 25px 25px, #ffffff 50%, transparent 50%),
            radial-gradient(1.5px 1.5px at 75px 100px, #c7d2fe 50%, transparent 50%),
            radial-gradient(1px 1px at 110px 65px, #ffffff 50%, transparent 50%),
            radial-gradient(1.5px 1.5px at 150px 140px, #e9d5ff 50%, transparent 50%),
            radial-gradient(1px 1px at 185px 30px, #ffffff 50%, transparent 50%);
          background-size: 200px 200px;
          animation: twinkle 6s ease-in-out infinite;
          animation-delay: -2.5s;
        }
        .shooting-star {
          position: absolute;
          width: 120px;
          height: 1px;
          background: linear-gradient(90deg, rgba(255,255,255,0.9), transparent);
          border-radius: 2px;
          animation: shoot 12s linear infinite;
          opacity: 0;
        }
        .shooting-star-2 {
          top: 12%;
          left: 65%;
          animation-delay: 6s;
        }
        .shooting-star-3 {
          top: 45%;
          left: 10%;
          animation-delay: 9s;
        }
        @keyframes shoot {
          0% { transform: translate(0, 0) rotate(-30deg); opacity: 0; }
          2% { opacity: 1; }
          6% { transform: translate(-40vw, 22vw) rotate(-30deg); opacity: 0; }
          100% { transform: translate(-40vw, 22vw) rotate(-30deg); opacity: 0; }
        }
      `}</style>

      {/* THE ACTUAL IMAGE - PRIMARY LAYER */}
      <div className="cosmic-image-main" />

      {/* Nebula clouds */}
      <div className="nebula nebula-1" />
      <div className="nebula nebula-2" />
      <div className="nebula nebula-3" />
      <div className="nebula nebula-4" />

      {/* Starfield */}
      <div className="starfield" />
      <div className="starfield-2" />

      {/* Shooting stars */}
      <div className="shooting-star shooting-star-2" />
      <div className="shooting-star shooting-star-3" />

      {/* Dark vignette for contrast */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 50% 50%, transparent 30%, rgba(0, 0, 0, 0.45) 100%)'
      }} />
    </div>
  )
}