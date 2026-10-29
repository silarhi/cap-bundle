# Contributing

Contributions are welcome! Bug reports and feature requests go to the
[issue tracker](https://github.com/silarhi/cap-bundle/issues), changes to a pull request against `main`.

## Setup

```bash
composer install
pnpm install # Git hooks: lint-staged formats the staged files on commit
```

## Quality checks

The CI runs PHPUnit on every supported PHP version, with the lowest and the latest dependencies, and PHPStan, PHP CS
Fixer and the `composer.json` checks once. It does not run Rector: run it locally before opening a pull request.

```bash
# Tests
vendor/bin/phpunit

# Static analysis (level: max)
vendor/bin/phpstan analyse

# Code style (drop --dry-run --diff to fix)
vendor/bin/php-cs-fixer fix --dry-run --diff

# Code modernization (drop --dry-run to apply)
vendor/bin/rector process --dry-run

# composer.json
composer validate --strict
composer normalize --dry-run
```

## JavaScript

The submit handling and the Stimulus controller live in [`assets/`](assets), in TypeScript. Their built files are
committed: Composer installs them, StimulusBundle and AssetMapper read `assets/dist/`, and `assets:install` copies
`public/`. Rebuild them in the same commit as the source, the CI checks they match.

`public/widget/` holds the Cap widget the bundle ships, copied from the `cap-widget` and `@cap.js/wasm` dev
dependencies by `pnpm build`. To update it, bump both packages (the build fails when they do not match), rebuild and
commit; Renovate's pull requests are rebuilt by a workflow.

```bash
cd assets
pnpm install
pnpm test       # Vitest (pnpm test:coverage writes coverage/)
pnpm lint       # Biome
pnpm typecheck
pnpm build      # assets/dist, public/cap.js and public/widget/
```

## End-to-end tests

`assets/e2e` drives a browser (Playwright) against a real [Cap Standalone](https://trycap.dev/guide/standalone/)
server: the challenges are solved in the browser and redeemed by `tests/E2E/E2eKernel.php`. The CI runs them with a
Cap service container; locally, with a Cap server on port 3000:

```bash
export $(tests/E2E/create-site-key.sh http://localhost:3000 <ADMIN_KEY>)
cd assets
pnpm exec playwright install chromium
pnpm build
pnpm e2e
```

## Documentation

The documentation site, [cap-bundle.silarhi.dev](https://cap-bundle.silarhi.dev), is built from the
[`docs/`](docs) folder with [Starlight](https://starlight.astro.build). Document a change in the same pull request:

```bash
cd docs
pnpm install
pnpm dev # http://localhost:4321
```

Pull requests touching `docs/` build the site; it is published once merged into `main`.

## License

By contributing, you agree that your contributions are released under the [MIT License](LICENSE).
