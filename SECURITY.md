# Security

## Reporting a vulnerability

Use GitHub private vulnerability reporting: on the repository, open **Security > Advisories > Report a vulnerability**. Please do not open a public issue for a suspected vulnerability.

## Data handling

**Default build** (calculator flag off):

- The app is a static site. There is no backend, database, or API, and the page itself collects nothing. There is no analytics or tracking code.
- All displayed data is aggregate, de-identified public data (CDC USALEEP, ACS, CDC PLACES, and for Austin, APD crime reports) computed ahead of time by the pipeline and shipped as static files.
- The default build collects, stores, and transmits no personal information. It does not handle PHI.
- The only browser storage is a localStorage flag recording that the guided tour was seen.
- ZIP lookup is a text field. "Use my location", if clicked, asks the browser for coordinates and matches them to a ZIP against the boundary file in the browser (`NeighborhoodMode.tsx`). The coordinates are not sent anywhere.
- ZIP views can link out to the Service Guide (`<serviceGuideUrl>/services?zip=<ZIP>`). The ZIP in the link is sent only if the user follows it. The links are hidden when no guide URL is configured in a production build.

**With `VITE_ENABLE_PERSONAL_CALCULATOR=true`:** the individual lifespan calculator is included. It runs in the browser; its inputs (age, sex, lifestyle factors) are not sent or stored by this app. Its handoff to the Service Guide sends only factor categories in the URL (`/intake?event=healthspan&focus=<categories>`) when the user follows the link. Review this against your own policy before enabling it.

## Third-party requests from the browser

| Host | Purpose |
| --- | --- |
| `tile.openstreetmap.org` | Map tiles (Explore mode) |
| `fonts.googleapis.com`, `fonts.gstatic.com` | Geist and Material Symbols fonts |

These services see the visitor's IP address and request metadata. Nothing else is requested; data files are served from the same origin. In the container, the Content-Security-Policy in [`deploy/nginx.conf`](deploy/nginx.conf) allows only these hosts.

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
- CI ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) runs lint, tests, `validate:data -- --all`, and a type-checked build before anything is published. The workflow has read-only repository permissions plus the Pages deploy permissions.
- City configs are validated against JSON Schema at build time; data files are validated by `npm run validate:data`.
- The Python pipeline runs offline from the browser's point of view: it is run by maintainers, and its output is committed and reviewed as data.

## Scope and compliance

This project makes no compliance claims (HIPAA or otherwise). The default build does not process protected health information. Operators are responsible for their own hosting, TLS, logging, and policy review.
