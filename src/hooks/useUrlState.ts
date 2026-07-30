import { useCallback, useSyncExternalStore } from "react";

// The URL is the source of truth for shareable view state (page, sort, filters,
// search) — see DESIGN.md, "State ownership". No router: this is the whole
// read/write surface, kept intentionally generic so filter/search params can be
// added later without changing its shape.

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener("popstate", onStoreChange);
  return () => window.removeEventListener("popstate", onStoreChange);
}

function getSnapshot(): string {
  return window.location.search;
}

export function useUrlState(): {
  params: URLSearchParams;
  setParams: (updates: Record<string, string | null>) => void;
} {
  const search = useSyncExternalStore(subscribe, getSnapshot);
  const params = new URLSearchParams(search);

  const setParams = useCallback((updates: Record<string, string | null>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    const nextSearch = next.toString();
    const url = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
    window.history.pushState(null, "", url);
    // pushState doesn't fire popstate itself — dispatch so subscribers re-read.
    // Deferred to a microtask: setParams is typically called from inside another
    // component's own event handler (e.g. DataGrid's pagination click). Dispatching
    // synchronously re-enters React mid-handler and re-renders that component with
    // new props while it's still processing the original event — DataGrid's
    // controlled-model sync then observes a stale value and fires a second, wrong
    // update. Deferring lets the original handler finish first.
    queueMicrotask(() => window.dispatchEvent(new PopStateEvent("popstate")));
  }, []);

  return { params, setParams };
}
