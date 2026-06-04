import { useMemo } from 'react';

const SEGMENTS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const DARK = '#1a1a2e';
const LIGHT = '#e8d5b7';
const RED = '#d32f2f';
const COLORS = ['#1a1a2e', '#e8d5b7', '#d32f2f', '#e8d5b7', '#1a1a2e', '#e8d5b7', '#d32f2f', '#e8d5b7', '#1a1a2e', '#e8d5b7', '#d32f2f', '#e8d5b7', '#1a1a2e', '#e8d5b7', '#d32f2f', '#e8d5b7', '#1a1a2e', '#e8d5b7', '#d32f2f', '#e8d5b7'];

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, r1, r2, startAngle, endAngle) {
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
  const bullRadius = R * 0.04;
  const outerBullRadius = R * 0.10;
  const tripleInner = R * 0.52;
  const tripleOuter = R * 0.60;
  const doubleInner = R * 0.82;
  const doubleOuter = R * 0.97;
  const wireColor = '#555';
  const wireWidth = 1.5;

  const dartMarkers = useMemo(() => {
    return lastDarts.map((dart, i) => {
      let r = 0;
      let angle = 0;
      const label = dart.label || '';
      const value = dart.value;

      if (label === 'BULL') {
        r = bullRadius;
        angle = Math.random() * 360;
      } else if (label === '25') {
        r = outerBullRadius * 0.7;
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
  }, [lastDarts, center, R, bullRadius, outerBullRadius, tripleInner, tripleOuter, doubleInner, doubleOuter]);

  const segmentsJsx = [];
  for (let i = 0; i < 20; i++) {
    const startAngle = i * 18;
    const endAngle = (i + 1) * 18;
    const color = COLORS[i];

    segmentsJsx.push(
      <g key={i}>
        <path d={describeArc(center, center, outerBullRadius, doubleOuter, startAngle, endAngle)} fill={color} stroke={wireColor} strokeWidth={wireWidth} />
        <path d={describeArc(center, center, tripleOuter, doubleInner, startAngle, endAngle)} fill={color} stroke={wireColor} strokeWidth={wireWidth} />
        <text
          x={polarToCartesian(center, center, R * 0.73, startAngle + 9).x}
          y={polarToCartesian(center, center, R * 0.73, startAngle + 9).y}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
          fontSize={R * 0.06}
          fontWeight="bold"
          style={{ pointerEvents: 'none' }}
        >
          {SEGMENTS[i]}
        </text>
      </g>
    );
  }

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r={doubleOuter + 2} fill="#222" />

        {segmentsJsx}

        {/* Triple ring fill */}
        <circle cx={center} cy={center} r={tripleOuter} fill="none" stroke={wireColor} strokeWidth={wireWidth} />
        <circle cx={center} cy={center} r={tripleInner} fill="none" stroke={wireColor} strokeWidth={wireWidth} />

        {/* Double ring fill */}
        <circle cx={center} cy={center} r={doubleOuter} fill="none" stroke={wireColor} strokeWidth={wireWidth} />
        <circle cx={center} cy={center} r={doubleInner} fill="none" stroke={wireColor} strokeWidth={wireWidth} />

        {/* Outer bull */}
        <circle cx={center} cy={center} r={outerBullRadius} fill={RED} stroke={wireColor} strokeWidth={wireWidth} />
        {/* Inner bull */}
        <circle cx={center} cy={center} r={bullRadius} fill={DARK} stroke={wireColor} strokeWidth={wireWidth} />

        {/* Spider / wire spokes */}
        {Array.from({ length: 20 }).map((_, i) => {
          const a = (i * 18 - 90) * Math.PI / 180;
          const x2 = center + doubleOuter * Math.cos(a);
          const y2 = center + doubleOuter * Math.sin(a);
          return <line key={i} x1={center} y1={center} x2={x2} y2={y2} stroke={wireColor} strokeWidth={wireWidth} opacity={0.3} />;
        })}

        {/* Dart markers */}
        {dartMarkers.map(marker => (
          <g key={marker.id}>
            <circle cx={marker.x} cy={marker.y} r={6} fill="red" stroke="white" strokeWidth={2} />
            <text x={marker.x} y={marker.y - 14} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold" stroke="#000" strokeWidth={0.5}>
              {marker.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
