import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

export interface UnsavedChangesDialogProps {
  open: boolean;
  onDiscard: () => void;
  onKeepEditing: () => void;
}

// MUI's Dialog (unlike Drawer) already provides role="dialog", aria-modal,
// and a focus trap out of the box — no custom ARIA wiring needed here.
export function UnsavedChangesDialog({ open, onDiscard, onKeepEditing }: UnsavedChangesDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onKeepEditing}
      aria-labelledby="unsaved-changes-title"
      aria-describedby="unsaved-changes-description"
    >
      <DialogTitle id="unsaved-changes-title">Discard unsaved changes?</DialogTitle>
      <DialogContent>
        <DialogContentText id="unsaved-changes-description">
          You have unsaved changes to this asset. If you close now, they will be lost.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onKeepEditing} autoFocus>
          Keep editing
        </Button>
        <Button onClick={onDiscard} color="error">
          Discard changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}
