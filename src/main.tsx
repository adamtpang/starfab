import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Fonts are bundled from npm (OFL-1.1), so the page makes no font request
// to another site at runtime.
import "@fontsource/exo-2/200.css";
import "@fontsource/exo-2/300.css";
import "@fontsource/exo-2/500.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-sans-condensed/400.css";
import "@fontsource/ibm-plex-sans-condensed/500.css";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
