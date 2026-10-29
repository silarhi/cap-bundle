<p align="center">
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/github/license/silarhi/cap-bundle?style=for-the-badge&color=6f42c1&labelColor=1a1a2e">
        <img src="https://img.shields.io/github/license/silarhi/cap-bundle?style=for-the-badge&color=6f42c1" alt="License">
    </picture>
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/php-%3E%3D8.2-777bb4?style=for-the-badge&labelColor=1a1a2e">
        <img src="https://img.shields.io/badge/php-%3E%3D8.2-777bb4?style=for-the-badge" alt="PHP Version">
    </picture>
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/github/actions/workflow/status/silarhi/cap-bundle/continuous-integration.yml?style=for-the-badge&label=CI&color=20c997&labelColor=1a1a2e">
        <img src="https://img.shields.io/github/actions/workflow/status/silarhi/cap-bundle/continuous-integration.yml?style=for-the-badge&label=CI&color=20c997"
            alt="CI Status">
    </picture>
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fsilarhi%2Fcap-bundle%2Fbadges%2Fcoverage.json&style=for-the-badge&labelColor=1a1a2e">
        <img src="https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fsilarhi%2Fcap-bundle%2Fbadges%2Fcoverage.json&style=for-the-badge" alt="Coverage">
    </picture>
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fsilarhi%2Fcap-bundle%2Fbadges%2Fcoverage-js.json&style=for-the-badge&labelColor=1a1a2e">
        <img src="https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fsilarhi%2Fcap-bundle%2Fbadges%2Fcoverage-js.json&style=for-the-badge" alt="JavaScript coverage">
    </picture>
</p>

<h1 align="center">Cap Bundle</h1>

<p align="center">
    <strong><a href="https://trycap.dev">Cap CAPTCHA</a> (trycap.dev), the self-hosted proof-of-work CAPTCHA, in your Symfony forms.</strong><br>
    A form type, a validator constraint and a widget that keeps working across Turbo visits — the
    <a href="https://github.com/karser/KarserRecaptcha3Bundle">KarserRecaptcha3Bundle</a> way, without Google.
</p>

<p align="center">
    📖 <a href="https://cap-bundle.silarhi.dev"><strong>Documentation</strong></a>
</p>

---

## Features

- **One form field**: `CapType` renders the widget and validates the token on submit, with the `Cap` constraint
- **Checkbox or invisible**: Cap's widget, or nothing at all: the challenge is solved while the visitor fills the form
- **SPA ready**: a framework-agnostic core for any SPA, the back-forward cache and forms you submit with `fetch()`,
  plus opt-in adapters for Turbo Drive and Live Components
- **Stimulus or not**: a controller StimulusBundle or Symfony Reprise registers for you, or a script the form renders, with no build step
- **Self-hosted end to end**: your Cap server, and the widget script and its WebAssembly solver from your domain if you like
- **Fails closed**: a Cap server out of reach rejects the submission, and the error stays on the field
- **Any payload**: the `#[Cap]` constraint and the `CapVerifierInterface` service protect JSON endpoints too

## Requirements

- PHP 8.2+
- Symfony 6.4, 7.x or 8.x
- A PSR-18 HTTP client and a PSR-17 implementation: Composer installs `symfony/http-client` and `nyholm/psr7` when
  the application has none (`php-http/discovery`), or set your own client
- A [Cap Standalone](https://trycap.dev/guide/standalone/) server, and a site key created in its dashboard

## Installation

```bash
composer require silarhi/cap-bundle
```

```dotenv
# .env
CAP_ENDPOINT=https://cap.example.com/<site-key>/
CAP_SECRET_KEY=<the secret key of the site key>
```

```yaml
# config/packages/cap.yaml
when@test:
    cap:
        enabled: false
```

## Quick start

```php
use Silarhi\CapBundle\Form\CapType;

$builder
    ->add('message', TextareaType::class)
    ->add('captcha', CapType::class);
```

`{{ form(form) }}` renders the widget and its script. On submit, the token is redeemed against your Cap server: a
missing or rejected one is a form error on the field.

## Documentation

Everything else is on **[cap-bundle.silarhi.dev](https://cap-bundle.silarhi.dev)**:

- [Installation](https://cap-bundle.silarhi.dev/getting-started/installation/) and [configuration reference](https://cap-bundle.silarhi.dev/getting-started/configuration/)
- The form type: [checkbox and invisible modes](https://cap-bundle.silarhi.dev/guides/form-type/), [labels and languages](https://cap-bundle.silarhi.dev/guides/translations/)
- JavaScript: [without a build step, with Stimulus, Symfony Reprise or your bundler](https://cap-bundle.silarhi.dev/guides/javascript/), [Turbo, Live Components and SPAs](https://cap-bundle.silarhi.dev/guides/turbo/)
- [Self-hosting the widget](https://cap-bundle.silarhi.dev/guides/self-hosting/), [Content Security Policy](https://cap-bundle.silarhi.dev/guides/content-security-policy/)
- [Migrating from reCAPTCHA](https://cap-bundle.silarhi.dev/guides/migrating-from-recaptcha/) (KarserRecaptcha3Bundle)
- [JSON endpoints and DTOs](https://cap-bundle.silarhi.dev/guides/api/), [testing](https://cap-bundle.silarhi.dev/guides/testing/)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Release notes are in [CHANGELOG.md](CHANGELOG.md).

## License

Released under the [MIT License](LICENSE).
