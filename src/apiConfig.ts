// Single absolute base URL shared by the RTK Query API slice and the MSW handlers.
// Node's fetch (what Vitest runs under) can't resolve a relative "/api" path the
// way a browser resolves it against window.location — see DESIGN.md, "Base URL".
export const API_BASE_URL = "http://localhost/api";
