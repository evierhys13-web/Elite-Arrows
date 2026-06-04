import { useMemo } from 'react';

const SEGMENTS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const BLACK = '#1a1a1a';
const CREAM = '#f0e0c0';
const RED = '#b71c1c';
const GREEN = '#1b5e20';

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function wedgePath(cx, cy, r1, r2, a1, a2) {
  const s1 = polarToCartesian(cx, cy, r1, a2);
  const s2 = polarToCartesian(cx, cy, r2, a2);
  const e1 = polarToCartesian(cx, cy, r2, a1);
  const e2 = polarToCartesian(cx, cy, r1, a1);
  const large = a2 - a1 > 180 ? 1 : 0;
  return `M ${s1.x} ${s1.y} L ${s2.x} ${s2.y} A ${r2} ${r2} 0 ${large} 0 ${e1.x} ${e1.y} L ${e2.x} ${e2.y} A ${r1} ${r1} 0 ${large} 1 ${s1.x} ${s1.y} Z`;
}

export default function ScoliaBoard({ lastDarts = [], size = 300 }) {
  const center = size / 2;
  const R = size * 0.44;
  const rBullInner = R * 0.04;
  const rBullOuter = R * 0.10;
  const rTripleInner = R * 0.52;
  const rTripleOuter = R * 0.60;
  const rDoubleInner = R * 0.82;
  const rDoubleOuter = R * 0.96;
  const rNumberRing = R * 1.02;
  const wire = '#888';
  const wireW = 1;

  const dartMarkers = useMemo(() => {
    return lastDarts.map((dart, i) => {
      const label = dart.label || '';
      const value = dart.value;
      let r, angle;

      if (label === 'BULL') {
        r = rBullInner * 0.6;
        angle = Math.random() * 360;
      } else if (label === '25') {
        r = rBullOuter * 0.7;
        angle = Math.random() * 360;
      } else {
        const segVal = parseInt(label.replace(/[^0-9]/g, '')) || value;
        const idx = SEGMENTS.indexOf(segVal);
        if (idx === -1) return null;
        angle = (idx * 18 + 9) - 90;

        if (label.startsWith('T')) r = rTripleInner + (rTripleOuter - rTripleInner) * 0.5;
        else if (label.startsWith('D')) r = rDoubleInner + (rDoubleOuter - rDoubleInner) * 0.5;
        else r = R * 0.28 + (Math.random() * R * 0.18);

        angle += (Math.random() - 0.5) * 8;
      }

      const x = center + r * Math.cos(angle * Math.PI / 180);
      const y = center + r * Math.sin(angle * Math.PI / 180);
      return { x, y, id: i, label };
    }).filter(Boolean);
  }, [lastDarts, center, R, rBullInner, rBullOuter, rTripleInner, rTripleOuter, rDoubleInner, rDoubleOuter]);

  const segs = [];
  for (let i = 0; i < 20; i++) {
    const a1 = i * 18 - 9;
    const a2 = (i + 1) * 18 - 9;
    const base = i % 2 === 0 ? BLACK : CREAM;
    const ring = i % 2 === 0 ? GREEN : RED;
    const txtCol = i % 2 === 0 ? '#fff' : '#222';

    segs.push(
      <g key={i}>
        <path d={wedgePath(center, center, rBullOuter, rTripleInner, a1, a2)} fill={base} />
        <path d={wedgePath(center, center, rTripleOuter, rDoubleInner, a1, a2)} fill={base} />
        <path d={wedgePath(center, center, rTripleInner, rTripleOuter, a1, a2)} fill={ring} />
        <path d={wedgePath(center, center, rDoubleInner, rDoubleOuter, a1, a2)} fill={ring} />
        <text
          x={polarToCartesian(center, center, R * 0.73, a1 + 9).x}
          y={polarToCartesian(center, center, R * 0.73, a1 + 9).y}
          textAnchor="middle" dominantBaseline="central"
          fill={txtCol}
          fontSize={R * 0.07}
          fontWeight="900"
          style={{ pointerEvents: 'none', fontFamily: 'Arial, system-ui, sans-serif' }}
        >
          {SEGMENTS[i]}
        </text>
      </g>
    );
  }

  const spiderLines = Array.from({ length: 20 }, (_, i) => {
    const a = ((i * 18 - 9) - 90) * Math.PI / 180;
    return (
      <line
        key={i}
        x1={center + rBullOuter * Math.cos(a)}
        y1={center + rBullOuter * Math.sin(a)}
        x2={center + rDoubleOuter * Math.cos(a)}
        y2={center + rDoubleOuter * Math.sin(a)}
        stroke={wire} strokeWidth={wireW}
      />
    );
  });

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background / number ring */}
        <circle cx={center} cy={center} r={rNumberRing + 4} fill="#111" />
        <circle cx={center} cy={center} r={rNumberRing} fill="none" stroke="#333" strokeWidth={2} />

        {/* Number labels on outer ring */}
        {SEGMENTS.map((num, i) => {
          const a = (i * 18 + 9) - 90;
          const r = rNumberRing + 12;
          const p = polarToCartesian(center, center, r, a);
          return (
            <text
              key={num}
              x={p.x} y={p.y}
              textAnchor="middle" dominantBaseline="central"
              fill="#ccc" fontSize={R * 0.08} fontWeight="bold"
              style={{ fontFamily: 'Arial, sans-serif' }}
            >
              {num}
            </text>
          );
        })}

        {segs}

        {/* Ring outlines */}
        <circle cx={center} cy={center} r={rTripleOuter} fill="none" stroke={wire} strokeWidth={wireW} />
        <circle cx={center} cy={center} r={rTripleInner} fill="none" stroke={wire} strokeWidth={wireW} />
        <circle cx={center} cy={center} r={rDoubleOuter} fill="none" stroke={wire} strokeWidth={wireW} />
        <circle cx={center} cy={center} r={rDoubleInner} fill="none" stroke={wire} strokeWidth={wireW} />

        {/* Bull */}
        <circle cx={center} cy={center} r={rBullOuter} fill={GREEN} />
        <circle cx={center} cy={center} r={rBullOuter} fill="none" stroke={wire} strokeWidth={wireW} />
        <circle cx={center} cy={center} r={rBullInner} fill={RED} />
        <circle cx={center} cy={center} r={rBullInner} fill="none" stroke={wire} strokeWidth={wireW} />

        {spiderLines}

        {/* Dart markers */}
        {dartMarkers.map(m => (
          <g key={m.id}>
            <circle cx={m.x} cy={m.y} r={6} fill="#ef4444" stroke="#fff" strokeWidth={2} />
            <text x={m.x} y={m.y - 14} textAnchor="middle" fill="#fff" fontSize={11} fontWeight="900" stroke="#000" strokeWidth={0.5}>
              {m.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
