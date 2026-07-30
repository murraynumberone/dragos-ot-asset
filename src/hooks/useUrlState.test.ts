import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useUrlState } from "./useUrlState";

afterEach(() => {
  window.history.pushState(null, "", "/");
});

describe("useUrlState", () => {
  it("reads params already present in the URL", () => {
    window.history.pushState(null, "", "/?page=2&sortField=name");
    const { result } = renderHook(() => useUrlState());
    expect(result.current.params.get("page")).toBe("2");
    expect(result.current.params.get("sortField")).toBe("name");
  });

  it("writes a param to the URL and reflects it on the next read", async () => {
    const { result } = renderHook(() => useUrlState());
    await act(async () => {
      result.current.setParams({ page: "3" });
    });
    expect(window.location.search).toBe("?page=3");
    expect(result.current.params.get("page")).toBe("3");
  });

  it("removes a param when set to null", () => {
    window.history.pushState(null, "", "/?page=3&pageSize=25");
    const { result } = renderHook(() => useUrlState());
    act(() => result.current.setParams({ page: null }));
    expect(new URLSearchParams(window.location.search).get("page")).toBeNull();
    expect(new URLSearchParams(window.location.search).get("pageSize")).toBe("25");
  });

  it("merges updates without clobbering unrelated params", () => {
    window.history.pushState(null, "", "/?sortField=name&sortDir=asc");
    const { result } = renderHook(() => useUrlState());
    act(() => result.current.setParams({ page: "2" }));

    const params = new URLSearchParams(window.location.search);
    expect(params.get("sortField")).toBe("name");
    expect(params.get("sortDir")).toBe("asc");
    expect(params.get("page")).toBe("2");
  });
});
