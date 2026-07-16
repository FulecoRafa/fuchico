import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

const params = new URLSearchParams(window.location.search);
const mermaidBlockKey = params.get("mermaidBlockKey");

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);

if (mermaidBlockKey) {
  // Popped-out diagram window: load only the mermaid module, not the whole app.
  const MermaidWindowApp = lazy(() =>
    import("@/modules/mermaid").then((m) => ({ default: m.MermaidWindowApp })),
  );
  root.render(
    <React.StrictMode>
      <Suspense fallback={null}>
        <MermaidWindowApp
          blockKey={mermaidBlockKey}
          title={params.get("title") ?? "Diagram"}
        />
      </Suspense>
    </React.StrictMode>,
  );
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
