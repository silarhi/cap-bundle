# CLAUDE.md

This file provides guidance for Claude Code when working on the Cap Bundle project.

## Project Overview

Cap Bundle integrates [Cap](https://trycap.dev), a self-hosted proof-of-work CAPTCHA, into Symfony forms, the way
KarserRecaptcha3Bundle does for reCAPTCHA: `CapType` renders the widget, the `Cap` constraint redeems the token against
the `/siteverify` endpoint of the Cap Standalone server. The JavaScript of `assets/` makes it work with Turbo, SPAs,
Stimulus or no build step at all.

## Tech Stack

- **Language**: PHP 8.2+, TypeScript (`assets/`)
- **Framework**: Symfony 6.4 / 7.x / 8.x (`symfony/form`, `symfony/validator`, `symfony/http-client`)
- **Optional**: `symfony/twig-bundle` (form theme), `symfony/asset` (versioned script URL), StimulusBundle
- **JavaScript**: `cap-widget` (peer), `@hotwired/stimulus` (optional peer); built with tsdown, tested with Vitest

## Repository Structure

```
src/
├── Form/CapType.php         # The field: view vars, options (mode, locale, worker_count, troubleshooting_url, i18n, csp_nonce)
├── Form/CapMode.php         # Enum of the mode option (Checkbox, Invisible); CapType's normalizer also takes its values
├── Validator/               # Cap constraint (#[Cap]) and CapValidator (enabled: false accepts everything)
├── Verifier/                # CapVerifierInterface, CapVerifier (HTTP client, never throws), VerificationResult
└── SilarhiCapBundle.php     # `cap:` configuration tree (extensionAlias), `cap.*` services, prepends the form theme
                             #   and the AssetMapper path
templates/form/cap_widget.html.twig  # silarhi_cap_widget block: <cap-widget> or <input type="hidden"> + <script type="module">
translations/                # validators.<locale>.xlf: the two constraint messages
assets/
├── src/core.ts              # install(), configure(), solve(), reset(): listeners delegated to the document
├── src/controller.ts        # Stimulus controller (silarhi--cap-bundle--cap): configure + install + import('cap-widget')
├── src/auto.ts              # Built to public/cap.js: install + loads widget.script after configure()
├── src/index.ts             # npm entry (@silarhi/cap-bundle)
├── dist/                    # Built, committed: StimulusBundle, AssetMapper and bundlers read it
└── test/                    # Vitest (jsdom) with fake <cap-widget> and Cap
public/cap.js                # Built, committed: assets:install copies it to public/bundles/silarhicap/
tests/                       # PHPUnit: Verifier/, Validator/ unit tests, Functional/ (TestKernel per environment:
                             #   test, disabled, custom)
```

## Build & Test Commands

```bash
composer install
vendor/bin/phpunit
vendor/bin/phpstan analyse                  # level max
vendor/bin/php-cs-fixer fix --dry-run --diff
vendor/bin/rector process --dry-run
composer validate --strict && composer normalize --dry-run

cd assets
pnpm install
pnpm test && pnpm lint && pnpm typecheck
pnpm build                                  # commit assets/dist and public/cap.js with the source
```

## CI/CD

- **Laminas CI Matrix Action** (`.github/workflows/continuous-integration.yml`): PHPUnit on every supported PHP, lowest
  and latest dependencies, PHPStan, PHP CS Fixer, composer checks (`.laminas-ci.json`)
- Jobs `Lint`, `Test`, `Build` run in `assets/`; `Build` fails when the committed built files differ from a fresh build
- The `main` ruleset requires the `CI passed` job; coverage is published to the `badges` branch
- Documentation site (`.github/workflows/docs.yml`): the reusable `silarhi/docs-kit` workflow builds `docs/` and
  deploys it to GitHub Pages (cap-bundle.silarhi.dev) from `main`
- pnpm everywhere (root for the git hooks, `assets/`, `docs/`, each with its own lockfile), pinned by `packageManager`

## Architecture Notes

- **The widget posts the token itself.** `<cap-widget>` replaces its light DOM with
  `<input type="hidden" name="<data-cap-hidden-field-name>">` when it connects: the template sets that name to the
  field's `full_name`, so the checkbox mode needs no JavaScript of ours to submit. Never render the input inside it.
- **Invisible mode is a hidden input, not a hidden widget.** `<cap-widget>`'s shadow CSS sets `:host { display:
inline-block }`, which beats the `hidden` attribute, and inline styles break strict CSPs. The input is solved with
  Cap's programmatic mode (`new Cap()`), whose hidden widget lives on `<html>`: `createInvisibleCap()` removes those
  of inputs no longer in the page.
- **Delegation, not lifecycles.** `install()` adds one capture-phase `submit` listener to the document: it sees forms
  Turbo Drive, Turbo Frames or any SPA inserted, before Turbo and the application's listeners. It stops the event,
  solves, then `requestSubmit(submitter)`. A failed solve submits all the same (once, through `bypassedForms`) so that
  the server answers with its error. `Symbol.for('@silarhi/cap-bundle')` keeps it idempotent across copies of the
  module (public/cap.js and an application bundle).
- **`solve()` returns at once while a solve is running** (the visitor clicked): `solveWidget()` waits for the widget's
  `solve` / `error` events instead of the promise.
- **Tokens are single-use**: they are cleared on `turbo:submit-end`, `turbo:before-cache` and a bfcache `pageshow`.
- **Script loading**: the form renders `<script type="module" src="/bundles/silarhicap/cap.js">`. Modules run once per
  page however many times they are inserted (Turbo re-inserts body scripts on each visit). It imports `widget.script`
  itself, after `configure()`, because the widget reads `window.CAP_CSS_NONCE` when it connects.
- **Env vars by default**: `endpoint` and `secret_key` default to `%env(CAP_ENDPOINT)%` and `%env(CAP_SECRET_KEY)%`,
  so a fresh `composer require` (no Flex recipe) does not break `cache:clear`. As they may be env placeholders, their
  trailing slash is normalized at runtime (`CapVerifier::fromEndpoint()`, `CapType::buildView()`), never in
  `loadExtension()`.
- **`exports` of `assets/package.json` keep `./package.json` and `./dist/*`**: Symfony Reprise and
  `@symfony/stimulus-bridge` resolve `<package>/package.json`, then `<package>/<main of the controller>`; without
  them the build fails with "cannot find @silarhi/cap-bundle/package.json".
- **Fails closed**: `CapVerifier::verify()` never throws; transport, 5xx and non-JSON answers are failed verifications.
- Optional services (`assets.packages`, `request_stack`, `logger`, the HTTP client) are injected with
  `ignoreOnInvalid()`: `CapVerifier` falls back to `HttpClient::create()`.

## Coding Conventions

- Strict types everywhere, PSR-4 under `Silarhi\CapBundle\`, PHP-CS-Fixer `@Symfony` + `@Symfony:risky`, PHPStan max
- Rector targets PHP 8.2 (deadCode, codeQuality, typeDeclarations)
- TypeScript: Biome (4 spaces, single quotes, no semicolons, 120 columns)

### Dependency Constraints

- **Integration libraries** (`symfony/*`, `twig/twig`) keep **wide version ranges** (`^6.4 || ^7.0 || ^8.0`) so the CI
  matrix tests from the lowest to the latest supported versions. Never bump their floors to the installed version.
- **QA tools** are bumped via `composer bump:tools`. Do not add `config.bump-after-update`.
- The default `widget.script` pins a `cap-widget` release (`SilarhiCapBundle::WIDGET_SCRIPT`): bump it with the
  `cap-widget` dev dependency of `assets/package.json`, and test the widget in a browser.

## API Documentation

**Always update documentation when adding or modifying public API**: form options, configuration options, the
constraint, the verifier, the JavaScript exports and events (`cap:solving`, `cap:solved`, `cap:failed`).

1. **`docs/`** — the documentation site (cap-bundle.silarhi.dev). Keep `README.md` short.
2. **`CLAUDE.md`** — Repository Structure, Architecture Notes.
3. **PHPDoc blocks** — on interfaces and services.
4. **`CHANGELOG.md`** — an entry in the top section, titled with the next release (e.g. `[0.2.0] - Unreleased`),
   [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) sections, **BC break:** prefix. Skip dependency bumps, CI
   and tooling changes.

## Releases

Lightweight tag `vX.Y.Z` on `origin/main` once CI is green, with a GitHub release whose notes follow the
`CHANGELOG.md` entry. Packagist updates from the GitHub hook. The JavaScript ships with the Composer package: there is
no npm release.
