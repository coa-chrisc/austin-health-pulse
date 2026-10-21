# Security

## Reporting a vulnerability

Use GitHub private vulnerability reporting: on the repository, open **Security > Advisories > Report a vulnerability**. Do not open a public issue for a suspected vulnerability.

## Data handling

The neighborhood figures come only from aggregate, de-identified public data. The optional individual lifespan estimator asks about the individual (age, sex, and habits), but it runs entirely in the browser and sends and stores nothing.

**What the app does with visitor input**

- Nothing a visitor enters leaves the browser or is stored. This covers the ZIP code, "Use my location" coordinates, age, and estimator answers.
- The app is a static site. It has no backend, database, or API. It has no cookies, no accounts, and no analytics or tracking code.
- The only browser storage is a localStorage flag recording that the guided tour was seen.
- ZIP lookup is a text field. "Use my location", if clicked, asks the browser for coordinates and matches them to a ZIP against the boundary file in the browser (`NeighborhoodMode.tsx`). The coordinates are not sent anywhere.
- ZIP views can link out to the Service Guide (`<serviceGuideUrl>/services?zip=<ZIP>`). The ZIP in the link is sent only if the user follows it. The links are hidden when no guide URL is configured in a production build.
- When the estimator is on, its link to the Service Guide (`/intake?event=healthspan&focus=<categories>`) carries general service-topic names such as `nutrition`, never the answers entered. The link is sent only if the user follows it.
- In kiosk mode, when the idle showcase starts, all views remount and the app returns to the home screen. This clears the previous visitor's inputs.

**What the data is.** Displayed data (CDC USALEEP, ACS, CDC PLACES, and for Austin, APD crime reports) is computed ahead of time by the pipeline and shipped as static files. The app does not handle PHI.

**Estimator build setting.** `VITE_ENABLE_PERSONAL_CALCULATOR` controls whether the estimator is included. The code default is off, and Docker and partner builds default to off. The GitHub Pages workflow (`.github/workflows/deploy.yml`) turns it on for the live Austin demo. Set the repository variable `ENABLE_PERSONAL_CALCULATOR` to `false` to turn it off. Review this against your own policy before enabling it.

**Hosting logs.** GitHub Pages serves the live demo, and its servers log requests like any web host. This project cannot see or control those logs. If you self-host, your own server logs apply.

## Third-party requests from the browser

| Host | Purpose |
| --- | --- |
| `tile.openstreetmap.org` | Map tiles (Explore mode) |

Fonts (Geist and Material Symbols) are bundled with the app through `@fontsource` packages, so the browser does not contact Google Fonts. OpenStreetMap sees the visitor's IP address and request metadata when the map loads. Data files are served from the same origin. In the container, the Content-Security-Policy in [`deploy/nginx.conf`](deploy/nginx.conf) allows images only from the same origin, `data:` URIs (Leaflet icons), and `tile.openstreetmap.org`, and fonts only from the same origin (`font-src 'self'`).

## Container hardening

See [`Dockerfile`](Dockerfile), [`docker-compose.yml`](docker-compose.yml), and [`deploy/nginx.conf`](deploy/nginx.conf).

- Multi-stage build; the runtime image contains only the built static files and nginx.
- `nginx-unprivileged`, running as UID 101 on port 8080.
- Response headers: Content-Security-Policy (no `unsafe-eval`, `connect-src 'self'`, `frame-ancestors 'none'`), `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`; `server_tokens off`. `style-src` allows `'unsafe-inline'` because React and Leaflet set inline styles.
- Compose example runs with a read-only root filesystem, all capabilities dropped, and `no-new-privileges`.
- `HEALTHCHECK` against `/healthz`.
- Verified locally: image built, run, and page rendered in headless Chrome with no CSP or console errors.
- The cloud blueprints in [`deploy/`](deploy/README.md) are starting templates. The AWS Terraform is not validated (Terraform was not installed); the Azure Bicep was validated with `az bicep build`; the GCP YAML was only parse-checked. None has been deployed to any cloud. The AWS example listener is HTTP only; add TLS before real use.

## Supply chain

- Dependencies are installed with `npm ci` against the committed `app/package-lock.json` (CI and Docker build).
- CI runs lint, tests, `validate:data -- --all`, and a type-checked build on every pull request ([`.github/workflows/ci.yml`](.github/workflows/ci.yml), read-only permissions) and again before anything is published ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)). Only the deploy job holds the Pages write permissions.
- City configs are validated against JSON Schema at build time; data files are validated by `npm run validate:data`.
- Maintainers run the Python pipeline, never the browser. Its output is committed and reviewed as data.

## Scope and compliance

This project makes no compliance claims (HIPAA or otherwise). The app does not process protected health information. Operators are responsible for their own hosting, TLS, logging, and policy review.
