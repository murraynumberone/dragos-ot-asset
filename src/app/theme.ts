import { createTheme, type PaletteMode, type Theme } from "@mui/material/styles";

const BRAND_PRIMARY_LIGHT = "#01605e";

// #01605e is only 2.53:1 against MUI's dark background (#121212) — fails
// WCAG AA (4.5:1) for text/icon use, since primary shows up as small text,
// links, and borders, not just large fills. Same hue and near-identical
// saturation (178° / ~98%) as the brand color, lightened until it clears
// AAA (7:1) with real margin: 7.19:1 against #121212.
const BRAND_PRIMARY_DARK = "#01b3ae";

// Loaded via Google Fonts — see index.html.
const BODY_FONT_FAMILY = '"Inter", "Roboto", "Helvetica", "Arial", sans-serif';
const HEADING_FONT_FAMILY = '"Space Grotesk", "Roboto", "Helvetica", "Arial", sans-serif';

export function createAppTheme(mode: PaletteMode): Theme {
  return createTheme({
    palette: {
      mode,
      primary: {
        main: mode === "light" ? BRAND_PRIMARY_LIGHT : BRAND_PRIMARY_DARK,
      },
    },
    typography: {
      fontFamily: BODY_FONT_FAMILY,
      h1: { fontFamily: HEADING_FONT_FAMILY },
      h2: { fontFamily: HEADING_FONT_FAMILY },
      h3: { fontFamily: HEADING_FONT_FAMILY },
      h4: { fontFamily: HEADING_FONT_FAMILY },
      h5: { fontFamily: HEADING_FONT_FAMILY },
      h6: { fontFamily: HEADING_FONT_FAMILY },
    },
  });
}
