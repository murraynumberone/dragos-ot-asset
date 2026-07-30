import {
  ASSET_TYPES,
  ZONES,
  type Asset,
  type AssetType,
  type Zone,
  type Criticality,
} from "../features/assets/types";

const ASSET_COUNT = 300;
const SEED = 42;

// Deterministic PRNG (mulberry32) so the mock dataset — and anything asserted
// against it in tests — is stable across runs.
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function pickWeighted<T>(rng: () => number, items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng() * total;
  for (const [item, weight] of items) {
    if (roll < weight) return item;
    roll -= weight;
  }
  return items[items.length - 1][0];
}

function randomOctet(rng: () => number): number {
  return 1 + Math.floor(rng() * 254);
}

// Real OT sites don't scatter asset types evenly across Purdue levels — a
// firewall belongs in the DMZ, not next to a sensor on the process floor.
const TYPE_TO_LIKELY_ZONES: Record<AssetType, readonly Zone[]> = {
  PLC: ["Level 0 – Process", "Level 1 – Control"],
  RTU: ["Level 0 – Process", "Level 1 – Control"],
  Sensor: ["Level 0 – Process"],
  Controller: ["Level 1 – Control"],
  HMI: ["Level 2 – Supervisory"],
  Historian: ["Level 2 – Supervisory", "Level 3 – Operations"],
  "Engineering Workstation": ["Level 3 – Operations"],
  Switch: ["Level 1 – Control", "Level 2 – Supervisory", "Level 3 – Operations"],
  Firewall: ["DMZ", "Level 3 – Operations"],
};

const TYPE_ABBREVIATION: Record<AssetType, string> = {
  PLC: "PLC",
  RTU: "RTU",
  HMI: "HMI",
  "Engineering Workstation": "EWS",
  Historian: "HIST",
  Switch: "SW",
  Firewall: "FW",
  Sensor: "SNR",
  Controller: "CTRL",
};

const ZONE_CODE: Record<Zone, string> = {
  "Level 0 – Process": "L0",
  "Level 1 – Control": "L1",
  "Level 2 – Supervisory": "L2",
  "Level 3 – Operations": "L3",
  "Level 4 – Enterprise": "L4",
  DMZ: "DMZ",
};

const CRITICALITY_WEIGHTS: readonly (readonly [Criticality, number])[] = [
  ["Low", 35],
  ["Medium", 35],
  ["High", 20],
  ["Critical", 10],
];

const DAY_MS = 24 * 60 * 60 * 1000;

function randomLastSeen(rng: () => number): string {
  const now = Date.now();
  const isRecent = rng() < 0.85;
  const [minAge, maxAge] = isRecent ? [0, 7 * DAY_MS] : [7 * DAY_MS, 180 * DAY_MS];
  const age = minAge + rng() * (maxAge - minAge);
  return new Date(now - age).toISOString();
}

function generateAssets(count: number, seed: number): Asset[] {
  const rng = mulberry32(seed);
  const typeCounters: Partial<Record<AssetType, number>> = {};

  return Array.from({ length: count }, (_, index) => {
    const type = pick(rng, ASSET_TYPES);
    const zone = pick(rng, TYPE_TO_LIKELY_ZONES[type]);
    const criticality = pickWeighted(rng, CRITICALITY_WEIGHTS);

    const seq = (typeCounters[type] = (typeCounters[type] ?? 0) + 1);
    const name = `${TYPE_ABBREVIATION[type]}-${ZONE_CODE[zone]}-${String(seq).padStart(3, "0")}`;

    const zoneOctet = 10 + ZONES.indexOf(zone);
    const ipAddress = `10.${zoneOctet}.${randomOctet(rng)}.${randomOctet(rng)}`;

    return {
      id: `asset-${index + 1}`,
      name,
      type,
      ipAddress,
      zone,
      criticality,
      lastSeen: randomLastSeen(rng),
    };
  });
}

export function createMockAssets(): Asset[] {
  return generateAssets(ASSET_COUNT, SEED);
}
