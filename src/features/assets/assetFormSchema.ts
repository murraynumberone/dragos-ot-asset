import { z } from "zod";
import { ASSET_TYPES, ZONES, CRITICALITIES } from "./types";

function isValidIpv4(value: string): boolean {
  const octets = value.split(".");
  if (octets.length !== 4) return false;
  return octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255);
}

export const assetFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or fewer"),
  type: z.enum(ASSET_TYPES),
  ipAddress: z
    .string()
    .trim()
    .min(1, "IP address is required")
    .refine(isValidIpv4, "Enter a valid IPv4 address (e.g. 10.0.0.1)"),
  zone: z.enum(ZONES),
  criticality: z.enum(CRITICALITIES),
});

export type AssetFormValues = z.infer<typeof assetFormSchema>;
