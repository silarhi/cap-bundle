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
`public/cap.js`. Rebuild them in the same commit as the source, the CI checks they match.

```bash
cd assets
pnpm install
pnpm test       # Vitest
pnpm lint       # Biome
pnpm typecheck
pnpm build      # assets/dist and public/cap.js
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
