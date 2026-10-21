# Contributing

Issues and pull requests are welcome. Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

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
- Use the theme tokens (role utilities such as `bg-primary`, `text-muted`, `rounded-card`, `text-2xs`, or `THEME`/`fontSize()`/`FONT_FAMILY` from `src/lib/theme.ts`, all filled from the city config's `theme` block) rather than hex values, Tailwind palette colors, or literal font sizes, so other agencies can restyle from config alone. `themeGuard.test.ts` enforces this; add a `theme-exempt: <reason>` comment for a rare exception. See [`docs/CUSTOMIZING.md`](docs/CUSTOMIZING.md).
- If you change the UI, regenerate the README screenshots with `npm run screenshots` from `app/`. If you have [`pngquant`](https://pngquant.org/), shrink them before committing: `pngquant --quality=80-95 --force --ext .png docs/screenshots/*.png`.

By contributing, you agree that your contributions are licensed under the [Apache License 2.0](LICENSE).
