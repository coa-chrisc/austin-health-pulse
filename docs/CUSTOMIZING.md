# Rebranding for your agency

Everything an agency normally changes lives in one city config file. You don't need to edit any components.

![The partner-city demo preset: Harris County data with its own name, colors, and logo](screenshots/07-partner-city.png)

## 1. Start from a preset

```bash
cp config/presets/partner-city-demo.json config/presets/my-city.json
```

Edit the copy, then build with it:

```bash
cd app
CITY_CONFIG=presets/my-city.json npm run validate:data
CITY_CONFIG=presets/my-city.json npm run dev       # live preview; reloads when the config changes
```

The config is checked against [`config/city.config.schema.json`](../config/city.config.schema.json) when you build. Editors that support JSON Schema, such as VS Code, autocomplete and flag errors as you type because of the `$schema` line at the top of each preset.

To make your config the default, copy it over `config/city.config.json`.

## 2. Names and text

| Key | Where it shows |
| --- | --- |
| `appName` | Header, browser tab title, page description, About panel, idle showcase |
| `agency.name`, `agency.shortName`, `agency.parent` | Header subtitle, footer, About panel credits, "Built by …" badge |
| `region.name` | Used as a proper noun throughout, for example "across Harris County" and "the Harris County average". Name the area your ZIP codes actually cover. |
| `region.cityName` | Service Guide buttons and text ("Find Houston services that can help") |
| `featuredZips` | The "Try a neighborhood" buttons on the home page |
| `dataSources`, `dataAsOf` | Footer and About panel |
| `serviceGuideUrl` | Base URL for the Service Guide links. Set it to `null` to hide them. |
| `showBuildStory` | Shows the About panel's "How This Was Built" section, which is the City of Austin's build story with its own hours and costs. Leave it out or set it to `false` for your agency. |

## 3. Colors

`brand.colors` sets 16 colors. The key names come from the Austin Public Health palette, but each one plays a role:

| Key | Role |
| --- | --- |
| `blue` | Primary: active navigation, buttons, links, section headings, slider fills |
| `darkBlue` | Ink: header and footer background, headings, large numbers |
| `green` | Secondary: logo tile, "Explore" button, accents, and the "better" end of data scales |
| `darkGreen` | Strongest "better" color in data scales; positive numbers |
| `compliantGreen` | Part of the Austin palette. It is exposed as `aph-compliant-green` but no component uses it yet. |
| `white` | Page background (an off-white in Austin's palette) |
| `lightBlue`, `lightGreen` | Tinted card backgrounds and soft gradients |
| `red`, `orange`, `yellow` | The "worse" end of data scales: map shading, the bar strip, gauges, and comparison table highlights |
| `cyan`, `purple`, `brown` | Extra series colors for charts |
| `lightGray`, `darkGray` | "No data" fills, borders, and secondary text |

Two things to keep in mind:

- **The data scales use your colors.** The map, the bar strip, and the comparison table run from `red` through `orange` and `yellow` to `green` and `darkGreen`. If your secondary brand color isn't a green, those scales will no longer read as bad-to-good. Pick a `green` and `darkGreen` that still read as "better" next to your `red`.
- **Check contrast.** White text sits on `blue`, `darkBlue`, and `green`, and `darkBlue` text sits on `white`, `lightBlue`, and `lightGreen`. Aim for WCAG AA contrast (4.5:1 for body text).

How it works: the build writes your colors into the page `<head>` as `--color-aph-*` CSS variables, so the page never shows the default palette first. Components use them through Tailwind utilities such as `bg-aph-blue` and `text-aph-dark-blue`, or through `APH_COLORS` in TypeScript. The `aph` prefix is historical; it carries your colors, not Austin's. When you add UI, use these tokens instead of hex values.

## 4. Logo and browser-tab icon

Put your logo under `config/brand/<your-id>/` and point `brand.logoUrl` at it, relative to `config/`:

```json
"brand": { "logoUrl": "brand/my-city/logo.svg", "colors": { … } }
```

- **Format:** SVG, PNG, or WebP.
- **Where it shows:** in a 40-pixel tile filled with `green` in the header, so a white or light mark works best.
- **How it's served:** the build bundles the file with the app, so it is served from your own site and passes the Content-Security-Policy. Logos hosted elsewhere are not supported.
- **When it's `null`:** a health-and-safety icon appears instead.
- **Checks:** `validate:data` and the build both fail if the file is missing.

The browser-tab icon is generated from your `green`: a rounded square with a white plus.

## 5. Fonts

The app uses Geist for text and Material Symbols for icons. Both are bundled with the app through `@fontsource` packages, so the browser contacts no font service.

To change the text font:

1. `npm install @fontsource/<font>` in `app/`.
2. Import the weights you need in `app/src/main.tsx`, replacing the Geist imports.
3. Change `--font-geist` in `app/src/index.css`.

Don't load fonts from a third-party host. The Content-Security-Policy in `deploy/nginx.conf` blocks them, and loading them would tell that host about every visitor.

## 6. Map

`map.center` (`[lat, lng]`), `zoom`, `minZoom`, and `maxZoom` set the starting view. Map tiles come from OpenStreetMap's public tile server. For a kiosk or a high-traffic site, read the [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/) and consider your own tile provider. If you switch providers, update the tile URL in `app/src/lib/constants.ts` and `img-src` in `deploy/nginx.conf`.

## 7. Check your work

```bash
cd app
CITY_CONFIG=presets/my-city.json npm run validate:data
CITY_CONFIG=presets/my-city.json BASE_PATH=/ npm run build
npm run screenshots   # regenerates docs/screenshots; needs Google Chrome (set CHROME_PATH if it isn't in the macOS default location)
```

The City of Austin and Austin Public Health names, logos, and palette identify the City. The Apache-2.0 license covers the code, not those marks, so replace them in your deployment.
