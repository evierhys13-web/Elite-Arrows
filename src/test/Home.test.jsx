/**
 * Tests for Home page – stats computation and rendered output.
 *
 * The stat-calculation logic (wins / losses / draws / points) lives inside the
 * component, so we test it by rendering with controlled result data via a
 * mocked AuthContext, and asserting the displayed values.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ── helpers ───────────────────────────────────────────────────────────────────

const CURRENT_USER_ID = "user-1";

/** Build an approved result from the current user's perspective */
function result({
  score1,
  score2,
  asPlayer1 = true,
  id = String(Math.random()),
}) {
  return {
    id,
    status: "approved",
    player1Id: asPlayer1 ? CURRENT_USER_ID : "opponent",
    player2Id: asPlayer1 ? "opponent" : CURRENT_USER_ID,
    score1,
    score2,
    date: "2026-01-01",
  };
}

// ── mock router ───────────────────────────────────────────────────────────────

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    MemoryRouter: actual.MemoryRouter,
  };
});

// ── mock AuthContext ──────────────────────────────────────────────────────────

let mockResults = [];

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: CURRENT_USER_ID, username: "TestUser", threeDartAverage: 42.5 },
    getAllUsers: () => [],
    getResults: () => mockResults,
    dataRefreshTrigger: 0,
  }),
}));

// ── import component after mocks ──────────────────────────────────────────────

import Home from "../pages/Home";

function renderHome() {
  // suppress localStorage tournament reads
  localStorage.setItem("eliteArrowsTournaments", "[]");
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockResults = [];
});

// ── stat display ──────────────────────────────────────────────────────────────

describe("Home – welcome message", () => {
  it("greets user with their username", () => {
    renderHome();
    expect(screen.getByText(/welcome back, testuser/i)).toBeInTheDocument();
  });
});

describe("Home – stats with no results", () => {
  it("shows zero stats when there are no results", () => {
    renderHome();
    // "Matches Played" stat card should show 0
    expect(screen.getByText("Matches Played")).toBeInTheDocument();
    const matchesPlayed = screen
      .getByText("Matches Played")
      .closest(".stat-card");
    expect(matchesPlayed.querySelector(".stat-value").textContent).toBe("0");
  });
});

/** Get a stat card value by its label text */
function getStatValue(label) {
  const card = screen.getByText(label).closest(".stat-card");
  return Number(card.querySelector(".stat-value").textContent);
}

describe("Home – stats calculation (as player 1)", () => {
  it("counts a win correctly", () => {
    mockResults = [result({ score1: 3, score2: 1, asPlayer1: true })];
    renderHome();
    expect(getStatValue("Matches Played")).toBe(1);
    expect(getStatValue("Wins")).toBe(1);
    expect(getStatValue("Losses")).toBe(0);
    expect(getStatValue("Points")).toBe(3);
  });

  it("counts a loss correctly", () => {
    mockResults = [result({ score1: 1, score2: 3, asPlayer1: true })];
    renderHome();
    expect(getStatValue("Wins")).toBe(0);
    expect(getStatValue("Losses")).toBe(1);
    expect(getStatValue("Points")).toBe(0);
  });

  it("counts a draw correctly (1 point)", () => {
    mockResults = [result({ score1: 2, score2: 2, asPlayer1: true })];
    renderHome();
    expect(getStatValue("Wins")).toBe(0);
    expect(getStatValue("Losses")).toBe(0);
    expect(getStatValue("Points")).toBe(1);
  });
});

describe("Home – stats calculation (as player 2)", () => {
  it("counts a win when user is player 2 and score2 > score1", () => {
    mockResults = [result({ score1: 1, score2: 3, asPlayer1: false })];
    renderHome();
    expect(getStatValue("Wins")).toBe(1);
    expect(getStatValue("Points")).toBe(3);
  });

  it("counts a loss when user is player 2 and score2 < score1", () => {
    mockResults = [result({ score1: 3, score2: 1, asPlayer1: false })];
    renderHome();
    expect(getStatValue("Wins")).toBe(0);
    expect(getStatValue("Losses")).toBe(1);
    expect(getStatValue("Points")).toBe(0);
  });
});

describe("Home – only approved results count", () => {
  it("ignores pending results", () => {
    mockResults = [{ ...result({ score1: 3, score2: 0 }), status: "pending" }];
    renderHome();
    expect(getStatValue("Matches Played")).toBe(0);
    expect(getStatValue("Points")).toBe(0);
  });
});

describe("Home – multiple results", () => {
  it("accumulates totals across results", () => {
    mockResults = [
      result({ score1: 3, score2: 1, asPlayer1: true }), // win  → 3 pts
      result({ score1: 1, score2: 3, asPlayer1: true }), // loss → 0 pts
      result({ score1: 2, score2: 2, asPlayer1: true }), // draw → 1 pt
    ];
    renderHome();
    expect(getStatValue("Matches Played")).toBe(3);
    expect(getStatValue("Wins")).toBe(1);
    expect(getStatValue("Losses")).toBe(1);
    expect(getStatValue("Points")).toBe(4);
  });
});
