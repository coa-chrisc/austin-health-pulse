import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Fonts are bundled rather than loaded from Google Fonts, so visitors'
// browsers make no third-party font requests.
import "@fontsource/geist/latin-400.css";
import "@fontsource/geist/latin-600.css";
import "@fontsource/geist/latin-700.css";
import "@fontsource/material-symbols-outlined/latin-400.css";
import "./index.css";
import App from "./App";
import { applyBrand } from "./lib/applyBrand";

applyBrand();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
