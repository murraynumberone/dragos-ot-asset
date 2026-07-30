import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import type { ReactNode } from "react";
import { assetsApi, useGetAssetsQuery, useLazyTriggerErrorQuery, useUpdateAssetMutation } from "./api";

function renderWithStore() {
  const store = configureStore({
    reducer: { [assetsApi.reducerPath]: assetsApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(assetsApi.middleware),
  });
  const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;
  return { wrapper };
}

describe("assetsApi", () => {
  it("fetches the full mock asset list", async () => {
    const { wrapper } = renderWithStore();
    const { result } = renderHook(() => useGetAssetsQuery(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(300);
  });

  it("surfaces a server error via the dedicated force-error trigger, without affecting the cached list", async () => {
    const { wrapper } = renderWithStore();
    const { result } = renderHook(
      () => ({ list: useGetAssetsQuery(), trigger: useLazyTriggerErrorQuery() }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    const [fireTrigger] = result.current.trigger;
    await expect(fireTrigger().unwrap()).rejects.toBeTruthy();

    await waitFor(() => expect(result.current.trigger[1].isError).toBe(true));
    expect(result.current.list.isSuccess).toBe(true);
    expect(result.current.list.data).toHaveLength(300);
  });

  it("persists an update through the PATCH mutation", async () => {
    const { wrapper } = renderWithStore();
    const { result } = renderHook(
      () => ({ list: useGetAssetsQuery(), update: useUpdateAssetMutation() }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    const target = result.current.list.data![0];

    const [update] = result.current.update;
    const updated = await update({ id: target.id, changes: { criticality: "Critical" } }).unwrap();

    expect(updated.id).toBe(target.id);
    expect(updated.criticality).toBe("Critical");
  });
});
