export class ScoringEngine {
  constructor() {
    this.segments = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  }

  calculateScore(x, y, centerX, centerY, radius) {
    const dx = x - centerX;
    const dy = y - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Normalize distance based on radius (radius is Bullseye to Double Out wire)
    const ratio = dist / radius;

    if (ratio < 0.03) return { value: 50, label: 'D-BULL' };
    if (ratio < 0.08) return { value: 25, label: 'S-BULL' };
    if (ratio > 1.05) return { value: 0, label: 'MISS' };

    // Calculate angle in degrees (0 is top 20)
    let angle = Math.atan2(-dx, dy) * (180 / Math.PI) + 180;

    // Rotate 9 degrees so each segment is centered
    angle = (angle + 9) % 360;
    const segmentIndex = Math.floor(angle / 18);
    const baseValue = this.segments[segmentIndex];

    // Multipliers based on ratio
    // Standard board proportions relative to radius (radius is bull center to outer double wire)
    const bullOuter = 0.12;
    const bullInner = 0.05;
    const tripleInner = 0.58;
    const tripleOuter = 0.65;
    const doubleInner = 0.95;
    const doubleOuter = 1.02;

    if (ratio <= bullInner) return { value: 50, label: 'D-BULL' };
    if (ratio <= bullOuter) return { value: 25, label: 'S-BULL' };
    if (ratio > doubleOuter) return { value: 0, label: 'MISS' };

    // Calculate angle in degrees (0 is top 20)
    let angle = Math.atan2(-dx, dy) * (180 / Math.PI) + 180;

    // Rotate 9 degrees so each segment is centered
    angle = (angle + 9) % 360;
    const segmentIndex = Math.floor(angle / 18);
    const baseValue = this.segments[segmentIndex];

    if (ratio >= tripleInner && ratio <= tripleOuter) return { value: baseValue * 3, label: `T${baseValue}` };
    if (ratio >= doubleInner && ratio <= doubleOuter) return { value: baseValue * 2, label: `D${baseValue}` };

    return { value: baseValue, label: `S${baseValue}` };
  }
}
