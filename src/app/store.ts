import { configureStore } from "@reduxjs/toolkit";
import { assetsApi } from "../features/assets/api";

export const store = configureStore({
  reducer: {
    [assetsApi.reducerPath]: assetsApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(assetsApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
