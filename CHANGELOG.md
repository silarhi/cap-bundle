# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - Unreleased

### Changed

- `symfony/http-client` is no longer required, only suggested: an application using its own PSR-18 client
  (`http_client`) does not install it any more. Applications relying on the default `psr18.http_client` must require
  it themselves (`composer require symfony/http-client`) if nothing else does; the bundle says so when it is missing.

## [0.2.0] - 2026-10-29

### Added

- `connect(element)`, for the applications that react to the elements showing up without Stimulus (a listener
  library, htmx...): what the Stimulus controller does, the submit handling, the adapters of `cap.adapters`, the widget
  settings and the widget script, in one idempotent call.
- The Live Components adapter (`adapters: [live]`, or `installLive()` from `@silarhi/cap-bundle/live`): it keeps the
  challenge out of Live Component re-renders and sends its token with the action only. `ComponentWithFormTrait`
  validates the form on every re-render, which would redeem the token.

### Fixed

- `CapValidator` is reset between the requests of long-running workers (FrankenPHP, RoadRunner).

## [0.1.0] - 2026-10-29

### Added

- `CapType`, a form field rendering the [Cap](https://trycap.dev) widget (`CapMode::Checkbox`) or a hidden input solved
  with Cap's programmatic mode (`CapMode::Invisible`), and validating the token on submit. Options: `locale`,
  `worker_count`, `troubleshooting_url`, `i18n`, `csp_nonce`.
- The `Cap` constraint and `CapVerifierInterface`, which redeem a token against the `/siteverify` endpoint of the Cap
  server, for JSON endpoints and DTOs. A Cap server out of reach rejects the token.
- Any PSR-18 HTTP client and PSR-17 factories (`http_client`, `request_factory`, `stream_factory`), Symfony's
  `psr18.http_client` by default.
- The submit handling, delegated to the document: an unsolved challenge is solved before the form is submitted, the
  invisible one as soon as the visitor focuses the form. Tokens are forgotten when the back-forward cache restores a
  page.
- Opt-in JavaScript adapters (`adapters: [turbo]`, or `installTurbo()` from `@silarhi/cap-bundle/turbo`): the Turbo
  one forgets the tokens of a Turbo submission and before Turbo caches the page.
- Two ways to load it: a script the form renders (`/bundles/silarhicap/cap.js`, no build step), or the
  `silarhi--cap-bundle--cap` Stimulus controller StimulusBundle registers, which lazy-loads the widget.
- The `CAP_ENDPOINT` and `CAP_SECRET_KEY` env vars as the default `endpoint` and `secret_key`: installing the bundle
  needs no configuration file.
- The Cap widget and its WebAssembly solvers, served from `/bundles/silarhicap/widget/`: no CDN by default, and no
  `cap-widget` package to install. `widget.script`, `widget.wasm_url` and `widget.hashwx_url` point them elsewhere.
- Validation messages as translation keys of the `validators` domain (`cap.validation.missing`,
  `cap.validation.invalid`), translated in English, French, German, Spanish, Italian, Dutch and Portuguese.

[0.3.0]: https://github.com/silarhi/cap-bundle/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/silarhi/cap-bundle/releases/tag/v0.2.0
[0.1.0]: https://github.com/silarhi/cap-bundle/releases/tag/v0.1.0
