---
title: Migrating from reCAPTCHA
description: Replace Google reCAPTCHA v3 (KarserRecaptcha3Bundle) with Cap CAPTCHA in a Symfony application, field by field.
sidebar:
    order: 9
---

[Cap](https://trycap.dev) replaces Google reCAPTCHA with a proof-of-work challenge served by your own server: no
cookies, no tracking, no third party seeing your visitors, no score to tune. Coming from
[KarserRecaptcha3Bundle](https://github.com/karser/KarserRecaptcha3Bundle), the API is close.

## 1. Run a Cap server

Start [Cap Standalone](https://trycap.dev/guide/standalone/) (one Docker container and a Valkey or Redis), create a
site key in its dashboard, and keep its site key and secret key.

## 2. Swap the bundles

```bash
composer remove karser/karser-recaptcha3-bundle
composer require silarhi/cap-bundle
```

```diff
-# .env
-RECAPTCHA3_KEY=...
-RECAPTCHA3_SECRET=...
+CAP_ENDPOINT=https://cap.example.com/<site-key>/
+CAP_SECRET_KEY=...
```

Delete `config/packages/karser_recaptcha3.yaml`. The `enabled: false` of the test environment becomes:

```yaml
# config/packages/cap.yaml
when@test:
    cap:
        enabled: false
```

## 3. Swap the fields

```diff
-use Karser\Recaptcha3Bundle\Form\Recaptcha3Type;
-use Karser\Recaptcha3Bundle\Validator\Constraints\Recaptcha3;
+use Silarhi\CapBundle\Form\CapMode;
+use Silarhi\CapBundle\Form\CapType;

-$builder->add('captcha', Recaptcha3Type::class, [
-    'constraints' => new Recaptcha3(),
-    'action_name' => 'contact',
-]);
+$builder->add('captcha', CapType::class, [
+    'mode' => CapMode::Invisible,
+]);
```

`CapType` adds its constraint itself. `CapMode::Invisible` keeps the reCAPTCHA v3 experience, nothing to click; the
default checkbox mode shows Cap's widget instead.

| KarserRecaptcha3Bundle                       | Cap Bundle                                                        |
| -------------------------------------------- | ----------------------------------------------------------------- |
| `Recaptcha3Type`                             | `CapType`                                                         |
| `Recaptcha3` constraint                      | `Cap` constraint, added by `CapType`                              |
| `score_threshold`                            | The difficulty of the site key, in the Cap dashboard              |
| `action_name`                                | Not needed: one site key per form if you want separate stats      |
| `script_nonce_csp`                           | `csp_nonce`                                                       |
| `locale`                                     | `locale`, the request locale by default                           |
| `host` (`www.recaptcha.net`)                 | `widget.script`, to [self-host the widget](/guides/self-hosting/) |
| `Recaptcha3Validator::getLastResponse()`     | `CapValidator::getLastResult()`                                   |
| `karser_recaptcha3.google.recaptcha` service | `CapVerifierInterface`                                            |

## 4. Remove Google from your policies

Drop `www.google.com`, `www.gstatic.com` and `www.recaptcha.net` from your Content-Security-Policy (see
[what Cap needs](/guides/content-security-policy/)) and Google reCAPTCHA from your privacy policy and cookie banner.
