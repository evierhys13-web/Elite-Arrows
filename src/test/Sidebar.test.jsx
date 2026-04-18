/**
 * Tests for the Sidebar component
 *
 * Verifies navigation item visibility rules:
 *  - free-tier users see only free-tier + utility + bottom items
 *  - subscribed users also see subscriber-only items
 *  - admin users see admin panel item
 *  - sign-out button is always present
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// ── mock context ──────────────────────────────────────────────────────────────

let mockUser = {};
const mockSignOut = vi.fn();
const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    NavLink: actual.NavLink,
    MemoryRouter: actual.MemoryRouter,
  };
});

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ signOut: mockSignOut, user: mockUser }),
}));

vi.mock("../context/ThemeContext", () => ({
  useTheme: () => ({ theme: "dark" }),
}));

vi.mock("../components/NotificationBell", () => ({ default: () => null }));

// ── import after mocks ────────────────────────────────────────────────────────

import Sidebar from "../components/Sidebar";

function renderSidebar() {
  return render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = {};
});

// ── free-tier user ────────────────────────────────────────────────────────────

describe("Sidebar – free-tier user", () => {
  beforeEach(() => {
    mockUser = {
      username: "TestUser",
      email: "user@test.com",
      division: "Unassigned",
      isSubscribed: false,
      isAdmin: false,
    };
  });

  it("shows Home nav item", () => {
    renderSidebar();
    expect(screen.getAllByText("Home").length).toBeGreaterThan(0);
  });

  it("shows Guide nav item", () => {
    renderSidebar();
    expect(screen.getAllByText("Guide").length).toBeGreaterThan(0);
  });

  it("shows League Table nav item", () => {
    renderSidebar();
    expect(screen.getAllByText("League Table").length).toBeGreaterThan(0);
  });

  it("does NOT show Submit Result for free-tier user", () => {
    renderSidebar();
    expect(screen.queryByText("Submit Result")).not.toBeInTheDocument();
  });

  it("does NOT show Chat for free-tier user", () => {
    renderSidebar();
    expect(screen.queryByText("Chat")).not.toBeInTheDocument();
  });

  it("does NOT show Admin Panel for free-tier user", () => {
    renderSidebar();
    expect(screen.queryByText("Admin Panel")).not.toBeInTheDocument();
  });

  it("shows Logout button", () => {
    renderSidebar();
    expect(screen.getAllByText("Logout").length).toBeGreaterThan(0);
  });
});

// ── subscribed user ───────────────────────────────────────────────────────────

describe("Sidebar – subscribed user", () => {
  beforeEach(() => {
    mockUser = {
      username: "SubUser",
      email: "sub@test.com",
      division: "Gold",
      isSubscribed: true,
      isAdmin: false,
    };
  });

  it("shows Submit Result", () => {
    renderSidebar();
    expect(screen.getAllByText("Submit Result").length).toBeGreaterThan(0);
  });

  it("shows Chat", () => {
    renderSidebar();
    expect(screen.getAllByText("Chat").length).toBeGreaterThan(0);
  });

  it("shows Fixtures", () => {
    renderSidebar();
    expect(screen.getAllByText("Fixtures").length).toBeGreaterThan(0);
  });

  it("does NOT show Admin Panel for regular subscriber", () => {
    renderSidebar();
    expect(screen.queryByText("Admin Panel")).not.toBeInTheDocument();
  });
});

// ── admin user ────────────────────────────────────────────────────────────────

describe("Sidebar – admin user", () => {
  beforeEach(() => {
    mockUser = {
      username: "AdminUser",
      email: "admin@test.com",
      division: "Elite",
      isSubscribed: true,
      isAdmin: true,
    };
  });

  it("shows Admin Panel", () => {
    renderSidebar();
    expect(screen.getAllByText("Admin Panel").length).toBeGreaterThan(0);
  });

  it("also shows subscriber items", () => {
    renderSidebar();
    expect(screen.getAllByText("Submit Result").length).toBeGreaterThan(0);
  });
});

// ── admin by email ────────────────────────────────────────────────────────────

describe("Sidebar – admin by hard-coded email", () => {
  beforeEach(() => {
    mockUser = {
      username: "Rhys",
      email: "rhyshowe2023@outlook.com",
      division: "Elite",
      isSubscribed: false,
      isAdmin: false,
    };
  });

  it("shows Admin Panel when user email matches hard-coded admin list", () => {
    renderSidebar();
    expect(screen.getAllByText("Admin Panel").length).toBeGreaterThan(0);
  });
});

// ── sign-out ──────────────────────────────────────────────────────────────────

describe("Sidebar – sign out", () => {
  beforeEach(() => {
    mockUser = { username: "TestUser", email: "user@test.com" };
  });

  it("calls signOut and navigates to /auth when Logout is clicked", async () => {
    const user = userEvent.setup();
    renderSidebar();
    // There may be two Logout buttons (desktop + mobile sidebar) – click the first
    const logoutButtons = screen.getAllByText("Logout");
    await user.click(logoutButtons[0]);
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/auth");
  });
});
