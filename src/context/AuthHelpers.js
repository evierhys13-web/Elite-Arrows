import { getResultIdentityKey, getResultOverrideKeys } from "../utils/resultIdentity";

export const RESULT_CACHE_KEY = "eliteArrowsResults";
export const RESULT_PROOF_FIELDS = [
  "proofImage",
  "proof",
  "proofUrl",
  "proofImageUrl",
  "proofFile",
];
export const MINIMAL_RESULT_CACHE_FIELDS = [
  "id",
  "firestoreId",
  "fixtureId",
  "cupId",
  "matchId",
  "player1",
  "player1Id",
  "player2",
  "player2Id",
  "score1",
  "score2",
  "division",
  "gameType",
  "season",
  "date",
  "submittedAt",
  "approvedAt",
  "updatedAt",
  "status",
  "submittedBy",
  "bestOf",
  "firstTo",
  "player1Stats",
  "player2Stats",
];

export const stripResultProofForCache = (result) => {
  const cached = { ...result };
  let hasProofImage = Boolean(cached.hasProofImage);
  RESULT_PROOF_FIELDS.forEach((field) => {
    if (cached[field]) hasProofImage = true;
    delete cached[field];
  });
  if (hasProofImage) cached.hasProofImage = true;
  return cached;
};

export const minimizeResultForCache = (result) => {
  const cached = {};
  MINIMAL_RESULT_CACHE_FIELDS.forEach((field) => {
    if (result[field] !== undefined) cached[field] = result[field];
  });
  if (RESULT_PROOF_FIELDS.some((field) => result[field]))
    cached.hasProofImage = true;
  return cached;
};

export const USER_CACHE_FIELDS = [
  "id",
  "username",
  "name",
  "displayName",
  "email",
  "profilePicture",
  "division",
  "superLeagueDivision",
  "isAdmin",
  "isTournamentAdmin",
  "isCupAdmin",
  "isSubscribed",
  "isBanned",
  "subscribedSeasons",
  "manualStats",
  "friends",
  "tokens",
  "isBot",
];

export const stripUserForCache = (u) => {
  const stripped = {};
  USER_CACHE_FIELDS.forEach((field) => {
    if (u[field] !== undefined) stripped[field] = u[field];
  });
  return stripped;
};

export const saveUsersCache = (users) => {
  try {
    localStorage.setItem(
      "eliteArrowsUsers",
      JSON.stringify((users || []).map(stripUserForCache)),
    );
  } catch (error) {
    console.warn("Could not cache users locally (quota exceeded):", error);
    localStorage.removeItem("eliteArrowsUsers");
  }
};

export const getCachedResults = () => {
  try {
    return JSON.parse(localStorage.getItem(RESULT_CACHE_KEY) || "[]");
  } catch (error) {
    console.warn("Could not read cached results:", error);
    localStorage.removeItem(RESULT_CACHE_KEY);
    return [];
  }
};

export const saveResultsCache = (results) => {
  const resultList = Array.isArray(results) ? results : [];
  const limitedResults = resultList
    .sort(
      (a, b) =>
        new Date(b.date || b.submittedAt || 0) -
        new Date(a.date || a.submittedAt || 0),
    )
    .slice(0, 1000);

  try {
    localStorage.setItem(
      RESULT_CACHE_KEY,
      JSON.stringify(limitedResults.map(stripResultProofForCache)),
    );
  } catch (error) {
    console.warn("Could not cache results locally (quota exceeded):", error);
    localStorage.removeItem(RESULT_CACHE_KEY);
  }
};

export const SENSITIVE_FIELDS = [
  "password",
  "passwordString",
  "passwordHash",
  "passwordKey",
  "passwordStringValue",
  "firebaseId",
  "pwd",
  "pass",
  "passwd",
];
