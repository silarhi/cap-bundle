---
title: The form type
description: CapType in checkbox or invisible mode, its options and how its errors are rendered.
sidebar:
    order: 1
---

## Checkbox mode

The default. `CapType` renders Cap's widget: a checkbox reading _“Verify you're human”_. Cap starts solving in the
background as soon as the visitor moves the mouse or presses a key, so ticking it is usually instant.

```php
$builder->add('captcha', CapType::class);
```

```html
<cap-widget
    id="contact_captcha"
    data-cap-hidden-field-name="contact[captcha]"
    required
    data-controller="silarhi--cap-bundle--cap"
    data-silarhi-cap="checkbox"
    data-cap-api-endpoint="https://cap.example.com/site-key/"
    data-cap-lang="en"
></cap-widget>
<script type="module" src="/bundles/silarhicap/cap.js"></script>
```

The widget creates the hidden `contact[captcha]` input itself and fills it once solved: the token is submitted with the
other fields. While the field is `required` (the default), the browser refuses to submit an unticked widget and shows
_“Please verify you're human”_. With `'required' => false`, or in a `novalidate` form, the bundle solves it on submit
instead.

## Invisible mode

Nothing to see or click: the challenge is solved with Cap's [programmatic mode](https://trycap.dev/guide/programmatic)
when the visitor focuses a field of the form, and on submit if they were faster.

```php
use Silarhi\CapBundle\Form\CapMode;

$builder->add('captcha', CapType::class, [
    'mode' => CapMode::Invisible,
]);
```

The option also takes the enum's value, `'invisible'`, for the places a PHP enum cannot reach (a form type option
read from a configuration file, for instance).

```html
<input
    type="hidden"
    id="contact_captcha"
    name="contact[captcha]"
    data-silarhi-cap="invisible"
    data-cap-api-endpoint="https://cap.example.com/site-key/"
    ...
/>
```

Submitting waits for the challenge: the form gets `aria-busy="true"` meanwhile, and the
[`cap:solving` and `cap:solved` events](/guides/javascript/#events) let you show a spinner. Solving takes from a few
hundred milliseconds to a few seconds, depending on the difficulty of the site key and the device.

Invisible mode needs the JavaScript of the bundle, the checkbox mode only needs the widget.

## Options

| Option                | Default             | Description                                                                                                   |
| --------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------- |
| `mode`                | `CapMode::Checkbox` | `CapMode::Checkbox` or `CapMode::Invisible` (or their values, `'checkbox'` and `'invisible'`)                 |
| `locale`              | the request locale  | Language of the widget labels (`data-cap-lang`): see [labels and languages](/guides/translations/)            |
| `i18n`                | `[]`                | Widget labels, keyed by the suffix of their `data-cap-i18n-*` attribute                                       |
| `worker_count`        | `null`              | Number of solver workers (`data-cap-worker-count`); Cap uses one per CPU core                                 |
| `troubleshooting_url` | `null`              | The "Troubleshooting" link Cap shows a blocked visitor (`data-cap-troubleshooting-url`)                       |
| `csp_nonce`           | `null`              | Nonce of the script and of the widget styles: see [Content Security Policy](/guides/content-security-policy/) |
| `constraints`         | `[new Cap()]`       | Replace it to customize the messages: `[new Cap(message: '…', missingMessage: '…')]`                          |
| `attr`                | `[]`                | Attributes of the `<cap-widget>` (or of the hidden input), e.g. a `class`                                     |
| `required`            | `true`              | Checkbox mode: the browser asks to tick the widget before submitting                                          |

`mapped` is `false` and `label` is `false` by default: the widget carries its own label.

## Errors

Errors stay on the field (`error_bubbling` is `false`): `form_row(form.captcha)` renders them under the widget.

| Code                 | Message key              | English                                          | When                                            |
| -------------------- | ------------------------ | ------------------------------------------------ | ----------------------------------------------- |
| `Cap::MISSING_ERROR` | `cap.validation.missing` | Please verify you are human.                     | No token submitted                              |
| `Cap::INVALID_ERROR` | `cap.validation.invalid` | The human verification failed, please try again. | Cap rejected the token, or could not be reached |

`{{ error }}` in a custom message is Cap's reason (`"Token expired"`, `"Token not found"`…) or the bundle's
(`connection-failed`, `bad-response`, `invalid-json`).

A token is single-use. When the form comes back with an error (any field), the widget renders again and the visitor
solves a new challenge.

## Several CAPTCHAs on a page

A contact form and a newsletter form on the same page can each have their `CapType`. Every challenge has its own
token: submitting one form solves and redeems only its own challenges, and the script of the bundle loads once
whatever the number of forms.

Two things to keep in mind:

- give the forms different names (`createNamed('newsletter', NewsletterType::class)`) when the same form type appears
  twice, otherwise both fields get the same `id`;
- each checkbox widget starts solving in the background as soon as the visitor interacts with the page, so several
  of them compute several challenges. The invisible mode only solves the challenge of the form the visitor focuses:
  prefer it for the secondary forms of a page (newsletter, search).

## Styling

Cap's widget is styled with CSS variables:

```css
cap-widget {
    --cap-background: var(--bs-body-bg);
    --cap-border-color: var(--bs-border-color);
    --cap-color: var(--bs-body-color);
    --cap-widget-width: 100%;
}
```

The full list is in [Cap's documentation](https://trycap.dev/guide/widget#styling).
