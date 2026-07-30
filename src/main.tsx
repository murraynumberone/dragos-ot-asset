import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import "./index.css";
import App from "./App.tsx";
import { store } from "./app/store";
import { ThemeModeProvider } from "./app/ThemeContext";

async function enableMocking() {
  const { worker } = await import("./mocks/browser");
  // Only our own /api/* routes are mocked — let everything else (Vite's own
  // dev-server requests, etc.) pass through instead of warning on every one.
  return worker.start({ onUnhandledRequest: "bypass" });
}

enableMocking().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Provider store={store}>
        <ThemeModeProvider>
          <App />
        </ThemeModeProvider>
      </Provider>
    </StrictMode>,
  );
});
