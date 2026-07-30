import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "../mocks/server";
import { resetMockAssets } from "../mocks/handlers";

// jsdom has no layout engine: elements report 0x0 dimensions and there's no
// ResizeObserver. MUI X DataGrid's row virtualization relies on both to work
// out what's "visible" — without these it renders zero rows even with data.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
}
Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
  configurable: true,
  value: 1000,
});
Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
  configurable: true,
  value: 1000,
});

// jsdom declares window.matchMedia (so `"matchMedia" in window` is true) but
// never actually implements it as a callable function — needed for the theme
// toggle's system-preference default. Writable/configurable so individual
// tests can override it (e.g. to simulate a dark-mode OS preference).
Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  // Not using `globals: true`, so RTL can't auto-detect Vitest and auto-clean —
  // without this, each render() in a test file stacks on top of the last one.
  cleanup();
  server.resetHandlers();
  resetMockAssets();
});
afterAll(() => server.close());
