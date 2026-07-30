import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { http, HttpResponse } from "msw";
import { server } from "../../../mocks/server";
import { API_BASE_URL } from "../../../apiConfig";
import { createMockAssets } from "../../../mocks/data";
import { assetsApi } from "../api";
import { EditAssetForm, EditDrawer } from "./EditDrawer";
import type { Asset } from "../types";

const testAsset: Asset = createMockAssets()[0];

function renderWithStore(children: React.ReactNode) {
  const store = configureStore({
    reducer: { [assetsApi.reducerPath]: assetsApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(assetsApi.middleware),
  });
  return render(<Provider store={store}>{children}</Provider>);
}

afterEach(() => {
  window.history.pushState(null, "", "/");
});

describe("EditAssetForm", () => {
  function renderForm(overrides: Partial<Parameters<typeof EditAssetForm>[0]> = {}) {
    const onDirtyChange = vi.fn();
    const onRequestClose = vi.fn();
    const onSaved = vi.fn();
    renderWithStore(
      <EditAssetForm
        asset={testAsset}
        onDirtyChange={onDirtyChange}
        onRequestClose={onRequestClose}
        onSaved={onSaved}
        {...overrides}
      />,
    );
    return { onDirtyChange, onRequestClose, onSaved };
  }

  it("prefills every field with the asset's current values", () => {
    renderForm();
    expect(screen.getByLabelText(/name/i)).toHaveValue(testAsset.name);
    expect(screen.getByLabelText(/ip address/i)).toHaveValue(testAsset.ipAddress);
    expect(screen.getByLabelText("Type")).toHaveTextContent(testAsset.type);
    expect(screen.getByLabelText("Zone")).toHaveTextContent(testAsset.zone);
    expect(screen.getByLabelText("Criticality")).toHaveTextContent(testAsset.criticality);
  });

  it("focuses the name field on mount", () => {
    renderForm();
    expect(screen.getByLabelText(/name/i)).toHaveFocus();
  });

  it("disables Save until the form is actually dirty", async () => {
    const user = userEvent.setup();
    renderForm();
    expect(screen.getByRole("button", { name: /^save$/i })).toBeDisabled();

    await user.type(screen.getByLabelText(/name/i), "!");
    expect(screen.getByRole("button", { name: /^save$/i })).toBeEnabled();
  });

  it("reports dirty state changes via onDirtyChange", async () => {
    const user = userEvent.setup();
    const { onDirtyChange } = renderForm();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    await user.type(screen.getByLabelText(/name/i), "!");
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
  });

  it("shows a validation error and blocks save when the name is cleared", async () => {
    const user = userEvent.setup();
    const { onSaved } = renderForm();

    await user.clear(screen.getByLabelText(/name/i));
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("shows a validation error for a malformed IP address", async () => {
    const user = userEvent.setup();
    renderForm();

    const ipInput = screen.getByLabelText(/ip address/i);
    await user.clear(ipInput);
    await user.type(ipInput, "999.1.1.1");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(await screen.findByText(/enter a valid ipv4 address/i)).toBeInTheDocument();
  });

  it("saves successfully: calls the PATCH mutation and onSaved", async () => {
    const user = userEvent.setup();
    const { onSaved } = renderForm();

    const nameInput = screen.getByLabelText(/name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Renamed Asset");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it("on save failure, shows an inline alert, keeps the drawer open, and preserves entered values", async () => {
    server.use(
      http.patch(`${API_BASE_URL}/assets/:id`, () => HttpResponse.json({ message: "boom" }, { status: 500 })),
    );
    const user = userEvent.setup();
    const { onSaved } = renderForm();

    const nameInput = screen.getByLabelText(/name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Renamed Asset");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/failed to save changes/i);
    expect(onSaved).not.toHaveBeenCalled();
    expect(nameInput).toHaveValue("Renamed Asset");
  });

  it("warns before an actual browser navigation when the form is dirty", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText(/name/i), "!");

    const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("does not warn on browser navigation when the form is clean", () => {
    renderForm();
    const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe("EditDrawer", () => {
  it("renders nothing when no asset is being edited", () => {
    renderWithStore(<EditDrawer assetId={null} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("looks up the asset by id and opens as an accessible dialog", async () => {
    renderWithStore(<EditDrawer assetId={testAsset.id} onClose={vi.fn()} />);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "edit-drawer-title");
    expect(screen.getByLabelText(/name/i)).toHaveValue(testAsset.name);
  });

  it("closes immediately on Escape when there are no unsaved changes", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithStore(<EditDrawer assetId={testAsset.id} onClose={onClose} />);
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows the unsaved-changes confirmation on Escape when dirty, instead of closing", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithStore(<EditDrawer assetId={testAsset.id} onClose={onClose} />);
    await user.type(await screen.findByLabelText(/name/i), "!");

    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText(/discard unsaved changes/i)).toBeInTheDocument();
  });

  it("'Keep editing' dismisses the confirmation without closing or losing values", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithStore(<EditDrawer assetId={testAsset.id} onClose={onClose} />);
    const nameInput = await screen.findByLabelText(/name/i);
    await user.type(nameInput, "!");
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: /keep editing/i }));

    expect(onClose).not.toHaveBeenCalled();
    // MUI's Dialog unmounts its content after a Fade exit transition, not
    // synchronously on click.
    await waitFor(() => {
      expect(screen.queryByText(/discard unsaved changes/i)).not.toBeInTheDocument();
    });
    expect(nameInput).toHaveValue(`${testAsset.name}!`);
  });

  it("'Discard changes' actually closes the drawer", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithStore(<EditDrawer assetId={testAsset.id} onClose={onClose} />);
    await user.type(await screen.findByLabelText(/name/i), "!");
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: /discard changes/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("the header close button goes through the same unsaved-changes guard", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithStore(<EditDrawer assetId={testAsset.id} onClose={onClose} />);
    await user.type(await screen.findByLabelText(/name/i), "!");

    await user.click(screen.getByRole("button", { name: /^close$/i }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText(/discard unsaved changes/i)).toBeInTheDocument();
  });
});
