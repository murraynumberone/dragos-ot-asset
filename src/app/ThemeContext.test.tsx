import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTheme } from "@mui/material/styles";
import { ThemeModeProvider, ThemeToggleButton } from "./ThemeContext";
import { useThemeMode } from "./useThemeMode";

const STORAGE_KEY = "theme-mode";

function mockSystemPreference(prefersDark: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: prefersDark,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}

// Reads both our own context value and the actual MUI theme fed to
// ThemeProvider, so a passing test proves the two are actually wired
// together, not just that some local state changed.
function Probe() {
  const { mode } = useThemeMode();
  const theme = useTheme();
  return <div data-testid="probe">{`${mode}:${theme.palette.mode}`}</div>;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("ThemeModeProvider", () => {
  it("defaults to light when the system prefers light and nothing is stored", () => {
    mockSystemPreference(false);
    render(
      <ThemeModeProvider>
        <Probe />
      </ThemeModeProvider>,
    );
    expect(screen.getByTestId("probe")).toHaveTextContent("light:light");
  });

  it("defaults to dark when the system prefers dark and nothing is stored", () => {
    mockSystemPreference(true);
    render(
      <ThemeModeProvider>
        <Probe />
      </ThemeModeProvider>,
    );
    expect(screen.getByTestId("probe")).toHaveTextContent("dark:dark");
  });

  it("prefers a stored choice over the system preference", () => {
    localStorage.setItem(STORAGE_KEY, "dark");
    mockSystemPreference(false); // system says light, stored choice should still win
    render(
      <ThemeModeProvider>
        <Probe />
      </ThemeModeProvider>,
    );
    expect(screen.getByTestId("probe")).toHaveTextContent("dark:dark");
  });

  it("ignores a corrupted/unrecognized stored value and falls back to system preference", () => {
    localStorage.setItem(STORAGE_KEY, "banana");
    mockSystemPreference(true);
    render(
      <ThemeModeProvider>
        <Probe />
      </ThemeModeProvider>,
    );
    expect(screen.getByTestId("probe")).toHaveTextContent("dark:dark");
  });

  it("toggling flips the mode, updates the real MUI theme, and persists the choice", async () => {
    const user = userEvent.setup();
    mockSystemPreference(false);
    render(
      <ThemeModeProvider>
        <Probe />
        <ThemeToggleButton />
      </ThemeModeProvider>,
    );
    expect(screen.getByTestId("probe")).toHaveTextContent("light:light");
    expect(screen.getByTestId("DarkModeIcon")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /switch to dark mode/i }));
    expect(screen.getByTestId("probe")).toHaveTextContent("dark:dark");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
    expect(screen.getByTestId("LightModeIcon")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /switch to light mode/i }));
    expect(screen.getByTestId("probe")).toHaveTextContent("light:light");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("light");
  });

  it("a fresh mount after a toggle picks up the persisted mode", async () => {
    const user = userEvent.setup();
    mockSystemPreference(false);
    const { unmount } = render(
      <ThemeModeProvider>
        <ThemeToggleButton />
      </ThemeModeProvider>,
    );
    await user.click(screen.getByRole("button", { name: /switch to dark mode/i }));
    unmount();

    render(
      <ThemeModeProvider>
        <Probe />
      </ThemeModeProvider>,
    );
    expect(screen.getByTestId("probe")).toHaveTextContent("dark:dark");
  });
});

describe("useThemeMode", () => {
  it("throws when used outside a ThemeModeProvider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/useThemeMode must be used within a ThemeModeProvider/);
    consoleSpy.mockRestore();
  });
});
