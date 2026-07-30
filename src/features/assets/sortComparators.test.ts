import { describe, expect, it } from "vitest";
import { compareCriticality, compareIpAddress } from "./sortComparators";
import type { Criticality } from "./types";

describe("compareCriticality", () => {
  it("orders by severity, not alphabetically", () => {
    // Alphabetical would give Critical, High, Low, Medium — wrong.
    const unsorted: Criticality[] = ["Critical", "Low", "High", "Medium"];
    const sorted = unsorted.sort(compareCriticality);
    expect(sorted).toEqual(["Low", "Medium", "High", "Critical"]);
  });
});

describe("compareIpAddress", () => {
  it("orders numerically by octet, not lexicographically", () => {
    // Lexicographic string sort would put "10.10.100.5" before "10.10.20.5".
    const sorted = ["10.10.100.5", "10.10.20.5", "10.10.9.5"].sort(compareIpAddress);
    expect(sorted).toEqual(["10.10.9.5", "10.10.20.5", "10.10.100.5"]);
  });

  it("treats identical addresses as equal", () => {
    expect(compareIpAddress("10.0.0.1", "10.0.0.1")).toBe(0);
  });

  it("compares later octets when earlier ones match", () => {
    expect(compareIpAddress("10.0.0.5", "10.0.0.10")).toBeLessThan(0);
  });
});
