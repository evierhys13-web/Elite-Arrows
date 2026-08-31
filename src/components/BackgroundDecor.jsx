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
      background: '#0b051d',
      contain: 'layout style paint'
    }}>
      <style>{`
        @keyframes drift {
          0% { transform: scale(1.05) translate(0, 0); }
          50% { transform: scale(1.08) translate(-0.5%, 0.5%); }
          100% { transform: scale(1.05) translate(0, 0); }
        }
        @keyframes nebula-drift {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(1.5%, -1.5%) scale(1.04); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.7; }
        }
        .cosmic-image-main {
          position: absolute;
          inset: -5%;
          background-image: url('/cosmic%20primary%20image.png');
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          animation: drift 90s ease-in-out infinite;
          opacity: 0.6;
          will-change: transform;
        }
        .nebula {
          position: absolute;
          border-radius: 50%;
          filter: blur(30px);
          mix-blend-mode: screen;
          opacity: 0.3;
          will-change: transform;
        }
        .nebula-1 {
          width: 35vw;
          height: 35vw;
          top: -10%;
          left: -8%;
          background: radial-gradient(circle, rgba(124, 58, 237, 0.4) 0%, rgba(59, 7, 100, 0.25) 40%, transparent 70%);
          animation: nebula-drift 55s ease-in-out infinite;
        }
        .nebula-2 {
          width: 30vw;
          height: 30vw;
          bottom: -8%;
          right: -6%;
          background: radial-gradient(circle, rgba(56, 189, 248, 0.35) 0%, rgba(8, 51, 68, 0.2) 45%, transparent 72%);
          animation: nebula-drift 65s ease-in-out infinite reverse;
        }
        .nebula-3 {
          width: 25vw;
          height: 25vw;
          top: 35%;
          right: 15%;
          background: radial-gradient(circle, rgba(217, 70, 239, 0.3) 0%, rgba(88, 28, 135, 0.2) 45%, transparent 70%);
          animation: nebula-drift 60s ease-in-out infinite;
          animation-delay: -20s;
        }
        .starfield {
          position: absolute;
          inset: 0;
          background-repeat: repeat;
          background-image:
            radial-gradient(1.2px 1.2px at 20px 30px, #ffffff 50%, transparent 50%),
            radial-gradient(1px 1px at 40px 70px, #f0f9ff 50%, transparent 50%),
            radial-gradient(1.2px 1.2px at 50px 160px, #e0f2fe 50%, transparent 50%),
            radial-gradient(1px 1px at 90px 40px, #ffffff 50%, transparent 50%),
            radial-gradient(1px 1px at 130px 80px, #dbeafe 50%, transparent 50%);
          background-size: 200px 200px;
          animation: twinkle 5s ease-in-out infinite;
        }
        .shooting-star {
          position: absolute;
          width: 120px;
          height: 1px;
          background: linear-gradient(90deg, rgba(255,255,255,0.9), rgba(255,255,255,0.1), transparent);
          border-radius: 2px;
          animation: shoot 18s linear infinite;
          opacity: 0;
          will-change: transform, opacity;
        }
        .shooting-star-1 {
          top: 15%;
          left: 65%;
          animation-delay: 6s;
        }
        .shooting-star-2 {
          top: 50%;
          left: 10%;
          animation-delay: 12s;
        }
        .shooting-star-3 {
          top: 75%;
          left: 70%;
          animation-delay: 24s;
          animation-duration: 22s;
        }
        @keyframes shoot {
          0% { transform: translate(0, 0) rotate(-30deg); opacity: 0; }
          2% { opacity: 0.8; }
          8% { transform: translate(-50vw, 28vw) rotate(-30deg); opacity: 0; }
          100% { transform: translate(-50vw, 28vw) rotate(-30deg); opacity: 0; }
        }
        .meteor {
          position: absolute;
          width: 200px;
          height: 3px;
          border-radius: 3px;
          opacity: 0;
          overflow: visible;
          will-change: transform, opacity;
        }
        .meteor::before {
          content: '';
          position: absolute;
          top: 50%;
          right: 0;
          transform: translateY(-50%);
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: radial-gradient(circle, #ffffff 0%, rgba(255, 224, 256, 0.8) 35%, transparent 75%);
          box-shadow: 0 0 12px 3px rgba(255, 236, 179, 0.6), 0 0 30px 8px rgba(255, 160, 100, 0.3);
        }
        .meteor::after {
          content: '';
          position: absolute;
          top: 50%;
          right: 8px;
          transform: translateY(-50%);
          width: 200px;
          height: 2px;
          background: linear-gradient(90deg, transparent 0%, rgba(255, 190, 120, 0.1) 40%, rgba(255, 230, 180, 0.4) 75%, #fff0d0 100%);
          border-radius: 3px;
        }
        .meteor-anim {
          animation: meteor-fall 20s linear infinite;
        }
        .meteor-1 { top: 40%; left: 85%; animation-delay: 3s; }
        .meteor-2 { top: 15%; left: 60%; animation-delay: 14s; animation-duration: 25s; }
        .meteor-3 { top: 65%; left: 40%; animation-delay: 24s; animation-duration: 18s; }
        @keyframes meteor-fall {
          0% { transform: translate(0, 0) rotate(-32deg); opacity: 0; }
          1% { opacity: 0.7; }
          10% { transform: translate(-70vw, 45vw) rotate(-32deg); opacity: 0; }
          100% { transform: translate(-70vw, 45vw) rotate(-32deg); opacity: 0; }
        }
      `}</style>

      <div className="cosmic-image-main" />
      <div className="nebula nebula-1" />
      <div className="nebula nebula-2" />
      <div className="nebula nebula-3" />
      <div className="starfield" />
      <div className="shooting-star shooting-star-1" />
      <div className="shooting-star shooting-star-2" />
      <div className="shooting-star shooting-star-3" />
      <div className="meteor meteor-anim meteor-1" />
      <div className="meteor meteor-anim meteor-2" />
      <div className="meteor meteor-anim meteor-3" />

      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 50% 50%, transparent 30%, rgba(0, 0, 0, 0.5) 100%)'
      }} />
    </div>
  )
}
