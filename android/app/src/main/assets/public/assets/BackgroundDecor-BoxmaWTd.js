import{t as e}from"./jsx-runtime-D-oznMWL.js";var t=e();function n(){let e=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5],n=(e,t,n,r)=>{let i=e=>e*Math.PI/180,a=250+r*Math.cos(i(e)),o=250+r*Math.sin(i(e)),s=250+r*Math.cos(i(t)),c=250+r*Math.sin(i(t)),l=250+n*Math.cos(i(t)),u=250+n*Math.sin(i(t)),d=250+n*Math.cos(i(e)),f=250+n*Math.sin(i(e)),p=+(t-e>180);return`M ${a} ${o} A ${r} ${r} 0 ${p} 1 ${s} ${c} L ${l} ${u} A ${n} ${n} 0 ${p} 0 ${d} ${f} Z`};return(0,t.jsxs)(`div`,{style:{position:`fixed`,top:0,left:0,right:0,bottom:0,pointerEvents:`none`,zIndex:-1,overflow:`hidden`,background:`#1e1b4b`},children:[(0,t.jsx)(`div`,{style:{position:`absolute`,inset:0,background:`
          linear-gradient(135deg,
            #312e81 0%,
            #4338ca 30%,
            #818cf8 70%,
            #38bdf8 100%
          )
        `,opacity:.85}}),(0,t.jsx)(`div`,{style:{position:`absolute`,top:`5%`,left:`5%`,width:`90%`,height:`90%`,background:`
          radial-gradient(circle at 20% 30%, rgba(165, 180, 252, 0.45) 0%, transparent 50%),
          radial-gradient(circle at 80% 70%, rgba(56, 189, 248, 0.4) 0%, transparent 50%),
          radial-gradient(circle at 50% 50%, rgba(129, 140, 248, 0.25) 0%, transparent 60%)
        `,filter:`blur(80px)`}}),(0,t.jsx)(`div`,{style:{position:`absolute`,inset:0,backgroundImage:`
          linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px)
        `,backgroundSize:`80px 80px`,maskImage:`radial-gradient(ellipse at 50% 50%, black 20%, transparent 95%)`}}),(0,t.jsx)(`div`,{style:{position:`absolute`,top:`50%`,left:`50%`,transform:`translate(-50%, -50%) rotate(10deg)`,width:`1200px`,height:`1200px`,opacity:.08},children:(0,t.jsxs)(`svg`,{viewBox:`0 0 500 500`,fill:`none`,xmlns:`http://www.w3.org/2000/svg`,children:[e.map((e,r)=>{let i=r*18-90-18/2;return(0,t.jsx)(`path`,{d:n(i,i+18,140,245),fill:r%2==0?`rgba(255,255,255,0.2)`:`transparent`,stroke:`white`,strokeWidth:`0.5`},`wedge-${r}`)}),(0,t.jsx)(`circle`,{cx:`250`,cy:`250`,r:`248`,stroke:`white`,strokeWidth:`2`,fill:`none`}),(0,t.jsx)(`circle`,{cx:`250`,cy:`250`,r:`140`,stroke:`white`,strokeWidth:`1`,fill:`none`})]})})]})}export{n as t};