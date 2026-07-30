import Chip from "@mui/material/Chip";
import type { Criticality } from "../types";

// Color is paired with the label text itself (Chip always renders both) so
// criticality is never conveyed by color alone — see DESIGN.md, "Accessibility
// considerations affecting architecture".
const COLOR_BY_CRITICALITY: Record<Criticality, "success" | "info" | "warning" | "error"> = {
  Low: "success",
  Medium: "info",
  High: "warning",
  Critical: "error",
};

export function CriticalityChip({ value }: { value: Criticality }) {
  return <Chip label={value} color={COLOR_BY_CRITICALITY[value]} size="small" variant="outlined" />;
}
