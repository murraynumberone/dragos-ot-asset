import { describe, expect, it } from "vitest";
import { assetFormSchema } from "./assetFormSchema";

const validValues = {
  name: "PLC-L0-001",
  type: "PLC",
  ipAddress: "10.10.1.1",
  zone: "Level 0 – Process",
  criticality: "Low",
};

describe("assetFormSchema", () => {
  it("accepts a fully valid asset", () => {
    expect(assetFormSchema.safeParse(validValues).success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = assetFormSchema.safeParse({ ...validValues, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a name that is only whitespace", () => {
    const result = assetFormSchema.safeParse({ ...validValues, name: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects a name over 100 characters", () => {
    const result = assetFormSchema.safeParse({ ...validValues, name: "a".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("rejects a type outside the known enum", () => {
    const result = assetFormSchema.safeParse({ ...validValues, type: "Toaster" });
    expect(result.success).toBe(false);
  });

  it.each([
    ["missing an octet", "10.10.1"],
    ["has a non-numeric octet", "10.10.1.x"],
    ["has an out-of-range octet", "10.10.1.999"],
    ["is empty", ""],
    ["has a trailing dot", "10.10.1.1."],
  ])("rejects an IP address that %s", (_label, ipAddress) => {
    const result = assetFormSchema.safeParse({ ...validValues, ipAddress });
    expect(result.success).toBe(false);
  });

  it("accepts boundary-valid octets", () => {
    const result = assetFormSchema.safeParse({ ...validValues, ipAddress: "255.255.255.255" });
    expect(result.success).toBe(true);
  });

  it("rejects a zone outside the known enum", () => {
    const result = assetFormSchema.safeParse({ ...validValues, zone: "Basement" });
    expect(result.success).toBe(false);
  });

  it("rejects a criticality outside the known enum", () => {
    const result = assetFormSchema.safeParse({ ...validValues, criticality: "Extreme" });
    expect(result.success).toBe(false);
  });
});
