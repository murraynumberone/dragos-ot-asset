import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_BASE_URL } from "../../apiConfig";
import type { Asset } from "./types";

export const assetsApi = createApi({
  reducerPath: "assetsApi",
  baseQuery: fetchBaseQuery({ baseUrl: API_BASE_URL }),
  tagTypes: ["Asset"],
  endpoints: (builder) => ({
    // Fetched once and cached — filtering/sorting/pagination happen client-side
    // against this list (see DESIGN.md, "API / data flow").
    getAssets: builder.query<Asset[], void>({
      query: () => "/assets",
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Asset" as const, id })),
              { type: "Asset" as const, id: "LIST" },
            ]
          : [{ type: "Asset" as const, id: "LIST" }],
    }),

    // Exists only to demo the error state from the live app. AssetTable calls
    // this (not getAssets) via useTriggerErrorQuery(undefined, { skip }),
    // skipping unless the committed search term is exactly "force-error" —
    // real search never re-fetches the cached list.
    triggerError: builder.query<void, void>({
      query: () => ({ url: "/assets", params: { q: "force-error" } }),
    }),

    updateAsset: builder.mutation<Asset, { id: string; changes: Partial<Omit<Asset, "id">> }>({
      query: ({ id, changes }) => ({
        url: `/assets/${id}`,
        method: "PATCH",
        body: changes,
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "Asset", id }],
    }),
  }),
});

export const {
  useGetAssetsQuery,
  useTriggerErrorQuery,
  useLazyTriggerErrorQuery,
  useUpdateAssetMutation,
} = assetsApi;
