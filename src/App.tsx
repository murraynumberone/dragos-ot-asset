import { useCallback, useRef, useState } from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { AssetTable } from "./features/assets/components/AssetTable";
import { FilterBar } from "./features/assets/components/FilterBar";
import { EditDrawer } from "./features/assets/components/EditDrawer";
import { ThemeToggleButton } from "./app/ThemeContext";

function App() {
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const handleEditAsset = useCallback((assetId: string) => {
    triggerRef.current = document.activeElement as HTMLElement | null;
    setEditingAssetId(assetId);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setEditingAssetId(null);
    triggerRef.current?.focus();
    triggerRef.current = null;
  }, []);

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
            OT Asset Inventory
          </Typography>
          <ThemeToggleButton />
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", p: 2 }}>
        <FilterBar />
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <AssetTable onEditAsset={handleEditAsset} />
        </Box>
      </Box>
      <EditDrawer assetId={editingAssetId} onClose={handleCloseDrawer} />
    </Box>
  );
}

export default App;
