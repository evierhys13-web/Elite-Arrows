/**
 * Tests for ThemeContext
 * Covers: default state, toggleTheme, language, chatSettings, localStorage persistence,
 * and the useTheme hook guard.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, useTheme } from "../context/ThemeContext";

// ── helpers ──────────────────────────────────────────────────────────────────

function ThemeDisplay() {
  const {
    theme,
    toggleTheme,
    language,
    setLanguage,
    chatSettings,
    setChatSettings,
  } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="language">{language}</span>
      <span data-testid="sound">{String(chatSettings.soundEnabled)}</span>
      <span data-testid="notifications">
        {String(chatSettings.notificationsEnabled)}
      </span>
      <button onClick={toggleTheme}>toggle</button>
      <button onClick={() => setLanguage("fr")}>set-fr</button>
      <button
        onClick={() =>
          setChatSettings((prev) => ({ ...prev, soundEnabled: false }))
        }
      >
        mute
      </button>
    </div>
  );
}

function renderWithProvider(localStorageOverrides = {}) {
  Object.entries(localStorageOverrides).forEach(([k, v]) =>
    localStorage.setItem(k, v),
  );
  return render(
    <ThemeProvider>
      <ThemeDisplay />
    </ThemeProvider>,
  );
}

// ── tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeContext – defaults", () => {
  it("defaults to dark theme when localStorage is empty", () => {
    renderWithProvider();
    expect(screen.getByTestId("theme").textContent).toBe("dark");
  });

  it('defaults to "en" language when localStorage is empty', () => {
    renderWithProvider();
    expect(screen.getByTestId("language").textContent).toBe("en");
  });

  it("defaults soundEnabled and notificationsEnabled to true", () => {
    renderWithProvider();
    expect(screen.getByTestId("sound").textContent).toBe("true");
    expect(screen.getByTestId("notifications").textContent).toBe("true");
  });
});

describe("ThemeContext – restores from localStorage", () => {
  it("restores saved theme", () => {
    renderWithProvider({ eliteArrowsTheme: "light" });
    expect(screen.getByTestId("theme").textContent).toBe("light");
  });

  it("restores saved language", () => {
    renderWithProvider({ eliteArrowsLanguage: "de" });
    expect(screen.getByTestId("language").textContent).toBe("de");
  });

  it("restores saved chat settings", () => {
    renderWithProvider({
      eliteArrowsChatSettings: JSON.stringify({
        soundEnabled: false,
        notificationsEnabled: false,
      }),
    });
    expect(screen.getByTestId("sound").textContent).toBe("false");
    expect(screen.getByTestId("notifications").textContent).toBe("false");
  });
});

describe("ThemeContext – toggleTheme", () => {
  it("switches from dark to light", async () => {
    const user = userEvent.setup();
    renderWithProvider();
    await user.click(screen.getByText("toggle"));
    expect(screen.getByTestId("theme").textContent).toBe("light");
  });

  it("switches from light back to dark", async () => {
    const user = userEvent.setup();
    renderWithProvider({ eliteArrowsTheme: "light" });
    await user.click(screen.getByText("toggle"));
    expect(screen.getByTestId("theme").textContent).toBe("dark");
  });

  it("persists new theme to localStorage", async () => {
    const user = userEvent.setup();
    renderWithProvider();
    await user.click(screen.getByText("toggle"));
    expect(localStorage.getItem("eliteArrowsTheme")).toBe("light");
  });

  it("sets data-theme attribute on documentElement", async () => {
    const user = userEvent.setup();
    renderWithProvider();
    await user.click(screen.getByText("toggle"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});

describe("ThemeContext – setLanguage", () => {
  it("updates language state", async () => {
    const user = userEvent.setup();
    renderWithProvider();
    await user.click(screen.getByText("set-fr"));
    expect(screen.getByTestId("language").textContent).toBe("fr");
  });

  it("persists language to localStorage", async () => {
    const user = userEvent.setup();
    renderWithProvider();
    await user.click(screen.getByText("set-fr"));
    expect(localStorage.getItem("eliteArrowsLanguage")).toBe("fr");
  });
});

describe("ThemeContext – setChatSettings", () => {
  it("updates soundEnabled", async () => {
    const user = userEvent.setup();
    renderWithProvider();
    await user.click(screen.getByText("mute"));
    expect(screen.getByTestId("sound").textContent).toBe("false");
  });

  it("persists chatSettings to localStorage", async () => {
    const user = userEvent.setup();
    renderWithProvider();
    await user.click(screen.getByText("mute"));
    const saved = JSON.parse(localStorage.getItem("eliteArrowsChatSettings"));
    expect(saved.soundEnabled).toBe(false);
    expect(saved.notificationsEnabled).toBe(true);
  });
});

describe("useTheme – guard", () => {
  it("throws when used outside ThemeProvider", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    function BadComponent() {
      useTheme();
      return null;
    }
    expect(() => render(<BadComponent />)).toThrow(
      "useTheme must be used within a ThemeProvider",
    );
    consoleError.mockRestore();
  });
});
