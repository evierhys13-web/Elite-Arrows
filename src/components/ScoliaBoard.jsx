import { useMemo } from 'react';

const SEGMENTS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const BLACK = '#111111';
const CREAM = '#f5e6c8';
const RED = '#c62828';
const GREEN = '#2e7d32';

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeAnnulus(cx, cy, r1, r2, startAngle, endAngle) {
  const s1 = polarToCartesian(cx, cy, r1, endAngle);
  const s2 = polarToCartesian(cx, cy, r2, endAngle);
  const e1 = polarToCartesian(cx, cy, r2, startAngle);
  const e2 = polarToCartesian(cx, cy, r1, startAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${s1.x} ${s1.y} L ${s2.x} ${s2.y} A ${r2} ${r2} 0 ${large} 0 ${e1.x} ${e1.y} L ${e2.x} ${e2.y} A ${r1} ${r1} 0 ${large} 1 ${s1.x} ${s1.y} Z`;
}

export default function ScoliaBoard({ lastDarts = [], size = 300 }) {
  const center = size / 2;
  const R = size * 0.44;
  const bullInner = R * 0.035;
  const bullOuter = R * 0.09;
  const tripleInner = R * 0.52;
  const tripleOuter = R * 0.60;
  const doubleInner = R * 0.82;
  const doubleOuter = R * 0.97;
  const wireColor = '#666';
  const wireWidth = 1.2;

  const dartMarkers = useMemo(() => {
    return lastDarts.map((dart, i) => {
      let r = 0;
      let angle = 0;
      const label = dart.label || '';
      const value = dart.value;

      if (label === 'BULL') {
        r = bullInner * 0.6;
        angle = Math.random() * 360;
      } else if (label === '25') {
        r = bullOuter * 0.7;
        angle = Math.random() * 360;
      } else {
        const segVal = parseInt(label.replace(/[^0-9]/g, '')) || value;
        const idx = SEGMENTS.indexOf(segVal);
        angle = (idx * 18) - 90;

        if (label.startsWith('T')) r = tripleInner + (tripleOuter - tripleInner) * 0.5;
        else if (label.startsWith('D')) r = doubleInner + (doubleOuter - doubleInner) * 0.5;
        else r = R * 0.28 + (Math.random() * R * 0.18);
        angle += (Math.random() - 0.5) * 10;
      }

      const x = center + r * Math.cos(angle * Math.PI / 180);
      const y = center + r * Math.sin(angle * Math.PI / 180);
      return { x, y, id: i, label };
    });
  }, [lastDarts, center, R, bullInner, bullOuter, tripleInner, tripleOuter, doubleInner, doubleOuter]);

  const segmentsJsx = [];
  for (let i = 0; i < 20; i++) {
    const startAngle = i * 18;
    const endAngle = (i + 1) * 18;
    const baseColor = i % 2 === 0 ? BLACK : CREAM;
    const ringColor = i % 2 === 0 ? GREEN : RED;
    const textColor = i % 2 === 0 ? '#fff' : '#000';

    segmentsJsx.push(
      <g key={i}>
        <path d={describeAnnulus(center, center, bullOuter, tripleInner, startAngle, endAngle)} fill={baseColor} />
        <path d={describeAnnulus(center, center, tripleOuter, doubleInner, startAngle, endAngle)} fill={baseColor} />
        <path d={describeAnnulus(center, center, tripleInner, tripleOuter, startAngle, endAngle)} fill={ringColor} />
        <path d={describeAnnulus(center, center, doubleInner, doubleOuter, startAngle, endAngle)} fill={ringColor} />
        <text
          x={polarToCartesian(center, center, R * 0.73, startAngle + 9).x}
          y={polarToCartesian(center, center, R * 0.73, startAngle + 9).y}
          textAnchor="middle"
          dominantBaseline="central"
          fill={textColor}
          fontSize={R * 0.065}
          fontWeight="900"
          style={{ pointerEvents: 'none', fontFamily: 'system-ui, sans-serif' }}
        >
          {SEGMENTS[i]}
        </text>
      </g>
    );
  }

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r={doubleOuter + 3} fill="#1a1a1a" />

        {segmentsJsx}

        {/* Ring outlines */}
        <circle cx={center} cy={center} r={tripleOuter} fill="none" stroke={wireColor} strokeWidth={wireWidth} />
        <circle cx={center} cy={center} r={tripleInner} fill="none" stroke={wireColor} strokeWidth={wireWidth} />
        <circle cx={center} cy={center} r={doubleOuter} fill="none" stroke={wireColor} strokeWidth={wireWidth} />
        <circle cx={center} cy={center} r={doubleInner} fill="none" stroke={wireColor} strokeWidth={wireWidth} />
        <circle cx={center} cy={center} r={bullOuter} fill="none" stroke={wireColor} strokeWidth={wireWidth} />

        {/* Outer bull (25) */}
        <circle cx={center} cy={center} r={bullOuter} fill={GREEN} />
        <circle cx={center} cy={center} r={bullOuter} fill="none" stroke={wireColor} strokeWidth={wireWidth} />

        {/* Inner bull (50) */}
        <circle cx={center} cy={center} r={bullInner} fill={RED} />
        <circle cx={center} cy={center} r={bullInner} fill="none" stroke={wireColor} strokeWidth={wireWidth} />

        {/* Spider wires */}
        {Array.from({ length: 20 }).map((_, i) => {
          const a = (i * 18 - 90) * Math.PI / 180;
          const x2 = center + doubleOuter * Math.cos(a);
          const y2 = center + doubleOuter * Math.sin(a);
          const x1 = center + bullOuter * Math.cos(a);
          const y1 = center + bullOuter * Math.sin(a);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={wireColor} strokeWidth={wireWidth * 1.2} />;
        })}

        {/* Dart markers */}
        {dartMarkers.map(marker => (
          <g key={marker.id}>
            <circle cx={marker.x} cy={marker.y} r={6} fill="#ef4444" stroke="#fff" strokeWidth={2} />
            <text x={marker.x} y={marker.y - 14} textAnchor="middle" fill="#fff" fontSize={11} fontWeight="900" stroke="#000" strokeWidth={0.5}>
              {marker.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
