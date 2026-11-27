---
title: Installation
description: Install the Cap Bundle, connect it to your Cap server and add a CAPTCHA to a Symfony form.
sidebar:
    order: 1
---

## Requirements

- PHP 8.2+
- Symfony 6.4, 7.x or 8.x, with `symfony/twig-bundle` to render the widget; without a kernel, `symfony/form` and
  `symfony/validator` are enough: see [without the bundle](#without-the-bundle)
- A PSR-18 HTTP client and a PSR-17 implementation: Symfony's HTTP client and `nyholm/psr7` unless the application
  has its own ([the HTTP client](/getting-started/configuration/#the-http-client))
- A [Cap Standalone](https://trycap.dev/guide/standalone/) server reachable from your visitors' browsers, and a site
  key created in its dashboard: you get a **site key** and a **secret key**

## Installation

```bash
composer require silarhi/cap-bundle
```

The bundle requires `php-http/discovery`: its Composer plugin, allowed in the `composer.json` of Symfony
applications, installs `symfony/http-client` and `nyholm/psr7` when the application has no PSR-18 client or PSR-17
implementation. If your `composer.json` does not allow it (`config.allow-plugins`), require them yourself:
`composer require symfony/http-client nyholm/psr7`.

With Symfony Flex, the bundle's recipe registers it, adds `CAP_ENDPOINT` and `CAP_SECRET_KEY` to `.env` and creates
`config/packages/cap.yaml`. Otherwise, register the bundle:

```php
// config/bundles.php
return [
    // ...
    Silarhi\CapBundle\SilarhiCapBundle::class => ['all' => true],
];
```

Copy its script to `public/bundles/silarhicap/` (Flex runs this command after every `composer install` already):

```bash
php bin/console assets:install
```

## Configuration

The bundle reads the URL of your Cap server and the secret key from two env vars:

```dotenv
# .env
CAP_ENDPOINT=https://cap.example.com/<site-key>/
# .env.local, or your secrets vault
CAP_SECRET_KEY=<the secret key of the site key>
```

`CAP_ENDPOINT` is the URL the browser uses: your Cap instance followed by the site key, as in Cap's
`data-cap-api-endpoint`. The secret key is the one of the site key, not the `ADMIN_KEY` of the dashboard.

Disable the bundle in the test environment:

```yaml
# config/packages/cap.yaml
when@test:
    cap:
        # No widget, every submission accepted: see the testing guide
        enabled: false
```

Every option, other env var names included, is in the [configuration reference](/getting-started/configuration/).

## Your first protected form

```php
use Silarhi\CapBundle\Form\CapType;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\EmailType;
use Symfony\Component\Form\Extension\Core\Type\TextareaType;
use Symfony\Component\Form\FormBuilderInterface;

final class ContactType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('email', EmailType::class)
            ->add('message', TextareaType::class)
            ->add('captcha', CapType::class);
    }
}
```

That's it:

- `{{ form(form) }}` (or `{{ form_row(form.captcha) }}`) renders Cap's checkbox and the script of the bundle;
- the widget solves the challenge and posts the token as `contact[captcha]`;
- `$form->isValid()` redeems the token against your Cap server. A missing or rejected token is an error on the
  field: _“Please verify you are human.”_ or _“The human verification failed, please try again.”_

The field is not mapped: it never touches your entity or DTO.

## Without the bundle

The bundle class is optional. An application without a kernel (a PHP-DI container, Symfony components and plain Twig)
needs neither the framework nor `symfony/dependency-injection` or `symfony/http-kernel`: it builds the services the
bundle would register.

```php
use Silarhi\CapBundle\Form\CapType;
use Silarhi\CapBundle\Validator\CapValidator;
use Silarhi\CapBundle\Verifier\CapVerifier;
use Symfony\Component\Form\Extension\Validator\ValidatorExtension;
use Symfony\Component\Form\Forms;
use Symfony\Component\HttpClient\Psr18Client;
use Symfony\Component\Translation\Loader\XliffFileLoader;
use Symfony\Component\Translation\Translator;
use Symfony\Component\Validator\ConstraintValidatorFactory;
use Symfony\Component\Validator\Validation;

$capDir = __DIR__ . '/vendor/silarhi/cap-bundle';

// The validation messages are translation keys: cap.validation.missing, cap.validation.invalid
$translator = new Translator('fr');
$translator->addLoader('xlf', new XliffFileLoader());
$translator->addResource('xlf', $capDir . '/translations/validators.fr.xlf', 'fr', 'validators');

// Any PSR-18 client with PSR-17 request and stream factories: Psr18Client is all three
$httpClient = new Psr18Client();
$verifier = CapVerifier::fromEndpoint($endpoint, $secretKey, null, $httpClient, $httpClient, $httpClient, $logger);

$validator = Validation::createValidatorBuilder()
    ->setConstraintValidatorFactory(new ConstraintValidatorFactory([CapValidator::class => new CapValidator($verifier)]))
    ->setTranslator($translator)
    ->setTranslationDomain('validators')
    ->getValidator();

$formFactory = Forms::createFormFactoryBuilder()
    ->addExtension(new ValidatorExtension($validator))
    ->addType(new CapType(
        $endpoint,
        // The defaults of the bundle's widget.* options: without them, the widget never loads
        widgetScript: CapType::WIDGET_SCRIPT_PATH,
        wasmUrl: CapType::WASM_PATH,
        hashwxUrl: CapType::HASHWX_PATH,
    ))
    ->getFormFactory();
```

The third argument of `CapVerifier::fromEndpoint()` is `verify_url`, the logger is optional. `CapValidator` takes
`enabled` second (`false` accepts every submission, as `cap.enabled`), and `CapType` takes the other options of the
bundle as named arguments: `enabled`, `renderScripts`, `adapters`, and `packages` (the `Packages` of `symfony/asset`)
to version the script URLs.

The form theme renders the widget: add the bundle's templates to the Twig loader, under the `SilarhiCap` namespace,
and its theme after `form_div_layout.html.twig` (`symfony/twig-bridge`):

```php
use Symfony\Bridge\Twig\Extension\FormExtension;
use Symfony\Bridge\Twig\Extension\TranslationExtension;
use Symfony\Bridge\Twig\Form\TwigRendererEngine;
use Symfony\Component\Form\FormRenderer;
use Twig\Environment;
use Twig\Loader\FilesystemLoader;
use Twig\RuntimeLoader\FactoryRuntimeLoader;

$loader = new FilesystemLoader([__DIR__ . '/templates', __DIR__ . '/vendor/symfony/twig-bridge/Resources/views/Form']);
$loader->addPath($capDir . '/templates', 'SilarhiCap');
$twig = new Environment($loader);

$engine = new TwigRendererEngine(['form_div_layout.html.twig', '@SilarhiCap/form/cap_widget.html.twig'], $twig);
$twig->addRuntimeLoader(new FactoryRuntimeLoader([FormRenderer::class => static fn (): FormRenderer => new FormRenderer($engine)]));
$twig->addExtension(new FormExtension());
$twig->addExtension(new TranslationExtension($translator));
```

Copy `vendor/silarhi/cap-bundle/public/` to `public/bundles/silarhicap/`, what `assets:install` does: the form renders
`/bundles/silarhicap/cap.js`, which loads the widget and its solvers from there.

[Other site keys](/getting-started/configuration/) are a PSR-11 container of their verifiers, by name, for
`CapValidator`, and their endpoints for `CapType`:

```php
// Any PSR-11 container whose has() and get() take the site key names
$verifiers = new MyContainer(['signup' => CapVerifier::fromEndpoint($signupEndpoint, $signupSecretKey, null, $httpClient, $httpClient, $httpClient)]);

new CapValidator($verifier, true, $verifiers);
new CapType($endpoint, widgetScript: CapType::WIDGET_SCRIPT_PATH, wasmUrl: CapType::WASM_PATH, hashwxUrl: CapType::HASHWX_PATH, endpoints: ['signup' => $signupEndpoint]);
```

Then `CapType::class, ['site_key' => 'signup']` and `#[Cap(siteKey: 'signup')]` pick it, as with the bundle.
