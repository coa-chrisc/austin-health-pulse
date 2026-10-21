import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Fonts are bundled rather than loaded from Google Fonts, so visitors'
// browsers make no third-party font requests.
import "virtual:theme-fonts";
import "@fontsource/material-symbols-outlined/latin-400.css";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
