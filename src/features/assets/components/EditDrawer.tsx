import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import { useGetAssetsQuery, useUpdateAssetMutation } from "../api";
import { assetFormSchema, type AssetFormValues } from "../assetFormSchema";
import { ASSET_TYPES, ZONES, CRITICALITIES, type Asset } from "../types";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export interface EditDrawerProps {
  assetId: string | null;
  onClose: () => void;
}

export function EditDrawer({ assetId, onClose }: EditDrawerProps) {
  const { data } = useGetAssetsQuery();
  const asset = data?.find((a) => a.id === assetId) ?? null;
  const open = asset !== null;

  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);

  function attemptClose() {
    if (isDirty) {
      setShowUnsavedConfirm(true);
      return;
    }
    onClose();
  }

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={attemptClose}
        slotProps={{
          // MUI forwards role/aria-* passed directly to Drawer onto *both*
          // the Modal root and the Paper, producing two role="dialog"
          // elements (ambiguous for queries and for assistive tech). Scoping
          // it to just the Paper — the actual content panel — is correct.
          paper: {
            role: "dialog",
            "aria-modal": true,
            "aria-labelledby": "edit-drawer-title",
            sx: { width: { xs: "100%", sm: 420 } },
          },
        }}
      >
        {/* Only mounted while an asset is actually being edited — this is what
            gives each editing session fresh RHF defaultValues without needing
            a reactive reset() effect that could wipe in-progress edits if the
            list refetches in the background (see EditAssetForm). */}
        {asset && (
          <EditAssetForm
            asset={asset}
            onDirtyChange={setIsDirty}
            onRequestClose={attemptClose}
            onSaved={onClose}
          />
        )}
      </Drawer>
      <UnsavedChangesDialog
        open={showUnsavedConfirm}
        onDiscard={() => {
          setShowUnsavedConfirm(false);
          onClose();
        }}
        onKeepEditing={() => setShowUnsavedConfirm(false)}
      />
    </>
  );
}

interface EditAssetFormProps {
  asset: Asset;
  onDirtyChange: (dirty: boolean) => void;
  onRequestClose: () => void;
  onSaved: () => void;
}

export function EditAssetForm({ asset, onDirtyChange, onRequestClose, onSaved }: EditAssetFormProps) {
  const [updateAsset, { isLoading: isSaving, error: saveError }] = useUpdateAssetMutation();
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<AssetFormValues>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: {
      name: asset.name,
      type: asset.type,
      ipAddress: asset.ipAddress,
      zone: asset.zone,
      criticality: asset.criticality,
    },
  });

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateAsset({ id: asset.id, changes: values }).unwrap();
      onSaved();
    } catch {
      // Surfaced via saveError below — form values are untouched, nothing lost.
    }
  });

  return (
    <Box component="form" onSubmit={onSubmit} noValidate sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography id="edit-drawer-title" variant="h6" component="h2">
          Edit asset
        </Typography>
        <IconButton aria-label="Close" onClick={onRequestClose} edge="end">
          <CloseIcon />
        </IconButton>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Last seen {dateTimeFormatter.format(new Date(asset.lastSeen))}
      </Typography>

      {saveError && (
        <Alert severity="error" role="alert" sx={{ mb: 2 }}>
          Failed to save changes. Your edits have not been lost — try again.
        </Alert>
      )}

      <Stack spacing={2}>
        <Controller
          name="name"
          control={control}
          render={({ field: { ref, ...field } }) => (
            <TextField
              {...field}
              inputRef={(el) => {
                ref(el);
                nameInputRef.current = el;
              }}
              label="Name"
              required
              error={!!errors.name}
              helperText={errors.name?.message}
            />
          )}
        />

        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <FormControl error={!!errors.type}>
              <InputLabel id="edit-type-label">Type</InputLabel>
              <Select {...field} labelId="edit-type-label" label="Type">
                {ASSET_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
              {errors.type && <FormHelperText>{errors.type.message}</FormHelperText>}
            </FormControl>
          )}
        />

        <Controller
          name="ipAddress"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="IP address"
              required
              error={!!errors.ipAddress}
              helperText={errors.ipAddress?.message}
            />
          )}
        />

        <Controller
          name="zone"
          control={control}
          render={({ field }) => (
            <FormControl error={!!errors.zone}>
              <InputLabel id="edit-zone-label">Zone</InputLabel>
              <Select {...field} labelId="edit-zone-label" label="Zone">
                {ZONES.map((zone) => (
                  <MenuItem key={zone} value={zone}>
                    {zone}
                  </MenuItem>
                ))}
              </Select>
              {errors.zone && <FormHelperText>{errors.zone.message}</FormHelperText>}
            </FormControl>
          )}
        />

        <Controller
          name="criticality"
          control={control}
          render={({ field }) => (
            <FormControl error={!!errors.criticality}>
              <InputLabel id="edit-criticality-label">Criticality</InputLabel>
              <Select {...field} labelId="edit-criticality-label" label="Criticality">
                {CRITICALITIES.map((criticality) => (
                  <MenuItem key={criticality} value={criticality}>
                    {criticality}
                  </MenuItem>
                ))}
              </Select>
              {errors.criticality && <FormHelperText>{errors.criticality.message}</FormHelperText>}
            </FormControl>
          )}
        />
      </Stack>

      <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 3 }}>
        <Button onClick={onRequestClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" disabled={isSaving || !isDirty}>
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </Stack>
    </Box>
  );
}
