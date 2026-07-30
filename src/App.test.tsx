import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { assetsApi } from "./features/assets/api";
import { ThemeModeProvider } from "./app/ThemeContext";
import App from "./App";

function renderApp() {
  const store = configureStore({
    reducer: { [assetsApi.reducerPath]: assetsApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(assetsApi.middleware),
  });
  return render(
    <Provider store={store}>
      <ThemeModeProvider>
        <App />
      </ThemeModeProvider>
    </Provider>,
  );
}

// The grid defaults to sorting by name, so which asset lands on the first
// visible page isn't predictable from generation order — grab whatever Edit
// action is actually rendered, the way a real user would. MUI X's
// GridActionsCellItem renders row actions as role="menuitem" inside a
// role="menu" cell, not role="button".
async function findAnyEditButton() {
  const buttons = await screen.findAllByRole("menuitem", { name: /^Edit / });
  return buttons[0];
}

afterEach(() => {
  window.history.pushState(null, "", "/");
});

describe("App: landmark structure", () => {
  it("has a banner (app bar) and a main region for the page content", async () => {
    renderApp();
    await waitFor(() => screen.getByText(/assets loaded/i));

    expect(screen.getByRole("banner")).toBeInTheDocument();
    const main = screen.getByRole("main");
    expect(main).toBeInTheDocument();
    // The filter bar and table are the actual page content, not the app bar.
    expect(main).toContainElement(screen.getByLabelText("Search"));
    expect(main).toContainElement(screen.getByRole("grid"));
  });
});

describe("App: edit drawer end-to-end", () => {
  it("opens the drawer prefilled with the clicked row's data, saves, and the grid reflects the change", async () => {
    const user = userEvent.setup();
    renderApp();
    await waitFor(() => screen.getByText(/assets loaded/i));

    const editButton = await findAnyEditButton();
    const targetName = editButton.getAttribute("aria-label")!.replace(/^Edit /, "");
    await user.click(editButton);

    const nameInput = await screen.findByLabelText(/^Name\s?\*?$/);
    expect(nameInput).toHaveValue(targetName);

    // Prefixed with "AAA" so it's guaranteed to sort first alphabetically
    // (every real seeded name starts with a type prefix like CTRL/PLC/SW) —
    // otherwise the renamed row could sort right off the visible first page
    // of 25, and the grid genuinely updating would look like a failure.
    await user.clear(nameInput);
    await user.type(nameInput, "AAA Renamed Via E2E Test");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(await screen.findByText("AAA Renamed Via E2E Test")).toBeInTheDocument();
  });

  it("restores focus to the row's Edit button after closing the drawer", async () => {
    const user = userEvent.setup();
    renderApp();
    await waitFor(() => screen.getByText(/assets loaded/i));

    const editButton = await findAnyEditButton();
    await user.click(editButton);
    await screen.findByLabelText(/^Name\s?\*?$/);

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(editButton).toHaveFocus();
  });
});
