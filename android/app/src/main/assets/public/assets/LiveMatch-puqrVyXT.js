import{i as e,t}from"./jsx-runtime-D-oznMWL.js";import{t as n}from"./react-BeFwIp5l.js";import{s as r}from"./chunk-QFMPRPBF-B1iQbGk_.js";import{N as i,S as ee,i as te}from"./firebase-QXE-UYgO.js";import{n as ne}from"./ToastContext-BI2f2f9T.js";import{n as re}from"./AuthContextInternal-CXVyrtij.js";import{t as ie}from"./Breadcrumbs-DuQPcp4C.js";import{t as a}from"./DartBot-C92pOtRE.js";import{t as ae}from"./Confetti-BUeLUAbR.js";var o=e(n(),1),s=t(),oe=[101,301,501,701],se=[{id:`bestOf`,label:`Best Of`,icon:`🏆`},{id:`firstTo`,label:`First To`,icon:`🎯`}],ce=50,le=20;function c(){let{user:e,sendGameInvite:t,allUsers:n}=re(),{showToast:c}=ne(),l=r(),u=(0,o.useRef)(null),d=(0,o.useRef)(null),f=(0,o.useRef)(null),[p,m]=(0,o.useState)(!1),[h,g]=(0,o.useState)(!1),[_,ue]=(0,o.useState)(501),[v,y]=(0,o.useState)(!0),[b,de]=(0,o.useState)(`bestOf`),[x,fe]=(0,o.useState)(3),[S,pe]=(0,o.useState)(a.getProBots()[1]),[C,me]=(0,o.useState)(ce),[w,he]=(0,o.useState)(le),[ge,_e]=(0,o.useState)(null),[ve,ye]=(0,o.useState)(!1),[T,E]=(0,o.useState)(null),[D,O]=(0,o.useState)(``),[be,k]=(0,o.useState)(!1),[A,j]=(0,o.useState)(501),[M,N]=(0,o.useState)(501),[P,xe]=(0,o.useState)(0),[F,Se]=(0,o.useState)(0),[I,Ce]=(0,o.useState)(`player`),[we,L]=(0,o.useState)([]),[R,z]=(0,o.useState)(``),[B,Te]=(0,o.useState)(null),[V,Ee]=(0,o.useState)(!1),[H,U]=(0,o.useState)([]),[De,Oe]=(0,o.useState)([]),[ke,Ae]=(0,o.useState)(!1),[W,je]=(0,o.useState)(!1),[G,Me]=(0,o.useState)([]),[K,q]=(0,o.useState)(``),[J,Y]=(0,o.useState)(null),[Ne,X]=(0,o.useState)(1);(0,o.useEffect)(()=>{l.state&&l.state.invitePlayer&&(y(!1),g(!0),E(l.state.invitePlayer))},[l.state]);let Z=(0,o.useMemo)(()=>{if(!D.trim()||!n)return[];let t=D.toLowerCase();return n.filter(n=>n.id!==e?.id&&(n.username?.toLowerCase().includes(t)||n.displayName?.toLowerCase().includes(t))).slice(0,10)},[D,n,e?.id]);(0,o.useEffect)(()=>{let e=e=>{f.current&&!f.current.contains(e.target)&&k(!1)};return document.addEventListener(`mousedown`,e),()=>document.removeEventListener(`mousedown`,e)},[]),(0,o.useEffect)(()=>{(async()=>{if(!(typeof navigator>`u`||!navigator.mediaDevices))try{await navigator.mediaDevices.getUserMedia({video:!0}).catch(()=>{});let e=(await navigator.mediaDevices.enumerateDevices()).filter(e=>e.kind===`videoinput`);if(Me(e),e.length>0){let t=localStorage.getItem(`eliteArrowsPreferredCamera`),n=e.find(e=>e.deviceId===t);q(n?n.deviceId:e[0].deviceId)}}catch(e){console.error(e)}})()},[]);let Q=async(e=null)=>{if(typeof navigator>`u`||!navigator.mediaDevices)return;let t=e||K;d.current&&(d.current.getTracks().forEach(e=>e.stop()),d.current=null,Y(null)),u.current&&(u.current.srcObject=null),await new Promise(e=>setTimeout(e,200));try{let e={video:{deviceId:t?{exact:t}:void 0,width:{ideal:1920},height:{ideal:1080}}},n=await navigator.mediaDevices.getUserMedia(e);d.current=n,Y(n),u.current&&(u.current.srcObject=n)}catch(e){c(`Camera error: `+e.message,`error`)}},Pe=async()=>{if(G.length<2)return;let e=G[(G.findIndex(e=>e.deviceId===K)+1)%G.length].deviceId;q(e),localStorage.setItem(`eliteArrowsPreferredCamera`,e),await Q(e)};(0,o.useEffect)(()=>(W?Q():d.current&&(d.current.getTracks().forEach(e=>e.stop()),d.current=null,Y(null)),()=>{d.current&&d.current.getTracks().forEach(e=>e.stop())}),[W,K]),(0,o.useEffect)(()=>{u.current&&d.current&&(u.current.srcObject=d.current)});let Fe=async()=>{if(h&&T){ye(!0);let e={startScore:_,gameFormat:b,legsToWin:x};ee(i(te,`gameInvites`,await t(T.id,e)),e=>{e.exists()&&e.data().status===`accepted`&&(_e(e.data().gameId),m(!0),ye(!1))});return}if(j(_),N(_),xe(0),Se(0),L([]),Ce(`player`),m(!0),U([]),Oe([]),z(``),v){let e=S.id===`custom`,t=e?C:S.avg,n=e?w:S.check;Te(new a({id:S.id,name:S.name,targetAverage:t,checkoutRate:n/100,setupRate:n/120}))}c(`Match Started!`,`info`)},$=(0,o.useCallback)((e,t)=>{let n=e===`player`,r=n?A:M,i=r-t;if(i<0||i===1)c(`BUST!`,`warning`),L(t=>[{who:e,score:0,result:`BUST`,remaining:r},...t]);else if(n?j(i):N(i),L(n=>[{who:e,score:t,remaining:i},...n]),i===0){let e=(n?P:F)+1;n?xe(e):Se(e),b===`firstTo`&&e>=x||b===`bestOf`&&e>x/2?(c(`MATCH SHOT! ${n?`You Win`:`Opponent Wins`}!`,`success`),n&&Ae(!0),m(!1)):(c(`LEG SHOT!`,`success`),n&&Ae(!0),j(_),N(_));return}Ce(n?v?`bot`:`opponent`:`player`)},[A,M,P,F,b,x,_,v,c]),Ie=(0,o.useCallback)(e=>{let t=parseInt(e);isNaN(t)||t>180||($(`player`,t),z(``),Oe([]))},[$]);return(0,o.useEffect)(()=>{p&&I===`bot`&&B&&(async()=>{Ee(!0),U([]);let e=[],t=M;for(let n=0;n<3;n++){await new Promise(e=>setTimeout(e,1200+Math.random()*800));let r=B.calculateDart(t,n);if(e.push(r),U([...e]),t-=r.value,t<=0)break}Ee(!1),$(`bot`,e.reduce((e,t)=>e+t.value,0))})()},[I,p,B,M,$]),p?(0,s.jsxs)(`div`,{className:`page animate-fade-in`,style:{maxWidth:`100%`,margin:`0`,padding:`0`,height:`100vh`,display:`flex`,flexDirection:`column`,background:`var(--bg-primary)`,overflow:`hidden`},children:[(0,s.jsx)(ae,{trigger:ke}),(0,s.jsxs)(`div`,{className:`match-header`,children:[(0,s.jsxs)(`div`,{className:`player-card ${I===`player`?`active`:``}`,children:[(0,s.jsxs)(`div`,{className:`player-card-top`,children:[(0,s.jsx)(`span`,{className:`player-name`,children:e?.username||`YOU`}),(0,s.jsxs)(`span`,{className:`player-badge`,children:[P,` LEG`,P===1?``:`S`]})]}),(0,s.jsx)(`div`,{className:`player-score`,children:A}),De.length>0&&I===`player`&&(0,s.jsx)(`div`,{className:`player-darts`,children:De.map((e,t)=>(0,s.jsx)(`span`,{className:`dart-chip`,children:e},t))}),I===`player`&&(0,s.jsx)(`div`,{className:`turn-arrow`,children:`◀ YOUR TURN`})]}),(0,s.jsx)(`div`,{className:`match-divider`,children:(0,s.jsx)(`span`,{className:`vs-text`,children:`VS`})}),(0,s.jsxs)(`div`,{className:`player-card right ${I===`player`?``:`active`}`,children:[(0,s.jsxs)(`div`,{className:`player-card-top`,children:[(0,s.jsx)(`span`,{className:`player-name`,children:v?S.name:T?.username||`OPPONENT`}),(0,s.jsxs)(`span`,{className:`player-badge`,children:[F,` LEG`,F===1?``:`S`]})]}),(0,s.jsx)(`div`,{className:`player-score`,children:V?(0,s.jsx)(`span`,{className:`thinking-dots`,children:`...`}):M}),I!==`player`&&!V&&(0,s.jsx)(`div`,{className:`turn-arrow right`,children:`◀ THEIR TURN`}),V&&(0,s.jsx)(`div`,{className:`thinking-label`,children:`THROWING...`})]})]}),(0,s.jsxs)(`div`,{className:`match-body`,children:[(0,s.jsx)(`div`,{className:`match-stage-wrap`,children:I===`player`&&W?(0,s.jsxs)(`div`,{className:`cam-view`,children:[(0,s.jsx)(`video`,{ref:u,autoPlay:!0,playsInline:!0,muted:!0,style:{transform:`scale(${Ne})`}}),(0,s.jsx)(`div`,{className:`cam-hud`,children:(0,s.jsxs)(`div`,{className:`cam-controls`,children:[(0,s.jsxs)(`div`,{className:`zoom-group`,children:[(0,s.jsx)(`button`,{onClick:e=>{e.stopPropagation(),X(e=>Math.min(5,e+.5))},className:`cam-btn`,children:`+`}),(0,s.jsxs)(`span`,{className:`zoom-val`,children:[Math.round(Ne*100),`%`]}),(0,s.jsx)(`button`,{onClick:e=>{e.stopPropagation(),X(e=>Math.max(1,e-.5))},className:`cam-btn`,children:`−`})]}),(0,s.jsx)(`button`,{onClick:e=>{e.stopPropagation(),Pe()},className:`cam-btn flip`,children:`🔄`})]})})]}):(0,s.jsxs)(`div`,{className:`dart-cards-view`,children:[(0,s.jsx)(`div`,{className:`dart-cards-container`,children:[0,1,2].map(e=>{let t=H[e],n=t?.label?.startsWith(`T`),r=t?.label?.startsWith(`D`),i=t?.label===`BULL`,ee=t?.label===`MISS`;return(0,s.jsx)(`div`,{className:`dart-card ${t?`filled `+(n?`treble`:r?`dbl`:i?`bull`:ee?`miss`:``):`empty`}`,style:{animationDelay:`${e*.15}s`},children:t?(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(`div`,{className:`dart-label`,children:t.label}),(0,s.jsx)(`div`,{className:`dart-value`,children:t.value})]}):(0,s.jsx)(`div`,{className:`dart-placeholder`,children:`🎯`})},e)})}),H.length>0&&(0,s.jsxs)(`div`,{className:`dart-total`,children:[`= `,H.reduce((e,t)=>e+t.value,0)]}),I===`bot`&&V&&(0,s.jsx)(`div`,{className:`dart-thinking`,children:`THROWING...`})]})}),(0,s.jsxs)(`aside`,{className:`match-sidebar`,children:[(0,s.jsxs)(`div`,{className:`scoring-module ${I===`player`?``:`blocked`}`,children:[(0,s.jsx)(`div`,{className:`lcd`,children:R||`0`}),(0,s.jsx)(`div`,{className:`keypad`,children:[1,2,3,4,5,6,7,8,9,`DEL`,0,`ENTER`].map(e=>(0,s.jsx)(`button`,{className:`key ${e===`ENTER`?`enter`:``} ${e===`DEL`?`del`:``}`,onClick:()=>{e===`DEL`?z(e=>e.slice(0,-1)):e===`ENTER`?Ie(R):R.length<3&&z(t=>t+e)},children:e},e))})]}),(0,s.jsxs)(`div`,{className:`history-module`,children:[(0,s.jsxs)(`div`,{className:`history-header`,children:[(0,s.jsx)(`span`,{children:`SHOT LOG`}),(0,s.jsx)(`button`,{className:`exit-btn`,onClick:()=>{window.confirm(`Quit match?`)&&m(!1)},children:`EXIT`})]}),(0,s.jsxs)(`div`,{className:`history-scroll`,children:[we.length===0&&(0,s.jsx)(`div`,{className:`history-empty`,children:`No throws yet`}),we.map((e,t)=>(0,s.jsxs)(`div`,{className:`history-row ${e.who}`,children:[(0,s.jsx)(`span`,{className:`hw`,children:e.who===`player`?`YOU`:`OPP`}),(0,s.jsxs)(`span`,{className:`hs`,children:[e.score,e.result===`BUST`?` 💥`:``]}),(0,s.jsx)(`span`,{className:`hr`,children:e.remaining})]},t))]})]})]})]}),(0,s.jsx)(`style`,{children:`
            .match-header { display: flex; align-items: center; gap: 12px; padding: 12px 20px; background: var(--bg-card); backdrop-filter: blur(20px); border-bottom: 1px solid var(--border); flex-shrink: 0; }
            .player-card { flex: 1; padding: 12px 20px; border-radius: var(--border-radius-md); background: rgba(255,255,255,0.03); border: 1px solid var(--border); position: relative; transition: 0.3s; min-width: 0; }
            .player-card.active { border-color: var(--accent-cyan); box-shadow: 0 0 30px var(--accent-cyan-glow), inset 0 0 30px rgba(56, 189, 248, 0.05); background: rgba(56, 189, 248, 0.06); }
            .player-card.right { text-align: right; }
            .player-card-top { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
            .player-card.right .player-card-top { justify-content: flex-end; }
            .player-name { font-weight: 900; font-size: 0.85rem; color: white; letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .player-badge { font-size: 0.6rem; font-weight: 800; background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 4px; color: var(--text-muted); white-space: nowrap; }
            .player-score { font-size: 4.5rem; font-weight: 900; line-height: 1; color: white; font-variant-numeric: tabular-nums; }
            .player-card.right .player-score { text-align: right; }
            .player-darts { display: flex; gap: 4px; margin-top: 6px; }
            .player-card.right .player-darts { justify-content: flex-end; }
            .dart-chip { background: var(--accent-cyan); color: black; font-size: 0.6rem; font-weight: 900; padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.3); }
            .turn-arrow { position: absolute; bottom: -10px; left: 0; font-size: 0.6rem; font-weight: 900; color: var(--accent-cyan); letter-spacing: 1px; animation: pulse-arrow 1.5s ease-in-out infinite; }
            .turn-arrow.right { left: auto; right: 0; }
            @keyframes pulse-arrow { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
            .thinking-dots { animation: blink-dots 1s step-end infinite; }
            @keyframes blink-dots { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
            .thinking-label { font-size: 0.65rem; font-weight: 800; color: var(--warning); letter-spacing: 1px; margin-top: 4px; }

            .match-divider { display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0; }
            .vs-text { font-size: 0.7rem; font-weight: 900; color: var(--text-muted); letter-spacing: 2px; }

            .match-body { display: grid; grid-template-columns: 1.6fr 1fr; gap: 12px; flex: 1; padding: 12px 20px 20px; min-height: 0; overflow: hidden; }

            .match-stage-wrap { border-radius: var(--border-radius-lg); overflow: hidden; background: #000; border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; position: relative; }
            .cam-view { width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; }
            .cam-view video { width: 100%; height: 100%; object-fit: contain; }
            .cam-hud { position: absolute; bottom: 16px; right: 16px; pointer-events: none; }
            .cam-controls { display: flex; gap: 8px; pointer-events: auto; }
            .zoom-group { display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.75); backdrop-filter: blur(8px); padding: 6px 12px; border-radius: 10px; border: 1px solid var(--border); }
            .cam-btn { width: 36px; height: 36px; border-radius: 8px; background: rgba(255,255,255,0.08); border: none; color: white; font-weight: 900; font-size: 1.1rem; cursor: pointer; transition: 0.15s; display: flex; align-items: center; justify-content: center; }
            .cam-btn:hover { background: rgba(255,255,255,0.15); }
            .cam-btn.flip { font-size: 1rem; }
            .zoom-val { font-size: 0.7rem; font-weight: 800; color: white; min-width: 36px; text-align: center; }
            .dart-cards-view { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; padding: 20px; }
            .dart-cards-container { display: flex; gap: 20px; align-items: center; }
            .dart-card { width: 120px; height: 150px; border-radius: 16px; background: var(--bg-card); backdrop-filter: blur(20px); border: 1px solid var(--border); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; transition: 0.3s; animation: card-pop 0.4s ease-out both; }
            .dart-card.filled { border-color: rgba(255,255,255,0.15); background: rgba(15,23,42,0.9); }
            .dart-card.treble { border-color: var(--accent-cyan); box-shadow: 0 0 24px var(--accent-cyan-glow); }
            .dart-card.dbl { border-color: #22c55e; box-shadow: 0 0 24px rgba(34,197,94,0.3); }
            .dart-card.bull { border-color: #eab308; box-shadow: 0 0 24px rgba(234,179,8,0.3); }
            .dart-card.miss { border-color: var(--error); opacity: 0.5; }
            .dart-card.empty { opacity: 0.2; }
            .dart-label { font-size: 1.6rem; font-weight: 900; color: white; }
            .dart-card.treble .dart-label { color: var(--accent-cyan); }
            .dart-card.dbl .dart-label { color: #22c55e; }
            .dart-card.bull .dart-label { color: #eab308; }
            .dart-card.miss .dart-label { color: var(--error); }
            .dart-value { font-size: 2rem; font-weight: 900; color: rgba(255,255,255,0.5); }
            .dart-placeholder { font-size: 1.8rem; opacity: 0.4; }
            .dart-total { font-size: 1.6rem; font-weight: 900; color: rgba(255,255,255,0.7); letter-spacing: 2px; }
            .dart-thinking { font-size: 0.75rem; font-weight: 800; color: var(--accent-cyan); letter-spacing: 2px; animation: pulse-arrow 1.2s ease-in-out infinite; }
            @keyframes card-pop { 0% { transform: scale(0.8) translateY(20px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } }

            .match-sidebar { display: flex; flex-direction: column; gap: 12px; min-height: 0; }
            .scoring-module { background: var(--bg-card); backdrop-filter: blur(20px); border: 1px solid var(--border); border-radius: var(--border-radius-lg); padding: 20px; transition: 0.3s; }
            .scoring-module.blocked { opacity: 0.25; pointer-events: none; }
            .lcd { background: rgba(0,0,0,0.5); padding: 12px; border-radius: 12px; border: 2px solid var(--accent-cyan); font-size: 3.5rem; font-weight: 900; color: var(--accent-cyan); text-align: center; text-shadow: 0 0 16px var(--accent-cyan-glow); margin-bottom: 12px; font-variant-numeric: tabular-nums; }
            .keypad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
            .key { height: 58px; border-radius: 10px; background: rgba(255,255,255,0.04); border: 1px solid var(--border); color: white; font-weight: 800; font-size: 1.3rem; cursor: pointer; transition: 0.15s; display: flex; align-items: center; justify-content: center; }
            .key:hover { background: rgba(255,255,255,0.08); }
            .key:active { transform: scale(0.95); }
            .key.enter { background: var(--accent-primary); border-color: var(--accent-primary); color: white; box-shadow: 0 4px 16px var(--accent-purple-glow); }
            .key.enter:hover { background: var(--accent-hover); }
            .key.del { color: var(--text-muted); }

            .history-module { flex: 1; display: flex; flex-direction: column; background: var(--bg-card); backdrop-filter: blur(20px); border: 1px solid var(--border); border-radius: var(--border-radius-lg); padding: 16px 20px; min-height: 0; }
            .history-header { display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: 0.75rem; color: white; letter-spacing: 1px; margin-bottom: 12px; flex-shrink: 0; }
            .exit-btn { padding: 6px 14px; border-radius: 6px; border: 1px solid var(--border); background: rgba(255,255,255,0.04); color: var(--text-muted); font-weight: 700; font-size: 0.65rem; cursor: pointer; transition: 0.15s; }
            .exit-btn:hover { background: rgba(239,68,68,0.15); border-color: var(--error); color: var(--error); }
            .history-scroll { flex: 1; overflow-y: auto; }
            .history-empty { text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 30px 0; }
            .history-row { display: flex; align-items: center; gap: 8px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.04); font-weight: 800; font-size: 0.85rem; }
            .history-row.player .hw { color: var(--accent-cyan); }
            .history-row .hw { width: 36px; font-size: 0.7rem; flex-shrink: 0; }
            .history-row .hs { flex: 1; text-align: center; }
            .history-row .hr { width: 44px; text-align: right; color: var(--text-muted); font-size: 0.75rem; }

            @media (max-width: 1200px) {
                .match-body { grid-template-columns: 1fr; overflow-y: auto; }
                .match-stage-wrap { min-height: 350px; flex-shrink: 0; }
                .match-sidebar { height: auto; }
                .player-score { font-size: 3.2rem; }
                .dart-card { width: 100px; height: 130px; }
                .dart-label { font-size: 1.3rem; }
                .dart-value { font-size: 1.6rem; }
            }
            @media (max-width: 600px) {
                .match-header { padding: 8px 12px; gap: 8px; }
                .player-card { padding: 8px 12px; }
                .player-score { font-size: 2.4rem; }
                .player-name { font-size: 0.7rem; }
                .match-body { padding: 8px 12px 12px; }
                .dart-card { width: 80px; height: 110px; }
                .dart-label { font-size: 1.1rem; }
                .dart-value { font-size: 1.3rem; }
                .dart-cards-container { gap: 10px; }
            }
        `})]}):(0,s.jsxs)(`div`,{className:`page animate-fade-in`,style:{maxWidth:`1100px`,margin:`0 auto`},children:[(0,s.jsx)(ie,{items:[{label:`Home`,path:`/home`},{label:`Match Setup`}]}),(0,s.jsxs)(`div`,{className:`setup-hero`,children:[(0,s.jsx)(`h1`,{className:`setup-title`,children:(0,s.jsx)(`span`,{className:`text-gradient`,children:`MATCH SETUP`})}),(0,s.jsx)(`p`,{className:`setup-subtitle`,children:`Configure your game — choose an opponent, format, and scoring`})]}),(0,s.jsxs)(`div`,{className:`setup-layout`,children:[(0,s.jsxs)(`div`,{className:`setup-card`,children:[(0,s.jsxs)(`div`,{className:`setup-card-header`,children:[(0,s.jsx)(`span`,{className:`step-badge`,children:`1`}),(0,s.jsx)(`span`,{children:`GAME MODE`})]}),(0,s.jsx)(`div`,{className:`setup-option-group`,children:oe.map(e=>(0,s.jsx)(`button`,{className:`opt-btn ${_===e?`active`:``}`,onClick:()=>ue(e),children:(0,s.jsx)(`span`,{className:`opt-val`,children:e})},e))}),(0,s.jsxs)(`div`,{className:`setup-card-header`,style:{marginTop:28},children:[(0,s.jsx)(`span`,{className:`step-badge`,children:`2`}),(0,s.jsx)(`span`,{children:`OPPONENT`})]}),(0,s.jsxs)(`div`,{className:`opponent-selector`,children:[(0,s.jsxs)(`button`,{className:`opp-btn ${v?`active`:``}`,onClick:()=>{y(!0),g(!1),E(null)},children:[(0,s.jsx)(`span`,{className:`opp-icon`,children:`🤖`}),(0,s.jsx)(`span`,{className:`opp-label`,children:`BOT`}),(0,s.jsx)(`span`,{className:`opp-desc`,children:`Play against AI`})]}),(0,s.jsxs)(`button`,{className:`opp-btn ${!v&&!h?`active`:``}`,onClick:()=>{y(!1),g(!1),E(null)},children:[(0,s.jsx)(`span`,{className:`opp-icon`,children:`👥`}),(0,s.jsx)(`span`,{className:`opp-label`,children:`LOCAL`}),(0,s.jsx)(`span`,{className:`opp-desc`,children:`Pass & play`})]}),(0,s.jsxs)(`button`,{className:`opp-btn ${h?`active`:``}`,onClick:()=>{y(!1),g(!0)},children:[(0,s.jsx)(`span`,{className:`opp-icon`,children:`🌐`}),(0,s.jsx)(`span`,{className:`opp-label`,children:`ONLINE`}),(0,s.jsx)(`span`,{className:`opp-desc`,children:`Challenge anyone`})]})]})]}),(0,s.jsxs)(`div`,{className:`setup-card`,children:[h?(0,s.jsxs)(s.Fragment,{children:[(0,s.jsxs)(`div`,{className:`setup-card-header`,children:[(0,s.jsx)(`span`,{className:`step-badge`,children:`3`}),(0,s.jsx)(`span`,{children:`SEARCH PLAYER`})]}),(0,s.jsxs)(`div`,{className:`search-wrap`,ref:f,children:[(0,s.jsx)(`input`,{className:`search-input`,type:`text`,placeholder:`Type a username...`,value:D,onChange:e=>{O(e.target.value),k(!0),E(null)},onFocus:()=>D.trim()&&k(!0)}),be&&Z.length>0&&(0,s.jsx)(`div`,{className:`search-results`,children:Z.map(e=>(0,s.jsxs)(`button`,{className:`search-result-item ${T?.id===e.id?`active`:``}`,onClick:()=>{E(e),O(e.username),k(!1)},children:[(0,s.jsx)(`div`,{className:`search-avatar`,children:e.username?.[0]?.toUpperCase()||`?`}),(0,s.jsxs)(`div`,{className:`search-info`,children:[(0,s.jsx)(`span`,{className:`search-name`,children:e.username}),(0,s.jsx)(`span`,{className:`search-status`,children:`Online`})]})]},e.id))}),be&&D.trim()&&Z.length===0&&(0,s.jsx)(`div`,{className:`search-results`,children:(0,s.jsx)(`div`,{className:`search-empty`,children:`No players found`})}),T&&(0,s.jsxs)(`div`,{className:`selected-player`,children:[(0,s.jsx)(`div`,{className:`search-avatar`,children:T.username?.[0]?.toUpperCase()||`?`}),(0,s.jsx)(`span`,{children:T.username}),(0,s.jsx)(`button`,{className:`clear-btn`,onClick:()=>{E(null),O(``)},children:`✕`})]})]})]}):v?(0,s.jsxs)(s.Fragment,{children:[(0,s.jsxs)(`div`,{className:`setup-card-header`,children:[(0,s.jsx)(`span`,{className:`step-badge`,children:`3`}),(0,s.jsx)(`span`,{children:`SELECT PRO BOT`})]}),(0,s.jsx)(`div`,{className:`pro-bot-grid`,children:a.getProBots().map(e=>(0,s.jsxs)(`button`,{className:`pro-bot-btn ${S.id===e.id?`active`:``}`,onClick:()=>pe(e),children:[(0,s.jsx)(`span`,{className:`pro-bot-icon`,children:e.icon}),(0,s.jsx)(`span`,{className:`pro-bot-name`,children:e.name}),(0,s.jsxs)(`span`,{className:`pro-bot-stats`,children:[e.avg,` · `,e.check,`%`]})]},e.id))}),S.id===`custom`&&(0,s.jsxs)(`div`,{className:`custom-controls`,children:[(0,s.jsxs)(`div`,{className:`slider-row`,children:[(0,s.jsxs)(`label`,{children:[`AVERAGE `,(0,s.jsx)(`strong`,{children:C})]}),(0,s.jsx)(`input`,{type:`range`,min:`20`,max:`110`,value:C,onChange:e=>me(Number(e.target.value))})]}),(0,s.jsxs)(`div`,{className:`slider-row`,children:[(0,s.jsxs)(`label`,{children:[`CHECKOUT `,(0,s.jsxs)(`strong`,{children:[w,`%`]})]}),(0,s.jsx)(`input`,{type:`range`,min:`5`,max:`60`,value:w,onChange:e=>he(Number(e.target.value))})]})]}),S.id!==`custom`&&(0,s.jsx)(`div`,{className:`bot-desc`,children:S.desc})]}):(0,s.jsxs)(`div`,{className:`local-hint`,children:[(0,s.jsx)(`span`,{className:`local-icon`,children:`🎯`}),(0,s.jsx)(`p`,{children:`Pass the device to your opponent when it's their turn. No setup needed.`})]}),(0,s.jsxs)(`div`,{className:`setup-card-header`,style:{marginTop:h?28:0},children:[(0,s.jsx)(`span`,{className:`step-badge`,children:h?4:3}),(0,s.jsx)(`span`,{children:`FORMAT`})]}),(0,s.jsx)(`div`,{className:`format-row`,children:se.map(e=>(0,s.jsx)(`button`,{className:`fmt-btn ${b===e.id?`active`:``}`,onClick:()=>de(e.id),children:e.label},e.id))}),(0,s.jsx)(`div`,{className:`legs-row`,children:[1,3,5,7,9,11,21].map(e=>(0,s.jsx)(`button`,{className:`leg-btn ${x===e?`active`:``}`,onClick:()=>fe(e),children:e},e))})]})]}),(0,s.jsxs)(`div`,{className:`setup-footer-bar`,children:[(0,s.jsxs)(`label`,{className:`camera-toggle`,children:[(0,s.jsx)(`input`,{type:`checkbox`,checked:W,onChange:e=>je(e.target.checked)}),(0,s.jsx)(`span`,{className:`toggle-track ${W?`on`:``}`,children:(0,s.jsx)(`span`,{className:`toggle-thumb`})}),(0,s.jsx)(`span`,{className:`toggle-label`,children:`Camera View`})]}),W&&(0,s.jsxs)(`div`,{className:`camera-preview-area`,children:[(0,s.jsxs)(`div`,{className:`camera-indicator`,children:[(0,s.jsx)(`span`,{className:`camera-dot ${J?`active`:`offline`}`}),J?`ACTIVE`:`STARTING...`]}),J&&(0,s.jsx)(`div`,{className:`camera-mini-preview`,children:(0,s.jsx)(`video`,{ref:u,autoPlay:!0,playsInline:!0,muted:!0})}),(0,s.jsx)(`select`,{className:`cam-select`,value:K,onChange:e=>q(e.target.value),children:G.map(e=>(0,s.jsx)(`option`,{value:e.deviceId,children:e.label||`Webcam`},e.deviceId))})]}),(0,s.jsxs)(`button`,{className:`start-btn`,onClick:Fe,disabled:h&&!T,children:[ve?`WAITING FOR ACCEPT...`:h&&T?`CHALLENGE ${T.username.toUpperCase()}`:`START MATCH`,(0,s.jsx)(`span`,{className:`start-arrow`,children:`🎯`})]})]}),(0,s.jsx)(`style`,{children:`
                .setup-hero { text-align: center; margin-bottom: 36px; }
                .setup-title { font-size: 2.4rem; font-weight: 900; letter-spacing: 2px; margin-bottom: 8px; }
                .setup-subtitle { color: var(--text-muted); font-size: 0.9rem; }

                .setup-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }

                .setup-card { background: var(--bg-card); backdrop-filter: blur(20px); border: 1px solid var(--border); border-radius: var(--border-radius-lg); padding: 28px; }
                .setup-card-header { display: flex; align-items: center; gap: 12px; font-weight: 800; font-size: 0.8rem; color: white; letter-spacing: 1.5px; margin-bottom: 16px; }
                .step-badge { width: 28px; height: 28px; border-radius: 50%; background: var(--accent-primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 900; }

                .setup-option-group { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
                .opt-btn { padding: 16px; border-radius: var(--border-radius-md); background: rgba(255,255,255,0.03); border: 1px solid var(--border); color: white; font-weight: 900; font-size: 1.2rem; cursor: pointer; transition: 0.2s; text-align: center; }
                .opt-btn.active { background: var(--accent-primary); border-color: var(--accent-primary); box-shadow: 0 0 20px var(--accent-purple-glow); }
                .opt-btn:hover { background: rgba(255,255,255,0.08); }

                .opponent-selector { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
                .opp-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 16px 8px; border-radius: var(--border-radius-md); background: rgba(255,255,255,0.03); border: 1px solid var(--border); cursor: pointer; transition: 0.2s; }
                .opp-btn.active { border-color: var(--accent-cyan); background: rgba(56, 189, 248, 0.1); box-shadow: 0 0 16px var(--accent-cyan-glow); }
                .opp-btn:hover { background: rgba(255,255,255,0.08); }
                .opp-icon { font-size: 1.8rem; }
                .opp-label { font-weight: 900; font-size: 0.85rem; color: white; }
                .opp-desc { font-size: 0.6rem; color: var(--text-muted); }

                .search-wrap { position: relative; }
                .search-input { width: 100%; padding: 14px 16px; border-radius: var(--border-radius-md); background: rgba(0,0,0,0.4); border: 1px solid var(--border); color: white; font-size: 0.95rem; outline: none; transition: 0.2s; }
                .search-input:focus { border-color: var(--accent-cyan); box-shadow: 0 0 12px var(--accent-cyan-glow); }
                .search-input::placeholder { color: var(--text-muted); }
                .search-results { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--border-radius-md); overflow: hidden; z-index: 50; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
                .search-result-item { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 16px; border: none; background: none; color: white; cursor: pointer; text-align: left; transition: 0.15s; }
                .search-result-item:hover, .search-result-item.active { background: rgba(56, 189, 248, 0.1); }
                .search-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--accent-primary); display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.9rem; flex-shrink: 0; }
                .search-info { display: flex; flex-direction: column; }
                .search-name { font-weight: 700; font-size: 0.85rem; }
                .search-status { font-size: 0.65rem; color: var(--success); }
                .search-empty { padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.85rem; }
                .selected-player { display: flex; align-items: center; gap: 10px; margin-top: 10px; padding: 10px 14px; background: rgba(56, 189, 248, 0.1); border: 1px solid var(--accent-cyan); border-radius: var(--border-radius-md); font-weight: 700; font-size: 0.9rem; }
                .clear-btn { margin-left: auto; width: 24px; height: 24px; border-radius: 50%; border: none; background: rgba(255,255,255,0.1); color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; }

                .pro-bot-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; max-height: 260px; overflow-y: auto; padding-right: 4px; scrollbar-width: thin; }
                .pro-bot-grid::-webkit-scrollbar { width: 4px; }
                .pro-bot-grid::-webkit-scrollbar-thumb { background: var(--accent-cyan); border-radius: 4px; }
                .pro-bot-btn { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 4px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--border); cursor: pointer; transition: 0.2s; }
                .pro-bot-btn.active { border-color: var(--accent-cyan); background: rgba(56, 189, 248, 0.12); box-shadow: 0 0 12px var(--accent-cyan-glow); }
                .pro-bot-btn:hover { background: rgba(255,255,255,0.07); }
                .pro-bot-icon { font-size: 1.1rem; }
                .pro-bot-name { font-size: 0.6rem; font-weight: 800; color: white; text-align: center; line-height: 1.1; }
                .pro-bot-stats { font-size: 0.55rem; color: var(--accent-cyan); font-weight: 700; }
                .bot-desc { font-size: 0.7rem; color: var(--text-muted); text-align: center; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px; margin-top: 10px; }
                .custom-controls { margin-top: 12px; display: flex; flex-direction: column; gap: 10px; }
                .slider-row { display: flex; flex-direction: column; gap: 4px; }
                .slider-row label { font-size: 0.7rem; font-weight: 700; color: var(--accent-cyan); display: flex; justify-content: space-between; }
                .slider-row label strong { color: white; }
                .slider-row input[type=range] { width: 100%; height: 5px; border-radius: 4px; background: var(--border); outline: none; -webkit-appearance: none; appearance: none; }
                .slider-row input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; border-radius: 50%; background: var(--accent-cyan); cursor: pointer; border: 2px solid white; }

                .local-hint { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 20px; text-align: center; color: var(--text-muted); font-size: 0.85rem; }
                .local-icon { font-size: 3rem; }

                .format-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
                .fmt-btn { padding: 14px; border-radius: var(--border-radius-md); background: rgba(255,255,255,0.03); border: 1px solid var(--border); color: white; font-weight: 800; cursor: pointer; transition: 0.2s; font-size: 0.9rem; }
                .fmt-btn.active { background: var(--accent-primary); border-color: var(--accent-primary); box-shadow: 0 0 16px var(--accent-purple-glow); }
                .fmt-btn:hover { background: rgba(255,255,255,0.07); }
                .legs-row { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
                .leg-btn { padding: 12px; border-radius: var(--border-radius-sm); background: rgba(255,255,255,0.03); border: 1px solid var(--border); color: white; font-weight: 800; cursor: pointer; transition: 0.2s; font-size: 0.8rem; }
                .leg-btn.active { background: var(--accent-primary); border-color: var(--accent-primary); }
                .leg-btn:hover { background: rgba(255,255,255,0.07); }

                .setup-footer-bar { display: flex; align-items: center; gap: 20px; background: var(--bg-card); backdrop-filter: blur(20px); border: 1px solid var(--border); border-radius: var(--border-radius-lg); padding: 20px 28px; margin-top: 4px; flex-wrap: wrap; }
                .camera-toggle { display: flex; align-items: center; gap: 10px; cursor: pointer; user-select: none; }
                .toggle-track { width: 44px; height: 24px; border-radius: 12px; background: rgba(255,255,255,0.15); position: relative; transition: 0.25s; flex-shrink: 0; }
                .toggle-track.on { background: var(--accent-cyan); }
                .toggle-thumb { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: white; transition: 0.25s; box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
                .toggle-track.on .toggle-thumb { left: 22px; }
                .toggle-label { font-weight: 700; font-size: 0.8rem; color: white; }
                .camera-toggle input { display: none; }

                .camera-preview-area { display: flex; align-items: center; gap: 12px; }
                .camera-indicator { display: flex; align-items: center; gap: 6px; font-size: 0.65rem; font-weight: 800; color: var(--accent-cyan); letter-spacing: 0.5px; }
                .camera-dot { width: 8px; height: 8px; border-radius: 50%; background: #555; display: inline-block; flex-shrink: 0; }
                .camera-dot.active { background: #00ff88; box-shadow: 0 0 8px #00ff88; animation: pulse-dot 1.5s ease-in-out infinite; }
                .camera-dot.offline { background: #ff8800; box-shadow: 0 0 8px #ff8800; animation: pulse-dot 1s ease-in-out infinite; }
                .camera-mini-preview { border-radius: 8px; overflow: hidden; border: 1px solid var(--accent-cyan); background: #000; max-height: 60px; width: 80px; flex-shrink: 0; }
                .camera-mini-preview video { width: 100%; height: 100%; object-fit: cover; display: block; }
                .cam-select { background: rgba(0,0,0,0.4); border: 1px solid var(--border); color: white; padding: 8px 10px; border-radius: var(--border-radius-sm); font-size: 0.7rem; font-weight: 600; max-width: 140px; }

                .start-btn { margin-left: auto; display: flex; align-items: center; gap: 12px; padding: 16px 36px; border-radius: var(--border-radius-md); border: none; background: linear-gradient(135deg, var(--accent-primary), #6344ef); color: white; font-weight: 900; font-size: 1rem; cursor: pointer; transition: 0.25s; box-shadow: 0 8px 24px rgba(129, 140, 248, 0.3); letter-spacing: 1px; white-space: nowrap; }
                .start-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(129, 140, 248, 0.4); }
                .start-btn:disabled { opacity: 0.4; cursor: not-allowed; }
                .start-arrow { font-size: 1.2rem; }

                @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

                @media (max-width: 900px) {
                    .setup-layout { grid-template-columns: 1fr; }
                    .setup-footer-bar { flex-direction: column; align-items: stretch; }
                    .start-btn { margin-left: 0; justify-content: center; }
                    .camera-preview-area { flex-wrap: wrap; }
                    .pro-bot-grid { grid-template-columns: repeat(3, 1fr); }
                }
            `})]})}export{c as default};