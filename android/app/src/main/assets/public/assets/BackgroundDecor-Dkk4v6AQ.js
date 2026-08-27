import{t as e}from"./jsx-runtime-BNdqF01M.js";var t=e();function n(){return(0,t.jsxs)(`div`,{style:{position:`fixed`,top:0,left:0,right:0,bottom:0,pointerEvents:`none`,zIndex:-100,overflow:`hidden`,background:`#0b051d`},children:[(0,t.jsx)(`style`,{children:`
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
          width: 140px;
          height: 1px;
          background: linear-gradient(90deg, rgba(255,255,255,0.95), rgba(255,255,255,0.1), transparent);
          border-radius: 2px;
          animation: shoot 14s linear infinite;
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
        .shooting-star-4 {
          top: 28%;
          left: 80%;
          animation-delay: 3s;
          animation-duration: 11s;
        }
        .shooting-star-5 {
          top: 60%;
          left: 30%;
          animation-delay: 12s;
          animation-duration: 16s;
        }
        .shooting-star-6 {
          top: 8%;
          left: 20%;
          animation-delay: 15s;
          animation-duration: 10s;
        }
        .shooting-star-7 {
          top: 75%;
          left: 70%;
          animation-delay: 18s;
          animation-duration: 13s;
        }
        .shooting-star-8 {
          top: 35%;
          left: 45%;
          animation-delay: 21s;
          animation-duration: 12s;
        }
        .shooting-star-9 {
          top: 55%;
          left: 92%;
          animation-delay: 24s;
          animation-duration: 15s;
        }
        .shooting-star-10 {
          top: 18%;
          left: 8%;
          animation-delay: 27s;
          animation-duration: 11s;
        }
        @keyframes shoot {
          0% { transform: translate(0, 0) rotate(-30deg); opacity: 0; }
          2% { opacity: 1; }
          8% { transform: translate(-50vw, 28vw) rotate(-30deg); opacity: 0; }
          100% { transform: translate(-50vw, 28vw) rotate(-30deg); opacity: 0; }
        }
        .meteor {
          position: absolute;
          width: 260px;
          height: 3px;
          border-radius: 3px;
          opacity: 0;
          overflow: visible;
        }
        .meteor::before {
          content: '';
          position: absolute;
          top: 50%;
          right: 0;
          transform: translateY(-50%);
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: radial-gradient(circle, #ffffff 0%, rgba(255, 224, 256, 0.9) 35%, rgba(255, 236, 179, 0.5) 55%, transparent 75%);
          box-shadow: 0 0 18px 5px rgba(255, 236, 179, 0.8), 0 0 42px 12px rgba(255, 160, 100, 0.5);
        }
        .meteor::after {
          content: '';
          position: absolute;
          top: 50%;
          right: 10px;
          transform: translateY(-50%);
          width: 260px;
          height: 3px;
          background: linear-gradient(90deg, transparent 0%, rgba(255, 190, 120, 0.15) 40%, rgba(255, 230, 180, 0.6) 75%, #fff0d0 100%);
          border-radius: 3px;
          box-shadow: 0 0 20px 2px rgba(255, 200, 130, 0.35);
        }
        .meteor-anim {
          animation: meteor-fall 13s linear infinite;
        }
        .meteor-1 { top: 40%; left: 85%; animation-delay: 2s; }
        .meteor-2 { top: 15%; left: 60%; animation-delay: 8s; animation-duration: 15s; }
        .meteor-3 { top: 65%; left: 40%; animation-delay: 4s; animation-duration: 11s; }
        .meteor-4 { top: 5%; left: 25%; animation-delay: 11s; animation-duration: 17s; }
        .meteor-5 { top: 80%; left: 75%; animation-delay: 6s; animation-duration: 14s; }
        .meteor-6 { top: 30%; left: 55%; animation-delay: 20s; animation-duration: 16s; }
        .meteor-7 { top: 55%; left: 15%; animation-delay: 14s; animation-duration: 12s; }
        .meteor-8 { top: 70%; left: 5%; animation-delay: 26s; animation-duration: 15s; }
        .meteor-9 { top: 22%; left: 95%; animation-delay: 33s; animation-duration: 13s; }
        @keyframes meteor-fall {
          0% { transform: translate(0, 0) rotate(-32deg); opacity: 0; }
          1% { opacity: 1; }
          10% { transform: translate(-70vw, 45vw) rotate(-32deg); opacity: 0; }
          100% { transform: translate(-70vw, 45vw) rotate(-32deg); opacity: 0; }
        }
      `}),(0,t.jsx)(`div`,{className:`cosmic-image-main`}),(0,t.jsx)(`div`,{className:`nebula nebula-1`}),(0,t.jsx)(`div`,{className:`nebula nebula-2`}),(0,t.jsx)(`div`,{className:`nebula nebula-3`}),(0,t.jsx)(`div`,{className:`nebula nebula-4`}),(0,t.jsx)(`div`,{className:`starfield`}),(0,t.jsx)(`div`,{className:`starfield-2`}),(0,t.jsx)(`div`,{className:`shooting-star shooting-star-2`}),(0,t.jsx)(`div`,{className:`shooting-star shooting-star-3`}),(0,t.jsx)(`div`,{className:`shooting-star shooting-star-4`}),(0,t.jsx)(`div`,{className:`shooting-star shooting-star-5`}),(0,t.jsx)(`div`,{className:`shooting-star shooting-star-6`}),(0,t.jsx)(`div`,{className:`shooting-star shooting-star-7`}),(0,t.jsx)(`div`,{className:`shooting-star shooting-star-8`}),(0,t.jsx)(`div`,{className:`shooting-star shooting-star-9`}),(0,t.jsx)(`div`,{className:`shooting-star shooting-star-10`}),(0,t.jsx)(`div`,{className:`meteor meteor-anim meteor-1`}),(0,t.jsx)(`div`,{className:`meteor meteor-anim meteor-2`}),(0,t.jsx)(`div`,{className:`meteor meteor-anim meteor-3`}),(0,t.jsx)(`div`,{className:`meteor meteor-anim meteor-4`}),(0,t.jsx)(`div`,{className:`meteor meteor-anim meteor-5`}),(0,t.jsx)(`div`,{className:`meteor meteor-anim meteor-6`}),(0,t.jsx)(`div`,{className:`meteor meteor-anim meteor-7`}),(0,t.jsx)(`div`,{className:`meteor meteor-anim meteor-8`}),(0,t.jsx)(`div`,{className:`meteor meteor-anim meteor-9`}),(0,t.jsx)(`div`,{style:{position:`absolute`,inset:0,background:`radial-gradient(circle at 50% 50%, transparent 30%, rgba(0, 0, 0, 0.45) 100%)`}})]})}export{n as t};