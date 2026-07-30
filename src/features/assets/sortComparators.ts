import { CRITICALITY_ORDER, type Criticality } from "./types";

// Default string sort would rank "Critical" < "High" < "Low" < "Medium" —
// wrong for a severity column. See DESIGN.md, "DataGrid pagination/sort/filter modes".
export function compareCriticality(a: Criticality, b: Criticality): number {
  return CRITICALITY_ORDER[a] - CRITICALITY_ORDER[b];
}

// Default string sort ranks "10.10.100.5" before "10.10.20.5" (lexicographic,
// not numeric octet comparison) — the same category of bug as criticality above.
export function compareIpAddress(a: string, b: string): number {
  const octetsA = a.split(".").map(Number);
  const octetsB = b.split(".").map(Number);
  for (let i = 0; i < 4; i++) {
    const diff = (octetsA[i] ?? 0) - (octetsB[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
