export const ASSET_TYPES = [
  "PLC",
  "RTU",
  "HMI",
  "Engineering Workstation",
  "Historian",
  "Switch",
  "Firewall",
  "Sensor",
  "Controller",
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const ZONES = [
  "Level 0 – Process",
  "Level 1 – Control",
  "Level 2 – Supervisory",
  "Level 3 – Operations",
  "Level 4 – Enterprise",
  "DMZ",
] as const;
export type Zone = (typeof ZONES)[number];

export const CRITICALITIES = ["Low", "Medium", "High", "Critical"] as const;
export type Criticality = (typeof CRITICALITIES)[number];

// Severity order, not alphabetical — needed for the DataGrid's criticality
// sortComparator (see DESIGN.md, "DataGrid pagination/sort/filter modes").
export const CRITICALITY_ORDER: Record<Criticality, number> = {
  Low: 0,
  Medium: 1,
  High: 2,
  Critical: 3,
};

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  ipAddress: string;
  zone: Zone;
  criticality: Criticality;
  lastSeen: string; // ISO 8601
}
