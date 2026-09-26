export const DIVISIONS = [
  "Elite",
  "Emerald",
  "Diamond",
  "Platinum",
];

export const DIVISION_FORMATS = {
  "Pro League": { bestOf: 15, firstTo: 8, noDraw: true },
  Elite: { bestOf: 12, firstTo: 7, noDraw: false },
  Emerald: { bestOf: 10, firstTo: 6, noDraw: false },
  Diamond: { bestOf: 8, firstTo: 5, noDraw: false },
  Platinum: { bestOf: 8, firstTo: 5, noDraw: false },
};

export const getDivisionFormat = (division) =>
  DIVISION_FORMATS[division] || { bestOf: 8, firstTo: 5, noDraw: false };

export const EMPTY_ARRAY = [];
