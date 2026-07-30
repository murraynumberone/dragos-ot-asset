import {
  ASSET_TYPES,
  ZONES,
  CRITICALITIES,
  type Asset,
  type AssetType,
  type Zone,
  type Criticality,
} from "./types";

export interface AssetFilters {
  q: string;
  types: AssetType[];
  zones: Zone[];
  criticalities: Criticality[];
}

function parseListParam<T extends string>(value: string | null, validValues: readonly T[]): T[] {
  if (!value) return [];
  const valid = new Set<string>(validValues);
  // Drop anything that isn't a recognized value instead of throwing — a
  // shared URL is user-editable/hand-typable and shouldn't be able to break
  // the page.
  return value.split(",").filter((v): v is T => valid.has(v));
}

// Takes the raw param strings directly (rather than a URLSearchParams) so
// callers can list exactly these primitives in a useMemo dependency array —
// closing over a URLSearchParams instead would defeat the memo, since it's a
// new object every render regardless of whether the underlying values changed.
export function parseAssetFiltersFromValues(
  q: string | null,
  type: string | null,
  zone: string | null,
  criticality: string | null,
): AssetFilters {
  return {
    q: q ?? "",
    types: parseListParam(type, ASSET_TYPES),
    zones: parseListParam(zone, ZONES),
    criticalities: parseListParam(criticality, CRITICALITIES),
  };
}

export function parseAssetFilters(params: URLSearchParams): AssetFilters {
  return parseAssetFiltersFromValues(
    params.get("q"),
    params.get("type"),
    params.get("zone"),
    params.get("criticality"),
  );
}

export function hasActiveFilters(filters: AssetFilters): boolean {
  return (
    filters.q.trim() !== "" ||
    filters.types.length > 0 ||
    filters.zones.length > 0 ||
    filters.criticalities.length > 0
  );
}

// Single implementation shared by FilterBar's "Clear filters" button and the
// empty-state's own clear action — both must reset the exact same set of URL
// params, not maintain two copies of this list.
export function clearAssetFilters(setParams: (updates: Record<string, string | null>) => void): void {
  setParams({ q: null, type: null, zone: null, criticality: null, page: null });
}

export function filterAssets(assets: Asset[], filters: AssetFilters): Asset[] {
  const q = filters.q.trim().toLowerCase();
  return assets.filter((asset) => {
    if (filters.types.length > 0 && !filters.types.includes(asset.type)) return false;
    if (filters.zones.length > 0 && !filters.zones.includes(asset.zone)) return false;
    if (filters.criticalities.length > 0 && !filters.criticalities.includes(asset.criticality)) {
      return false;
    }
    if (q && !asset.name.toLowerCase().includes(q) && !asset.ipAddress.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });
}
