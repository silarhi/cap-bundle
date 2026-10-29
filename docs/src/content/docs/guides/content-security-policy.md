---
title: Content Security Policy
description: Run the Cap widget under a strict Content-Security-Policy with nonces.
sidebar:
    order: 6
---

The widget needs:

| Directive     | Sources                                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------- |
| `script-src`  | the script of the bundle, the origin of `widget.script` (`https://cdn.jsdelivr.net` by default), `'wasm-unsafe-eval'` |
| `worker-src`  | `blob:`: the solver runs in web workers                                                                               |
| `connect-src` | your Cap server (challenges), and the origin of the WebAssembly files (`https://cdn.jsdelivr.net` by default)         |
| `style-src`   | a nonce, or `'unsafe-inline'`: the widget injects a `<style>` in its shadow root                                      |

## Nonces

Pass the nonce of the request to the field, for instance the one of
[NelmioSecurityBundle](https://github.com/nelmio/NelmioSecurityBundle):

```twig
{{ form_row(form.captcha, { csp_nonce: csp_nonce('script') }) }}
```

or from the form type:

```php
$builder->add('captcha', CapType::class, ['csp_nonce' => $this->nonceGenerator->getNonce()]);
```

With [Symfony Reprise](/guides/javascript/#symfony-reprise-vite-rsbuild), put the nonce on the tags it renders with
its `RenderAssetTagEvent`, and still pass it to `CapType` for the widget.

The nonce goes on the `<script>` of the bundle, and to `window.CAP_CSS_NONCE` and `window.CAP_SCRIPT_NONCE`, which the
widget puts on the `<style>` and the scripts it injects: the decompression fallback, and the script of the sandboxed
`srcdoc` iframe that runs Cap's [instrumentation challenges](https://trycap.dev/guide/instrumentation). With Turbo Drive the policy of the first page stays in force
for the whole visit, so the bundle keeps the nonce of the first page it saw.
