import mermaid from "mermaid";

let initializedTheme: "light" | "dark" | null = null;
let counter = 0;
let renderContainer: HTMLDivElement | null = null;

function ensureInitialized(theme: "light" | "dark") {
  if (initializedTheme === theme) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: theme === "dark" ? "dark" : "default",
    securityLevel: "strict",
  });
  initializedTheme = theme;
}

// mermaid.render(), when the source fails to parse, falls back to rendering
// its own "syntax error" diagram and only THEN rethrows -- skipping its own
// cleanup of the temp element it renders into. Without an explicit target,
// that temp element is appended straight to document.body and never removed,
// leaking a giant error graphic into the page on every invalid intermediate
// state while typing. Giving it our own off-screen container confines the
// leak there instead (and each call clears it before rendering into it
// again). Off-screen via position, not display:none, so mermaid's internal
// getBBox() layout measurements still work.
function ensureRenderContainer(): HTMLDivElement {
  if (renderContainer?.isConnected) return renderContainer;
  const el = document.createElement("div");
  el.style.position = "fixed";
  el.style.top = "-10000px";
  el.style.left = "-10000px";
  el.style.visibility = "hidden";
  el.style.pointerEvents = "none";
  document.body.appendChild(el);
  renderContainer = el;
  return el;
}

export async function renderMermaid(
  source: string,
  theme: "light" | "dark",
): Promise<{ svg: string }> {
  ensureInitialized(theme);
  counter += 1;
  const container = ensureRenderContainer();
  const { svg } = await mermaid.render(
    `mermaid-diagram-${counter}`,
    source,
    container,
  );
  return { svg };
}
