export const DIVISIONS = [
  "Elite",
  "Emerald",
  "Diamond",
  "Platinum",
];

export const DIVISION_FORMATS = {
  "Pro League": { bestOf: 15, firstTo: 8, noDraw: true },
  Elite: { bestOf: 8, firstTo: 5, noDraw: false },
  Emerald: { bestOf: 8, firstTo: 5, noDraw: false },
  Diamond: { bestOf: 8, firstTo: 5, noDraw: false },
  Platinum: { bestOf: 8, firstTo: 5, noDraw: false },
};

export const formatFromBestOf = (bestOf) => {
  const legs = Number(bestOf) || 8
  return { bestOf: legs, firstTo: Math.ceil(legs / 2), noDraw: legs % 2 === 1 }
}

export const getDivisionFormat = (division, adminData) => {
  const custom = adminData?.divisionFormats?.[division]
  if (custom?.bestOf) return formatFromBestOf(custom.bestOf)
  return DIVISION_FORMATS[division] || { bestOf: 8, firstTo: 5, noDraw: false };
};

export const getDivisionFormatLabel = (fmt, division) => {
  if (!fmt) return null
  if (division === 'Overall') {
    return `Pro League (BO${DIVISION_FORMATS['Pro League'].bestOf}) • Elite/Emerald/Diamond/Platinum (BO${fmt.bestOf})`
  }
  return fmt.noDraw
    ? `Best of ${fmt.bestOf} Legs (First to ${fmt.firstTo} / No Draws)`
    : `Best of ${fmt.bestOf} Legs (First to ${fmt.firstTo} / ${fmt.firstTo - 1}–${fmt.firstTo - 1} Draw)`
}

export const EMPTY_ARRAY = [];
