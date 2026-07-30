import { http, HttpResponse, delay } from "msw";
import { API_BASE_URL } from "../apiConfig";
import { createMockAssets } from "./data";
import type { Asset } from "../features/assets/types";

// `let`, not `const` — PATCH mutates this in place so edits persist for the
// session (no real backend, by design; resets on reload / resetMockAssets()).
let assets: Asset[] = createMockAssets();

// Restores the pristine dataset between tests. The MSW server itself only
// resets *handlers* added at runtime (server.use(...)) — it has no idea this
// module keeps its own mutable state, so tests must reset it explicitly.
export function resetMockAssets(): void {
  assets = createMockAssets();
}

export const handlers = [
  http.get(`${API_BASE_URL}/assets`, async ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q");

    await delay(400);

    // Reachable only via a dedicated trigger query (see features/assets/api.ts) —
    // otherwise real search never sends `q` to the server, since filtering
    // happens client-side against the single cached fetch.
    if (q?.trim().toLowerCase() === "force-error") {
      return HttpResponse.json(
        { message: 'Internal server error (forced via the "force-error" search term)' },
        { status: 500 },
      );
    }

    return HttpResponse.json(assets);
  }),

  http.patch(`${API_BASE_URL}/assets/:id`, async ({ params, request }) => {
    await delay(300);

    const { id } = params;
    const index = assets.findIndex((asset) => asset.id === id);
    if (index === -1) {
      return HttpResponse.json({ message: `Asset ${String(id)} not found` }, { status: 404 });
    }

    const changes = (await request.json()) as Partial<Omit<Asset, "id">>;
    assets[index] = { ...assets[index], ...changes, id: assets[index].id };
    return HttpResponse.json(assets[index]);
  }),
];
