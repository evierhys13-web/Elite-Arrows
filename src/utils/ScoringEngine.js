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
    // Standard board proportions:
    // Bullseye: 0.0 - 0.08
    // Single: 0.08 - 0.58
    // Treble: 0.58 - 0.65
    // Single: 0.65 - 0.95
    // Double: 0.95 - 1.05

    if (ratio >= 0.58 && ratio <= 0.65) return { value: baseValue * 3, label: `T${baseValue}` };
    if (ratio >= 0.95 && ratio <= 1.05) return { value: baseValue * 2, label: `D${baseValue}` };

    return { value: baseValue, label: `S${baseValue}` };
  }
}
