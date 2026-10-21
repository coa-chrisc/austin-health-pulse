# Contributing

Thanks for helping improve Austin Health Pulse. Issues and pull requests are welcome.

## Run it locally

Requires Node.js 22.12+.

```bash
cd app
npm ci
npm run dev   # http://localhost:5173/austin-health-pulse/
```

To refresh the data in `config/data/<id>/`, see [`data/README.md`](data/README.md).

## Gates

Run these from `app/` before opening a PR. CI runs the same steps and blocks deploys on failure.

```bash
npm run lint
npm test
npm run build
```

## Pull requests

- Keep each PR to one concern, and use conventional commit prefixes (`fix:`, `feat:`, `docs:`, `chore:`, `refactor:`, `test:`).
- Describe what changed and how you checked it. For UI changes, include a screenshot.
- Changes to the lifespan model math (`app/src/lib/lifespanModel.ts`) need a Vitest case and a citation for any new effect size.
- New data fetches must go through `import.meta.env.BASE_URL`. Keep `HashRouter`, which GitHub Pages requires.
- Use the Austin Public Health palette (`APH_COLORS` / `aph-*` Tailwind utilities) rather than arbitrary colors.

By contributing, you agree that your contributions are licensed under the [Apache License 2.0](LICENSE).
