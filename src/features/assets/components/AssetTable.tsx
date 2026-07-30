import { useEffect, useMemo } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import {
  DataGrid,
  GridActionsCellItem,
  type GridColDef,
  type GridPaginationModel,
  type GridSortModel,
} from "@mui/x-data-grid";
import type { SerializedError } from "@reduxjs/toolkit";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import EditIcon from "@mui/icons-material/Edit";
import { useGetAssetsQuery, useTriggerErrorQuery } from "../api";
import { useUrlState } from "../../../hooks/useUrlState";
import type { Asset } from "../types";
import { compareCriticality, compareIpAddress } from "../sortComparators";
import { clearAssetFilters, filterAssets, hasActiveFilters, parseAssetFiltersFromValues } from "../selectors";
import { CriticalityChip } from "./CriticalityChip";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_SORT_FIELD = "name";

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

function parsePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed - 1 : 0;
}

function parsePageSize(value: string | null): number {
  const parsed = Number(value);
  return PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : DEFAULT_PAGE_SIZE;
}

function formatFetchErrorMessage(error: FetchBaseQueryError | SerializedError | undefined): string {
  return error && "status" in error
    ? `Failed to load assets (status ${String(error.status)}).`
    : "Failed to load assets.";
}

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function formatRelative(date: Date): string {
  const diffMinutes = Math.round((date.getTime() - Date.now()) / 60_000);
  if (Math.abs(diffMinutes) < 60) return relativeTimeFormatter.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return relativeTimeFormatter.format(diffHours, "hour");
  const diffDays = Math.round(diffHours / 24);
  return relativeTimeFormatter.format(diffDays, "day");
}

interface NoRowsOverlayProps {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

// Rendered directly in place of DataGrid when there are zero rows — same
// pattern as the loading/error branches below, not a DataGrid slot. Avoids
// DataGrid's slots/slotProps typing entirely, which has no clean way to type
// a custom overlay's own props.
function NoRowsOverlay({ hasActiveFilters, onClearFilters }: NoRowsOverlayProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 1,
      }}
    >
      <Box>{hasActiveFilters ? "No assets match your filters." : "No assets found."}</Box>
      {hasActiveFilters && (
        <Button size="small" onClick={onClearFilters}>
          Clear filters
        </Button>
      )}
    </Box>
  );
}

export interface AssetTableProps {
  onEditAsset?: (assetId: string) => void;
}

export function AssetTable({ onEditAsset }: AssetTableProps) {
  const { data, isLoading, isError: isGetAssetsError, error: getAssetsError } = useGetAssetsQuery();
  const { params, setParams } = useUrlState();

  // DataGrid checks these controlled props for changes *by reference*
  // (see useGridSorting's `currentModel !== model`) — a fresh object/array
  // literal every render looks like "the sort/page changed" on every render,
  // which silently retriggers DataGrid's own "sort changed → reset to page 0"
  // behavior. Memoizing on the underlying primitives keeps identity stable.
  const pageParam = params.get("page");
  const pageSizeParam = params.get("pageSize");
  const paginationModel: GridPaginationModel = useMemo(
    () => ({ page: parsePage(pageParam), pageSize: parsePageSize(pageSizeParam) }),
    [pageParam, pageSizeParam],
  );

  const sortField = params.get("sortField") ?? DEFAULT_SORT_FIELD;
  const sortDir = params.get("sortDir") === "desc" ? "desc" : "asc";
  const sortModel: GridSortModel = useMemo(
    () => [{ field: sortField, sort: sortDir }],
    [sortField, sortDir],
  );

  const qParam = params.get("q") ?? "";
  const typeParam = params.get("type");
  const zoneParam = params.get("zone");
  const criticalityParam = params.get("criticality");
  const filters = useMemo(
    () => parseAssetFiltersFromValues(qParam, typeParam, zoneParam, criticalityParam),
    [qParam, typeParam, zoneParam, criticalityParam],
  );

  // FilterBar writes `q` to the URL as typed, including the magic value — the
  // trigger query is what actually demos the error state (see api.ts); real
  // search never fires it.
  const isForceError = filters.q.trim().toLowerCase() === "force-error";
  const triggerError = useTriggerErrorQuery(undefined, { skip: !isForceError });

  const filteredData = useMemo(
    () => (data ? filterAssets(data, filters) : undefined),
    [data, filters],
  );

  // The force-error demo always takes over the whole view — that's its entire
  // purpose. A genuine getAssets failure only does the same when there's no
  // usable data left to show at all: a background refetch failing (e.g. the
  // one RTK Query fires automatically after a successful edit invalidates the
  // list) shouldn't nuke a perfectly good, already-displayed list just because
  // the *next* fetch attempt failed — the stale data is still worth showing.
  const showForceError = isForceError && triggerError.isError;
  const hasData = data !== undefined;
  const showFullPageError = showForceError || (isGetAssetsError && !hasData);
  const showStaleDataWarning = isGetAssetsError && hasData && !showForceError;

  // If the URL names a page beyond what the current (possibly filtered) row
  // count actually supports — a pasted link to a page that no longer exists,
  // or a filter that shrank the result set — DataGrid clamps its own *display*
  // to the last valid page but has no way to tell us, so the URL itself stays
  // wrong and sharing it again reproduces the mismatch. Correct the URL
  // ourselves once the real row count is known, rather than relying on that
  // internal clamp.
  useEffect(() => {
    if (!filteredData) return;
    const pageCount = Math.max(1, Math.ceil(filteredData.length / paginationModel.pageSize));
    if (paginationModel.page >= pageCount) {
      setParams({ page: String(pageCount) });
    }
  }, [filteredData, paginationModel.page, paginationModel.pageSize, setParams]);

  const columns: GridColDef<Asset>[] = useMemo(
    () => [
      { field: "name", headerName: "Name", flex: 1.2, minWidth: 160 },
      { field: "type", headerName: "Type", flex: 1.2, minWidth: 170 },
      {
        field: "ipAddress",
        headerName: "IP Address",
        flex: 1,
        minWidth: 140,
        sortComparator: compareIpAddress,
      },
      { field: "zone", headerName: "Zone", flex: 1.3, minWidth: 190 },
      {
        field: "criticality",
        headerName: "Criticality",
        flex: 0.8,
        minWidth: 130,
        sortComparator: compareCriticality,
        renderCell: (cellParams) => <CriticalityChip value={cellParams.value} />,
      },
      {
        field: "lastSeen",
        headerName: "Last Seen",
        type: "dateTime",
        flex: 1,
        minWidth: 200,
        valueGetter: (_value, row) => new Date(row.lastSeen),
        renderCell: (cellParams) => {
          const date = cellParams.value as Date;
          return (
            <Tooltip title={formatRelative(date)}>
              <span>{dateTimeFormatter.format(date)}</span>
            </Tooltip>
          );
        },
      },
      {
        field: "actions",
        type: "actions",
        headerName: "",
        width: 56,
        getActions: (cellParams) => [
          <GridActionsCellItem
            key="edit"
            icon={<EditIcon />}
            label={`Edit ${cellParams.row.name}`}
            showInMenu={false}
            onClick={() => onEditAsset?.(cellParams.row.id)}
          />,
        ],
      },
    ],
    [onEditAsset],
  );

  if (showFullPageError) {
    const message = formatFetchErrorMessage(showForceError ? triggerError.error : getAssetsError);
    return (
      <Alert severity="error" role="alert">
        {message}
      </Alert>
    );
  }

  const statusText = isLoading
    ? "Loading assets…"
    : data && filteredData
      ? filteredData.length === data.length
        ? `${data.length} assets loaded`
        : `${filteredData.length} of ${data.length} assets match your filters`
      : "";

  return (
    <Box sx={{ height: "100%", width: "100%" }} aria-busy={isLoading}>
      <Box sx={visuallyHiddenSx} role="status">
        {statusText}
      </Box>
      {showStaleDataWarning && (
        <Alert severity="warning" role="alert" sx={{ mb: 1 }}>
          Showing previously loaded data — the latest refresh failed.
        </Alert>
      )}
      {isLoading || !filteredData ? (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
          <CircularProgress aria-label="Loading assets" />
        </Box>
      ) : filteredData.length === 0 ? (
        <NoRowsOverlay
          hasActiveFilters={hasActiveFilters(filters)}
          onClearFilters={() => clearAssetFilters(setParams)}
        />
      ) : (
        <DataGrid
          rows={filteredData}
          columns={columns}
          getRowId={(row) => row.id}
          paginationMode="client"
          sortingMode="client"
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          paginationModel={paginationModel}
          onPaginationModelChange={(model) =>
            setParams({ page: String(model.page + 1), pageSize: String(model.pageSize) })
          }
          sortModel={sortModel}
          onSortModelChange={(model) => {
            const next = model[0];
            setParams({
              sortField: next?.field ?? null,
              sortDir: next?.sort ?? null,
            });
          }}
          disableColumnFilter
          disableRowSelectionOnClick
        />
      )}
    </Box>
  );
}
