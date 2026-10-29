---
title: Labels and languages
description: Translate the Cap widget and the validation messages of the Cap Bundle.
sidebar:
    order: 4
---

## The widget

Cap translates its own labels. The bundle passes the request locale as `data-cap-lang`, so the widget speaks the
language of the page. Override it per field:

```php
$builder->add('cap', CapType::class, ['locale' => 'de']);
```

Or replace any label with the `i18n` option, keyed by the suffix of Cap's `data-cap-i18n-*` attributes:

```php
$builder->add('cap', CapType::class, [
    'i18n' => [
        'initial-state' => $this->translator->trans('cap.verify'),
        'solved-label' => $this->translator->trans('cap.solved'),
    ],
]);
```

The keys are `initial-state`, `verifying-label`, `solved-label`, `error-label`, `troubleshooting-label`,
`wasm-disabled`, `verify-aria-label`, `verifying-aria-label`, `verified-aria-label`, `error-aria-label` and
`required-label` (the browser message of an unticked required widget).

## Validation messages

The two messages of the `Cap` constraint are translated in the `validators` domain, in English, French, German,
Spanish, Italian, Dutch and Portuguese. Override them in your own `translations/validators.<locale>.xlf`:

```yaml
# translations/validators.fr.yaml
'Please verify you are human.': 'Cochez la case « Je ne suis pas un robot ».'
'The human verification failed, please try again.': 'Vérification impossible, réessayez.'
```

Or pass other messages to the constraint:

```php
use Silarhi\CapBundle\Validator\Cap;

$builder->add('cap', CapType::class, [
    'constraints' => [new Cap(message: 'cap.failed', missingMessage: 'cap.missing')],
]);
```
