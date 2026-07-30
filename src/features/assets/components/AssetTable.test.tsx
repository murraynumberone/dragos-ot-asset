import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { http, HttpResponse } from "msw";
import { server } from "../../../mocks/server";
import { API_BASE_URL } from "../../../apiConfig";
import { assetsApi, useUpdateAssetMutation } from "../api";
import { createMockAssets } from "../../../mocks/data";
import { AssetTable } from "./AssetTable";

function makeStore() {
  return configureStore({
    reducer: { [assetsApi.reducerPath]: assetsApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(assetsApi.middleware),
  });
}

function renderTable() {
  return render(
    <Provider store={makeStore()}>
      <AssetTable />
    </Provider>,
  );
}

// Renders AssetTable alongside a hidden trigger for the update mutation, so
// tests can simulate "an edit succeeded, and the invalidation-triggered
// refetch of the list then failed" without going through the full edit-drawer
// UI (which already has its own save-flow tests).
function TriggerUpdateButton() {
  const [update] = useUpdateAssetMutation();
  return (
    <button onClick={() => update({ id: "asset-1", changes: { criticality: "Critical" } })}>
      trigger-update
    </button>
  );
}

function renderTableWithUpdateTrigger() {
  return render(
    <Provider store={makeStore()}>
      <TriggerUpdateButton />
      <AssetTable />
    </Provider>,
  );
}

afterEach(() => {
  window.history.pushState(null, "", "/");
});

describe("AssetTable", () => {
  it("shows a loading state before data arrives", () => {
    renderTable();
    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
  });

  it("renders all six required columns", async () => {
    renderTable();
    for (const header of ["Name", "Type", "IP Address", "Zone", "Criticality", "Last Seen"]) {
      expect(await screen.findByRole("columnheader", { name: header })).toBeInTheDocument();
    }
  });

  it("paginates client-side across the full 300-row mock dataset", async () => {
    renderTable();
    await waitFor(() => {
      expect(screen.getByText("1–25 of 300")).toBeInTheDocument();
    });
  });

  it("initializes pagination from the URL", async () => {
    window.history.pushState(null, "", "/?page=2&pageSize=10");
    renderTable();

    // Regression guard for a real bug: mounting DataGrid with rows=[] (before
    // the fetch resolves) while a controlled page > 0 is requested makes it
    // permanently clamp to page 0 and never re-sync once real rows arrive —
    // checking only the eventual footer text doesn't catch this, because a
    // *different* fix (memoizing paginationModel/sortModel) independently
    // happens to mask the same symptom. Asserting the grid doesn't exist yet
    // pins down the actual precondition instead of just the end state.
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("11–20 of 300")).toBeInTheDocument();
    });
  });

  it("updates the URL when the page changes", async () => {
    const user = userEvent.setup();
    renderTable();
    await waitFor(() => expect(screen.getByText("1–25 of 300")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /go to next page/i }));

    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).get("page")).toBe("2");
    });
  });

  it("updates the URL and aria-sort when a column header is clicked", async () => {
    const user = userEvent.setup();
    renderTable();
    const typeHeader = await screen.findByRole("columnheader", { name: "Type" });

    await user.click(typeHeader);

    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).get("sortField")).toBe("type");
    });
    expect(typeHeader).toHaveAttribute("aria-sort", "ascending");
  });

  it("shows an accessible error state if the request fails", async () => {
    server.use(
      http.get(`${API_BASE_URL}/assets`, () => HttpResponse.json({ message: "boom" }, { status: 500 })),
    );
    renderTable();
    expect(await screen.findByRole("alert")).toHaveTextContent(/failed to load assets/i);
  });

  it("shows an empty state when there are no assets", async () => {
    server.use(http.get(`${API_BASE_URL}/assets`, () => HttpResponse.json([])));
    renderTable();
    expect(await screen.findByText(/no assets found/i)).toBeInTheDocument();
  });

  it("applies a type filter from the URL and reports the reduced count", async () => {
    const expectedCount = createMockAssets().filter((a) => a.type === "Firewall").length;
    window.history.pushState(null, "", "/?type=Firewall");
    renderTable();

    await waitFor(() => {
      expect(
        screen.getByText(new RegExp(`${expectedCount} of 300 assets match your filters`)),
      ).toBeInTheDocument();
    });
  });

  it("applies a text search from the URL against name and IP address", async () => {
    const target = createMockAssets()[0];
    window.history.pushState(null, "", `/?q=${encodeURIComponent(target.name)}`);
    renderTable();

    await waitFor(() => {
      expect(screen.getByText(/1 of 300 assets match your filters/i)).toBeInTheDocument();
    });
  });

  it("ANDs multiple filter dimensions together via the URL, and offers a way to clear them", async () => {
    const user = userEvent.setup();
    // PLC only ever appears in Level 0/1 zones in the generator (see mocks/data.ts),
    // so pairing it with an unrelated zone is guaranteed to yield zero rows.
    window.history.pushState(null, "", "/?type=PLC&zone=DMZ");
    renderTable();

    expect(await screen.findByText(/no assets match your filters/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /clear filters/i }));

    await waitFor(() => {
      expect(window.location.search).toBe("");
    });
    expect(await screen.findByText("1–25 of 300")).toBeInTheDocument();
  });

  it("shows a plain empty state with no clear action when there are no filters to clear", async () => {
    server.use(http.get(`${API_BASE_URL}/assets`, () => HttpResponse.json([])));
    renderTable();

    expect(await screen.findByText(/no assets found/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /clear filters/i })).not.toBeInTheDocument();
  });

  it("shows the accessible error alert when the URL's q is the force-error trigger", async () => {
    window.history.pushState(null, "", "/?q=force-error");
    renderTable();
    expect(await screen.findByRole("alert")).toHaveTextContent(/failed to load assets/i);
  });
});

describe("AssetTable: background refetch failure after a successful edit", () => {
  it("keeps showing the grid with the stale data instead of a full-page error", async () => {
    const user = userEvent.setup();
    renderTableWithUpdateTrigger();

    await waitFor(() => screen.getByText("1–25 of 300"));
    expect(screen.getByRole("grid")).toBeInTheDocument();

    // From this point on, any GET /assets (i.e. the refetch that
    // invalidatesTags triggers after the mutation below) fails — but the
    // PATCH itself is untouched, so it still succeeds.
    server.use(
      http.get(`${API_BASE_URL}/assets`, () => HttpResponse.json({ message: "boom" }, { status: 500 })),
    );

    await user.click(screen.getByRole("button", { name: "trigger-update" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/showing previously loaded data/i);
    // The grid must still be there — not replaced by the full-page takeover.
    expect(screen.getByRole("grid")).toBeInTheDocument();
    expect(screen.queryByText(/^failed to load assets/i)).not.toBeInTheDocument();
  });

  it("still shows the full-page error when there truly is no data to fall back on", async () => {
    server.use(
      http.get(`${API_BASE_URL}/assets`, () => HttpResponse.json({ message: "boom" }, { status: 500 })),
    );
    renderTable();

    expect(await screen.findByRole("alert")).toHaveTextContent(/^failed to load assets/i);
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });

  it("the force-error demo still takes over the whole view even though the list has data", async () => {
    // Regression guard: the fix above must not accidentally suppress the
    // deliberate force-error demo path just because getAssets still has data.
    window.history.pushState(null, "", "/?q=force-error");
    renderTable();

    expect(await screen.findByRole("alert")).toHaveTextContent(/^failed to load assets/i);
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });
});

describe("AssetTable: out-of-range page correction", () => {
  it("corrects a wildly out-of-range page in the URL to the actual last page", async () => {
    window.history.pushState(null, "", "/?page=9999");
    renderTable();

    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).get("page")).toBe("12");
    });
    // 300 rows / 25 per page = 12 pages; the last page holds rows 276–300.
    expect(await screen.findByText("276–300 of 300")).toBeInTheDocument();
  });

  it("corrects based on the filtered count, not the total", async () => {
    const expectedCount = createMockAssets().filter((a) => a.type === "Firewall").length;
    const expectedLastPage = Math.ceil(expectedCount / 10);
    window.history.pushState(null, "", `/?type=Firewall&pageSize=10&page=999`);
    renderTable();

    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).get("page")).toBe(String(expectedLastPage));
    });
  });

  it("does not touch a page that's already valid", async () => {
    window.history.pushState(null, "", "/?page=2");
    renderTable();

    await waitFor(() => screen.getByText("26–50 of 300"));
    // Give the correction effect a chance to (not) fire.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(new URLSearchParams(window.location.search).get("page")).toBe("2");
  });
});
