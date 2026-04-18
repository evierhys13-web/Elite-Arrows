/**
 * Tests for src/firestoreService.js
 *
 * Path note: firestoreService.js (at src/) imports from '../firebase' which
 * resolves to the project root. From src/test/, that same path is '../../firebase'.
 * We provide an inline factory so the mock intercepts the correct resolved path.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  doc: vi.fn((db, col, id) => ({ _path: `${col}/${id}` })),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn((...args) => args),
  where: vi.fn(),
  orderBy: vi.fn((field, dir) => ({ _field: field, _dir: dir })),
  onSnapshot: vi.fn(() => vi.fn()),
  collection: vi.fn((_db, name) => name),
  deleteDoc: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
}));

vi.mock("../../firebase", () => ({
  db: {},
  resultsCollection: "resultsCollection",
  tournamentsCollection: "tournamentsCollection",
  betsCollection: "betsCollection",
  notificationsCollection: "notificationsCollection",
  doc: mocks.doc,
  setDoc: mocks.setDoc,
  getDoc: mocks.getDoc,
  getDocs: mocks.getDocs,
  query: mocks.query,
  where: mocks.where,
  orderBy: mocks.orderBy,
  onSnapshot: mocks.onSnapshot,
  collection: mocks.collection,
  deleteDoc: mocks.deleteDoc,
  addDoc: mocks.addDoc,
  updateDoc: mocks.updateDoc,
}));

import {
  getResults,
  addResult,
  updateResult,
  getTournaments,
  addTournament,
  updateTournament,
  deleteTournament,
  getBets,
  addBet,
  updateBet,
  getNotifications,
  addNotification,
  updateNotification,
  subscribeToResults,
  subscribeToTournaments,
  subscribeToBets,
} from "../firestoreService";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeSnapshot(items) {
  return {
    docs: items.map((data, i) => ({
      id: String(i),
      data: () => data,
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.setDoc.mockResolvedValue(undefined);
});

// ── getResults ────────────────────────────────────────────────────────────────

describe("getResults", () => {
  it("returns mapped results with id field", async () => {
    mocks.getDocs.mockResolvedValueOnce(
      makeSnapshot([
        { player1: "Alice", score1: 3, score2: 1 },
        { player1: "Bob", score1: 0, score2: 3 },
      ]),
    );
    const results = await getResults();
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ id: "0", player1: "Alice" });
    expect(results[1]).toMatchObject({ id: "1", player1: "Bob" });
  });

  it("returns empty array when collection is empty", async () => {
    mocks.getDocs.mockResolvedValueOnce(makeSnapshot([]));
    const results = await getResults();
    expect(results).toEqual([]);
  });

  it("calls orderBy with date desc", async () => {
    mocks.getDocs.mockResolvedValueOnce(makeSnapshot([]));
    await getResults();
    expect(mocks.orderBy).toHaveBeenCalledWith("date", "desc");
  });
});

// ── addResult ─────────────────────────────────────────────────────────────────

describe("addResult", () => {
  it("calls setDoc and returns a string id", async () => {
    const id = await addResult({ player1: "Alice", score1: 3 });
    expect(mocks.setDoc).toHaveBeenCalledTimes(1);
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("passes the result data to setDoc", async () => {
    const result = { player1: "Alice", score1: 3, score2: 1 };
    await addResult(result);
    const [, passedData] = mocks.setDoc.mock.calls[0];
    expect(passedData).toMatchObject(result);
  });
});

// ── updateResult ──────────────────────────────────────────────────────────────

describe("updateResult", () => {
  it("calls setDoc with merge: true", async () => {
    await updateResult("abc", { score1: 5 });
    expect(mocks.setDoc).toHaveBeenCalledWith(
      expect.anything(),
      { score1: 5 },
      { merge: true },
    );
  });
});

// ── getTournaments ────────────────────────────────────────────────────────────

describe("getTournaments", () => {
  it("returns mapped tournaments", async () => {
    mocks.getDocs.mockResolvedValueOnce(makeSnapshot([{ name: "Summer Cup" }]));
    const ts = await getTournaments();
    expect(ts).toHaveLength(1);
    expect(ts[0]).toMatchObject({ id: "0", name: "Summer Cup" });
  });
});

// ── addTournament ─────────────────────────────────────────────────────────────

describe("addTournament", () => {
  it("returns an id string", async () => {
    const id = await addTournament({ name: "Winter Cup" });
    expect(typeof id).toBe("string");
    expect(mocks.setDoc).toHaveBeenCalledTimes(1);
  });
});

// ── updateTournament ──────────────────────────────────────────────────────────

describe("updateTournament", () => {
  it("calls setDoc with merge: true", async () => {
    await updateTournament("t1", { name: "Updated Cup" });
    expect(mocks.setDoc).toHaveBeenCalledWith(
      expect.anything(),
      { name: "Updated Cup" },
      { merge: true },
    );
  });
});

// ── deleteTournament ──────────────────────────────────────────────────────────

describe("deleteTournament", () => {
  it("soft-deletes by setting deleted:true with merge", async () => {
    await deleteTournament("t1");
    expect(mocks.setDoc).toHaveBeenCalledWith(
      expect.anything(),
      { deleted: true },
      { merge: true },
    );
  });
});

// ── getBets ───────────────────────────────────────────────────────────────────

describe("getBets", () => {
  it("returns mapped bets", async () => {
    mocks.getDocs.mockResolvedValueOnce(
      makeSnapshot([{ amount: 10 }, { amount: 20 }]),
    );
    const bets = await getBets();
    expect(bets).toHaveLength(2);
    expect(bets[0]).toMatchObject({ id: "0", amount: 10 });
  });
});

// ── addBet ────────────────────────────────────────────────────────────────────

describe("addBet", () => {
  it("returns an id string and calls setDoc", async () => {
    const id = await addBet({ amount: 5 });
    expect(typeof id).toBe("string");
    expect(mocks.setDoc).toHaveBeenCalledTimes(1);
  });
});

// ── updateBet ─────────────────────────────────────────────────────────────────

describe("updateBet", () => {
  it("calls setDoc with merge: true", async () => {
    await updateBet("b1", { amount: 15 });
    expect(mocks.setDoc).toHaveBeenCalledWith(
      expect.anything(),
      { amount: 15 },
      { merge: true },
    );
  });
});

// ── getNotifications ──────────────────────────────────────────────────────────

describe("getNotifications", () => {
  it("returns mapped notifications ordered by createdAt", async () => {
    mocks.getDocs.mockResolvedValueOnce(makeSnapshot([{ message: "Hello" }]));
    const notifs = await getNotifications();
    expect(notifs).toHaveLength(1);
    expect(notifs[0]).toMatchObject({ id: "0", message: "Hello" });
    expect(mocks.orderBy).toHaveBeenCalledWith("createdAt", "desc");
  });
});

// ── addNotification ───────────────────────────────────────────────────────────

describe("addNotification", () => {
  it("returns an id string and calls setDoc", async () => {
    const id = await addNotification({ message: "New match!" });
    expect(typeof id).toBe("string");
    expect(mocks.setDoc).toHaveBeenCalledTimes(1);
  });
});

// ── updateNotification ────────────────────────────────────────────────────────

describe("updateNotification", () => {
  it("calls setDoc with merge: true", async () => {
    await updateNotification("n1", { read: true });
    expect(mocks.setDoc).toHaveBeenCalledWith(
      expect.anything(),
      { read: true },
      { merge: true },
    );
  });
});

// ── subscribeToResults ────────────────────────────────────────────────────────

describe("subscribeToResults", () => {
  it("calls onSnapshot and returns an unsubscribe function", () => {
    const unsubscribe = vi.fn();
    mocks.onSnapshot.mockReturnValueOnce(unsubscribe);
    const result = subscribeToResults(vi.fn());
    expect(mocks.onSnapshot).toHaveBeenCalledTimes(1);
    expect(result).toBe(unsubscribe);
  });

  it("callback receives mapped results", () => {
    mocks.onSnapshot.mockImplementationOnce((q, handler) => {
      handler(makeSnapshot([{ player1: "Alice", score1: 3 }]));
      return vi.fn();
    });
    const cb = vi.fn();
    subscribeToResults(cb);
    expect(cb).toHaveBeenCalledWith([
      expect.objectContaining({ id: "0", player1: "Alice" }),
    ]);
  });
});

// ── subscribeToTournaments ────────────────────────────────────────────────────

describe("subscribeToTournaments", () => {
  it("calls onSnapshot and invokes callback with mapped data", () => {
    mocks.onSnapshot.mockImplementationOnce((col, handler) => {
      handler(makeSnapshot([{ name: "Cup A" }]));
      return vi.fn();
    });
    const cb = vi.fn();
    subscribeToTournaments(cb);
    expect(cb).toHaveBeenCalledWith([
      expect.objectContaining({ name: "Cup A" }),
    ]);
  });
});

// ── subscribeToBets ───────────────────────────────────────────────────────────

describe("subscribeToBets", () => {
  it("calls onSnapshot and invokes callback with mapped data", () => {
    mocks.onSnapshot.mockImplementationOnce((col, handler) => {
      handler(makeSnapshot([{ amount: 50 }]));
      return vi.fn();
    });
    const cb = vi.fn();
    subscribeToBets(cb);
    expect(cb).toHaveBeenCalledWith([expect.objectContaining({ amount: 50 })]);
  });
});
