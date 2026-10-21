# Contributing

Issues and pull requests are welcome.

## Run it locally

Requires Node.js 22.12+.

```bash
cd app
npm ci
npm run dev   # http://localhost:5173/austin-health-pulse/
```

To refresh the data in `config/data/<id>/`, see [`data/README.md`](data/README.md). The pipeline needs a free Census API key; the app build and CI do not.

## Gates

Run these from `app/` before opening a PR. CI runs the same steps, plus `npm run validate:data -- --all` and a partner-city build, on every pull request (`.github/workflows/ci.yml`). The deploy workflow repeats the checks and blocks deploys on failure.

```bash
npm run lint
npm test
npm run validate:data
npm run build
```

## Pull requests

- Keep each PR to one concern, and use conventional commit prefixes (`fix:`, `feat:`, `docs:`, `chore:`, `refactor:`, `test:`).
- Describe what changed and how you checked it. For UI changes, include a screenshot.
- Changes to the lifespan model math (`app/src/lib/lifespanModel.ts`) need a Vitest case and a citation for any new effect size.
- Add new data files through the `data` block of the city config, not by fetching a hardcoded path. Keep `HashRouter`, which GitHub Pages requires.
- Use the brand color tokens (`APH_COLORS` / `aph-*` Tailwind utilities, filled from the city config) rather than hex values, so other agencies can rebrand from config alone. See [`docs/CUSTOMIZING.md`](docs/CUSTOMIZING.md).
- If you change the UI, regenerate the README screenshots with `npm run screenshots` from `app/`.

By contributing, you agree that your contributions are licensed under the [Apache License 2.0](LICENSE).
