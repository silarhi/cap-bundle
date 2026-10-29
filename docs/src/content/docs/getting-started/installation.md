---
title: Installation
description: Install the Cap Bundle, connect it to your Cap server and add a CAPTCHA to a Symfony form.
sidebar:
    order: 1
---

## Requirements

- PHP 8.2+
- Symfony 6.4, 7.x or 8.x, with `symfony/twig-bundle` to render the widget
- Symfony's HTTP client and a PSR-17 implementation, such as `nyholm/psr7`, or your own
  [PSR-18 client](/getting-started/configuration/#the-http-client)
- A [Cap Standalone](https://trycap.dev/guide/standalone/) server reachable from your visitors' browsers, and a site
  key created in its dashboard: you get a **site key** and a **secret key**

## Installation

```bash
composer require silarhi/cap-bundle symfony/http-client nyholm/psr7
```

Leave out what your application has already, or both if it brings its own PSR-18 client.

Register the bundle if Flex did not:

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
