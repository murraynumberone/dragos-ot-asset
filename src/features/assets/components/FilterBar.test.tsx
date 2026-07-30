import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { assetsApi } from "../api";
import { createMockAssets } from "../../../mocks/data";
import { FilterBar } from "./FilterBar";
import { AssetTable } from "./AssetTable";

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

describe("FilterBar", () => {
  it("renders the search box and the three filter selects", () => {
    renderWithStore(<FilterBar />);
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
    expect(screen.getByLabelText("Type")).toBeInTheDocument();
    expect(screen.getByLabelText("Zone")).toBeInTheDocument();
    expect(screen.getByLabelText("Criticality")).toBeInTheDocument();
  });

  it("shows a pending state immediately while typing, then commits to the URL after the debounce", async () => {
    const user = userEvent.setup();
    renderWithStore(<FilterBar />);

    await user.type(screen.getByLabelText("Search"), "firewall");

    expect(screen.getByRole("status")).toHaveTextContent(/searching/i);
    expect(new URLSearchParams(window.location.search).get("q")).toBeNull();

    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).get("q")).toBe("firewall");
    });
    expect(screen.getByRole("status")).toHaveTextContent(/showing results for "firewall"/i);
  });

  it("commits a type filter selection immediately, with no debounce, and resets the page", async () => {
    const user = userEvent.setup();
    window.history.pushState(null, "", "/?page=3");
    renderWithStore(<FilterBar />);

    await user.click(screen.getByLabelText("Type"));
    await user.click(screen.getByRole("option", { name: "PLC" }));

    await waitFor(() => {
      const params = new URLSearchParams(window.location.search);
      expect(params.get("type")).toBe("PLC");
      expect(params.get("page")).toBeNull();
    });
  });

  it("supports selecting multiple values for the same filter", async () => {
    const user = userEvent.setup();
    renderWithStore(<FilterBar />);

    await user.click(screen.getByLabelText("Type"));
    await user.click(screen.getByRole("option", { name: "PLC" }));
    await user.click(screen.getByRole("option", { name: "RTU" }));

    await waitFor(() => {
      const values = new URLSearchParams(window.location.search).get("type")?.split(",");
      expect(values).toEqual(expect.arrayContaining(["PLC", "RTU"]));
      expect(values).toHaveLength(2);
    });
  });

  it("removes the URL param entirely when the last selected value is deselected", async () => {
    const user = userEvent.setup();
    window.history.pushState(null, "", "/?zone=DMZ");
    renderWithStore(<FilterBar />);

    await user.click(screen.getByLabelText("Zone"));
    await user.click(screen.getByRole("option", { name: "DMZ" }));

    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).get("zone")).toBeNull();
    });
  });

  it("stays in sync when the URL changes externally (e.g. browser back)", () => {
    window.history.pushState(null, "", "/?q=existing");
    renderWithStore(<FilterBar />);
    expect(screen.getByLabelText("Search")).toHaveValue("existing");
  });

  it("hides the Clear filters action when no filters are active", () => {
    renderWithStore(<FilterBar />);
    expect(screen.queryByRole("button", { name: /clear filters/i })).not.toBeInTheDocument();
  });

  it("shows Clear filters once any filter is active, and it resets everything together", async () => {
    window.history.pushState(null, "", "/?q=firewall&type=PLC,RTU&zone=DMZ&criticality=High&page=3");
    const user = userEvent.setup();
    renderWithStore(<FilterBar />);

    const clearButton = screen.getByRole("button", { name: /clear filters/i });
    await user.click(clearButton);

    await waitFor(() => {
      expect(window.location.search).toBe("");
    });
    expect(screen.getByLabelText("Search")).toHaveValue("");
    expect(screen.queryByRole("button", { name: /clear filters/i })).not.toBeInTheDocument();
  });
});

describe("FilterBar + AssetTable integration", () => {
  it("reduces the visible rows when a filter is applied through the real UI", async () => {
    const user = userEvent.setup();
    const expectedCount = createMockAssets().filter((a) => a.type === "Firewall").length;

    renderWithStore(
      <>
        <FilterBar />
        <AssetTable />
      </>,
    );

    await waitFor(() => screen.getByText(/assets loaded/i));

    await user.click(screen.getByLabelText("Type"));
    await user.click(screen.getByRole("option", { name: "Firewall" }));

    await waitFor(() => {
      expect(
        screen.getByText(new RegExp(`${expectedCount} of \\d+ assets match your filters`)),
      ).toBeInTheDocument();
    });
  });

  it("typing the force-error magic string surfaces the accessible error alert", async () => {
    const user = userEvent.setup();
    renderWithStore(
      <>
        <FilterBar />
        <AssetTable />
      </>,
    );

    await waitFor(() => screen.getByText(/assets loaded/i));

    await user.type(screen.getByLabelText("Search"), "force-error");

    expect(await screen.findByRole("alert")).toHaveTextContent(/failed to load assets/i);
  });
});
