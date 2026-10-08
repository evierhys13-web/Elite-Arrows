import { getResultIdentityKey, getResultOverrideKeys } from "../utils/resultIdentity";

export const RESULT_CACHE_KEY = "eliteArrowsResults";
export const RESULT_PROOF_FIELDS = [
  "proofImage",
  "proofImage2",
  "proof",
  "proofUrl",
  "proofImageUrl",
  "proofFile",
  "proofVideo",
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
  "isPermanentAdmin",
  "permanentRoles",
  "isSubscribed",
  "isBanned",
  "bannedUntil",
  "warningCount",
  "strikeCount",
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

// Admin role flags a user can hold. Kept here so the pin, the self-heal and the
// admin panel all agree on the same set - a mismatch is exactly how a role goes
// missing without anything to restore it from.
export const ADMIN_ROLE_FLAGS = [
  "isAdmin",
  "isTournamentAdmin",
  "isCupAdmin",
];

// Roles snapshotted onto a user when they are pinned as permanent. Normalises
// both shapes the doc has carried: a plain array of flag names, and the older
// boolean-only `isPermanentAdmin` which implied every role currently held.
export const getPermanentRoles = (u) => {
  if (!u) return [];
  const raw = Array.isArray(u.permanentRoles) ? u.permanentRoles : [];
  const roles = raw.filter((r) => ADMIN_ROLE_FLAGS.includes(r));
  if (roles.length > 0) return roles;
  if (u.isPermanentAdmin === true) {
    return ADMIN_ROLE_FLAGS.filter((flag) => u[flag] === true);
  }
  return [];
};

// Returns the pinned roles that are currently missing on the doc, so a caller
// can write back only what was lost instead of blanket-forcing every flag.
export const getLostPermanentRoles = (u) =>
  getPermanentRoles(u).filter((flag) => u?.[flag] !== true);

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
