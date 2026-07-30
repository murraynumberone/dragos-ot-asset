import { describe, expect, it, vi } from "vitest";
import { clearAssetFilters, filterAssets, hasActiveFilters, parseAssetFilters, type AssetFilters } from "./selectors";
import type { Asset } from "./types";

const assets: Asset[] = [
  {
    id: "1",
    name: "PLC-L0-001",
    type: "PLC",
    ipAddress: "10.10.1.1",
    zone: "Level 0 – Process",
    criticality: "Low",
    lastSeen: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "2",
    name: "RTU-L0-002",
    type: "RTU",
    ipAddress: "10.10.1.2",
    zone: "Level 0 – Process",
    criticality: "High",
    lastSeen: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "3",
    name: "FW-DMZ-001",
    type: "Firewall",
    ipAddress: "10.20.1.1",
    zone: "DMZ",
    criticality: "Critical",
    lastSeen: "2026-01-01T00:00:00.000Z",
  },
];

const noFilters: AssetFilters = { q: "", types: [], zones: [], criticalities: [] };

describe("filterAssets", () => {
  it("returns everything when no filters are applied", () => {
    expect(filterAssets(assets, noFilters)).toHaveLength(3);
  });

  it("filters by a single type", () => {
    const result = filterAssets(assets, { ...noFilters, types: ["Firewall"] });
    expect(result.map((a) => a.id)).toEqual(["3"]);
  });

  it("ORs multiple selected values within one dimension", () => {
    const result = filterAssets(assets, { ...noFilters, types: ["PLC", "RTU"] });
    expect(result.map((a) => a.id).sort()).toEqual(["1", "2"]);
  });

  it("filters by zone", () => {
    const result = filterAssets(assets, { ...noFilters, zones: ["DMZ"] });
    expect(result.map((a) => a.id)).toEqual(["3"]);
  });

  it("filters by criticality", () => {
    const result = filterAssets(assets, { ...noFilters, criticalities: ["Critical"] });
    expect(result.map((a) => a.id)).toEqual(["3"]);
  });

  it("ANDs across dimensions", () => {
    const result = filterAssets(assets, { ...noFilters, types: ["RTU"], criticalities: ["High"] });
    expect(result.map((a) => a.id)).toEqual(["2"]);

    const noMatch = filterAssets(assets, { ...noFilters, types: ["RTU"], criticalities: ["Critical"] });
    expect(noMatch).toHaveLength(0);
  });

  it("searches by name, case-insensitively", () => {
    const result = filterAssets(assets, { ...noFilters, q: "plc" });
    expect(result.map((a) => a.id)).toEqual(["1"]);
  });

  it("searches by IP address substring", () => {
    const result = filterAssets(assets, { ...noFilters, q: "10.20" });
    expect(result.map((a) => a.id)).toEqual(["3"]);
  });

  it("trims whitespace in the search term", () => {
    const result = filterAssets(assets, { ...noFilters, q: "  plc  " });
    expect(result.map((a) => a.id)).toEqual(["1"]);
  });
});

describe("parseAssetFilters", () => {
  it("parses comma-separated values from the URL", () => {
    const params = new URLSearchParams("type=PLC,RTU&zone=DMZ&criticality=Critical&q=foo");
    expect(parseAssetFilters(params)).toEqual({
      q: "foo",
      types: ["PLC", "RTU"],
      zones: ["DMZ"],
      criticalities: ["Critical"],
    });
  });

  it("drops unrecognized values instead of throwing", () => {
    const params = new URLSearchParams("type=PLC,NotARealType");
    expect(parseAssetFilters(params).types).toEqual(["PLC"]);
  });

  it("returns empty defaults when nothing is present", () => {
    expect(parseAssetFilters(new URLSearchParams())).toEqual({
      q: "",
      types: [],
      zones: [],
      criticalities: [],
    });
  });
});

describe("hasActiveFilters", () => {
  it("is false when nothing is set", () => {
    expect(hasActiveFilters(noFilters)).toBe(false);
  });

  it("is false for a search term that's only whitespace", () => {
    expect(hasActiveFilters({ ...noFilters, q: "   " })).toBe(false);
  });

  it.each([
    ["q", { ...noFilters, q: "firewall" }],
    ["types", { ...noFilters, types: ["PLC"] as Asset["type"][] }],
    ["zones", { ...noFilters, zones: ["DMZ"] as Asset["zone"][] }],
    ["criticalities", { ...noFilters, criticalities: ["High"] as Asset["criticality"][] }],
  ])("is true when %s is set", (_label, filters) => {
    expect(hasActiveFilters(filters)).toBe(true);
  });
});

describe("clearAssetFilters", () => {
  it("nulls out every filter param plus page, in one call", () => {
    const setParams = vi.fn();
    clearAssetFilters(setParams);
    expect(setParams).toHaveBeenCalledExactlyOnceWith({
      q: null,
      type: null,
      zone: null,
      criticality: null,
      page: null,
    });
  });
});
