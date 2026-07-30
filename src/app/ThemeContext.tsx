import { useMemo, useState, type ReactNode } from "react";
import CssBaseline from "@mui/material/CssBaseline";
import IconButton from "@mui/material/IconButton";
import { ThemeProvider, type PaletteMode } from "@mui/material/styles";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import { createAppTheme } from "./theme";
import { ThemeModeContext, useThemeMode } from "./useThemeMode";

const STORAGE_KEY = "theme-mode";

function getSystemPreference(): PaletteMode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredMode(): PaletteMode | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    // Storage can throw (private browsing, disabled storage, etc.) — fall
    // back to system preference below rather than crash.
    return null;
  }
}

function writeStoredMode(mode: PaletteMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Non-fatal — the toggle still works for the rest of the session, it
    // just won't survive a reload.
  }
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  // Read once at mount: localStorage if the user has explicitly chosen
  // before, otherwise the OS preference. Once toggled, the explicit choice
  // is persisted and wins over subsequent OS-level changes — see DESIGN.md's
  // "Theme: system-only vs manual toggle" tradeoff.
  const [mode, setMode] = useState<PaletteMode>(() => readStoredMode() ?? getSystemPreference());

  const toggleMode = () => {
    setMode((current) => {
      const next = current === "light" ? "dark" : "light";
      writeStoredMode(next);
      return next;
    });
  };

  const theme = useMemo(() => createAppTheme(mode), [mode]);
  const value = useMemo(() => ({ mode, toggleMode }), [mode]);

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function ThemeToggleButton() {
  const { mode, toggleMode } = useThemeMode();
  const nextMode = mode === "light" ? "dark" : "light";
  return (
    <IconButton onClick={toggleMode} aria-label={`Switch to ${nextMode} mode`} color="inherit">
      {mode === "light" ? <DarkModeIcon /> : <LightModeIcon />}
    </IconButton>
  );
}
