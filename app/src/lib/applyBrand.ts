import { cityConfig } from "./cityConfig";

/**
 * Mirror the configured brand palette onto the `--color-aph-*` custom
 * properties so Tailwind's `aph-*` utilities follow the city config
 * (index.css @theme only supplies defaults). Also sets the document title.
 */
export function applyBrand() {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(cityConfig.brand.colors)) {
    const kebab = name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    root.style.setProperty(`--color-aph-${kebab}`, value);
  }
  document.title = cityConfig.appName;
}
