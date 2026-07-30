import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import OutlinedInput from "@mui/material/OutlinedInput";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useUrlState } from "../../../hooks/useUrlState";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { ASSET_TYPES, ZONES, CRITICALITIES, type AssetType, type Zone, type Criticality } from "../types";
import { clearAssetFilters, hasActiveFilters, parseAssetFiltersFromValues } from "../selectors";

const SEARCH_DEBOUNCE_MS = 300;

const visuallyHiddenSx = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;

function MultiSelectFilter<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: readonly T[];
  selected: T[];
  onChange: (values: T[]) => void;
}) {
  const labelId = `${label.toLowerCase()}-filter-label`;
  return (
    <FormControl size="small" sx={{ minWidth: 200, width: { xs: "100%", sm: "auto" } }}>
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select<T[]>
        labelId={labelId}
        multiple
        value={selected}
        onChange={(event: SelectChangeEvent<T[]>) => {
          const { value } = event.target;
          onChange(typeof value === "string" ? (value.split(",") as T[]) : value);
        }}
        input={<OutlinedInput label={label} />}
        renderValue={(values) => (
          <Stack direction="row" spacing={0.5} flexWrap="wrap">
            {values.map((value) => (
              <Chip key={value} label={value} size="small" />
            ))}
          </Stack>
        )}
      >
        {options.map((option) => (
          <MenuItem key={option} value={option}>
            <Checkbox checked={selected.includes(option)} size="small" />
            <ListItemText primary={option} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export function FilterBar() {
  const { params, setParams } = useUrlState();

  const qParam = params.get("q") ?? "";
  const typeParam = params.get("type");
  const zoneParam = params.get("zone");
  const criticalityParam = params.get("criticality");
  // Same reference-stability discipline as AssetTable's paginationModel/sortModel
  // (see its comment) — memoized on the raw param strings, not on `params`
  // itself, which is a new object every render regardless of whether the
  // underlying URL actually changed.
  const filters = useMemo(
    () => parseAssetFiltersFromValues(qParam, typeParam, zoneParam, criticalityParam),
    [qParam, typeParam, zoneParam, criticalityParam],
  );

  const [pendingQ, setPendingQ] = useState(qParam);
  const debouncedQ = useDebouncedValue(pendingQ, SEARCH_DEBOUNCE_MS);

  // Read inside the commit effect below without being a dependency of it —
  // see that effect's comment for why.
  const qParamRef = useRef(qParam);
  qParamRef.current = qParam;

  // Stay in sync if the committed value changes from outside this component
  // (browser back/forward, a pasted link, or Clear filters).
  useEffect(() => {
    setPendingQ(qParam);
  }, [qParam]);

  // Deliberately keyed on debouncedQ alone, not qParam: if qParam changes
  // externally (e.g. Clear filters), pendingQ/debouncedQ haven't caught up
  // to it yet on this render. Depending on qParam here would re-run this
  // effect with a still-stale debouncedQ and immediately write it back to
  // the URL, undoing the external change. Reading qParam via a ref instead
  // means this only ever commits in response to the user's own typing.
  useEffect(() => {
    const normalized = debouncedQ.trim();
    if (normalized === qParamRef.current.trim()) return;
    // Changing what's being searched for invalidates the current page.
    setParams({ q: normalized || null, page: null });
  }, [debouncedQ, setParams]);

  const isSearchPending = pendingQ.trim() !== qParam.trim();

  function commitList(paramKey: "type" | "zone" | "criticality", values: string[]) {
    setParams({ [paramKey]: values.length ? values.join(",") : null, page: null });
  }

  return (
    <Box
      component="search"
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        flexWrap: { sm: "wrap" },
        alignItems: { xs: "stretch", sm: "flex-start" },
        gap: 2,
        mb: 2,
      }}
    >
      <TextField
        label="Search"
        size="small"
        value={pendingQ}
        onChange={(event) => setPendingQ(event.target.value)}
        helperText="Search by name or IP address"
        sx={{ minWidth: 240, width: { xs: "100%", sm: "auto" } }}
        slotProps={{
          input: {
            endAdornment: isSearchPending ? <CircularProgress size={16} aria-hidden="true" /> : undefined,
          },
        }}
      />
      <MultiSelectFilter<AssetType>
        label="Type"
        options={ASSET_TYPES}
        selected={filters.types}
        onChange={(values) => commitList("type", values)}
      />
      <MultiSelectFilter<Zone>
        label="Zone"
        options={ZONES}
        selected={filters.zones}
        onChange={(values) => commitList("zone", values)}
      />
      <MultiSelectFilter<Criticality>
        label="Criticality"
        options={CRITICALITIES}
        selected={filters.criticalities}
        onChange={(values) => commitList("criticality", values)}
      />
      {hasActiveFilters(filters) && (
        <Button size="small" onClick={() => clearAssetFilters(setParams)} sx={{ mt: 0.5 }}>
          Clear filters
        </Button>
      )}
      <Box sx={visuallyHiddenSx} role="status">
        {isSearchPending ? "Searching…" : qParam ? `Showing results for "${qParam}"` : ""}
      </Box>
    </Box>
  );
}
